#!/usr/bin/env python3
"""Static local preview only. Never reads/writes a live Supabase project."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        super().end_headers()
    def do_GET(self):
        if any(part.startswith('.') for part in self.path.split('/') if part):
            self.send_error(404); return
        super().do_GET()
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
print(f'Kalam Se Kranti local preview: http://0.0.0.0:{port}', flush=True)
ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
