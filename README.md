# 💡⛽ Luzas — Ahorra en luz y gasolina

App web gratuita, pensada para el móvil, que ayuda a cualquier persona a pagar menos:

- **Luz por horas (PVPC):** precio de cada hora de hoy y de mañana, con colores (barato / normal / caro),
  las mejores horas para poner la lavadora y otros aparatos de 1, 2 y 3 horas, cuánto se ahorra y un aviso
  en el calendario antes de la hora barata.
- **Gasolineras más baratas** cerca de ti (con tu ubicación) o de un municipio, por combustible
  (gasolina 95, 98, diésel, diésel premium, autogás), en mapa y lista ordenada por precio o distancia, con
  cuánto ahorras llenando el depósito frente a la media de la zona.
- **Paga menos:** ofertas de luz y seguros *(fase 3)*.

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
js/app.js             Arranque: pestañas, tema, carga de datos
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
