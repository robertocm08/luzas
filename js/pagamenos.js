// =====================================================================
// pagamenos.js — Sección "Paga menos".
//
// Siempre tiene contenido útil aunque aún no haya enlaces de afiliado:
// consejos y el comparador OFICIAL y gratuito de la CNMC (no es publicidad).
// Las ofertas de afiliado se leen de config.js y van SIEMPRE marcadas como
// "Publicidad", con rel="sponsored" (así lo piden Google y la ley).
// =====================================================================
import { CONFIG } from './config.js';
import { escapar } from './formato.js';

/** Solo ofertas completas y con enlace seguro (https). Función pura → se prueba. */
export function ofertasValidas(lista) {
  return (Array.isArray(lista) ? lista : []).filter((o) => {
    if (!o || !o.titulo || !o.url) return false;
    try { return new URL(o.url).protocol === 'https:'; } catch { return false; }
  });
}

function plantillaOfertas(lista) {
  return ofertasValidas(lista).map((o) => `
    <li class="tarjeta oferta">
      <p class="etiqueta-publicidad">Publicidad</p>
      <h3>${escapar(o.titulo)}</h3>
      ${o.descripcion ? `<p>${escapar(o.descripcion)}</p>` : ''}
      <a class="boton" href="${escapar(o.url)}" target="_blank" rel="sponsored noopener">${escapar(o.boton || 'Ver la oferta')}</a>
    </li>`).join('');
}

export function pintarPagaMenos(contenedor, config = CONFIG) {
  const luz = plantillaOfertas(config.ofertas?.luz);
  const seguros = plantillaOfertas(config.ofertas?.seguros);
  contenedor.innerHTML = `
    <p>Ideas y ofertas para pagar menos en casa y en el coche.</p>

    <h2>💡 Tarifa de la luz</h2>
    <div class="tarjeta">
      <h3>¿Te conviene el PVPC o una tarifa fija?</h3>
      <p>Con el <strong>PVPC</strong> (el precio por horas de esta app) se ahorra si puedes poner los aparatos
         en las horas baratas. Si no puedes cambiar tus horarios, una <strong>tarifa de precio fijo</strong> puede salir mejor.</p>
      <p>El comparador <strong>oficial y gratuito</strong> de la CNMC compara todas las ofertas con tu consumo real.</p>
      <a class="boton secundario" href="https://comparador.cnmc.gob.es/" target="_blank" rel="noopener">Abrir el comparador de la CNMC</a>
    </div>
    ${luz ? `<ul class="lista-ofertas">${luz}</ul>` : ''}

    <h2>🚗 Seguro del coche</h2>
    <div class="tarjeta">
      <h3>Compara antes de renovar</h3>
      <p>Las aseguradoras suelen subir el precio en cada renovación. Pide precio a otras compañías
         <strong>un mes antes</strong> del vencimiento: puedes cambiarte avisando con un mes de antelación.</p>
    </div>
    ${seguros ? `<ul class="lista-ofertas">${seguros}</ul>` : ''}

    <h2>⛽ Trucos para gastar menos combustible</h2>
    <ul class="tarjeta lista-consejos">
      <li>Revisa la presión de las ruedas cada mes: con poca presión se gasta más.</li>
      <li>Conduce suave y en marchas largas; a 100 km/h se gasta bastante menos que a 120.</li>
      <li>Quita el peso y la baca que no uses.</li>
      <li>Usa la pestaña <a href="#gasolina">Gasolina</a> antes de repostar.</li>
    </ul>

    ${luz || seguros ? '<p class="nota">Los enlaces marcados como «Publicidad» son de afiliado: si contratas a través de ellos, la app puede recibir una comisión sin coste para ti.</p>' : ''}
  `;
}
