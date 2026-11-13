// Pruebas de los cálculos de gasolineras.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  numeroES, compactarMinisterio, expandirEstaciones, distanciaKm, gasolinerasCerca,
  precioMedio, ahorroDeposito, ordenarGasolineras, analizarZona, normalizar, buscarMunicipio, listaMunicipios,
  nombreNatural,
} from '../js/calculos-gasolina.js';

const SOL = { lat: 40.41669, lon: -3.70358 };       // Puerta del Sol, Madrid
const BARCELONA = { lat: 41.38506, lon: 2.17340 };  // Plaza de Cataluña

// Crea una gasolinera de prueba a "km" kilómetros al norte de Sol.
function gasolinera(id, km, g95, extra = {}) {
  return {
    id, rotulo: `G${id}`, direccion: 'Calle', municipio: 'Madrid', provincia: 'MADRID',
    lat: SOL.lat + km / 111.2, lon: SOL.lon, horario: '24H',
    precios: { g95, g98: null, diesel: null, dieselPlus: null, glp: null }, ...extra,
  };
}

test('lee números con coma decimal del Ministerio', () => {
  assert.equal(numeroES('1,459'), 1.459);
  assert.equal(numeroES(''), null);
  assert.equal(numeroES(undefined), null);
});

test('compacta los datos del Ministerio y quita las de venta restringida', () => {
  const base = {
    'Rótulo': 'REPSOL', 'Dirección': 'C/ MAYOR, 1', 'Municipio': 'Ávila', 'Provincia': 'ÁVILA', 'Horario': 'L-D: 24H',
    'Latitud': '40,656685', 'Longitud (WGS84)': '-4,681208', 'Precio Gasolina 95 E5': '1,529', 'Precio Gasoleo A': '1,449',
  };
  const json = {
    Fecha: '13/11/2026 15:15:12',
    ListaEESSPrecio: [
      { ...base, IDEESS: '1', 'Tipo Venta': 'P' },
      { ...base, IDEESS: '2', 'Tipo Venta': 'R' },                                // solo socios → fuera
      { ...base, IDEESS: '3', 'Tipo Venta': 'P', 'Precio Gasolina 95 E5': '', 'Precio Gasoleo A': '' }, // sin precios → fuera
    ],
  };
  const c = compactarMinisterio(json);
  assert.equal(c.estaciones.length, 1);
  assert.equal(c.fechaMinisterio, '13/11/2026 15:15:12');
  const [e] = expandirEstaciones(c);
  assert.equal(e.id, '1');
  assert.equal(e.lat, 40.65669);
  assert.equal(e.precios.g95, 1.529);
  assert.equal(e.precios.diesel, 1.449);
  assert.equal(e.precios.g98, null);
});

test('distancia Madrid–Barcelona en línea recta ≈ 505 km', () => {
  const d = distanciaKm(SOL, BARCELONA);
  assert.ok(d > 500 && d < 510, `salió ${d}`);
  assert.equal(distanciaKm(SOL, SOL), 0);
});

test('solo cuenta gasolineras con precio para ese combustible y dentro del radio', () => {
  const lista = [gasolinera(1, 2, 1.5), gasolinera(2, 5, null), gasolinera(3, 8, 1.4), gasolinera(4, 9, 1.45), gasolinera(5, 30, 1.2)];
  const r = gasolinerasCerca(lista, SOL, 'g95', { minimo: 3 });
  assert.equal(r.radioKm, 10);
  assert.deepEqual(r.lista.map((e) => e.id).sort(), [1, 3, 4]);
});

test('amplía el radio si hay menos de 5 gasolineras cerca (zonas rurales)', () => {
  const lista = [gasolinera(1, 2, 1.5), gasolinera(2, 20, 1.4), gasolinera(3, 24, 1.45),
    gasolinera(4, 22, 1.5), gasolinera(5, 15, 1.5), gasolinera(6, 40, 1.3)];
  const r = gasolinerasCerca(lista, SOL, 'g95');
  assert.equal(r.radioKm, 25);
  assert.equal(r.lista.length, 5);
});

test('si ni a 50 km hay 5, devuelve las que haya', () => {
  const r = gasolinerasCerca([gasolinera(1, 30, 1.5), gasolinera(2, 80, 1.4)], SOL, 'g95');
  assert.equal(r.radioKm, 50);
  assert.equal(r.lista.length, 1);
});

