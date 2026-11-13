// Versión mínima de 'node:assert/strict' para el navegador.
function fallo(mensaje) { throw new Error(mensaje); }
const assert = {
  equal(a, b, m) { if (!Object.is(a, b)) fallo(m ?? `Esperaba ${JSON.stringify(b)} y salió ${JSON.stringify(a)}`); },
  deepEqual(a, b, m) {
    const ja = JSON.stringify(a), jb = JSON.stringify(b);
    if (ja !== jb) fallo(m ?? `Esperaba ${jb} y salió ${ja}`);
  },
  ok(v, m) { if (!v) fallo(m ?? 'Se esperaba un valor verdadero'); },
};
export default assert;
