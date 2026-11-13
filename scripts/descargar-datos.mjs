// =====================================================================
// descargar-datos.mjs — Lo ejecuta la GitHub Action cada hora.
//
// Descarga los datos oficiales, los deja pequeños y ordenados, y los guarda
// en la carpeta data/ para que se publiquen junto a la app.
//
// Si una API falla, NO dejamos la app sin datos: recuperamos el archivo que
// ya estaba publicado (SITE_URL es la dirección de la app en GitHub Pages).
//
// Uso:  node scripts/descargar-datos.mjs
// =====================================================================
import { mkdir, writeFile } from 'node:fs/promises';
import { leerRespuestaREE } from '../js/calculos.js';
import { urlLuzREE, URL_GASOLINERAS } from '../js/fuentes.js';
import { compactarMinisterio } from '../js/calculos-gasolina.js';

const CARPETA = new URL('../data/', import.meta.url);
const SITE_URL = process.env.SITE_URL ?? '';
const CABECERAS = { 'User-Agent': 'Mozilla/5.0 (compatible; luzas-datos/1.0)', Accept: 'application/json' };

async function pedirJSON(url, segundos = 60) {
  const r = await fetch(url, { headers: CABECERAS, signal: AbortSignal.timeout(segundos * 1000) });
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
  return r.json();
}

// ---- Luz ------------------------------------------------------------------
async function descargarLuz() {
  const horas = leerRespuestaREE(await pedirJSON(urlLuzREE()));
  if (horas.length < 23) throw new Error(`REE devolvió solo ${horas.length} horas`);
  return {
    actualizado: new Date().toISOString(),
    fuente: 'Red Eléctrica de España (apidatos.ree.es) · PVPC 2.0TD',
    unidad: '€/kWh',
    horas,
  };
}

// ---- Gasolineras ------------------------------------------------------------
async function descargarGasolineras() {
  const compacto = compactarMinisterio(await pedirJSON(URL_GASOLINERAS, 120));
  if (compacto.estaciones.length < 5000) throw new Error(`solo ${compacto.estaciones.length} gasolineras`);
  return {
    actualizado: new Date().toISOString(),
    fuente: 'Ministerio para la Transición Ecológica (sedeaplicaciones.minetur.gob.es)',
    unidad: '€/litro',
    ...compacto,
  };
}

// ---- Utilidad: descarga con plan B ------------------------------------------
async function guardar(nombre, descargar) {
  let datos;
  try {
    datos = await descargar();
    console.log(`✔ ${nombre}: descargado`);
  } catch (error) {
    console.warn(`⚠ ${nombre}: fallo al descargar (${error.message}). Intento recuperar la copia publicada…`);
    if (!SITE_URL) throw error;
    datos = await pedirJSON(new URL(`data/${nombre}`, SITE_URL).href);
    console.log(`✔ ${nombre}: se mantiene la copia publicada anterior`);
  }
  await writeFile(new URL(nombre, CARPETA), JSON.stringify(datos));
}

await mkdir(CARPETA, { recursive: true });
const tareas = [['luz.json', descargarLuz], ['gasolineras.json', descargarGasolineras]];
let fallos = 0;
for (const [nombre, fn] of tareas) {
  try { await guardar(nombre, fn); } catch (e) { fallos++; console.error(`✘ ${nombre}: ${e.message}`); }
}
// Si falla una fuente, se publica igualmente la otra (la app sabe arreglárselas).
// Solo si fallan TODAS, la Action termina en error y GitHub te avisa por correo.
if (fallos === tareas.length) process.exitCode = 1;
