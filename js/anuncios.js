// =====================================================================
// anuncios.js — Rellena los huecos de publicidad de la app.
//
// Los huecos están en el HTML como:
//   <aside class="hueco-anuncio" data-hueco="inicio" hidden></aside>
// y permanecen OCULTOS (sin ocupar sitio) hasta que:
//   1. los anuncios están activados en config.js, y
//   2. el usuario ha aceptado las cookies.
// Están al final de cada pantalla, nunca entre los botones ni encima de la
// información importante, para que no molesten.
//
// Modo demostración: añade ?anuncios=demo a la dirección para ver dónde irán
// los anuncios sin tener aún cuenta de AdSense (no carga nada de fuera).
// =====================================================================
import { CONFIG } from './config.js';
import { pedirConsentimiento } from './consentimiento.js';

export function modoAnuncios(config = CONFIG, busqueda = location.search) {
  if (new URLSearchParams(busqueda).get('anuncios') === 'demo') return 'demo';
  return config.anuncios?.activo ? config.anuncios.proveedor : 'ninguno';
}

export function iniciarAnuncios() {
  const modo = modoAnuncios();
  if (modo === 'ninguno') return; // sin anuncios: ni cookies ni aviso
  pedirConsentimiento({ alAceptar: () => mostrarHuecos(modo) });
}

function mostrarHuecos(modo) {
  const huecos = document.querySelectorAll('.hueco-anuncio');
  if (modo === 'demo') {
    huecos.forEach((h) => {
      h.innerHTML = `<p class="etiqueta-publicidad">Publicidad</p>
        <div class="anuncio-demo">Aquí irá un anuncio<br><small>(hueco "${h.dataset.hueco}")</small></div>`;
      h.hidden = false;
    });
    return;
  }
  if (modo === 'adsense') cargarAdSense(huecos);
}

function cargarAdSense(huecos) {
  const { cliente, huecos: bloques } = CONFIG.anuncios;
  const script = Object.assign(document.createElement('script'), {
    src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(cliente)}`,
    async: true,
    crossOrigin: 'anonymous',
  });
  document.head.append(script);
  huecos.forEach((h) => {
    const bloque = bloques[h.dataset.hueco];
    if (!bloque) return;
    h.innerHTML = `<p class="etiqueta-publicidad">Publicidad</p>
      <ins class="adsbygoogle" style="display:block" data-ad-client="${cliente}" data-ad-slot="${bloque}"
        data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    h.hidden = false;
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  });
}
