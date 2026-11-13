// =====================================================================
// gasolina.js — Pantalla "Gasolina": formulario, mapa y lista.
//
// Flujo:
//   1. El usuario elige combustible y depósito (se recuerdan).
//   2. Pulsa "cerca de mí" o escribe su municipio → tenemos un "punto".
//   3. analizarZona() busca, calcula media y ahorro, y ordena.
//   4. Pintamos el resumen, el mapa y la lista.
// =====================================================================
import { COMBUSTIBLES, analizarZona, buscarMunicipio, SEPARADOR } from './calculos-gasolina.js';
import { cargarGasolineras, leerPreferencias, guardarPreferencias, pedirUbicacion } from './datos-gasolina.js';
import { pintarMapa } from './mapa.js';
import { precioLitro, euros, distancia, capitalizar, escapar } from './formato.js';

const MAX_LISTA = 20; // cuántas se muestran antes de "Ver más"

// Lo que la pantalla "recuerda" mientras está abierta (nada de esto se guarda, salvo las preferencias).
const estado = {
  datos: null,
  punto: null,          // { lat, lon } — solo en memoria
  esUbicacion: false,   // true si el punto es el GPS del usuario
  nombreZona: '',
  orden: 'precio',
  mostrar: MAX_LISTA,
};

export function iniciarGasolina() {
  const prefs = leerPreferencias();
  const raiz = document.getElementById('contenido-gasolina');
  raiz.innerHTML = plantillaFormulario(prefs);
  const form = raiz.querySelector('form');

  // Cambiar combustible o depósito → se guarda y se recalcula.
  form.addEventListener('change', (ev) => {
    if (ev.target.name === 'combustible') guardarPreferencias({ combustible: ev.target.value });
    if (ev.target.name === 'litros') {
      const litros = Math.min(150, Math.max(5, Number(ev.target.value) || 50));
      ev.target.value = litros;
      guardarPreferencias({ litros });
    }
    if (estado.punto) pintarResultados();
  });
  form.querySelectorAll('[data-litros]').forEach((b) => b.addEventListener('click', () => {
    form.litros.value = b.dataset.litros;
    form.litros.dispatchEvent(new Event('change', { bubbles: true }));
  }));

  // Botón "cerca de mí"
  form.querySelector('#boton-ubicacion').addEventListener('click', async () => {
    mensaje('Buscando tu ubicación…');
    try {
      estado.punto = await pedirUbicacion();
      estado.esUbicacion = true;
      estado.nombreZona = 'ti';
      estado.mostrar = MAX_LISTA;
      await pintarResultados();
      irAResultados();
    } catch (e) { mensaje(e.message, true); }
  });

  // Buscar por municipio
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await buscarPorMunicipio(form.municipio.value);
  });

  // Los datos se cargan "en segundo plano": la función termina ya y el formulario se puede usar.
  cargarYRellenar(prefs);
}

/** Lo que hace el botón de Inicio "Ver la más barata cerca de mí". */
export function buscarCercaDeMi() {
  document.getElementById('boton-ubicacion')?.click();
}

