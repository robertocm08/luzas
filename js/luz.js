// =====================================================================
// luz.js — Dibuja la pantalla "Luz" a partir de los datos.
//
// Patrón que usamos en toda la app:
//   datos  →  funciones de calculos.js  →  texto HTML  →  pantalla
//
// Orden de la pantalla (de lo más útil a lo menos):
//   1. Precio de ahora.
//   2. "¿Cuándo pongo la lavadora?" (la franja de 2 horas, en grande).
//   3. Otras duraciones (1 y 3 horas) en filas compactas.
//   4. Gráfico de barras del día + lista detallada desplegable.
// =====================================================================
import { clasificarHoras, recomendarFranja, extremos, sumarUnaHora, horasDesde } from './calculos.js';
import { precioKwh, numero3, euros, hora, franja, fechaLarga, icono, escapar } from './formato.js';
import { descargarICS, programarNotificacion } from './aviso.js';

// La principal es la lavadora (2 horas); las otras van en filas pequeñas.
const PRINCIPAL = { duracion: 2, ejemplos: 'lavadora, lavavajillas' };
const OTRAS = [
  { duracion: 1, ejemplos: 'horno, plancha, termo' },
  { duracion: 3, ejemplos: 'secadora, cargar el coche' },
];
const NOMBRE_NIVEL = { barato: 'Barato', normal: 'Normal', caro: 'Caro' };
const SIMBOLO_NIVEL = { barato: '▼', normal: '●', caro: '▲' }; // no depender solo del color

const estado = { datos: null, dia: 'hoy', avisoPendiente: null };

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

/**
 * Datos para la tarjeta de Inicio.
 * - Si quedan pocas horas hoy y ya se conoce mañana, habla de mañana.
 * - Si quedan pocas horas y mañana aún no se ha publicado, NO presenta como
 *   "barata" la única franja que queda: dice cuándo se publica mañana.
 */
export function resumenLuz(datos, ahora = new Date()) {
  if (!datos || datos.hoy.length === 0) return null;
  const quedanPocas = horasDesde(datos.hoy, ahora).length < 6;
  let r = null;
  let cuando = 'hoy';
  let aviso = null;
  if (!quedanPocas) r = recomendarFranja(datos.hoy, 3, { desde: ahora });
  else if (datos.manana.length) { r = recomendarFranja(datos.manana, 3); cuando = 'mañana'; }
  else aviso = 'Los precios de mañana se publican hacia las 20:15.';
  const actual = horaActual(clasificarHoras(datos.hoy), ahora);
  return {
    cuando,
    franja: r ? franja(r.mejor.inicio, r.mejor.fin) : null,
    aviso,
    precioNum: actual ? numero3(actual.precio) : null,
    precioAhora: actual ? precioKwh(actual.precio) : null,
    nivelAhora: actual?.nivel ?? null,
  };
}

