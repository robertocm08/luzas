// =====================================================================
// calculos.js — Las matemáticas de la app.
//
// Aquí NO hay nada de pantalla: solo funciones que reciben datos y
// devuelven resultados. Así se pueden probar automáticamente (ver la
// carpeta tests/) sin abrir el navegador.
//
// Formato de una "hora" de luz en toda la app:
//   { inicio: "2026-11-13T20:00:00.000+01:00", precio: 0.2498 }
//   - inicio: cuándo empieza esa hora (texto en formato ISO).
//   - precio: euros por kWh.
// =====================================================================

/**
 * Convierte la respuesta de la API de Red Eléctrica en nuestro formato.
 * REE da los precios en €/MWh; los pasamos a €/kWh (dividiendo entre 1000),
 * que es la unidad que aparece en la factura.
 */
export function leerRespuestaREE(json) {
  const bloques = json?.included ?? [];
  const pvpc = bloques.find((b) => b.type === 'PVPC' || b.attributes?.title === 'PVPC');
  if (!pvpc) return [];
  return pvpc.attributes.values
    .map((v) => ({ inicio: v.datetime, precio: redondear(v.value / 1000, 5) }))
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
}

/**
 * Pone una etiqueta a cada hora: 'barato', 'normal' o 'caro'.
 * Regla sencilla y fácil de explicar: ordenamos las horas del día por precio;
 * el tercio más barato es "barato", el tercio más caro es "caro".
 * Devuelve las mismas horas con un campo nuevo: nivel.
 */
export function clasificarHoras(horas) {
  if (horas.length === 0) return [];
  const ordenadas = [...horas].map((h) => h.precio).sort((a, b) => a - b);
  const tercio = Math.floor(ordenadas.length / 3);
  // Límite de lo barato: el precio más alto del tercio barato.
  const limiteBarato = ordenadas[Math.max(tercio - 1, 0)];
  // Límite de lo caro: el precio más bajo del tercio caro.
  const limiteCaro = ordenadas[ordenadas.length - tercio];
  return horas.map((h) => {
    let nivel = 'normal';
    if (h.precio <= limiteBarato) nivel = 'barato';
    else if (h.precio >= limiteCaro) nivel = 'caro';
    return { ...h, nivel };
  });
}

/**
 * Busca el bloque de N horas seguidas con el precio medio más bajo
 * (o más alto, si buscarMasCaro = true).
 *
 * Técnica de "ventana deslizante": imaginamos una ventana de N horas que se
 * mueve de hora en hora por el día y nos quedamos con la mejor posición.
 *
 * Devuelve { inicio, fin, horas, precioMedio } o null si no caben N horas.
 */
export function buscarFranja(horas, duracion, buscarMasCaro = false) {
  if (duracion < 1 || horas.length < duracion) return null;
  let mejor = null;
  for (let i = 0; i + duracion <= horas.length; i++) {
    const ventana = horas.slice(i, i + duracion);
    const media = ventana.reduce((suma, h) => suma + h.precio, 0) / duracion;
    const esMejor = mejor === null || (buscarMasCaro ? media > mejor.precioMedio : media < mejor.precioMedio);
    if (esMejor) {
      mejor = {
        inicio: ventana[0].inicio,
        fin: sumarUnaHora(ventana[duracion - 1].inicio),
        horas: ventana,
        precioMedio: media,
      };
    }
  }
  return mejor;
}

/**
 * Responde a "¿cuándo pongo la lavadora?".
 *
 * - horas: precios del día.
 * - duracion: cuántas horas dura el aparato (1, 2, 3...).
 * - desde: (opcional) solo cuenta las horas que aún no han empezado, para
 *   no recomendar una hora que ya ha pasado. Se incluye la hora en curso.
 * - kwhPorHora: cuánta energía gasta el aparato en una hora (1 kWh por defecto,
 *   parecido a una lavadora o un lavavajillas).
 *
 * Devuelve la mejor franja, la peor y cuánto se ahorra entre una y otra.
 */
export function recomendarFranja(horas, duracion, { desde = null, kwhPorHora = 1 } = {}) {
  const disponibles = desde ? horasDesde(horas, desde) : horas;
  const mejor = buscarFranja(disponibles, duracion, false);
  const peor = buscarFranja(disponibles, duracion, true);
  if (!mejor || !peor) return null;
  const costeMejor = mejor.precioMedio * duracion * kwhPorHora;
  const costePeor = peor.precioMedio * duracion * kwhPorHora;
  const ahorroEuros = costePeor - costeMejor;
  const ahorroPorcentaje = costePeor > 0 ? (ahorroEuros / costePeor) * 100 : 0;
  return {
    duracion,
    mejor,
    peor,
    costeMejor: redondear(costeMejor, 4),
    costePeor: redondear(costePeor, 4),
    ahorroEuros: redondear(ahorroEuros, 4),
    ahorroPorcentaje: Math.round(ahorroPorcentaje),
  };
}

/** Las horas que todavía no han terminado en el momento "desde". */
export function horasDesde(horas, desde) {
  const ahora = new Date(desde).getTime();
  return horas.filter((h) => new Date(sumarUnaHora(h.inicio)).getTime() > ahora);
}

/** Hora más barata y más cara de una lista (útil para el resumen). */
export function extremos(horas) {
  if (horas.length === 0) return null;
  let min = horas[0];
  let max = horas[0];
  for (const h of horas) {
    if (h.precio < min.precio) min = h;
    if (h.precio > max.precio) max = h;
  }
  const media = horas.reduce((s, h) => s + h.precio, 0) / horas.length;
  return { min, max, media };
}

/** Separa una lista de horas en días (fecha de calendario en Madrid). */
export function agruparPorDia(horas) {
  const dias = {};
  for (const h of horas) {
    const dia = fechaMadrid(h.inicio);
    (dias[dia] ??= []).push(h);
  }
  return dias;
}

/** Fecha "AAAA-MM-DD" de un momento, según la hora oficial de Madrid. */
export function fechaMadrid(momento) {
  // 'sv-SE' es un truco habitual: ese idioma escribe las fechas como 2026-11-13.
  return new Date(momento).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

/** Devuelve el mismo instante más una hora, como texto ISO. */
export function sumarUnaHora(inicio) {
  return new Date(new Date(inicio).getTime() + 3600_000).toISOString();
}

export function redondear(numero, decimales = 2) {
  const f = 10 ** decimales;
  return Math.round(numero * f) / f;
}
