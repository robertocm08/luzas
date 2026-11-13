// =====================================================================
// datos-luz.js — Consigue los precios de la luz, por este orden:
//   1. El archivo data/luz.json que prepara la GitHub Action cada hora.
//   2. Si falta, es viejo o no tiene mañana (y ya debería), pregunta
//      directamente a Red Eléctrica (su API permite llamarla desde el navegador).
//   3. Si no hay Internet, usa la última copia guardada en el móvil.
// =====================================================================
import { leerRespuestaREE, agruparPorDia, fechaMadrid } from './calculos.js';
import { urlLuzREE, sumarDias } from './fuentes.js';

const CLAVE_COPIA = 'luz-ultima-copia';

export async function cargarLuz(ahora = new Date()) {
  const hoy = fechaMadrid(ahora);
  const manana = sumarDias(hoy, 1);
  const debeHaberManana = horaMadrid(ahora) >= 20.5; // a partir de las 20:30

  const completo = (horas) => {
    const dias = agruparPorDia(horas);
    return dias[hoy]?.length >= 23 && (!debeHaberManana || dias[manana]?.length >= 23);
  };

  // 1. Archivo propio (rápido y no depende de que REE responda).
  let datos = await intentar(async () => {
    const r = await fetch('data/luz.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    return { horas: j.horas, actualizado: j.actualizado, origen: 'archivo' };
  });

  // 2. Directo a Red Eléctrica si el archivo no sirve.
  if (!datos || !completo(datos.horas)) {
    const directo = await intentar(async () => {
      const r = await fetch(urlLuzREE(ahora));
      if (!r.ok) throw new Error(r.status);
      return { horas: leerRespuestaREE(await r.json()), actualizado: new Date().toISOString(), origen: 'ree' };
    });
    if (directo && directo.horas.length > 0) datos = directo;
  }

  // 3. Copia guardada si no hay conexión.
  if (datos && datos.horas.length > 0) {
    guardarCopia(datos);
  } else {
    datos = leerCopia();
    if (datos) datos.origen = 'copia';
  }
  return organizar(datos, ahora);
}

/** Los últimos precios guardados en el móvil, para enseñarlos al instante al abrir. */
export function copiaLuz(ahora = new Date()) {
  const datos = leerCopia();
  return datos ? organizar({ ...datos, origen: 'copia' }, ahora) : null;
}

function organizar(datos, ahora) {
  if (!datos) return null;
  const hoy = fechaMadrid(ahora);
  const manana = sumarDias(hoy, 1);
  const dias = agruparPorDia(datos.horas);
  return {
    hoy: dias[hoy] ?? [],
    manana: dias[manana] ?? [],
    actualizado: datos.actualizado,
    origen: datos.origen,
    sinConexion: datos.origen === 'copia',
  };
}

function horaMadrid(fecha) {
  const [h, m] = fecha.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour12: false }).split(':').map(Number);
  return h + m / 60;
}

async function intentar(fn) {
  try { return await fn(); } catch { return null; }
}

// localStorage puede fallar (modo privado, almacenamiento lleno): por eso try/catch.
function guardarCopia(datos) {
  try { localStorage.setItem(CLAVE_COPIA, JSON.stringify(datos)); } catch { /* sin copia, no pasa nada */ }
}
function leerCopia() {
  try { return JSON.parse(localStorage.getItem(CLAVE_COPIA)); } catch { return null; }
}
