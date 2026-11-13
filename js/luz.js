// =====================================================================
// luz.js — Dibuja la pantalla "Luz" a partir de los datos.
//
// Patrón que usamos en toda la app:
//   datos  →  funciones de calculos.js  →  texto HTML  →  pantalla
// =====================================================================
import { clasificarHoras, recomendarFranja, extremos, sumarUnaHora, horasDesde } from './calculos.js';
import { precioKwh, euros, hora, franja, fechaLarga } from './formato.js';
import { descargarICS, programarNotificacion } from './aviso.js';

// Ejemplos de aparatos para cada duración, para que se entienda sin pensar.
const APARATOS = [
  { duracion: 1, ejemplos: 'horno, plancha, termo' },
  { duracion: 2, ejemplos: 'lavadora, lavavajillas' },
  { duracion: 3, ejemplos: 'secadora, cargar el coche' },
];
const NOMBRE_NIVEL = { barato: 'Barato', normal: 'Normal', caro: 'Caro' };
const SIMBOLO_NIVEL = { barato: '▼', normal: '●', caro: '▲' }; // no depender solo del color

let estado = { datos: null, dia: 'hoy', avisoPendiente: null };

export function pintarLuz(datos, contenedor) {
  estado.datos = datos;
  contenedor.innerHTML = plantillaLuz();
  // Botones Hoy / Mañana
  contenedor.querySelectorAll('[data-dia]').forEach((b) =>
    b.addEventListener('click', () => { estado.dia = b.dataset.dia; pintarLuz(datos, contenedor); }));
  // Botones "Avisarme"
  contenedor.querySelectorAll('[data-aviso]').forEach((b) =>
    b.addEventListener('click', () => abrirAviso(JSON.parse(b.dataset.aviso))));
}

/** Frase corta para la pantalla de inicio. */
export function resumenLuz(datos, ahora = new Date()) {
  if (!datos || datos.hoy.length === 0) return null;
  // Si quedan pocas horas hoy y ya se sabe mañana, es más útil hablar de mañana.
  const quedanPocas = horasDesde(datos.hoy, ahora).length < 6;
  let r = quedanPocas && datos.manana.length ? null : recomendarFranja(datos.hoy, 3, { desde: ahora });
  let cuando = 'hoy';
  if (!r && datos.manana.length) { r = recomendarFranja(datos.manana, 3); cuando = 'mañana'; }
  const actual = horaActual(clasificarHoras(datos.hoy), ahora);
  return {
    cuando,
    franja: r ? franja(r.mejor.inicio, r.mejor.fin) : null,
    precioAhora: actual ? precioKwh(actual.precio) : null,
    nivelAhora: actual?.nivel ?? null,
  };
}

