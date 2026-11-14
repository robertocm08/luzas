# 🍠⚡ Batata — Ahorra en luz y gasolina

App web gratuita, pensada para el móvil, que ayuda a cualquier persona a pagar menos:

- **Luz por horas (PVPC):** precio de cada hora de hoy y de mañana, con colores (barato / normal / caro),
  las mejores horas para poner la lavadora y otros aparatos de 1, 2 y 3 horas, cuánto se ahorra y un aviso
  en el calendario antes de la hora barata.
- **Gasolineras más baratas** cerca de ti (con tu ubicación) o de un municipio, por combustible
  (gasolina 95, 98, diésel, diésel premium, autogás), en mapa y lista ordenada por precio o distancia, con
  cuánto ahorras llenando el depósito frente a la media de la zona.
- **Paga menos:** consejos, el comparador oficial de la CNMC y ofertas de luz y seguros de coche
  (enlaces de afiliado, siempre marcados como «Publicidad»).

👉 **App publicada:** <https://robertocm08.github.io/luzas/>

Se instala en el móvil como una app (PWA), funciona sin conexión con los últimos datos descargados, tiene
modo oscuro y textos grandes. **Tu ubicación nunca sale de tu móvil.**

## De dónde salen los datos

| Dato | Fuente oficial | Cómo llega a la app |
|---|---|---|
| Precio de la luz PVPC 2.0TD (€/kWh, sin impuestos) | [Red Eléctrica de España — apidatos.ree.es](https://www.ree.es/es/datos/apidatos) | Una GitHub Action lo descarga cada hora y lo publica como `data/luz.json`. Si falta o está viejo, la app pregunta directamente a REE. |
| Precios de carburantes | [Ministerio — sedeaplicaciones.minetur.gob.es](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/) | La GitHub Action descarga cada hora los 12 MB del Ministerio y los reduce a `data/gasolineras.json` (≈1,5 MB, ≈400 KB comprimido): solo gasolineras abiertas al público y solo los datos que usa la app. Si falta, la app los pide directamente al Ministerio. |
| Mapa | [OpenStreetMap](https://www.openstreetmap.org/copyright) con [Leaflet](https://leafletjs.com) | Se carga solo al abrir la pestaña Gasolina. |

**Cómo se calcula el ahorro:** se toman las gasolineras con ese combustible a menos de 10 km (si hay menos
de 5, el radio pasa a 25 o 50 km). La media de la zona es la media de sus precios, y el ahorro de cada una es
`(media − precio) × litros del depósito`.

**Privacidad:** la ubicación solo se usa en el navegador para medir distancias; no se guarda ni se envía.
En el móvil solo se recuerdan el combustible, los litros del depósito y el último municipio buscado.

Los datos descargados **no** se guardan en el historial del repositorio (crecería sin parar): se publican
directamente junto a la app en cada ejecución.

## Cómo está organizado

```
index.html            Página única con 4 pestañas
css/estilos.css       Aspecto: móvil primero, modo oscuro, accesible
js/calculos.js        Solo cálculos (mejores franjas, ahorro…) → es lo que se prueba
js/datos-luz.js       Consigue los precios (archivo propio → REE → copia guardada)
js/luz.js             Dibuja la pantalla de la luz
js/aviso.js           Aviso por calendario (.ics) o notificación
js/calculos-gasolina.js  Distancias, media de la zona, ahorro, orden, búsqueda de municipios
js/datos-gasolina.js  Consigue las gasolineras y guarda las preferencias
js/gasolina.js        Dibuja la pantalla de gasolineras
js/mapa.js            Mapa (Leaflet + OpenStreetMap)
js/config.js          ⭐ Anuncios, afiliados y datos del titular (el archivo para ganar dinero)
js/consentimiento.js  Aviso de cookies (RGPD)
js/anuncios.js        Huecos de publicidad (solo con permiso)
js/pagamenos.js       Sección «Paga menos»
js/app.js             Arranque: pestañas, tema, carga de datos
privacidad.html       Política de privacidad y cookies; permite cambiar la decisión
sw.js, manifest.json  Lo que la hace instalable y usable sin conexión
scripts/              Descarga de datos (GitHub Action) y servidor local
tests/                Pruebas automáticas
.github/workflows/    Pruebas en cada cambio + datos y publicación cada hora
```

## Probarla en tu ordenador

Necesitas Python (para servir los archivos):

```bash
python scripts/servidor-local.py
```

Abre <http://localhost:8080>. Las pruebas se pueden ver en <http://localhost:8080/tests/navegador.html>,
o con Node 22 o superior: `npm test`.

## Publicarla gratis en GitHub Pages

1. Sube el proyecto a un repositorio **público** de GitHub.
2. En el repositorio: **Settings → Pages → Source: GitHub Actions**.
3. La Action **Publicar** se ejecuta sola en cada cambio y cada hora. También puedes lanzarla a mano en
   **Actions → Publicar → Run workflow**.
4. La app queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`.

Si una ejecución falla, GitHub te avisa por correo. Si una API oficial falla, se mantiene la copia de datos
publicada anteriormente.

> Nota: GitHub desactiva las tareas programadas de un repositorio público tras 60 días sin actividad.
> Si ocurre, basta con entrar en **Actions** y volver a activarlas.

## Ganar dinero con la app

Todo se configura en **[`js/config.js`](js/config.js)**. Mantener la app no cuesta nada: GitHub Pages y
GitHub Actions son gratis para repositorios públicos.

### 0. Antes de nada: tus datos como titular

La ley española (LSSI) obliga a identificar al responsable de una web con publicidad. Rellena `titular`
(nombre, correo y, si tienes actividad económica, NIF) en `config.js`. Aparecerá en `privacidad.html`.

### 1. Enlaces de afiliado («Paga menos»)

1. Date de alta en programas de afiliados de comercializadoras de luz o comparadores de seguros
   (por ejemplo, a través de redes de afiliación como Awin o TradeDoubler).
2. Copia en `config.js` → `ofertas.luz` u `ofertas.seguros` un bloque por oferta:
   ```js
   { titulo: 'Nombre', descripcion: 'Qué ofrece', url: 'https://tu-enlace-de-afiliado', boton: 'Ver la oferta' },
   ```
3. Sube el cambio. La oferta aparece marcada como **Publicidad**, con `rel="sponsored"`. Solo se aceptan
   enlaces `https`.

Los enlaces de afiliado no usan cookies dentro de la app, así que no necesitan el aviso de cookies.

### 2. Anuncios (Google AdSense)

1. Solicita una cuenta en <https://adsense.google.com>. Ten en cuenta que **AdSense pide que el sitio esté
   en la raíz de un dominio** para colocar el archivo `ads.txt`. En `robertocm08.github.io/luzas/` no se
   puede, así que tendrás que **usar un dominio propio** (unos 10 €/año). En GitHub: **Settings → Pages →
   Custom domain**. Después crea un archivo `ads.txt` en la raíz del proyecto con la línea que te da AdSense
   y añádelo a la lista de archivos que se publican en `.github/workflows/publicar.yml`.
2. En AdSense crea 3 bloques de anuncios «display» adaptables y copia sus números en
   `anuncios.huecos` (`inicio`, `luz`, `gasolina`). Pon tu ID de editor (`ca-pub-…`) en `anuncios.cliente`.
3. Cambia `anuncios.activo` a `true` y sube el cambio.

**Consentimiento de cookies (RGPD):** con los anuncios activos, la app muestra un aviso con «Aceptar» y
«Rechazar» igual de visibles y **no carga nada de Google hasta que el usuario acepta**. La decisión dura
12 meses y se puede cambiar en `privacidad.html`. Si rechaza, no se muestran anuncios.

> ⚠️ Google exige en Europa un **gestor de consentimiento certificado (CMP, marco TCF)** para servir
> anuncios. El más sencillo es el gratuito de Google: en AdSense → **Privacidad y mensajes → RGPD**. Si lo
> activas, ese mensaje sustituye al nuestro: pon `activo: true` igualmente, pero sube `VERSION_CONSENTIMIENTO`
> o simplifica `iniciarAnuncios()` para no preguntar dos veces. Sin CMP certificado, Google puede mostrar
> pocos anuncios o ninguno.

**Ver los huecos sin cuenta de AdSense:** abre la app con `?anuncios=demo`
(por ejemplo `http://localhost:8080/?anuncios=demo`). Verás el aviso de cookies y unas cajas de ejemplo
donde irán los anuncios. No se carga nada externo.

### Dónde aparecen los anuncios

Uno al final de Inicio, otro al final de Luz y otro al final de Gasolina. Nunca entre botones ni encima de
la información, para que no molesten. Ocultos y sin ocupar espacio mientras no haya permiso.

## Pruebas automáticas

Se ejecutan en GitHub en cada cambio (pestaña **Actions → Pruebas**). Si alguna falla, no se publica nada.

| Archivo | Qué comprueba |
|---|---|
| `tests/calculos-luz.test.mjs` | Mejores franjas de 1-3 h, ahorro, horas pasadas, colores, días de 23 h |
| `tests/aviso.test.mjs` | Archivo de calendario con la hora y la alarma correctas |
| `tests/calculos-gasolina.test.mjs` | Distancias, radio adaptable, ahorro por depósito, orden, municipios |
| `tests/consentimiento.test.mjs` | Aceptar/rechazar, caducidad a 12 meses, cambios de versión |
| `tests/ingresos.test.mjs` | Solo ofertas con enlace `https`, anuncios apagados por defecto |
