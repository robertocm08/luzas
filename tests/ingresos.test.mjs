// Pruebas de anuncios y ofertas de afiliado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ofertasValidas } from '../js/pagamenos.js';
import { modoAnuncios } from '../js/anuncios.js';

test('solo muestra ofertas completas y con enlace https', () => {
  const lista = [
    { titulo: 'Buena', url: 'https://ejemplo.es/afiliado?id=1' },
    { titulo: 'Sin enlace' },
    { titulo: 'Insegura', url: 'http://ejemplo.es' },
    { titulo: 'Peligrosa', url: 'javascript:alert(1)' },
    { url: 'https://ejemplo.es/sin-titulo' },
    null,
  ];
  assert.deepEqual(ofertasValidas(lista).map((o) => o.titulo), ['Buena']);
  assert.deepEqual(ofertasValidas(undefined), []);
});

test('sin activar en config no hay anuncios (ni aviso de cookies)', () => {
  assert.equal(modoAnuncios({ anuncios: { activo: false, proveedor: 'adsense' } }, ''), 'ninguno');
  assert.equal(modoAnuncios({ anuncios: { activo: true, proveedor: 'adsense' } }, ''), 'adsense');
  assert.equal(modoAnuncios({ anuncios: { activo: false } }, '?anuncios=demo'), 'demo');
});
