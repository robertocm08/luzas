// =====================================================================
// formato.js — Cómo se escriben números y horas en pantalla (a la española).
// =====================================================================

const euros3 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const euros2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

/** 0.15911 → "0,159 €/kWh" */
export const precioKwh = (p) => `${euros3.format(p)} €/kWh`;

/** 0.15911 → "0,159" (para mostrar la cifra grande y la unidad aparte) */
export const numero3 = (p) => euros3.format(p);

/** 0.4 → "0,40 €" (cantidades pequeñas: muestra céntimos si hace falta) */
export const euros = (e) => euros2.format(e);

/** Hora local del móvil: "14:00". Funciona también en Canarias (una hora menos). */
export const hora = (iso) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

/** "de 14:00 a 16:00" */
export const franja = (inicio, fin) => `de ${hora(inicio)} a ${hora(fin)}`;

/** "viernes, 13 de noviembre" */
export const fechaLarga = (iso) => {
  const t = new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1); // "Viernes, 13 de noviembre"
};

/** 1.459 → "1,459 €/L" */
export const precioLitro = (p) => `${euros3.format(p)} €/L`;

/** 2.345 → "2,3 km" ; 0.45 → "450 m" */
export const distancia = (km) =>
  km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km.toLocaleString('es-ES', { maximumFractionDigits: 1 })} km`;

/**
 * El Ministerio escribe todo en MAYÚSCULAS. Lo pasamos a un formato más fácil de leer:
 * "AVENIDA DE LA CONSTITUCIÓN, 26" → "Avenida de la Constitución, 26"
 */
const PEQUENAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'a', 'en']);
export function capitalizar(texto) {
  return String(texto ?? '').toLowerCase().replace(/[\p{L}\d]+/gu, (palabra, posicion) =>
    posicion > 0 && PEQUENAS.has(palabra) ? palabra : palabra.charAt(0).toUpperCase() + palabra.slice(1));
}

/** Icono del juego de iconos de index.html: icono('rayo') → <svg>…</svg> */
export const icono = (nombre, clase = '') =>
  `<svg class="icono ${clase}" aria-hidden="true"><use href="#i-${nombre}"/></svg>`;

/** Bloques grises animados mientras algo carga. altos = [24, 48, 20] (en px) */
export const esqueleto = (altos = [24, 48, 20]) =>
  altos.map((h, i) => `<span class="esqueleto" style="height:${h}px;${i === 0 ? 'width:45%' : ''}"></span>`).join('');

/** Evita que un texto que venga de fuera se interprete como HTML. */
export function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
