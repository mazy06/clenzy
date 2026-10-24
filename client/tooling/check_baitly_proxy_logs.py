#!/usr/bin/env python3
"""Test the shipped frontend nginx configuration offline, without Docker."""
import http.client
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[2]


class BaitlyProxyLogs(unittest.TestCase):
    def test_frontend_preserves_spa_cache_and_404_without_private_access_or_errors(self):
        with tempfile.TemporaryDirectory(prefix='baitly-frontend-log-') as folder:
            directory = Path(folder)
            (directory / 'logs').mkdir()
            html = directory / 'html'
            html.mkdir()
            (html / 'index.html').write_text('baitly-spa-canary')
            (html / 'baitly-config.js').write_text('baitly-runtime-canary')
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            config = (ROOT / 'client/nginx.conf').read_text()
            config = config.replace('listen 80;', f'listen 127.0.0.1:{port};')
            config = config.replace('/usr/share/nginx/html', str(html))
            config = config.replace('/etc/nginx/', str(directory / 'absent') + '/')
            path = directory / 'nginx.conf'
            path.write_text(f'worker_processes 1;\npid {directory}/nginx.pid;\n'
                            f'error_log {directory}/errors.log warn;\nevents {{}}\nhttp {{\n'
                            'client_body_temp_path body;\nproxy_temp_path proxy;\n'
                            'fastcgi_temp_path fastcgi;\nuwsgi_temp_path uwsgi;\nscgi_temp_path scgi;\n'
                            f'access_log {directory}/access.log;\n{config}\n}}\n')
            process = subprocess.Popen([os.environ.get('NGINX_BINARY', 'nginx'), '-p', folder,
                                        '-c', str(path), '-g', 'daemon off;'],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                for _ in range(100):
                    try:
                        with socket.create_connection(('127.0.0.1', port), timeout=.1):
                            break
                    except OSError:
                        if process.poll() is not None:
                            self.fail('Isolated frontend nginx failed to start')
                        time.sleep(.02)
                else:
                    self.fail('Isolated frontend nginx did not become ready')
                private = 'SYNTHETIC_PRIVATE_email_token_PIN_92841'
                for route, expected in [('/documents/' + private, 200), ('/missing-' + private + '.js', 404),
                                        ('/baitly-config.js', 200), ('/robots.txt', 404)]:
                    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=3)
                    try:
                        connection.request('GET', route + '?token=' + private,
                                           headers={'Authorization': 'Bearer ' + private, 'Cookie': private,
                                                    'Referer': 'https://example.test/' + private})
                        response = connection.getresponse()
                        body = response.read()
                        self.assertEqual(response.status, expected)
                        if expected == 200:
                            self.assertIn('no-cache', response.getheader('Cache-Control'))
                            self.assertIn(b'baitly-', body)
                    finally:
                        connection.close()
            finally:
                if process.poll() is None:
                    process.terminate()
                process.wait(timeout=5)
            self.assertEqual((directory / 'access.log').read_text(), '')
            self.assertEqual((directory / 'errors.log').read_text(), '')

    def test_legacy_proxy_format_does_not_reference_request_fields(self):
        config = (ROOT / 'nginx/nginx.prod.conf').read_text()
        self.assertIn('error_log /dev/null;', config)
        logging = config.split('log_format baitly_security escape=json', 1)[1].split(';', 1)[0]
        self.assertIn('BAITLY_PROXY_ACCESS', logging)
        self.assertIn('$status', logging)
        self.assertIn('$request_time', logging)
        for field in ['$request"', '$request_uri', '$uri', '$host', '$remote_addr', '$remote_user', '$http_']:
            self.assertNotIn(field, logging)
        self.assertNotIn('log_format main', config)


if __name__ == '__main__':
    unittest.main()
