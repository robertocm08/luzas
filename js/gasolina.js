// =====================================================================
// gasolina.js — Pantalla "Gasolina": búsqueda, mapa y lista.
//
// Flujo:
//   1. El usuario elige combustible y depósito (se recuerdan).
//   2. Pulsa "cerca de mí" o escribe su municipio → tenemos un "punto".
//   3. analizarZona() busca, calcula media y ahorro, y ordena.
//   4. Pintamos el resumen, el mapa y la lista.
//
// Cuando ya hay una búsqueda, el formulario se recoge en una barra pequeña
// ("Diésel · 50 L · cerca de La Adrada  [Cambiar]") para que lo primero que
// se vea sean los resultados.
// =====================================================================
import { COMBUSTIBLES, analizarZona, buscarMunicipio, SEPARADOR } from './calculos-gasolina.js';
import { cargarGasolineras, leerPreferencias, guardarPreferencias, pedirUbicacion } from './datos-gasolina.js';
import { pintarMapa } from './mapa.js';
import { precioLitro, numero3, euros, distancia, capitalizar, escapar, icono, esqueleto } from './formato.js';

const MAX_LISTA = 20; // cuántas se muestran antes de "Ver más"
const PASO_LITROS = 5;

// Lo que la pantalla "recuerda" mientras está abierta (nada de esto se guarda, salvo las preferencias).
const estado = {
  datos: null,
  punto: null,          // { lat, lon } — solo en memoria
  esUbicacion: false,   // true si el punto es el GPS del usuario
  nombreZona: '',
  orden: 'precio',
  mostrar: MAX_LISTA,
  formAbierto: true,
};

export function iniciarGasolina() {
  const prefs = leerPreferencias();
  const raiz = document.getElementById('contenido-gasolina');
  raiz.innerHTML = `<div id="barra-busqueda"></div>${plantillaFormulario(prefs)}`;
  const form = raiz.querySelector('form');

  // Cambiar combustible o depósito → se guarda y se recalcula.
  form.addEventListener('change', (ev) => {
    if (ev.target.name === 'combustible') guardarPreferencias({ combustible: ev.target.value });
    if (ev.target.name === 'litros') fijarLitros(Number(ev.target.value));
    if (estado.punto) pintarResultados();
  });
  // Botones − y + del depósito
  form.querySelectorAll('[data-paso]').forEach((b) => b.addEventListener('click', () => {
    fijarLitros(Number(form.litros.value) + Number(b.dataset.paso) * PASO_LITROS);
    if (estado.punto) pintarResultados();
  }));

  // Botón "cerca de mí"
  form.querySelector('#boton-ubicacion').addEventListener('click', async () => {
    mensaje('Buscando tu ubicación…');
    try {
      estado.punto = await pedirUbicacion();
      estado.esUbicacion = true;
      estado.nombreZona = 'ti';
      estado.mostrar = MAX_LISTA;
      estado.formAbierto = false;
      await pintarResultados();
      irArriba();
    } catch (e) { mensaje(e.message, true); }
  });

  // Buscar por municipio
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await buscarPorMunicipio(form.municipio.value);
  });

  // "Listo": cierra el formulario sin buscar de nuevo
  form.querySelector('#cerrar-formulario').addEventListener('click', () => {
    estado.formAbierto = false;
    actualizarPanel();
  });

  actualizarPanel();
  // Los datos se cargan "en segundo plano": la función termina ya y el formulario se puede usar.
  cargarYRellenar(prefs);
}

/** Lo que hace el botón de Inicio "Buscar cerca de mí". */
export function buscarCercaDeMi() {
  document.getElementById('boton-ubicacion')?.click();
}

function fijarLitros(valor) {
  const litros = Math.min(150, Math.max(5, Math.round(valor) || 50));
  document.getElementById('litros').value = litros;
  guardarPreferencias({ litros });
}

