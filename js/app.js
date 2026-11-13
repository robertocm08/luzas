// =====================================================================
// app.js — El "director de orquesta". Se ejecuta al abrir la app y:
//   1. Gestiona las pestañas de abajo (Inicio, Luz, Gasolina, Paga menos).
//   2. Gestiona el modo claro / oscuro.
//   3. Carga los datos y pide a cada pantalla que se dibuje.
//   4. Activa el "service worker" (lo que permite usarla sin conexión).
// =====================================================================
import { cargarLuz, copiaLuz } from './datos-luz.js';
import { pintarLuz, resumenLuz, prepararDialogoAviso } from './luz.js';
import { hora, escapar } from './formato.js';

// ---- 1. Pestañas -----------------------------------------------------------
// Usamos la parte de la dirección tras la "#" (#luz, #gasolina...). Así el botón
// "atrás" del móvil funciona y se puede guardar un enlace directo a cada pantalla.
const VISTAS = ['inicio', 'luz', 'gasolina', 'pagamenos'];

function mostrarVista() {
  const actual = VISTAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'inicio';
  for (const v of VISTAS) {
    document.getElementById(`vista-${v}`).hidden = v !== actual;
    document.querySelector(`[data-ir="${v}"]`)?.setAttribute('aria-current', v === actual ? 'page' : 'false');
  }
  document.getElementById('principal').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', mostrarVista);

// ---- 2. Modo oscuro --------------------------------------------------------
// Por defecto sigue al móvil. Si el usuario pulsa el botón, recordamos su elección.
function aplicarTema(tema) {
  if (tema) document.documentElement.dataset.theme = tema;
  else delete document.documentElement.dataset.theme;
  const oscuro = tema ? tema === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const boton = document.getElementById('boton-tema');
  boton.textContent = oscuro ? '☀️ Claro' : '🌙 Oscuro';
  boton.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}
function leerPreferencia(clave) { try { return localStorage.getItem(clave); } catch { return null; } }
function guardarPreferencia(clave, valor) { try { localStorage.setItem(clave, valor); } catch { /* da igual */ } }

document.getElementById('boton-tema').addEventListener('click', () => {
  const oscuroAhora = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const nuevo = oscuroAhora ? 'light' : 'dark';
  guardarPreferencia('tema', nuevo);
  aplicarTema(nuevo);
});

// ---- 3. Datos y pantallas ---------------------------------------------------
async function cargarTodo() {
  const vistaLuz = document.getElementById('contenido-luz');
  // Primero, al instante, lo último que guardamos (si es de hoy); luego, lo nuevo.
  const copia = copiaLuz();
  if (copia?.hoy.length) { pintarLuz(copia, vistaLuz); pintarInicio(copia); }
  const luz = await cargarLuz();
  if (!luz) {
    vistaLuz.innerHTML = `<div class="tarjeta aviso-error"><p class="grande">No hemos podido cargar los precios.</p>
      <p>Comprueba tu conexión a Internet y vuelve a intentarlo.</p>
      <button class="boton" onclick="location.reload()">Reintentar</button></div>`;
  } else {
    pintarLuz(luz, vistaLuz);
    pintarEstadoDatos(luz);
  }
  pintarInicio(luz);
}

function pintarEstadoDatos(luz) {
  const txt = luz.sinConexion
    ? `Sin conexión: mostrando los últimos datos guardados (${hora(luz.actualizado)}).`
    : `Datos de Red Eléctrica de España · actualizados a las ${hora(luz.actualizado)}`;
  document.getElementById('estado-luz').textContent = txt;
  document.getElementById('estado-luz').classList.toggle('aviso-offline', luz.sinConexion);
}

function pintarInicio(luz) {
  const caja = document.getElementById('resumen-luz');
  const r = resumenLuz(luz);
  if (!r) { caja.innerHTML = '<p>No hay datos de la luz ahora mismo.</p>'; return; }
  caja.innerHTML = `
    ${r.franja ? `<p class="grande">La luz está más barata <strong>${escapar(r.cuando)} ${escapar(r.franja)}</strong>.</p>` : ''}
    ${r.precioAhora ? `<p>Ahora mismo: <strong>${escapar(r.precioAhora)}</strong>
       <span class="pastilla nivel-${r.nivelAhora}">${r.nivelAhora === 'barato' ? '▼ Barato' : r.nivelAhora === 'caro' ? '▲ Caro' : '● Normal'}</span></p>` : ''}
    <a class="boton" href="#luz">Ver todas las horas</a>`;
}

// ---- 4. Service worker (uso sin conexión) -----------------------------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ---- Arranque ---------------------------------------------------------------
aplicarTema(leerPreferencia('tema'));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema(leerPreferencia('tema')));
prepararDialogoAviso();
mostrarVista();
cargarTodo();
// Si la app se queda abierta, refrescamos cada 15 minutos (el precio cambia cada hora).
setInterval(cargarTodo, 15 * 60_000);
