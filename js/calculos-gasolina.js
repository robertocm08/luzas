// =====================================================================
// calculos-gasolina.js — Las matemáticas de las gasolineras.
// Como calculos.js: sin pantalla, para poder probarlo automáticamente.
//
// Una gasolinera dentro de la app es así:
//   { id, rotulo, direccion, municipio, provincia, lat, lon, horario,
//     precios: { g95: 1.459, g98: null, diesel: 1.389, dieselPlus: null, glp: null } }
// =====================================================================

/** Combustibles que ofrece la app y su nombre en los datos del Ministerio. */
export const COMBUSTIBLES = {
  g95:        { nombre: 'Gasolina 95',     campo: 'Precio Gasolina 95 E5' },
  g98:        { nombre: 'Gasolina 98',     campo: 'Precio Gasolina 98 E5' },
  diesel:     { nombre: 'Diésel',          campo: 'Precio Gasoleo A' },
  dieselPlus: { nombre: 'Diésel Premium',  campo: 'Precio Gasoleo Premium' },
  glp:        { nombre: 'Autogás (GLP)',   campo: 'Precio Gases licuados del petróleo' },
};
const CLAVES = Object.keys(COMBUSTIBLES);

// ---- Preparar los datos del Ministerio ------------------------------------

/** "1,459" → 1.459 ; "" → null */
export function numeroES(texto) {
  if (texto === undefined || texto === null || String(texto).trim() === '') return null;
  const n = Number(String(texto).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Convierte la respuesta enorme del Ministerio (12 MB) en una versión pequeña:
 * solo las gasolineras abiertas al público, solo los datos que usamos y en
 * forma de "tabla" (listas en vez de objetos con nombres repetidos).
 */
export function compactarMinisterio(json) {
  const filas = [];
  for (const e of json?.ListaEESSPrecio ?? []) {
    // "R" = venta restringida (solo socios de una cooperativa, flotas...). No sirven al público.
    if (e['Tipo Venta'] === 'R') continue;
    const lat = numeroES(e['Latitud']);
    const lon = numeroES(e['Longitud (WGS84)']);
    if (lat === null || lon === null) continue;
    const precios = CLAVES.map((c) => numeroES(e[COMBUSTIBLES[c].campo]));
    if (precios.every((p) => p === null)) continue;
    filas.push([
      e['IDEESS'], e['Rótulo'], e['Dirección'], e['Municipio'], e['Provincia'],
      Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5, e['Horario'], ...precios,
    ]);
  }
  return {
    fechaMinisterio: json?.Fecha ?? null,
    campos: ['id', 'rotulo', 'direccion', 'municipio', 'provincia', 'lat', 'lon', 'horario', ...CLAVES],
    estaciones: filas,
  };
}

/**
 * El Ministerio escribe "Adrada (La)", "Coruña (A)", "Hospitalet de Llobregat (L')".
 * Lo pasamos al orden natural: "La Adrada", "A Coruña", "L'Hospitalet de Llobregat".
 */
export function nombreNatural(nombre) {
  const m = /^(.+?)\s*\(([^()]+)\)$/.exec(String(nombre ?? '').trim());
  if (!m) return String(nombre ?? '').trim();
  const articulo = m[2].trim();
  return articulo.endsWith("'") ? `${articulo}${m[1]}` : `${articulo} ${m[1]}`;
}

/** Pasa la "tabla" compacta a objetos cómodos de usar. */
export function expandirEstaciones(compacto) {
  return (compacto?.estaciones ?? []).map((f) => ({
    id: f[0], rotulo: f[1], direccion: f[2], municipio: nombreNatural(f[3]), provincia: nombreNatural(f[4]),
    lat: f[5], lon: f[6], horario: f[7],
    precios: Object.fromEntries(CLAVES.map((c, i) => [c, f[8 + i]])),
  }));
}

// ---- Distancias -------------------------------------------------------------

/**
 * Distancia en km entre dos puntos {lat, lon} "en línea recta" sobre la Tierra
 * (fórmula del semiverseno o "haversine"). Para elegir gasolinera es suficiente.
 */
export function distanciaKm(a, b) {
  const R = 6371; // radio medio de la Tierra en km
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---- Búsqueda ---------------------------------------------------------------

/**
 * Gasolineras con precio para ese combustible a menos de radioKm del punto.
 * Si hay menos de "minimo", amplía el radio (10 → 25 → 50 km) para no dejar
 * al usuario sin resultados en zonas rurales y que la "media" tenga sentido.
 * Devuelve { radioKm, lista } y cada gasolinera lleva su distancia y precio.
 */
export function gasolinerasCerca(estaciones, punto, combustible, { radios = [10, 25, 50], minimo = 5 } = {}) {
  const conPrecio = [];
  for (const e of estaciones) {
    const precio = e.precios[combustible];
    if (precio === null || precio === undefined) continue;
    conPrecio.push({ ...e, precio, distancia: distanciaKm(punto, e) });
  }
  let lista = [];
  let radioKm = radios[0];
  for (radioKm of radios) {
    lista = conPrecio.filter((e) => e.distancia <= radioKm);
    if (lista.length >= minimo) break;
  }
  return { radioKm, lista };
}

/** Precio medio de la zona (la lista de resultados). */
export function precioMedio(lista) {
  if (lista.length === 0) return null;
  return lista.reduce((s, e) => s + e.precio, 0) / lista.length;
}

/**
 * Cuánto ahorras llenando el depósito aquí frente a la media de la zona.
 * Positivo = ahorras; negativo = pagas más que la media.
 */
export function ahorroDeposito(precio, media, litros) {
  return Math.round((media - precio) * litros * 100) / 100;
}

/**
 * Ordena por 'precio' (y a igual precio, la más cercana) o por 'distancia'
 * (y a igual distancia, la más barata). No cambia la lista original.
 */
export function ordenarGasolineras(lista, criterio = 'precio') {
  const copia = [...lista];
  if (criterio === 'distancia') copia.sort((a, b) => a.distancia - b.distancia || a.precio - b.precio);
  else copia.sort((a, b) => a.precio - b.precio || a.distancia - b.distancia);
  return copia;
}

/** Junta todo: busca, calcula la media, añade el ahorro a cada una y ordena. */
export function analizarZona(estaciones, punto, combustible, litros, criterio = 'precio') {
  const { radioKm, lista } = gasolinerasCerca(estaciones, punto, combustible);
  const media = precioMedio(lista);
  const conAhorro = lista.map((e) => ({ ...e, ahorro: ahorroDeposito(e.precio, media, litros) }));
  return { radioKm, media, lista: ordenarGasolineras(conAhorro, criterio) };
}

// ---- Municipios -------------------------------------------------------------

/** "Ávila " → "avila" (sin tildes, minúsculas, sin espacios de sobra). */
export function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Lista de municipios distintos (con su provincia), para el autocompletado. */
export function listaMunicipios(estaciones) {
  const vistos = new Map();
  for (const e of estaciones) {
    const clave = `${e.municipio}|${e.provincia}`;
    if (!vistos.has(clave)) vistos.set(clave, { municipio: e.municipio, provincia: e.provincia });
  }
  return [...vistos.values()].sort((a, b) => a.municipio.localeCompare(b.municipio, 'es'));
}

/** Separador entre municipio y provincia en el autocompletado: "La Adrada · Ávila". */
export const SEPARADOR = ' · ';

/**
 * Busca un municipio escrito por el usuario. Admite "Ávila", "avila",
 * "Adrada" (encuentra "La Adrada") o "La Adrada · Ávila" (como sale en el autocompletado).
 * Devuelve una lista de coincidencias { municipio, provincia, centro }:
 *   - vacía si no existe,
 *   - con varias si el nombre se repite en distintas provincias.
 * El "centro" es el punto medio de sus gasolineras.
 */
export function buscarMunicipio(estaciones, texto) {
  const [parteNombre, parteProvincia] = String(texto ?? '').split(SEPARADOR.trim());
  const nombre = normalizar(parteNombre);
  const provincia = parteProvincia ? normalizar(parteProvincia) : null;
  if (!nombre) return [];

  const grupos = new Map();
  const agrupar = (filtro) => {
    for (const e of estaciones) {
      if (!filtro(normalizar(e.municipio))) continue;
      if (provincia && normalizar(e.provincia) !== provincia) continue;
      const clave = `${e.municipio}|${e.provincia}`;
      const g = grupos.get(clave) ?? { municipio: e.municipio, provincia: e.provincia, lat: 0, lon: 0, n: 0 };
      g.lat += e.lat; g.lon += e.lon; g.n++;
      grupos.set(clave, g);
    }
  };
  agrupar((n) => n === nombre);                                    // 1º nombre exacto
  if (grupos.size === 0) agrupar((n) => n.startsWith(nombre));     // 2º que empiece igual
  if (grupos.size === 0) agrupar((n) => n.includes(` ${nombre}`)); // 3º "adrada" → "la adrada"
  return [...grupos.values()].map((g) => ({
    municipio: g.municipio, provincia: g.provincia, centro: { lat: g.lat / g.n, lon: g.lon / g.n },
  }));
}