/** Muestra el formulario completo o la barra compacta, según haya búsqueda o no. */
function actualizarPanel() {
  const form = document.querySelector('.formulario-gasolina');
  const barra = document.getElementById('barra-busqueda');
  const compacto = estado.punto && !estado.formAbierto;
  form.hidden = compacto;
  document.getElementById('cerrar-formulario').hidden = !estado.punto;
  if (!compacto) { barra.innerHTML = ''; return; }
  const { combustible, litros } = leerPreferencias();
  const lugar = estado.esUbicacion ? 'cerca de ti' : `en ${escapar(estado.nombreZona)}`;
  barra.innerHTML = `<div class="tarjeta barra-busqueda">
    <span class="insignia insignia-gas">${icono('surtidor')}</span>
    <p><strong>${escapar(COMBUSTIBLES[combustible].nombre)} · ${litros} L</strong><br><span class="nota">${lugar}</span></p>
    <button type="button" class="boton-pequeno" id="abrir-formulario">${icono('ajustes')} Cambiar</button>
  </div>`;
  barra.querySelector('#abrir-formulario').addEventListener('click', () => {
    estado.formAbierto = true;
    actualizarPanel();
    document.querySelector('.formulario-gasolina input:checked')?.focus();
  });
}

async function cargarYRellenar(prefs) {
  const form = document.querySelector('.formulario-gasolina');
  const resultados = document.getElementById('resultados-gasolina');
  try {
    if (prefs.municipio) resultados.innerHTML = esqueletoResultados();
    estado.datos = await cargarGasolineras();
    // Autocompletado de municipios
    document.getElementById('lista-municipios').innerHTML = estado.datos.municipios
      .map((m) => `<option value="${escapar(etiquetaMunicipio(m))}">`).join('');
    document.getElementById('estado-gasolina').textContent =
      `Datos del Ministerio para la Transición Ecológica · precios del ${estado.datos.fechaMinisterio ?? '—'}`;
    if (estado.punto) await pintarResultados();
    else if (prefs.municipio) { form.municipio.value = prefs.municipio; await buscarPorMunicipio(prefs.municipio, false); }
    else resultados.innerHTML = '';
  } catch {
    mensaje('No hemos podido cargar las gasolineras. Comprueba tu conexión e inténtalo de nuevo.', true);
  }
}

async function buscarPorMunicipio(texto, desdeBusqueda = true) {
  if (!estado.datos) { mensaje('Un momento, aún estamos cargando las gasolineras…'); return; }
  const encontrados = buscarMunicipio(estado.datos.estaciones, texto);
  if (encontrados.length === 0) {
    mensaje(`No encontramos gasolineras en "${texto}". Revisa cómo está escrito o elige uno de la lista.`, true);
    return;
  }
  if (encontrados.length > 1) {
    // El mismo nombre en varias provincias: que el usuario elija.
    const caja = document.getElementById('resultados-gasolina');
    caja.innerHTML = `<div class="tarjeta"><p class="grande"><strong>Hay varios municipios con ese nombre. ¿Cuál es el tuyo?</strong></p>
      ${encontrados.slice(0, 12).map((m) => `<button type="button" class="boton secundario" data-elegir="${escapar(etiquetaMunicipio(m))}">
        ${escapar(etiquetaMunicipio(m))}</button>`).join('')}</div>`;
    caja.querySelectorAll('[data-elegir]').forEach((b) => b.addEventListener('click', () => {
      document.getElementById('municipio').value = b.dataset.elegir;
      buscarPorMunicipio(b.dataset.elegir);
    }));
    return;
  }
  const [m] = encontrados;
  const texto2 = etiquetaMunicipio(m);
  guardarPreferencias({ municipio: texto2 });
  document.getElementById('municipio').value = texto2;
  estado.punto = m.centro;
  estado.esUbicacion = false;
  estado.nombreZona = m.municipio;
  estado.mostrar = MAX_LISTA;
  estado.formAbierto = false;
  await pintarResultados();
  if (desdeBusqueda) irArriba();
}

