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
import { iniciarGasolina, buscarCercaDeMi, resumenGasolina } from './gasolina.js';
import { cargarGasolineras, leerPreferencias, pedirUbicacion, ubicacionPermitida } from './datos-gasolina.js';
import { buscarMunicipio } from './calculos-gasolina.js';

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
  // La pantalla de gasolina se prepara la primera vez que se abre (ahorra datos a quien solo mira la luz).
  if (actual === 'gasolina') asegurarGasolina();
}

let gasolinaIniciada = false;
function asegurarGasolina() {
  if (gasolinaIniciada) return;
  gasolinaIniciada = true;
  iniciarGasolina();
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

/**
 * Resumen de gasolina en Inicio. Para no molestar al abrir la app, solo usa la
 * ubicación si el usuario ya dio permiso antes; si no, usa el municipio que
 * buscó la última vez; y si tampoco, muestra un botón.
 */
async function pintarInicioGasolina() {
  const caja = document.getElementById('resumen-gasolina');
  const boton = `<button class="boton" type="button" id="inicio-cerca">📍 Ver la más barata cerca de mí</button>
    <a class="boton secundario" href="#gasolina">Buscar por municipio</a>`;
  const conectarBoton = () => caja.querySelector('#inicio-cerca')?.addEventListener('click', () => {
    location.hash = '#gasolina';
    asegurarGasolina();
    buscarCercaDeMi();
  });

  try {
    const prefs = leerPreferencias();
    let punto = null;
    let zona = '';
    if (await ubicacionPermitida()) {
      punto = await pedirUbicacion().catch(() => null);
      zona = 'ti';
    }
    if (!punto && prefs.municipio) {
      const datos = await cargarGasolineras();
      const [m] = buscarMunicipio(datos.estaciones, prefs.municipio);
      if (m) { punto = m.centro; zona = m.municipio; }
    }
    if (!punto) {
      caja.innerHTML = `<p>Encuentra la gasolinera más barata de tu zona y cuánto ahorras llenando el depósito.</p>${boton}`;
      conectarBoton();
      return;
    }
    const r = await resumenGasolina(punto, zona);
    if (!r) { caja.innerHTML = `<p>No hay gasolineras cerca con tu combustible.</p>${boton}`; conectarBoton(); return; }
    caja.innerHTML = `
      <p class="grande">La gasolinera más barata cerca de ${escapar(zona)} es <strong>${escapar(r.rotulo)}</strong>:
        ${escapar(r.precio)} de ${escapar(r.combustible)}, a ${escapar(r.distancia)}.</p>
      ${r.ahorro ? `<p>Ahorras <strong>${escapar(r.ahorro)}</strong> llenando ${r.litros} L frente a la media.</p>` : ''}
      <a class="boton" href="#gasolina">Ver todas</a>`;
  } catch {
    caja.innerHTML = `<p>No hemos podido cargar las gasolineras ahora mismo.</p>${boton}`;
    conectarBoton();
  }
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
pintarInicioGasolina();
// Si la app se queda abierta, refrescamos cada 15 minutos (el precio cambia cada hora).
setInterval(cargarTodo, 15 * 60_000);
