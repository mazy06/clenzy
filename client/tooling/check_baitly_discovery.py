#!/usr/bin/env python3
"""Exercise built Baitly HTTP discovery with native nginx, never Docker or a preview."""
import argparse
import http.client
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
from html.parser import HTMLParser
import time
import xml.etree.ElementTree as ET
from contextlib import contextmanager
from urllib.parse import urlsplit


class WatchPage(HTMLParser):
    def __init__(self):
        super().__init__()
        self.video = None
        self.json_ld = ''
        self.in_json_ld = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'video':
            self.video = attrs
        if tag == 'script' and attrs.get('id') == 'baitly-video-ld':
            self.in_json_ld = True

    def handle_data(self, data):
        if self.in_json_ld:
            self.json_ld += data

    def handle_endtag(self, tag):
        if tag == 'script':
            self.in_json_ld = False


@contextmanager
def nginx_server(binary, client, build, discovery):
    with tempfile.TemporaryDirectory(prefix="baitly-discovery-") as directory:
        prefix = Path(directory)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        configuration = (client / "nginx.conf").read_text()
        configuration = configuration.replace("listen 80;", f"listen 127.0.0.1:{port};")
        configuration = configuration.replace("/usr/share/nginx/html", str(client / build))
        include_directory = client / "site-discovery-nginx" if discovery else prefix / "absent"
        configuration = configuration.replace("/etc/nginx/baitly-discovery", str(include_directory))
        config = prefix / "nginx.conf"
        config.write_text(
            f"pid {prefix}/nginx.pid;\nerror_log {prefix}/error.log;\nevents {{}}\nhttp {{\n"
            "types { text/html html; application/javascript js; text/css css; }\n"
            "access_log off;\nclient_body_temp_path body;\nproxy_temp_path proxy;\n"
            "fastcgi_temp_path fastcgi;\nuwsgi_temp_path uwsgi;\nscgi_temp_path scgi;\n"
            + configuration + "\n}\n"
        )
        command = [binary, "-p", str(prefix), "-c", str(config)]
        subprocess.run(command + ["-t"], check=True, capture_output=True)
        process = subprocess.Popen(command + ["-g", "daemon off;"], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        try:
            for _ in range(100):
                if process.poll() is not None:
                    raise RuntimeError(process.stderr.read().decode())
                try:
                    with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                        break
                except OSError:
                    time.sleep(0.02)
            else:
                raise RuntimeError("nginx did not start")
            yield port
        finally:
            process.terminate()
            process.communicate(timeout=5)


def request(port, path, accept=None, method="GET", host="baitly.fr"):
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    headers = {"Host": host}
    if accept is not None:
        headers["Accept"] = accept
    try:
        connection.request(method, path, headers=headers)
        response = connection.getresponse()
        return response.status, dict((key.lower(), value) for key, value in response.getheaders()), response.read().decode()
    finally:
        connection.close()


def check(client, binary):
    count = 0
    with nginx_server(binary, client, "dist-site", True) as port:
        for host in ["baitly.fr", "baitly.ma"]:
            status, headers, body = request(port, "/sitemap.xml", host=host)
            assert status == 200 and headers["content-type"] == "application/xml; charset=utf-8", (status, headers)
            root = ET.fromstring(body)
            urls = [element.text for element in root.findall("{*}url/{*}loc")]
            assert len(urls) == len(set(urls)) and len(urls) > 10
            # Alternate serving domains retain the same canonical search identity.
            assert all(url.startswith("https://baitly.fr/") for url in urls)
            assert not any("inscription" in url or "activation" in url or ":slug" in url for url in urls)
            status, headers, body = request(port, "/robots.txt", host=host)
            assert status == 200 and headers["content-type"] == "text/plain; charset=utf-8"
            assert "Sitemap: https://baitly.fr/sitemap.xml" in body
            assert "Sitemap: https://baitly.fr/sitemap-videos.xml" in body
        status, headers, body = request(port, '/sitemap-videos.xml')
        assert status == 200 and headers['content-type'] == 'application/xml; charset=utf-8'
        video_entries = ET.fromstring(body).findall('{*}url')
        assert video_entries
        for entry in video_entries:
            loc = entry.findtext('{*}loc')
            assert loc in urls, loc
            parsed = urlsplit(loc)
            status, _, html = request(port, parsed.path + (f'?{parsed.query}' if parsed.query else ''))
            assert status == 200
            watch = WatchPage()
            watch.feed(html)
            data = json.loads(watch.json_ld)
            assert watch.video and 'controls' in watch.video, loc
            assert watch.video['src'] == data['contentUrl'] == entry.findtext('{*}video/{*}content_loc'), loc
            assert watch.video['poster'] == data['thumbnailUrl'][0] == entry.findtext('{*}video/{*}thumbnail_loc'), loc
            assert data['mainEntityOfPage'] == loc, loc
        for url in urls:
            parsed = urlsplit(url)
            path = parsed.path + (f"?{parsed.query}" if parsed.query else "")
            status, headers, body = request(port, path)
            assert status == 200, (url, status)
            assert f'<link rel="canonical" href="{url}">' in body, url
            assert '<h1' in body and '<main' in body, url
        paths = sorted({urlsplit(url).path for url in urls})
        for path in paths:
            for language in ["fr", "en", "ar"]:
                status, headers, body = request(port, f"{path}?lang={language}", "text/markdown")
                assert status == 200, (path, status)
                assert headers["content-type"] == "text/markdown; charset=utf-8", (path, headers)
                article = path.startswith("/ressources/blog/")
                content_language = "fr" if article and language == "en" else language
                assert headers["content-language"] == content_language, (path, headers)
                if article and language == "ar":
                    assert any("\u0600" <= char <= "\u06ff" for char in body.splitlines()[0]), path
                assert body.startswith("# ") and len(body) > 100
                assert "Accept" in headers["vary"] and "no-store" in headers["cache-control"]
                assert 'rel="describedby"' in headers["link"]
                count += 1
            status, headers, body = request(port, path)
            assert status == 200 and headers["content-type"].startswith("text/html")
            # Le conteneur porte l'URL publiée (data-baitly-url) pour l'hydratation.
            assert '<div id="root"' in body and '<!--baitly-content:start-->' in body, path
            assert 'rel="describedby"' in headers["link"] and "Accept" in headers["vary"]
        for accept in [None, "*/*", "text/html", "text/markdown;q=0", "text/markdown; q=0.000, text/html", "application/text/markdown"]:
            assert request(port, "/", accept)[1]["content-type"].startswith("text/html"), accept
        for accept in ["text/markdown", "TEXT/MARKDOWN", "text/markdown;q=0.5", "text/html;q=0.5, text/markdown;q=1", "text/markdown;q=0, text/markdown;q=1"]:
            assert request(port, "/", accept)[1]["content-type"].startswith("text/markdown"), accept
        status, headers, body = request(port, "/", "text/markdown", method="HEAD")
        assert status == 200 and headers["content-type"].startswith("text/markdown") and not body
        assert request(port, "/?lang=../en", "text/markdown")[1]["content-language"] == "fr"
        for path in ["/prestataires/inscription", "/prestataires/activation?token=private", "/inscription", "/register"]:
            status, headers, body = request(port, path, "text/markdown")
            assert status == 200 and headers["content-type"].startswith("text/html"), (path, status, headers)
            assert '<meta name="robots" content="noindex, follow">' in body
            assert "link" not in headers
        for language in ["fr", "en", "ar"]:
            status, headers, body = request(port, f"/unknown?lang={language}")
            assert status == 404 and headers["content-type"].startswith("text/html")
            assert f'<html lang="{language}"' in body
            assert '<title>404 | Baitly</title>' in body
        assert request(port, "/_baitly-markdown/fr/index.md")[0] == 404
        assert request(port, "/_baitly-html/fr/index.html")[0] == 404
        status, headers, body = request(port, "/llms.txt")
        assert status == 200 and headers["content-type"].startswith("text/plain") and body.startswith("# Baitly")
    with nginx_server(binary, client, "dist", False) as port:
        assert request(port, "/robots.txt")[0] == 200
        assert request(port, "/sitemap.xml")[0] == 404
        assert request(port, "/sitemap-videos.xml")[0] == 404
        assert request(port, "/", "text/markdown")[1]["content-type"].startswith("text/html")
        assert "link" not in request(port, "/")[1]
    print(f"PASS: {len(urls)} canonical sitemap URLs, {len(video_entries)} videos, {count} Markdown representations, GET/HEAD, Accept/q=0, languages, cache, Link, multiple hosts, private paths and PMS isolation")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--nginx", default=shutil.which("nginx") or os.environ.get("NGINX_BINARY"))
    args = parser.parse_args()
    if not args.nginx:
        parser.error("A native nginx binary is required (--nginx)")
    check(Path(__file__).resolve().parent.parent, args.nginx)