/** Tras buscar, vuelve arriba: ahí están la barra y el resumen. */
function irArriba() {
  document.getElementById('vista-gasolina').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function pintarResultados() {
  const caja = document.getElementById('resultados-gasolina');
  if (!estado.datos) { caja.innerHTML = esqueletoResultados(); return; }
  actualizarPanel();
  const { combustible, litros } = leerPreferencias();
  const zona = analizarZona(estado.datos.estaciones, estado.punto, combustible, litros, estado.orden);
  const nombre = COMBUSTIBLES[combustible].nombre;

  if (zona.lista.length === 0) {
    caja.innerHTML = `<div class="tarjeta aviso-info"><p class="grande"><strong>No hay gasolineras con ${escapar(nombre)} a menos de ${zona.radioKm} km.</strong></p>
      <p>Prueba con otro combustible u otro municipio.</p></div>`;
    return;
  }
  const mejor = [...zona.lista].sort((a, b) => a.precio - b.precio || a.distancia - b.distancia)[0];
  const lugar = estado.esUbicacion ? 'de ti' : `de ${escapar(estado.nombreZona)}`;

  caja.innerHTML = `
    <div class="tarjeta tarjeta-gas resumen-zona">
      <p class="cabeza-tarjeta"><span class="insignia insignia-gas">${icono('surtidor')}</span> La más barata</p>
      <p class="dato-grande">${numero3(mejor.precio)} <span class="dato-unidad">€/L</span></p>
      <p class="grande"><strong>${escapar(capitalizar(mejor.rotulo))}</strong> · a ${distancia(mejor.distancia)}</p>
      ${mejor.ahorro > 0 ? `<p><span class="ahorro positivo">▼ Ahorras ${euros(mejor.ahorro)} llenando ${litros} L</span></p>` : ''}
      <p class="nota">${zona.lista.length} gasolineras a menos de ${zona.radioKm} km ${lugar} · media ${precioLitro(zona.media)}</p>
    </div>
    <div class="segmento" role="group" aria-label="Ordenar la lista">
      <button type="button" data-orden="precio" aria-pressed="${estado.orden === 'precio'}">Más baratas</button>
      <button type="button" data-orden="distancia" aria-pressed="${estado.orden === 'distancia'}">Más cercanas</button>
    </div>
    <div id="mapa" class="mapa" role="region" aria-label="Mapa de gasolineras (la misma información está en la lista)"></div>
    <ol class="lista-gasolineras">
      ${zona.lista.slice(0, estado.mostrar).map((e, i) => plantillaGasolinera(e, i, e.id === mejor.id)).join('')}
    </ol>
    ${zona.lista.length > estado.mostrar ? `<button type="button" class="boton secundario" id="ver-mas">Ver ${Math.min(MAX_LISTA, zona.lista.length - estado.mostrar)} más</button>` : ''}`;

  caja.querySelectorAll('[data-orden]').forEach((b) => b.addEventListener('click', () => {
    estado.orden = b.dataset.orden; pintarResultados();
  }));
  caja.querySelector('#ver-mas')?.addEventListener('click', () => { estado.mostrar += MAX_LISTA; pintarResultados(); });

  pintarMapa(document.getElementById('mapa'), {
    punto: estado.punto,
    esUbicacion: estado.esUbicacion,
    lista: zona.lista.slice(0, estado.mostrar),
    mejorId: mejor.id,
    alPulsar: (id) => {
      const fila = document.getElementById(`g-${id}`);
      fila?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fila?.classList.add('resaltada');
      setTimeout(() => fila?.classList.remove('resaltada'), 2000);
    },
  });
}

function plantillaGasolinera(e, i, esMejor) {
  let ahorro;
  if (e.ahorro >= 0.01) ahorro = `<span class="ahorro positivo">▼ Ahorras ${euros(e.ahorro)}</span>`;
  else if (e.ahorro <= -0.01) ahorro = `<span class="ahorro negativo">▲ ${euros(-e.ahorro)} más</span>`;
  else ahorro = '<span class="ahorro igual">● Como la media</span>';
  const nombre = capitalizar(e.rotulo);
  const comoLlegar = `https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lon}`;
  return `<li class="gasolinera${esMejor ? ' es-mejor' : ''}" id="g-${escapar(e.id)}">
    <span class="puesto" aria-hidden="true">${i + 1}</span>
    <h3>${escapar(nombre)}</h3>
    <p class="precio-g">${precioLitro(e.precio)}</p>
    <p class="detalle">${escapar(capitalizar(String(e.direccion).replace(/[\s,]+$/, '')))}, ${escapar(e.municipio)} ·
      <strong>a ${distancia(e.distancia)}</strong><br>${escapar(e.horario)}</p>
    <div class="acciones">
      ${ahorro}
      <a class="boton-pequeno como-llegar" href="${comoLlegar}" target="_blank" rel="noopener"
        aria-label="Cómo llegar a ${escapar(nombre)}">${icono('navegar')} Cómo llegar</a>
    </div>
  </li>`;
}

function plantillaFormulario(prefs) {
  const opciones = Object.entries(COMBUSTIBLES).map(([clave, c]) => `
    <label class="chip"><input type="radio" name="combustible" value="${clave}" ${prefs.combustible === clave ? 'checked' : ''}>
      <span>${c.nombre}</span></label>`).join('');
  return `<form class="tarjeta formulario-gasolina" novalidate>
    <fieldset>
      <legend>¿Qué combustible usas?</legend>
      <div class="chips">${opciones}</div>
    </fieldset>
    <label for="litros" class="etiqueta-campo">Litros que llenas (tamaño del depósito)</label>
    <div class="paso-litros">
      <button type="button" data-paso="-1" aria-label="${PASO_LITROS} litros menos">${icono('menos')}</button>
      <span class="campo-litros">
        <input id="litros" name="litros" type="number" inputmode="numeric" min="5" max="150" step="${PASO_LITROS}" value="${prefs.litros}">
        <span class="sufijo" aria-hidden="true">L</span>
      </span>
      <button type="button" data-paso="1" aria-label="${PASO_LITROS} litros más">${icono('mas')}</button>
    </div>
    <button type="button" class="boton" id="boton-ubicacion">${icono('ubicacion')} Buscar cerca de mí</button>
    <p class="separador"><span>o</span></p>
    <label for="municipio" class="etiqueta-campo">Escribe tu municipio</label>
    <div class="fila-busqueda">
      <input id="municipio" name="municipio" type="search" list="lista-municipios" autocomplete="off"
        placeholder="Por ejemplo: Ávila" enterkeyhint="search">
      <button type="submit" class="boton boton-buscar" aria-label="Buscar">${icono('lupa')}</button>
    </div>
    <datalist id="lista-municipios"></datalist>
    <p class="nota privacidad-nota">${icono('candado')} <span>Tu ubicación solo se usa en este móvil para medir distancias. No se guarda ni se envía.</span></p>
    <button type="button" class="boton secundario" id="cerrar-formulario" hidden>Listo</button>
  </form>`;
}

/** "La Adrada · Ávila" */
const etiquetaMunicipio = (m) => `${m.municipio}${SEPARADOR}${capitalizar(m.provincia)}`;

const esqueletoResultados = () =>
  `<div class="tarjeta" aria-label="Cargando gasolineras">${esqueleto([24, 48, 20])}</div>
   <span class="esqueleto" style="height:300px;border-radius:20px"></span>
   <span class="esqueleto" style="height:110px;border-radius:20px"></span>`;

function mensaje(texto, esError = false) {
  document.getElementById('resultados-gasolina').innerHTML =
    `<div class="tarjeta ${esError ? 'aviso-error' : ''}" role="status"><p>${escapar(texto)}</p></div>`;
}

/** Resumen para la pantalla de Inicio. */
export async function resumenGasolina(punto, nombreZona) {
  const datos = await cargarGasolineras();
  const { combustible, litros } = leerPreferencias();
  const zona = analizarZona(datos.estaciones, punto, combustible, litros, 'precio');
  if (zona.lista.length === 0) return null;
  const m = zona.lista[0];
  return { rotulo: capitalizar(m.rotulo), precio: precioLitro(m.precio), precioNum: numero3(m.precio),
    distancia: distancia(m.distancia), ahorro: m.ahorro > 0 ? euros(m.ahorro) : null, litros,
    combustible: COMBUSTIBLES[combustible].nombre, nombreZona };
}
