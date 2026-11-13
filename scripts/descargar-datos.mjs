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
import { urlLuzREE } from '../js/fuentes.js';

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
let fallos = 0;
for (const [nombre, fn] of [['luz.json', descargarLuz]]) {
  try { await guardar(nombre, fn); } catch (e) { fallos++; console.error(`✘ ${nombre}: ${e.message}`); }
}
// Si no hay ningún dato, que la Action falle y GitHub nos avise por correo.
if (fallos > 0) process.exitCode = 1;
