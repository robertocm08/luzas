// Versión mínima de 'node:test' para el navegador. Solo sirve para tests/navegador.html.
export const resultados = [];
export function test(nombre, fn) {
  const r = { nombre, ok: true };
  r.promesa = Promise.resolve()
    .then(fn)
    .catch((error) => { r.ok = false; r.error = error; });
  resultados.push(r);
}
