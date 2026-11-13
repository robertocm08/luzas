# Servidor para probar la app en tu ordenador:  python scripts/servidor-local.py
# Luego abre http://localhost:8080 en el navegador.
# Igual que "python -m http.server", pero le dice al navegador que no guarde
# copias de los archivos, para que siempre veas tus últimos cambios.
import http.server
import os

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))


class SinCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


http.server.ThreadingHTTPServer(('127.0.0.1', 8080), SinCache).serve_forever()