test('el ahorro llenando el depósito es (media − precio) × litros', () => {
  assert.equal(ahorroDeposito(1.40, 1.50, 50), 5);
  assert.equal(ahorroDeposito(1.55, 1.50, 40), -2); // más cara que la media
  assert.equal(precioMedio([{ precio: 1.4 }, { precio: 1.6 }]), 1.5);
  assert.equal(precioMedio([]), null);
});

test('ordena por precio y, si empatan, por distancia', () => {
  const l = [
    { id: 'a', precio: 1.50, distancia: 1 },
    { id: 'b', precio: 1.40, distancia: 9 },
    { id: 'c', precio: 1.40, distancia: 3 },
  ];
  assert.deepEqual(ordenarGasolineras(l, 'precio').map((e) => e.id), ['c', 'b', 'a']);
  assert.deepEqual(ordenarGasolineras(l, 'distancia').map((e) => e.id), ['a', 'c', 'b']);
  assert.deepEqual(l.map((e) => e.id), ['a', 'b', 'c']); // no modifica la original
});

test('analizarZona calcula media, ahorro y orden de una vez', () => {
  const lista = [gasolinera(1, 1, 1.50), gasolinera(2, 2, 1.40), gasolinera(3, 3, 1.60)];
  const r = analizarZona(lista, SOL, 'g95', 50);
  assert.ok(Math.abs(r.media - 1.5) < 1e-9);
  assert.equal(r.lista[0].id, 2);
  assert.equal(r.lista[0].ahorro, 5);    // (1,50 − 1,40) × 50
  assert.equal(r.lista[2].ahorro, -5);
});

test('pone los nombres del Ministerio en orden natural', () => {
  assert.equal(nombreNatural('Adrada (La)'), 'La Adrada');
  assert.equal(nombreNatural('CORUÑA (A)'), 'A CORUÑA');
  assert.equal(nombreNatural('BALEARS (ILLES)'), 'ILLES BALEARS');
  assert.equal(nombreNatural("Hospitalet de Llobregat (L')"), "L'Hospitalet de Llobregat");
  assert.equal(nombreNatural('Ávila'), 'Ávila');
});

test('encuentra "La Adrada" aunque se escriba solo "adrada"', () => {
  const est = expandirEstaciones({ estaciones: [['1', 'X', 'C', 'Adrada (La)', 'ÁVILA', 40.3, -4.6, '24H', 1.5, null, null, null, null]] });
  assert.equal(est[0].municipio, 'La Adrada');
  assert.equal(buscarMunicipio(est, 'adrada').length, 1);
  assert.equal(buscarMunicipio(est, 'La Adrada · Ávila').length, 1);
});

test('normaliza tildes, mayúsculas y espacios', () => {
  assert.equal(normalizar('  Ávila   de  los Caballeros '), 'avila de los caballeros');
  assert.equal(normalizar('A CORUÑA'), 'a coruna');
});

test('busca municipios sin importar tildes y distingue provincias', () => {
  const est = [
    gasolinera(1, 0, 1.5, { municipio: 'Ávila', provincia: 'ÁVILA' }),
    gasolinera(2, 2, 1.5, { municipio: 'Ávila', provincia: 'ÁVILA' }),
    gasolinera(3, 0, 1.5, { municipio: 'Villanueva', provincia: 'CÓRDOBA' }),
    gasolinera(4, 0, 1.5, { municipio: 'Villanueva', provincia: 'ZARAGOZA' }),
  ];
  const avila = buscarMunicipio(est, 'avila');
  assert.equal(avila.length, 1);
  assert.equal(avila[0].municipio, 'Ávila');
  assert.ok(Math.abs(avila[0].centro.lat - (SOL.lat + 1 / 111.2)) < 1e-9); // punto medio de sus 2 gasolineras

  assert.equal(buscarMunicipio(est, 'Villanueva').length, 2);                 // ambiguo → elegir
  assert.equal(buscarMunicipio(est, 'Villanueva · Zaragoza').length, 1);       // del autocompletado
  assert.equal(buscarMunicipio(est, 'villan').length, 2);                      // empieza por…
  assert.deepEqual(buscarMunicipio(est, 'Atlantis'), []);
  assert.deepEqual(buscarMunicipio(est, '   '), []);
  assert.equal(listaMunicipios(est).length, 3);
});
