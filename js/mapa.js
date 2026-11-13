// =====================================================================
// mapa.js — Mapa con Leaflet (librería libre) y OpenStreetMap (mapas libres).
// Leaflet se descarga solo la primera vez que hace falta el mapa.
// Sin conexión no hay mapa, pero la lista sigue funcionando.
// =====================================================================
import { escapar, precioLitro, capitalizar } from './formato.js';

const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';

let cargando = null;
let mapa = null;
let capa = null;

function cargarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  cargando ??= new Promise((resolver, rechazar) => {
    // crossOrigin permite que el service worker guarde una copia para usarla sin conexión.
    const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: LEAFLET_CSS, crossOrigin: 'anonymous' });
    const js = Object.assign(document.createElement('script'), { src: LEAFLET_JS, async: true, crossOrigin: 'anonymous' });
    js.onload = () => resolver(window.L);
    js.onerror = () => { cargando = null; rechazar(new Error('No se pudo cargar el mapa')); };
    document.head.append(css, js);
  });
  return cargando;
}

/**
 * Dibuja el mapa en "contenedor" con:
 *  - punto: dónde está el usuario (o el centro del municipio),
 *  - lista: gasolineras ya ordenadas; cada una con su número de puesto.
 *  - alPulsar(id): qué hacer al tocar una gasolinera (bajar hasta ella en la lista).
 */
export async function pintarMapa(contenedor, { punto, lista, esUbicacion, alPulsar, mejorId }) {
  let L;
  try { L = await cargarLeaflet(); } catch {
    contenedor.innerHTML = '<p class="nota">El mapa no está disponible sin conexión. La lista de abajo sí.</p>';
    return;
  }
  if (!mapa || mapa.getContainer() !== contenedor) {
    contenedor.innerHTML = '';
    mapa = L.map(contenedor, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);
    capa = L.layerGroup().addTo(mapa);
  }
  capa.clearLayers();

  L.circleMarker([punto.lat, punto.lon], { radius: 10, color: '#ffffff', fillColor: '#2563eb', fillOpacity: 1, weight: 4 })
    .bindTooltip(esUbicacion ? 'Estás aquí' : 'Centro del municipio').addTo(capa);

  const limites = [[punto.lat, punto.lon]];
  lista.forEach((e, i) => {
    const esMejor = e.id === mejorId;
    const icono = L.divIcon({
      className: `marcador${esMejor ? ' marcador-mejor' : ''}`,
      html: `<span>${i + 1}</span>`,
      iconSize: esMejor ? [46, 46] : [32, 32],
    });
    L.marker([e.lat, e.lon], {
      icon: icono,
      title: `${i + 1}. ${capitalizar(e.rotulo)} ${precioLitro(e.precio)}${esMejor ? ' (la más barata)' : ''}`,
      keyboard: false,
      zIndexOffset: esMejor ? 1000 : -i, // la más barata siempre encima de las demás
    })
      .bindPopup(`<strong>${i + 1}. ${escapar(capitalizar(e.rotulo))}</strong><br>${escapar(precioLitro(e.precio))}`)
      .on('click', () => alPulsar?.(e.id))
      .addTo(capa);
    // Encuadra la más barata y las 8 primeras de la lista, para no alejar demasiado el mapa.
    if (i < 8 || esMejor) limites.push([e.lat, e.lon]);
  });
  mapa.fitBounds(limites, { padding: [30, 30], maxZoom: 15 });
  setTimeout(() => mapa.invalidateSize(), 50); // por si el mapa estaba oculto al crearse
}
