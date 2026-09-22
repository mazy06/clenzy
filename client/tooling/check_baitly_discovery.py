#!/usr/bin/env python3
"""Exercise built Baitly HTTP discovery with native nginx, never Docker or a preview."""
import argparse
import http.client
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET
from contextlib import contextmanager


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
            assert all(url.startswith(f"https://{host}/") for url in urls)
            assert not any("inscription" in url or "activation" in url or ":slug" in url for url in urls)
            status, headers, body = request(port, "/robots.txt", host=host)
            assert status == 200 and headers["content-type"] == "text/plain; charset=utf-8"
            assert f"Sitemap: https://{host}/sitemap.xml" in body
        paths = [url.removeprefix("https://baitly.ma") for url in urls]
        for path in paths:
            for language in ["fr", "en", "ar"]:
                status, headers, body = request(port, f"{path}?lang={language}", "text/markdown")
                assert status == 200, (path, status)
                assert headers["content-type"] == "text/markdown; charset=utf-8", (path, headers)
                assert headers["content-language"] == ("fr" if path.startswith("/legal/") else language)
                assert body.startswith("# ") and len(body) > 100
                assert "Accept" in headers["vary"] and "no-store" in headers["cache-control"]
                assert 'rel="describedby"' in headers["link"]
                count += 1
            status, headers, body = request(port, path)
            assert status == 200 and headers["content-type"].startswith("text/html")
            assert '<div id="root">' in body
            assert 'rel="describedby"' in headers["link"] and "Accept" in headers["vary"]
        for accept in [None, "*/*", "text/html", "text/markdown;q=0", "text/markdown; q=0.000, text/html", "application/text/markdown"]:
            assert request(port, "/", accept)[1]["content-type"].startswith("text/html"), accept
        for accept in ["text/markdown", "TEXT/MARKDOWN", "text/markdown;q=0.5", "text/html;q=0.5, text/markdown;q=1", "text/markdown;q=0, text/markdown;q=1"]:
            assert request(port, "/", accept)[1]["content-type"].startswith("text/markdown"), accept
        status, headers, body = request(port, "/", "text/markdown", method="HEAD")
        assert status == 200 and headers["content-type"].startswith("text/markdown") and not body
        assert request(port, "/?lang=../en", "text/markdown")[1]["content-language"] == "fr"
        for path in ["/prestataires/inscription", "/prestataires/activation?token=private", "/unknown"]:
            assert request(port, path, "text/markdown")[1]["content-type"].startswith("text/html")
        assert request(port, "/_baitly-markdown/fr/index.md")[0] == 404
        status, headers, body = request(port, "/llms.txt")
        assert status == 200 and headers["content-type"].startswith("text/plain") and body.startswith("# Baitly")
    with nginx_server(binary, client, "dist", False) as port:
        assert request(port, "/robots.txt")[0] == 200
        assert request(port, "/sitemap.xml")[0] == 404
        assert request(port, "/", "text/markdown")[1]["content-type"].startswith("text/html")
        assert "link" not in request(port, "/")[1]
    print(f"PASS: {len(paths)} sitemap URLs, {count} Markdown representations, GET/HEAD, Accept/q=0, languages, cache, Link, multiple hosts, private paths and PMS isolation")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--nginx", default=shutil.which("nginx") or os.environ.get("NGINX_BINARY"))
    args = parser.parse_args()
    if not args.nginx:
        parser.error("A native nginx binary is required (--nginx)")
    check(Path(__file__).resolve().parent.parent, args.nginx)
