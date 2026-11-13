// =====================================================================
// consentimiento.js — Aviso de cookies conforme al RGPD y a la guía de la AEPD.
//
// Reglas que cumplimos:
//   - Nada de anuncios ni cookies de terceros hasta que el usuario ACEPTE.
//   - "Rechazar" es tan fácil y visible como "Aceptar" (mismo tamaño, misma pantalla).
//   - La decisión se puede cambiar en cualquier momento (página de privacidad).
//   - La decisión caduca a los 12 meses y se vuelve a preguntar.
//   - Si cambiamos lo que hacemos con los datos (VERSION), se vuelve a preguntar.
//   - Si no hay anuncios activos, no hay cookies y no se muestra ningún aviso.
//
// Nota: guardar la decisión en el propio móvil (localStorage) está permitido
// sin pedir permiso, porque es imprescindible para recordar lo que se eligió.
// =====================================================================

export const VERSION_CONSENTIMIENTO = 1;
export const VALIDEZ_DIAS = 365;
const CLAVE = 'consentimiento-cookies';

/**
 * Decide en qué situación estamos a partir de lo guardado.
 * Función pura (sin pantalla) → se prueba en tests/consentimiento.test.mjs
 * Devuelve 'aceptado', 'rechazado' o 'pendiente' (hay que preguntar).
 */
export function estadoConsentimiento(guardado, ahora = new Date(), version = VERSION_CONSENTIMIENTO) {
  if (!guardado || typeof guardado !== 'object') return 'pendiente';
  if (guardado.version !== version) return 'pendiente';
  const fecha = new Date(guardado.fecha);
  if (Number.isNaN(fecha.getTime())) return 'pendiente';
  const dias = (ahora - fecha) / 86_400_000;
  if (dias < 0 || dias > VALIDEZ_DIAS) return 'pendiente';
  if (guardado.decision === 'aceptado' || guardado.decision === 'rechazado') return guardado.decision;
  return 'pendiente';
}

export function crearRegistro(decision, ahora = new Date()) {
  return { decision, fecha: ahora.toISOString(), version: VERSION_CONSENTIMIENTO };
}

// ---- Lectura y escritura en el móvil ----------------------------------------
export function leerConsentimiento() {
  try { return estadoConsentimiento(JSON.parse(localStorage.getItem(CLAVE))); } catch { return 'pendiente'; }
}

function guardar(decision) {
  try { localStorage.setItem(CLAVE, JSON.stringify(crearRegistro(decision))); } catch { /* modo privado */ }
  window.dispatchEvent(new CustomEvent('consentimiento', { detail: decision }));
}

/** Borra la decisión (desde la página de privacidad) para volver a preguntar. */
export function olvidarConsentimiento() {
  try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
}

// ---- El aviso en pantalla -----------------------------------------------------
/**
 * Muestra el aviso si hace falta. "alAceptar" se llama cuando hay permiso
 * (en ese momento o porque ya lo había dado antes).
 */
export function pedirConsentimiento({ alAceptar }) {
  const estado = leerConsentimiento();
  if (estado === 'aceptado') { alAceptar(); return; }
  if (estado === 'rechazado') return;

  const aviso = document.createElement('section');
  aviso.className = 'aviso-cookies';
  aviso.setAttribute('role', 'dialog');
  aviso.setAttribute('aria-labelledby', 'aviso-cookies-titulo');
  aviso.innerHTML = `
    <h2 id="aviso-cookies-titulo">¿Nos ayudas con publicidad?</h2>
    <p>Esta app es gratis gracias a los anuncios. Para mostrarlos, Google y sus socios usan cookies que
       pueden recordar tus visitas. <strong>Solo los cargaremos si aceptas.</strong> Si rechazas, la app
       funciona exactamente igual, sin anuncios.</p>
    <div class="aviso-cookies-botones">
      <button type="button" class="boton" data-decision="aceptado">Aceptar</button>
      <button type="button" class="boton" data-decision="rechazado">Rechazar</button>
    </div>
    <p class="nota"><a href="privacidad.html${location.search}">Más información</a></p>`;
  document.body.append(aviso);
  document.body.classList.add('con-aviso-cookies');

  aviso.querySelectorAll('[data-decision]').forEach((b) => b.addEventListener('click', () => {
    guardar(b.dataset.decision);
    aviso.remove();
    document.body.classList.remove('con-aviso-cookies');
    if (b.dataset.decision === 'aceptado') alAceptar();
  }));
  aviso.querySelector('[data-decision="aceptado"]').focus({ preventScroll: true });
}
