from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse,unquote
ROOT=Path(__file__).resolve().parents[2]
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):
  route=unquote(urlparse(path).path)
  if route in ['/','/goals']:
   return '/private/tmp/godly-kids-goal-playtest.html'
  if route in ['/homeworld/index.html','/homeworld/living-test.html']:
   return str(ROOT/'homeworld/dist/index.html')
  if route.startswith('/homeworld/assets/'):
   asset=ROOT/'homeworld/dist/assets'/Path(route).name
   if asset.is_file():return str(asset)
  relative=Path(route.lstrip('/'))
  if '..' in relative.parts:return str(ROOT/'public/not-found')
  return str(ROOT/'public'/relative)
 def end_headers(self):
  self.send_header('Cache-Control','no-cache')
  super().end_headers()
ThreadingHTTPServer(('127.0.0.1',5188),Handler).serve_forever()