function plantillaLuz() {
  const { datos, dia } = estado;
  const ahora = new Date();
  const horas = clasificarHoras(dia === 'hoy' ? datos.hoy : datos.manana);
  const desde = dia === 'hoy' ? ahora : null;

  let html = `
    <div class="segmento" role="group" aria-label="Elegir día">
      <button type="button" data-dia="hoy" aria-pressed="${dia === 'hoy'}">Hoy</button>
      <button type="button" data-dia="manana" aria-pressed="${dia === 'manana'}">Mañana</button>
    </div>`;

  if (horas.length === 0) {
    return html + `<div class="tarjeta aviso-info">
      <p class="grande"><strong>Los precios de mañana aún no se han publicado.</strong></p>
      <p>Red Eléctrica los publica cada día hacia las <strong>20:15</strong>. Vuelve a mirar esta tarde.</p>
    </div>`;
  }

  html += `<p class="fecha">${fechaLarga(horas[0].inicio)}</p>`;

  // 1. Precio de ahora (solo hoy)
  if (dia === 'hoy') {
    const actual = horaActual(horas, ahora);
    if (actual) {
      html += `<div class="tarjeta ahora nivel-${actual.nivel}">
        <div>
          <p class="etiqueta">Ahora (${franja(actual.inicio, sumarUnaHora(actual.inicio))})</p>
          <p class="dato-grande">${numero3(actual.precio)} <span class="dato-unidad">€/kWh</span></p>
        </div>
        <span class="pastilla nivel-${actual.nivel}">${SIMBOLO_NIVEL[actual.nivel]} ${NOMBRE_NIVEL[actual.nivel]}</span>
      </div>`;
    }
  }

  // 2. Recomendación principal: la lavadora
  const r = recomendarFranja(horas, PRINCIPAL.duracion, { desde });
  html += '<h2>¿Cuándo pongo la lavadora?</h2>';
  if (r) {
    const yaEmpezo = new Date(r.mejor.inicio) <= ahora;
    html += `<div class="tarjeta tarjeta-luz franja-principal">
      <p class="cabeza-tarjeta"><span class="insignia insignia-luz">${icono('reloj')}</span>
        Mejor momento ${dia === 'hoy' ? 'que queda hoy' : 'de mañana'} · 2 horas</p>
      <p class="dato-grande">${hora(r.mejor.inicio)} – ${hora(r.mejor.fin)}</p>
      ${yaEmpezo ? '<p><span class="pastilla ya">¡Ponla ya!</span></p>' : ''}
      <p class="ahorro-linea">Ahorras <strong>${euros(r.ahorroEuros)}</strong> (${r.ahorroPorcentaje} % menos) que si la pones ${franja(r.peor.inicio, r.peor.fin)}.</p>
      ${yaEmpezo ? '' : botonAviso(r, 'boton', `${icono('campana')} Avisarme antes`)}
    </div>`;
  } else {
    html += `<div class="tarjeta"><p>Hoy ya no quedan 2 horas seguidas. ${datos.manana.length
      ? 'Mira la pestaña <strong>Mañana</strong>.' : 'Vuelve después de las 20:15 para ver mañana.'}</p></div>`;
  }

  // 3. Otras duraciones, compactas
  html += '<ul class="lista-franjas" aria-label="Otros aparatos">';
  for (const { duracion, ejemplos } of OTRAS) {
    const o = recomendarFranja(horas, duracion, { desde });
    const titulo = `${duracion} ${duracion === 1 ? 'hora' : 'horas'}`;
    if (!o) { html += `<li class="fila-franja"><span><strong>${titulo}</strong> <span class="ejemplos">· ${ejemplos}</span><br>Ya no quedan hoy.</span></li>`; continue; }
    const yaEmpezo = new Date(o.mejor.inicio) <= ahora;
    html += `<li class="fila-franja">
      <span><span class="ejemplos">${titulo} · ${ejemplos}</span><br>
        <strong>${hora(o.mejor.inicio)} – ${hora(o.mejor.fin)}</strong>${yaEmpezo ? ' <span class="pastilla ya">Ya</span>' : ''}
        <span class="nota"> · ahorras ${euros(o.ahorroEuros)}</span></span>
      ${yaEmpezo ? '' : botonAviso(o, 'boton-icono', icono('campana'), `Avisarme para ${titulo} a las ${hora(o.mejor.inicio)}`)}
    </li>`;
  }
  html += `</ul>
    <p class="nota">Ahorro calculado para un aparato que gasta 1 kWh cada hora (una lavadora típica).</p>`;

  // 4. Gráfico de barras verticales + lista detallada
  const e = extremos(horas);
  const rango = e.max.precio - e.min.precio || 1;
  const actual = dia === 'hoy' ? horaActual(horas, ahora) : null;
  html += `<h2>Precio de cada hora</h2>
    <p class="leyenda">
      <span class="pastilla nivel-barato">▼ Barato</span>
      <span class="pastilla nivel-normal">● Normal</span>
      <span class="pastilla nivel-caro">▲ Caro</span>
    </p>
    <div class="tarjeta">
      <div class="grafico-barras" style="--n:${horas.length}" role="img"
        aria-label="Gráfico del precio por horas. Más barata a las ${hora(e.min.inicio)} (${precioKwh(e.min.precio)}), más cara a las ${hora(e.max.inicio)} (${precioKwh(e.max.precio)}). La lista completa está debajo.">
        ${horas.map((h) => `<span class="barra nivel-${h.nivel}${h === actual ? ' es-ahora' : ''}"
          style="height:${(18 + (82 * (h.precio - e.min.precio)) / rango).toFixed(1)}%"></span>`).join('')}
      </div>
      <div class="eje-horas" style="--n:${horas.length}" aria-hidden="true">
        ${horas.map((h, i) => `<span>${i % 6 === 0 ? hora(h.inicio).slice(0, 2) + 'h' : ''}</span>`).join('')}
      </div>
      <p class="nota">Más barata: <strong>${hora(e.min.inicio)}</strong> (${precioKwh(e.min.precio)}) ·
        Más cara: <strong>${hora(e.max.inicio)}</strong> (${precioKwh(e.max.precio)})</p>
    </div>
    <details class="desplegable">
      <summary>Ver el precio de cada hora ${icono('abajo')}</summary>
      <ol class="grafico">
        ${horas.map((h) => {
          const ancho = 20 + (80 * (h.precio - e.min.precio)) / rango;
          const esAhora = h === actual;
          return `<li class="fila nivel-${h.nivel}${esAhora ? ' es-ahora' : ''}"
              aria-label="${hora(h.inicio)}: ${precioKwh(h.precio)}, ${NOMBRE_NIVEL[h.nivel]}${esAhora ? ', hora actual' : ''}">
            <span class="g-hora">${hora(h.inicio)}</span>
            <span class="g-barra" aria-hidden="true"><span style="width:${ancho.toFixed(1)}%"></span></span>
            <span class="g-precio" aria-hidden="true">${SIMBOLO_NIVEL[h.nivel]} ${numero3(h.precio)}</span>
          </li>`;
        }).join('')}
      </ol>
    </details>
    <p class="nota">Precios en €/kWh de la tarifa regulada PVPC (2.0TD), con peajes y cargos, sin impuestos.</p>`;
  return html;
}

function botonAviso(r, clase, contenido, etiqueta = null) {
  const aviso = { inicio: r.mejor.inicio, fin: r.mejor.fin, duracion: r.duracion };
  return `<button type="button" class="${clase}" data-aviso='${JSON.stringify(aviso)}'
    ${etiqueta ? `aria-label="${escapar(etiqueta)}"` : ''}>${contenido}</button>`;
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
  const titulo = () => `Luz barata ${franja(estado.avisoPendiente.inicio, estado.avisoPendiente.fin)}`;

  dialogo.querySelector('[data-calendario]').addEventListener('click', () => {
    const a = estado.avisoPendiente;
    descargarICS({ inicio: a.inicio, fin: a.fin, titulo: titulo(),
      descripcion: 'Buen momento para poner la lavadora, el lavavajillas u otros aparatos. Aviso creado con Batata.' });
    resultado.textContent = 'Abre el archivo descargado para añadirlo a tu calendario. Sonará 15 minutos antes.';
  });
  dialogo.querySelector('[data-notificacion]').addEventListener('click', async () => {
    resultado.textContent = await programarNotificacion({ inicio: estado.avisoPendiente.inicio, titulo: titulo(),
      cuerpo: 'Empieza la franja más barata. Buen momento para poner tus aparatos.' });
  });
  dialogo.querySelector('[data-cerrar]').addEventListener('click', () => dialogo.close());
}