function plantillaLuz() {
  const { datos, dia } = estado;
  const ahora = new Date();
  const horas = clasificarHoras(dia === 'hoy' ? datos.hoy : datos.manana);
  const hayManana = datos.manana.length > 0;

  let html = `
    <div class="selector-dia" role="group" aria-label="Elegir día">
      <button class="boton-dia" data-dia="hoy" aria-pressed="${dia === 'hoy'}">Hoy</button>
      <button class="boton-dia" data-dia="manana" aria-pressed="${dia === 'manana'}">Mañana</button>
    </div>`;

  if (horas.length === 0) {
    return html + `<div class="tarjeta aviso-info">
      <p class="grande">Los precios de mañana aún no se han publicado.</p>
      <p>Red Eléctrica los publica cada día hacia las <strong>20:15</strong>. Vuelve a mirar esta tarde.</p>
    </div>`;
  }

  html += `<p class="fecha">${fechaLarga(horas[0].inicio)}</p>`;

  // Tarjeta "Ahora" (solo hoy)
  if (dia === 'hoy') {
    const actual = horaActual(horas, ahora);
    if (actual) {
      html += `<div class="tarjeta ahora nivel-${actual.nivel}">
        <p class="etiqueta">Ahora mismo (${franja(actual.inicio, sumarUnaHora(actual.inicio))})</p>
        <p class="precio-grande">${precioKwh(actual.precio)}</p>
        <p class="nivel">${SIMBOLO_NIVEL[actual.nivel]} Precio ${NOMBRE_NIVEL[actual.nivel].toLowerCase()}</p>
      </div>`;
    }
  }

  // ¿Cuándo pongo la lavadora?
  html += `<h2>¿Cuándo pongo la lavadora?</h2>
    <p class="nota">Las mejores horas ${dia === 'hoy' ? 'que quedan hoy' : 'de mañana'}, según cuánto dura el aparato.</p>
    <ul class="lista-franjas">`;
  for (const { duracion, ejemplos } of APARATOS) {
    const r = recomendarFranja(horas, duracion, { desde: dia === 'hoy' ? ahora : null });
    const titulo = `${duracion} ${duracion === 1 ? 'hora' : 'horas'}`;
    if (!r) {
      html += `<li class="tarjeta franja"><h3>${titulo} <span class="ejemplos">(${ejemplos})</span></h3>
        <p>Hoy ya no quedan ${titulo} seguidas. ${hayManana ? 'Mira la pestaña <strong>Mañana</strong>.' : 'Vuelve a mirar después de las 20:15 para ver mañana.'}</p></li>`;
      continue;
    }
    const aviso = { inicio: r.mejor.inicio, fin: r.mejor.fin, duracion };
    const yaEmpezo = new Date(r.mejor.inicio) <= ahora;
    html += `<li class="tarjeta franja">
      <h3>${titulo} <span class="ejemplos">(${ejemplos})</span></h3>
      <p class="grande"><strong>${franja(r.mejor.inicio, r.mejor.fin)}</strong>
        ${yaEmpezo ? '<span class="pastilla ya">¡Ponlo ya!</span>' : ''}</p>
      <p>Ahorras <strong>${euros(r.ahorroEuros)}</strong> (${r.ahorroPorcentaje} % menos) frente a ponerlo
         ${franja(r.peor.inicio, r.peor.fin)}, la peor franja.</p>
      ${yaEmpezo ? '' : `<button class="boton secundario" data-aviso='${JSON.stringify(aviso)}'>🔔 Avisarme</button>`}
    </li>`;
  }
  html += `</ul>
    <p class="nota">Ahorro calculado para un aparato que gasta 1 kWh cada hora (una lavadora típica).</p>`;

  // Gráfico: una fila por hora, con barra, precio y símbolo.
  const e = extremos(horas);
  const rango = e.max.precio - e.min.precio || 1;
  html += `<h2>Precio de cada hora</h2>
    <p class="leyenda">
      <span class="pastilla nivel-barato">▼ Barato</span>
      <span class="pastilla nivel-normal">● Normal</span>
      <span class="pastilla nivel-caro">▲ Caro</span>
    </p>
    <ol class="grafico">`;
  for (const h of horas) {
    const ancho = 20 + (80 * (h.precio - e.min.precio)) / rango;
    const esAhora = dia === 'hoy' && h === horaActual(horas, ahora);
    html += `<li class="fila nivel-${h.nivel}${esAhora ? ' es-ahora' : ''}"
        aria-label="${hora(h.inicio)}: ${precioKwh(h.precio)}, ${NOMBRE_NIVEL[h.nivel]}${esAhora ? ', hora actual' : ''}">
      <span class="g-hora">${hora(h.inicio)}</span>
      <span class="g-barra" aria-hidden="true"><span style="width:${ancho.toFixed(1)}%"></span></span>
      <span class="g-precio" aria-hidden="true">${SIMBOLO_NIVEL[h.nivel]} ${precioKwh(h.precio).replace(' €/kWh', '')}</span>
    </li>`;
  }
  html += `</ol>
    <p class="nota">Precios en €/kWh de la tarifa regulada PVPC (2.0TD), con peajes y cargos incluidos, sin impuestos.
    Más barata: ${hora(e.min.inicio)} (${precioKwh(e.min.precio)}). Más cara: ${hora(e.max.inicio)} (${precioKwh(e.max.precio)}).</p>`;
  return html;
}

function horaActual(horas, ahora) {
  const t = ahora.getTime();
  return horas.find((h) => {
    const ini = new Date(h.inicio).getTime();
    return t >= ini && t < ini + 3600_000;
  });
}

// ---- Diálogo de aviso ----------------------------------------------------
function abrirAviso(aviso) {
  estado.avisoPendiente = aviso;
  const dialogo = document.getElementById('dialogo-aviso');
  dialogo.querySelector('[data-texto]').textContent =
    `Te recordamos ${franja(aviso.inicio, aviso.fin)} que es buen momento para poner tus aparatos.`;
  dialogo.querySelector('[data-resultado]').textContent = '';
  dialogo.showModal();
}

export function prepararDialogoAviso() {
  const dialogo = document.getElementById('dialogo-aviso');
  const resultado = dialogo.querySelector('[data-resultado]');
  const titulo = () => `💡 Luz barata ${franja(estado.avisoPendiente.inicio, estado.avisoPendiente.fin)}`;

  dialogo.querySelector('[data-calendario]').addEventListener('click', () => {
    const a = estado.avisoPendiente;
    descargarICS({ inicio: a.inicio, fin: a.fin, titulo: titulo(),
      descripcion: 'Buen momento para poner la lavadora, el lavavajillas u otros aparatos. Aviso creado con Luzas.' });
    resultado.textContent = 'Abre el archivo descargado para añadirlo a tu calendario. Sonará 15 minutos antes.';
  });
  dialogo.querySelector('[data-notificacion]').addEventListener('click', async () => {
    resultado.textContent = await programarNotificacion({ inicio: estado.avisoPendiente.inicio, titulo: titulo(),
      cuerpo: 'Empieza la franja más barata. Buen momento para poner tus aparatos.' });
  });
  dialogo.querySelector('[data-cerrar]').addEventListener('click', () => dialogo.close());
}
