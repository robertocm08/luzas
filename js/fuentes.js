// =====================================================================
// fuentes.js — Direcciones de las APIs oficiales.
// Lo usan tanto la app (en el navegador) como el script de la GitHub Action,
// así si una dirección cambia solo hay que tocarla aquí.
// =====================================================================
import { fechaMadrid } from './calculos.js';

/** Suma días a una fecha 'AAAA-MM-DD' y devuelve otra 'AAAA-MM-DD'. */
export function sumarDias(fecha, dias) {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/**
 * Dirección de la API de Red Eléctrica para los precios PVPC de hoy y mañana.
 * Mañana solo aparece a partir de las ~20:15, cuando se publica.
 */
export function urlLuzREE(ahora = new Date()) {
  const hoy = fechaMadrid(ahora);
  const manana = sumarDias(hoy, 1);
  return 'https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real'
    + `?start_date=${hoy}T00:00&end_date=${manana}T23:59&time_trunc=hour`;
}
