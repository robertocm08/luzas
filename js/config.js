// =====================================================================
// config.js — EL ÚNICO ARCHIVO QUE TIENES QUE TOCAR PARA GANAR DINERO.
//
// Aquí se activan los anuncios y se añaden los enlaces de afiliado.
// Después de cambiarlo, súbelo a GitHub y la app se actualiza sola.
// =====================================================================

export const CONFIG = {
  // ---- Quién está detrás de la app (obligatorio por ley si hay publicidad) ----
  // Aparece en la página de privacidad. Rellénalo ANTES de activar anuncios o afiliados.
  titular: {
    nombre: '',            // Tu nombre o el de tu empresa
    nif: '',               // Opcional si eres particular sin actividad económica
    correo: '',            // Un correo de contacto para temas de privacidad
  },

  // ---- Anuncios ----------------------------------------------------------------
  // Mientras "activo" sea false: no hay anuncios, no hay cookies y no aparece
  // ningún aviso de cookies (la app no las necesita para nada más).
  anuncios: {
    activo: false,
    proveedor: 'adsense',              // de momento solo 'adsense'
    cliente: 'ca-pub-0000000000000000', // tu "ID de editor" de AdSense
    // Un "bloque de anuncios" de AdSense por cada hueco de la app:
    huecos: {
      inicio: '0000000000',
      luz: '0000000000',
      gasolina: '0000000000',
    },
  },

  // ---- "Paga menos": ofertas con enlace de afiliado ------------------------------
  // Cada oferta aparece SIEMPRE marcada como "Publicidad".
  // Copia un bloque { ... } por cada oferta. Deja la lista vacía [] si no tienes.
  ofertas: {
    luz: [
      // {
      //   titulo: 'Nombre de la comercializadora',
      //   descripcion: 'Precio fijo 24 h sin permanencia. Ejemplo: 0,11 €/kWh.',
      //   url: 'https://enlace-de-afiliado...',
      //   boton: 'Ver la oferta',
      // },
    ],
    seguros: [
      // {
      //   titulo: 'Comparador de seguros de coche',
      //   descripcion: 'Compara más de 30 aseguradoras en 2 minutos.',
      //   url: 'https://enlace-de-afiliado...',
      //   boton: 'Comparar seguros',
      // },
    ],
  },
};
