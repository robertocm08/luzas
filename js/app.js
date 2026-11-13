// =====================================================================
// app.js — El "director de orquesta". Se ejecuta al abrir la app y:
//   1. Gestiona las pestañas de abajo (Inicio, Luz, Gasolina, Paga menos).
//   2. Gestiona el modo claro / oscuro.
//   3. Carga los datos y pide a cada pantalla que se dibuje.
//   4. Activa el "service worker" (lo que permite usarla sin conexión).
// =====================================================================
import { cargarLuz, copiaLuz } from './datos-luz.js';
import { pintarLuz, resumenLuz, prepararDialogoAviso } from './luz.js';
import { hora, escapar, icono, fechaLarga } from './formato.js';
import { iniciarGasolina, buscarCercaDeMi, resumenGasolina } from './gasolina.js';
import { cargarGasolineras, leerPreferencias, pedirUbicacion, ubicacionPermitida } from './datos-gasolina.js';
import { buscarMunicipio } from './calculos-gasolina.js';
import { iniciarAnuncios } from './anuncios.js';
import { pintarPagaMenos } from './pagamenos.js';

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
// La app es oscura por defecto (estilo aurora). Con el botón se pasa a la versión
// clara, y recordamos la elección.
function aplicarTema(tema) {
  if (tema === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  const oscuro = tema !== 'light';
  const boton = document.getElementById('boton-tema');
  boton.innerHTML = icono(oscuro ? 'sol' : 'luna');
  boton.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#08061a' : '#eef0ff');
}
function leerPreferencia(clave) { try { return localStorage.getItem(clave); } catch { return null; } }
function guardarPreferencia(clave, valor) { try { localStorage.setItem(clave, valor); } catch { /* da igual */ } }

document.getElementById('boton-tema').addEventListener('click', () => {
  const nuevo = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
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

const NIVEL = { barato: '▼ Barato', normal: '● Normal', caro: '▲ Caro' };

/** Tarjeta de la luz en Inicio: el precio de ahora es el protagonista. */
function pintarInicio(luz) {
  const caja = document.getElementById('resumen-luz');
  const r = resumenLuz(luz);
  if (!r) {
    caja.innerHTML = `<div class="tarjeta aviso-error"><p>No hemos podido cargar el precio de la luz.</p>
      <button class="boton secundario" type="button" onclick="location.reload()">Reintentar</button></div>`;
    return;
  }
  caja.innerHTML = `
    <article class="tarjeta tarjeta-luz">
      <p class="cabeza-tarjeta"><span class="insignia insignia-luz">${icono('rayo')}</span> Luz ahora</p>
      ${r.precioNum !== null ? `<p class="dato-grande">${escapar(r.precioNum)} <span class="dato-unidad">€/kWh</span></p>
        <p><span class="pastilla nivel-${r.nivelAhora}">${NIVEL[r.nivelAhora]}</span></p>` : ''}
      ${r.franja ? `<p class="grande">${icono('reloj')} Más barata <strong>${escapar(r.cuando)}, ${escapar(r.franja)}</strong></p>` : ''}
      ${r.aviso ? `<p>${icono('reloj')} ${escapar(r.aviso)}</p>` : ''}
      <a class="enlace-flecha" href="#luz">Ver todas las horas ${icono('flecha')}</a>
    </article>`;
}

/**
 * Resumen de gasolina en Inicio. Para no molestar al abrir la app, solo usa la
 * ubicación si el usuario ya dio permiso antes; si no, usa el municipio que
 * buscó la última vez; y si tampoco, muestra un botón.
 */
async function pintarInicioGasolina() {
  const caja = document.getElementById('resumen-gasolina');
  const tarjeta = (contenido) => `<article class="tarjeta tarjeta-gas">
      <p class="cabeza-tarjeta"><span class="insignia insignia-gas">${icono('surtidor')}</span> Gasolina más barata</p>
      ${contenido}</article>`;
  const boton = `<button class="boton" type="button" id="inicio-cerca">${icono('ubicacion')} Buscar cerca de mí</button>
    <a class="enlace-flecha" href="#gasolina">O escribe tu municipio ${icono('flecha')}</a>`;
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
      caja.innerHTML = tarjeta(`<p class="grande">Encuentra la más barata de tu zona y cuánto ahorras llenando el depósito.</p>${boton}`);
      conectarBoton();
      return;
    }
    const r = await resumenGasolina(punto, zona);
    if (!r) { caja.innerHTML = tarjeta(`<p>No hay gasolineras cerca con tu combustible.</p>${boton}`); conectarBoton(); return; }
    caja.innerHTML = tarjeta(`
      <p class="dato-grande">${escapar(r.precioNum)} <span class="dato-unidad">€/L</span></p>
      <p class="grande"><strong>${escapar(r.rotulo)}</strong> · a ${escapar(r.distancia)}</p>
      <p class="nota">${escapar(r.combustible)}, cerca de ${escapar(zona)}</p>
      ${r.ahorro ? `<p><span class="ahorro positivo">▼ Ahorras ${escapar(r.ahorro)} llenando ${r.litros} L</span></p>` : ''}
      <a class="enlace-flecha" href="#gasolina">Ver todas las gasolineras ${icono('flecha')}</a>`);
  } catch {
    caja.innerHTML = tarjeta(`<p>No hemos podido cargar las gasolineras ahora mismo.</p>${boton}`);
    conectarBoton();
  }
}

// ---- 4. Service worker (uso sin conexión) -----------------------------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ---- Arranque ---------------------------------------------------------------
aplicarTema(leerPreferencia('tema'));
document.getElementById('fecha-hoy').textContent = fechaLarga(new Date());
prepararDialogoAviso();
mostrarVista();
cargarTodo();
pintarInicioGasolina();
pintarPagaMenos(document.getElementById('contenido-pagamenos'));
iniciarAnuncios(); // solo hace algo si los anuncios están activos en config.js
// Si la app se queda abierta, refrescamos cada 15 minutos (el precio cambia cada hora).
setInterval(cargarTodo, 15 * 60_000);
