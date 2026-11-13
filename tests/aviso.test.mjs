// Pruebas del archivo de calendario (.ics) del aviso de la luz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearICS } from '../js/aviso.js';

test('el aviso de calendario tiene la hora en UTC y una alarma 15 minutos antes', () => {
  const ics = crearICS({
    inicio: '2026-11-14T03:00:00.000+01:00',
    fin: '2026-11-14T05:00:00.000+01:00',
    titulo: 'Luz barata',
    descripcion: 'Pon la lavadora',
    ahora: new Date('2026-11-13T12:00:00Z'),
  });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('DTSTART:20261114T020000Z')); // 03:00 en Madrid = 02:00 UTC
  assert.ok(ics.includes('DTEND:20261114T040000Z'));
  assert.ok(ics.includes('TRIGGER:-PT15M'));
  assert.ok(ics.includes('\r\n')); // el formato exige saltos de línea CRLF
});

test('escapa comas y punto y coma del texto', () => {
  const ics = crearICS({ inicio: '2026-11-14T02:00:00Z', fin: '2026-11-14T03:00:00Z', titulo: 'Hola, luz; barata', descripcion: 'x' });
  assert.ok(ics.includes('SUMMARY:Hola\\, luz\\; barata'));
});
