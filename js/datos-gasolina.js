// =====================================================================
// datos-gasolina.js — Consigue la lista de gasolineras:
//   1. El archivo data/gasolineras.json que prepara la GitHub Action
//      (1,5 MB, unos 400 KB comprimido). Sin conexión, el service worker
//      entrega la última copia descargada.
//   2. Si no existe, la descarga directamente del Ministerio (12 MB, lento).
//
// También guarda las preferencias del usuario (combustible, depósito y
// municipio). La ubicación GPS NUNCA se guarda.
// =====================================================================
import { compactarMinisterio, expandirEstaciones, listaMunicipios } from './calculos-gasolina.js';
import { URL_GASOLINERAS } from './fuentes.js';

let promesa = null; // así Inicio y Gasolina comparten una sola descarga

export function cargarGasolineras({ forzar = false } = {}) {
  if (!promesa || forzar) promesa = descargar().catch((e) => { promesa = null; throw e; });
  return promesa;
}

async function descargar() {
  let compacto;
  let origen = 'archivo';
  try {
    const r = await fetch('data/gasolineras.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    compacto = await r.json();
  } catch {
    origen = 'ministerio';
    const r = await fetch(URL_GASOLINERAS, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`Ministerio ${r.status}`);
    compacto = { ...compactarMinisterio(await r.json()), actualizado: new Date().toISOString() };
  }
  const estaciones = expandirEstaciones(compacto);
  return {
    estaciones,
    municipios: listaMunicipios(estaciones),
    fechaMinisterio: compacto.fechaMinisterio,
    actualizado: compacto.actualizado,
    origen,
  };
}

// ---- Preferencias (solo en este móvil) -------------------------------------
const CLAVE = 'gasolina-preferencias';
const POR_DEFECTO = { combustible: 'g95', litros: 50, municipio: '' };

export function leerPreferencias() {
  try { return { ...POR_DEFECTO, ...JSON.parse(localStorage.getItem(CLAVE)) }; } catch { return { ...POR_DEFECTO }; }
}
export function guardarPreferencias(cambios) {
  const nuevas = { ...leerPreferencias(), ...cambios };
  try { localStorage.setItem(CLAVE, JSON.stringify(nuevas)); } catch { /* sin memoria, no pasa nada */ }
  return nuevas;
}

// ---- Ubicación ---------------------------------------------------------------
/**
 * Pide la posición al móvil. Solo se usa en memoria para calcular distancias:
 * no se guarda en ningún sitio ni se envía a ningún servidor.
 */
export function pedirUbicacion() {
  return new Promise((resolver, rechazar) => {
    if (!('geolocation' in navigator)) { rechazar(new Error('Este navegador no permite usar la ubicación.')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => rechazar(new Error(e.code === 1
        ? 'No has dado permiso para usar tu ubicación. Puedes escribir tu municipio.'
        : 'No hemos podido saber dónde estás. Prueba a escribir tu municipio.')),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 },
    );
  });
}

/** ¿Ya dio permiso de ubicación antes? (para no molestar con la pregunta al abrir la app) */
export async function ubicacionPermitida() {
  try { return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted'; } catch { return false; }
}
