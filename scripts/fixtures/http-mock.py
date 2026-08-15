#!/usr/bin/env python3
"""A small local HTTP server for the curl and wget content pages.

Those pages need endpoints that echo a request back, return a chosen status, redirect,
delay, set a cookie, or demand basic auth. Public services that do this (httpbin.org and
friends) are third-party, frequently down, and answer with values that change on every
request — a trace id, the caller's public IP, a date. None of that can be documented as
exact output, which is why the pages that used them had illustrative rather than real
responses.

Running it locally makes the responses ours, and therefore reproducible. The examples on
those pages point at this server, and the pages say how to start it, so a reader can
recreate every result rather than take it on trust.

    python3 scripts/fixtures/http-mock.py [port]     # default 8080

Determinism rules for anything added here: sort JSON keys, use a fixed two-space indent,
and never include a value derived from the clock, the client address, or a random source.
"""
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

INDEX = """\
Local test server for the curl and wget pages.

GET  /get                     echo the query string and request headers
POST /post                    echo the body, as form fields or JSON
PUT  /put                     echo the body
DELETE /delete                echo the request
GET  /headers                 echo the request headers only
GET  /user-agent              echo the User-Agent header only
GET  /basic-auth/user/pass    401 until the right credentials arrive
GET  /cookies/set/NAME/VALUE  set a cookie, then redirect to /cookies
GET  /cookies                 echo the cookies the request carried
GET  /redirect/N              redirect N times, then land on /get
GET  /status/CODE             answer with that status code
GET  /delay/SECONDS           wait, then answer
GET  /robots.txt              a small static file
GET  /page.html               a small static HTML page
"""

ROBOTS = "User-agent: *\nDisallow: /deny\n"

PAGE = """\
<!doctype html>
<title>Test page</title>
<h1>Test page</h1>
<p>A small static page served by the local test server.</p>
"""


def body(handler):
    """Reads the request body, decoded as UTF-8."""
    length = int(handler.headers.get("Content-Length") or 0)
    return handler.rfile.read(length).decode("utf-8") if length else ""


class Handler(BaseHTTPRequestHandler):
    # A fixed token rather than the real Python and OS versions, so the Server header
    # cannot shift when the image is rebuilt.
    server_version = "mockhttp/1.0"
    sys_version = ""

    def log_message(self, *args):
        """Silent: the server runs in the background during a replay."""

    # --- helpers ----------------------------------------------------------------
    def send_json(self, payload, status=200, extra_headers=()):
        raw = json.dumps(payload, indent=2, sort_keys=True).encode() + b"\n"
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        for key, value in extra_headers:
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(raw)

    def send_text(self, text, status=200, content_type="text/plain", extra_headers=()):
        raw = text.encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        for key, value in extra_headers:
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(raw)

    def request_headers(self):
        """The headers a caller would recognise, with the hop-by-hop noise dropped."""
        keep = ("Accept", "Accept-Encoding", "Authorization", "Content-Length",
                "Content-Type", "Cookie", "Host", "User-Agent", "X-Test")
        return {k: v for k, v in sorted(self.headers.items()) if k in keep}

    def echo(self, url, data=""):
        parsed = urlparse(url)
        payload = {
            "args": {k: v[0] for k, v in parse_qs(parsed.query).items()},
            "headers": self.request_headers(),
            "url": f"http://{self.headers.get('Host', f'localhost:{PORT}')}{url}",
        }
        if self.command in ("POST", "PUT"):
            content_type = self.headers.get("Content-Type", "")
            payload["data"] = "" if "form-urlencoded" in content_type else data
            payload["form"] = (
                {k: v[0] for k, v in parse_qs(data).items()} if "form-urlencoded" in content_type else {}
            )
            try:
                payload["json"] = json.loads(data) if data else None
            except ValueError:
                payload["json"] = None
        return payload

    # --- routing ----------------------------------------------------------------
    def route(self):
        path = urlparse(self.path).path
        parts = [p for p in path.split("/") if p]

        if path == "/":
            return self.send_text(INDEX)
        if path == "/robots.txt":
            return self.send_text(ROBOTS)
        if path == "/page.html":
            return self.send_text(PAGE, content_type="text/html")
        if path in ("/get", "/post", "/put", "/delete"):
            return self.send_json(self.echo(self.path, body(self)))
        if path == "/headers":
            return self.send_json({"headers": self.request_headers()})
        if path == "/user-agent":
            return self.send_json({"user-agent": self.headers.get("User-Agent", "")})

        if parts[:1] == ["basic-auth"] and len(parts) == 3:
            import base64

            expected = "Basic " + base64.b64encode(f"{parts[1]}:{parts[2]}".encode()).decode()
            if self.headers.get("Authorization") != expected:
                return self.send_json(
                    {"authenticated": False},
                    401,
                    [("WWW-Authenticate", 'Basic realm="Fake Realm"')],
                )
            return self.send_json({"authenticated": True, "user": parts[1]})

        if parts[:2] == ["cookies", "set"] and len(parts) == 4:
            return self.send_text(
                "",
                302,
                extra_headers=[("Location", "/cookies"), ("Set-Cookie", f"{parts[2]}={parts[3]}; Path=/")],
            )
        if path == "/cookies":
            raw = self.headers.get("Cookie", "")
            jar = dict(c.strip().split("=", 1) for c in raw.split(";") if "=" in c)
            return self.send_json({"cookies": jar})

        if parts[:1] == ["redirect"] and len(parts) == 2 and parts[1].isdigit():
            remaining = int(parts[1]) - 1
            target = "/get" if remaining <= 0 else f"/redirect/{remaining}"
            return self.send_text("", 302, extra_headers=[("Location", target)])
        if parts[:1] == ["status"] and len(parts) == 2 and parts[1].isdigit():
            return self.send_text("", int(parts[1]))
        if parts[:1] == ["delay"] and len(parts) == 2 and parts[1].isdigit():
            time.sleep(min(int(parts[1]), 30))
            return self.send_json(self.echo(self.path, body(self)))

        return self.send_text("Not Found\n", 404)

    do_GET = do_POST = do_PUT = do_DELETE = do_HEAD = route


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