async function cargarYRellenar(prefs) {
  const form = document.querySelector('.formulario-gasolina');
  const resultados = document.getElementById('resultados-gasolina');
  // Rellenar el autocompletado de municipios cuando lleguen los datos.
  try {
    mensaje('Cargando gasolineras…');
    estado.datos = await cargarGasolineras();
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
  if (!estado.datos) return;
  const encontrados = buscarMunicipio(estado.datos.estaciones, texto);
  if (encontrados.length === 0) {
    mensaje(`No encontramos gasolineras en "${texto}". Revisa cómo está escrito o elige uno de la lista.`, true);
    return;
  }
  if (encontrados.length > 1) {
    // El mismo nombre en varias provincias: que el usuario elija.
    const caja = document.getElementById('resultados-gasolina');
    caja.innerHTML = `<div class="tarjeta"><p class="grande">Hay varios municipios con ese nombre. ¿Cuál es el tuyo?</p>
      ${encontrados.slice(0, 12).map((m) => `<button class="boton secundario" data-elegir="${escapar(etiquetaMunicipio(m))}">
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
  await pintarResultados();
  if (desdeBusqueda) irAResultados();
}

/** En el móvil, baja hasta los resultados para que se vean sin tener que buscarlos. */
function irAResultados() {
  document.querySelector('.resumen-zona')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function pintarResultados() {
  const caja = document.getElementById('resultados-gasolina');
  if (!estado.datos) { mensaje('Cargando gasolineras…'); return; }
  const { combustible, litros } = leerPreferencias();
  const zona = analizarZona(estado.datos.estaciones, estado.punto, combustible, litros, estado.orden);
  const nombre = COMBUSTIBLES[combustible].nombre;

  if (zona.lista.length === 0) {
    caja.innerHTML = `<div class="tarjeta aviso-info"><p class="grande">No hay gasolineras con ${escapar(nombre)} a menos de ${zona.radioKm} km.</p>
      <p>Prueba con otro combustible u otro municipio.</p></div>`;
    return;
  }
  const mejor = [...zona.lista].sort((a, b) => a.precio - b.precio)[0];
  const ahorroMejor = zona.lista.find((e) => e.id === mejor.id).ahorro;
  const lugar = estado.esUbicacion ? 'de ti' : `de ${escapar(estado.nombreZona)}`;

  caja.innerHTML = `
    <div class="tarjeta resumen-zona">
      <p class="etiqueta">${escapar(nombre)} · ${zona.lista.length} gasolineras a menos de ${zona.radioKm} km ${lugar}</p>
      <p>Precio medio: <strong>${precioLitro(zona.media)}</strong></p>
      <p class="grande">La más barata: <strong>${escapar(capitalizar(mejor.rotulo))}</strong>, ${precioLitro(mejor.precio)}
        ${ahorroMejor > 0 ? `<br>Ahorras <strong>${euros(ahorroMejor)}</strong> llenando ${litros} L` : ''}</p>
    </div>
    <div class="selector-dia" role="group" aria-label="Ordenar la lista">
      <button class="boton-dia" data-orden="precio" aria-pressed="${estado.orden === 'precio'}">Más baratas</button>
      <button class="boton-dia" data-orden="distancia" aria-pressed="${estado.orden === 'distancia'}">Más cercanas</button>
    </div>
    <div id="mapa" class="mapa" role="region" aria-label="Mapa de gasolineras (la misma información está en la lista)"></div>
    <ol class="lista-gasolineras">
      ${zona.lista.slice(0, estado.mostrar).map((e, i) => plantillaGasolinera(e, i, litros)).join('')}
    </ol>
    ${zona.lista.length > estado.mostrar ? `<button class="boton secundario" id="ver-mas">Ver ${Math.min(MAX_LISTA, zona.lista.length - estado.mostrar)} más</button>` : ''}`;

  caja.querySelectorAll('[data-orden]').forEach((b) => b.addEventListener('click', () => {
    estado.orden = b.dataset.orden; pintarResultados();
  }));
  caja.querySelector('#ver-mas')?.addEventListener('click', () => { estado.mostrar += MAX_LISTA; pintarResultados(); });

  pintarMapa(document.getElementById('mapa'), {
    punto: estado.punto,
    esUbicacion: estado.esUbicacion,
    lista: zona.lista.slice(0, estado.mostrar),
    alPulsar: (id) => {
      const fila = document.getElementById(`g-${id}`);
      fila?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fila?.classList.add('resaltada');
      setTimeout(() => fila?.classList.remove('resaltada'), 2000);
    },
  });
}

function plantillaGasolinera(e, i, litros) {
  let ahorro;
  if (e.ahorro >= 0.01) ahorro = `<p class="ahorro positivo">▼ Ahorras <strong>${euros(e.ahorro)}</strong> llenando ${litros} L</p>`;
  else if (e.ahorro <= -0.01) ahorro = `<p class="ahorro negativo">▲ Pagas ${euros(-e.ahorro)} más que la media (${litros} L)</p>`;
  else ahorro = '<p class="ahorro">● Igual que la media</p>';
  const comoLlegar = `https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lon}`;
  return `<li class="tarjeta gasolinera" id="g-${escapar(e.id)}">
    <div class="g-cabecera">
      <span class="puesto" aria-hidden="true">${i + 1}</span>
      <h3>${escapar(capitalizar(e.rotulo))}</h3>
      <p class="precio-g">${precioLitro(e.precio)}</p>
    </div>
    <p>${escapar(capitalizar(String(e.direccion).replace(/[\s,]+$/, '')))}, ${escapar(e.municipio)} · <strong>a ${distancia(e.distancia)}</strong></p>
    ${ahorro}
    <p class="nota">Horario: ${escapar(e.horario)}</p>
    <a class="boton secundario" href="${comoLlegar}" target="_blank" rel="noopener">🧭 Cómo llegar</a>
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
    <div class="fila-litros">
      <input id="litros" name="litros" type="number" inputmode="numeric" min="5" max="150" value="${prefs.litros}">
      <button type="button" class="boton-pequeno" data-litros="40">40</button>
      <button type="button" class="boton-pequeno" data-litros="50">50</button>
      <button type="button" class="boton-pequeno" data-litros="60">60</button>
    </div>
    <button type="button" class="boton" id="boton-ubicacion">📍 Buscar cerca de mí</button>
    <p class="separador"><span>o</span></p>
    <label for="municipio" class="etiqueta-campo">Escribe tu municipio</label>
    <div class="fila-busqueda">
      <input id="municipio" name="municipio" type="search" list="lista-municipios" autocomplete="off"
        placeholder="Por ejemplo: Ávila" enterkeyhint="search">
      <button type="submit" class="boton boton-buscar">Buscar</button>
    </div>
    <datalist id="lista-municipios"></datalist>
    <p class="nota">🔒 Tu ubicación solo se usa en este móvil para medir distancias. No se guarda ni se envía.</p>
  </form>`;
}

/** "La Adrada · Ávila" */
const etiquetaMunicipio = (m) => `${m.municipio}${SEPARADOR}${capitalizar(m.provincia)}`;

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
  return { rotulo: capitalizar(m.rotulo), precio: precioLitro(m.precio), distancia: distancia(m.distancia),
    ahorro: m.ahorro > 0 ? euros(m.ahorro) : null, litros, combustible: COMBUSTIBLES[combustible].nombre, nombreZona };
}
