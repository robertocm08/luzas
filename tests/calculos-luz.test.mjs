// Pruebas de los cálculos de la luz.
// Se ejecutan en GitHub con:  node --test tests/
// (y en tu ordenador abriendo tests/navegador.html con el servidor local).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leerRespuestaREE, clasificarHoras, buscarFranja, recomendarFranja,
  horasDesde, extremos, agruparPorDia, fechaMadrid,
} from '../js/calculos.js';

// Crea un día de prueba a partir de una lista de precios (€/kWh).
// La primera hora es el 13/11/2026 a las 00:00 en Madrid (23:00 UTC del día 12).
function dia(precios, inicioUTC = '2026-11-12T23:00:00.000Z') {
  const t0 = new Date(inicioUTC).getTime();
  return precios.map((precio, i) => ({ inicio: new Date(t0 + i * 3600_000).toISOString(), precio }));
}

test('lee la respuesta de REE y pasa €/MWh a €/kWh', () => {
  const json = {
    included: [
      { type: 'Precio mercado spot', attributes: { title: 'Spot', values: [{ value: 1, datetime: 'x' }] } },
      { type: 'PVPC', attributes: { title: 'PVPC', values: [
        { value: 150.62, datetime: '2026-11-13T01:00:00.000+01:00' },
        { value: 159.11, datetime: '2026-11-13T00:00:00.000+01:00' },
      ] } },
    ],
  };
  const horas = leerRespuestaREE(json);
  assert.equal(horas.length, 2);
  assert.equal(horas[0].precio, 0.15911); // ordenadas por hora
  assert.equal(horas[1].precio, 0.15062);
});

test('si REE no trae PVPC devuelve lista vacía', () => {
  assert.deepEqual(leerRespuestaREE({ included: [] }), []);
  assert.deepEqual(leerRespuestaREE(null), []);
});

test('la franja de 1 hora es la hora más barata', () => {
  const horas = dia([0.20, 0.10, 0.30, 0.05, 0.25]);
  const f = buscarFranja(horas, 1);
  assert.equal(f.precioMedio, 0.05);
  assert.equal(f.inicio, horas[3].inicio);
});

test('la franja de 3 horas busca horas SEGUIDAS, no las 3 más baratas sueltas', () => {
  // Las 3 más baratas sueltas serían 0.01, 0.02 y 0.03, pero no están juntas.
  const horas = dia([0.01, 0.50, 0.02, 0.50, 0.03, 0.50, 0.10, 0.10, 0.10]);
  const f = buscarFranja(horas, 3);
  assert.equal(f.inicio, horas[6].inicio);
  assert.equal(f.horas.length, 3);
  assert.ok(Math.abs(f.precioMedio - 0.10) < 1e-9);
  // El fin es una hora después del inicio de la última hora del bloque.
  assert.equal(new Date(f.fin) - new Date(f.inicio), 3 * 3600_000);
});

test('buscarFranja devuelve null si no caben las horas', () => {
  assert.equal(buscarFranja(dia([0.1, 0.2]), 3), null);
  assert.equal(buscarFranja([], 1), null);
});

test('calcula el ahorro frente a la peor franja', () => {
  const horas = dia([0.10, 0.10, 0.30, 0.30]);
  const r = recomendarFranja(horas, 2, { kwhPorHora: 1 });
  assert.equal(r.costeMejor, 0.2);   // 2 h × 0,10 € × 1 kWh
  assert.equal(r.costePeor, 0.6);    // 2 h × 0,30 € × 1 kWh
  assert.equal(r.ahorroEuros, 0.4);
  assert.equal(r.ahorroPorcentaje, 67);
});

test('el ahorro escala con el consumo del aparato', () => {
  const horas = dia([0.10, 0.30]);
  const r = recomendarFranja(horas, 1, { kwhPorHora: 2 });
  assert.equal(r.ahorroEuros, 0.4);
});

test('no recomienda horas que ya han pasado', () => {
  const horas = dia([0.01, 0.20, 0.30, 0.10, 0.40]);
  // Son las 02:30 en Madrid: la hora de 0.01 (00:00) ya pasó; la de 02:00 sigue en curso.
  const ahora = new Date(new Date(horas[2].inicio).getTime() + 30 * 60_000);
  assert.equal(horasDesde(horas, ahora).length, 3);
  const r = recomendarFranja(horas, 1, { desde: ahora });
  assert.equal(r.mejor.precioMedio, 0.10);
});

test('si ya no quedan suficientes horas hoy, devuelve null', () => {
  const horas = dia([0.1, 0.2, 0.3]);
  const casiAlFinal = new Date(new Date(horas[2].inicio).getTime() + 10 * 60_000);
  assert.equal(recomendarFranja(horas, 2, { desde: casiAlFinal }), null);
});

test('clasifica en barato, normal y caro por tercios', () => {
  const precios = [0.05, 0.06, 0.07, 0.10, 0.11, 0.12, 0.20, 0.21, 0.22];
  const niveles = clasificarHoras(dia(precios)).map((h) => h.nivel);
  assert.deepEqual(niveles, ['barato', 'barato', 'barato', 'normal', 'normal', 'normal', 'caro', 'caro', 'caro']);
});

test('un día de 24 horas tiene 8 baratas y 8 caras', () => {
  const precios = Array.from({ length: 24 }, (_, i) => 0.1 + i / 100);
  const c = clasificarHoras(dia(precios));
  assert.equal(c.filter((h) => h.nivel === 'barato').length, 8);
  assert.equal(c.filter((h) => h.nivel === 'caro').length, 8);
});

test('extremos encuentra mínimo, máximo y media', () => {
  const e = extremos(dia([0.2, 0.1, 0.3]));
  assert.equal(e.min.precio, 0.1);
  assert.equal(e.max.precio, 0.3);
  assert.ok(Math.abs(e.media - 0.2) < 1e-9);
});

test('agrupa por día de Madrid aunque el instante sea del día anterior en UTC', () => {
  const horas = dia(new Array(48).fill(0.1));
  const dias = agruparPorDia(horas);
  assert.deepEqual(Object.keys(dias), ['2026-11-13', '2026-11-14']);
  assert.equal(dias['2026-11-13'].length, 24);
  assert.equal(fechaMadrid('2026-11-12T23:00:00.000Z'), '2026-11-13');
});

test('funciona con el día del cambio de hora (23 horas)', () => {
  // 29/03/2026: en Madrid se pasa de las 02:00 a las 03:00; el día tiene 23 horas.
  const horas = dia(new Array(23).fill(0.2).map((p, i) => (i === 10 ? 0.05 : p)), '2026-03-28T23:00:00.000Z');
  assert.equal(agruparPorDia(horas)['2026-03-29'].length, 23);
  assert.equal(buscarFranja(horas, 1).precioMedio, 0.05);
});
