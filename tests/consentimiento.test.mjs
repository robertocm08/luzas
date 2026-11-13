// Pruebas del consentimiento de cookies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoConsentimiento, crearRegistro, VERSION_CONSENTIMIENTO } from '../js/consentimiento.js';

const HOY = new Date('2026-11-13T12:00:00Z');
const hace = (dias) => new Date(HOY.getTime() - dias * 86_400_000);

test('sin decisión guardada hay que preguntar', () => {
  assert.equal(estadoConsentimiento(null, HOY), 'pendiente');
  assert.equal(estadoConsentimiento(undefined, HOY), 'pendiente');
  assert.equal(estadoConsentimiento('basura', HOY), 'pendiente');
});

test('recuerda si aceptó o rechazó', () => {
  assert.equal(estadoConsentimiento(crearRegistro('aceptado', hace(10)), HOY), 'aceptado');
  assert.equal(estadoConsentimiento(crearRegistro('rechazado', hace(10)), HOY), 'rechazado');
});

test('la decisión caduca a los 12 meses', () => {
  assert.equal(estadoConsentimiento(crearRegistro('aceptado', hace(364)), HOY), 'aceptado');
  assert.equal(estadoConsentimiento(crearRegistro('aceptado', hace(366)), HOY), 'pendiente');
});

test('si cambia la versión de la política, se vuelve a preguntar', () => {
  const viejo = { ...crearRegistro('aceptado', hace(1)), version: VERSION_CONSENTIMIENTO - 1 };
  assert.equal(estadoConsentimiento(viejo, HOY), 'pendiente');
});

test('datos raros (fecha futura, decisión desconocida) → preguntar', () => {
  assert.equal(estadoConsentimiento(crearRegistro('aceptado', new Date('2030-01-01')), HOY), 'pendiente');
  assert.equal(estadoConsentimiento({ ...crearRegistro('aceptado', hace(1)), decision: 'quizás' }, HOY), 'pendiente');
  assert.equal(estadoConsentimiento({ ...crearRegistro('aceptado', hace(1)), fecha: 'ayer' }, HOY), 'pendiente');
});
