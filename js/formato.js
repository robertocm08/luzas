// =====================================================================
// formato.js — Cómo se escriben números y horas en pantalla (a la española).
// =====================================================================

const euros3 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const euros2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

/** 0.15911 → "0,159 €/kWh" */
export const precioKwh = (p) => `${euros3.format(p)} €/kWh`;

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

/** Evita que un texto que venga de fuera se interprete como HTML. */
export function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
