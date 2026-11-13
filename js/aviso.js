// =====================================================================
// aviso.js — "Avísame antes de la hora barata".
//
// Sin un servidor no se puede enviar una notificación fiable al móvil con la
// app cerrada. Por eso ofrecemos dos caminos:
//   1. Añadir un evento al CALENDARIO del móvil con una alarma. Es lo más
//      fiable: suena aunque la app esté cerrada o el móvil sin Internet.
//   2. Una notificación del navegador, que solo funciona si la app sigue
//      abierta (aunque sea en segundo plano).
// =====================================================================

/**
 * Crea el texto de un archivo .ics (formato estándar de calendario).
 * Es una función "pura" (sin pantalla), así que también se puede probar.
 */
export function crearICS({ inicio, fin, titulo, descripcion, minutosAntes = 15, ahora = new Date() }) {
  const utc = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // 20261113T030000Z
  const limpiar = (t) => String(t).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Luzas//Ahorro luz//ES',
    'BEGIN:VEVENT',
    `UID:${utc(inicio)}-${Math.random().toString(36).slice(2)}@luzas`,
    `DTSTAMP:${utc(ahora)}`,
    `DTSTART:${utc(inicio)}`,
    `DTEND:${utc(fin)}`,
    `SUMMARY:${limpiar(titulo)}`,
    `DESCRIPTION:${limpiar(descripcion)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${limpiar(titulo)}`,
    `TRIGGER:-PT${minutosAntes}M`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Descarga el .ics: el móvil lo abre con su app de calendario. */
export function descargarICS(datos, nombreArchivo = 'aviso-luz.ics') {
  const blob = new Blob([crearICS(datos)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nombreArchivo });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Programa una notificación del navegador "minutosAntes" de la hora.
 * Devuelve un texto para explicar al usuario qué ha pasado.
 */
export async function programarNotificacion({ inicio, titulo, cuerpo, minutosAntes = 15 }) {
  if (!('Notification' in window)) return 'Este navegador no permite notificaciones. Usa la opción del calendario.';
  const permiso = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permiso !== 'granted') return 'No has dado permiso para notificaciones. Puedes usar la opción del calendario.';

  const espera = new Date(inicio).getTime() - minutosAntes * 60_000 - Date.now();
  const mostrar = async () => {
    // Si hay "service worker" (la parte de la app que funciona en segundo plano), lo usamos:
    // así la notificación aparece también en Android.
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(titulo, { body: cuerpo, icon: 'iconos/icono-192.png', tag: 'aviso-luz' });
    else new Notification(titulo, { body: cuerpo });
  };
  if (espera <= 0) { mostrar(); return 'La franja barata empieza ya. Te hemos enviado el aviso.'; }
  setTimeout(mostrar, espera);
  return 'Te avisaremos si dejas la app abierta. Para un aviso seguro con la app cerrada, usa el calendario.';
}
