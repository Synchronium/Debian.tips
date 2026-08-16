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

    python3 scripts/fixtures/http-mock.py [port] [bind] [--tls]   # default 8080, loopback

With --tls it serves the same endpoints over HTTPS with a self-signed certificate it
generates on first use, which is what the curl page's `-k` examples need: against a
certificate a browser or curl has no reason to trust, `-k` visibly changes the outcome.
Reaching a real HTTPS host instead would show `200` either way, demonstrating nothing, and
would put a third party in the path of a check that is supposed to be self-contained.

Determinism rules for anything added here: sort JSON keys, use a fixed two-space indent,
and never include a value derived from the clock, the client address, or a random source.
That extends to the framework's own headers — `Date` and `Server` are both pinned below,
so a page can print a response verbatim instead of masking half of it. (The certificate is
freshly generated and therefore different every run. That's fine, and deliberate: nothing
documented depends on which certificate it is, only on nobody trusting it.)

It listens on loopback only. Readers are told to run this on their own machine, and it is
an unauthenticated server that echoes request headers (`Authorization` included) and will
return any status code asked of it: nothing that should appear on a shared network. Pass
a bind address explicitly to widen it.
"""
import json
import os
import socket
import ssl
import subprocess
import sys
import tempfile
import time
from email.utils import parsedate_to_datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

flags = [a for a in sys.argv[1:] if a.startswith("-")]
positional = [a for a in sys.argv[1:] if not a.startswith("-")]
unknown = [f for f in flags if f != "--tls"]
if unknown:
    sys.exit(f"http-mock.py: unknown option {unknown[0]} (only --tls)")

PORT = int(positional[0]) if positional else 8080
BIND = positional[1] if len(positional) > 1 else "::1"
TLS = "--tls" in flags

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
GET  /site/index.html         a small linked site, for recursive download
GET  /top.html                one level above /site/, for --no-parent
GET  /large.bin               64KB, supports Range so a download can be resumed

Run a second copy with --tls to serve all of the above over HTTPS, with a self-signed
certificate that nothing trusts.
"""

ROBOTS = "User-agent: *\nDisallow: /site/b.html\n"

PAGE = """\
<!doctype html>
<title>Test page</title>
<h1>Test page</h1>
<p>A small static page served by the local test server.</p>
"""

# A tiny linked site, so the wget page can show recursive download, link conversion, and
# --no-parent against something with real structure. Kept small on purpose: a reader
# should be able to read the whole tree in the fixtures block.
# Deliberately not flat: -l (depth) and -np (no-parent) can only be demonstrated against a
# tree that has both a level below the starting point and a document above it.
#
#   /top.html                 above the starting directory, linked from the index
#   /site/index.html          the starting point
#   /site/{a,b}.html          one level down
#   /site/img/logo.png        an image, for -A and -R
#   /site/sub/deep.html       one level down, linking to
#   /site/sub/deeper.html     two levels down, so -l 1 visibly stops short
SITE = {
    "/site/index.html": (
        "<!doctype html>\n<title>Index</title>\n<h1>Index</h1>\n"
        '<ul>\n<li><a href="a.html">Page A</a></li>\n<li><a href="b.html">Page B</a></li>\n'
        '<li><a href="img/logo.png">Logo</a></li>\n'
        '<li><a href="sub/deep.html">Deeper</a></li>\n'
        '<li><a href="../top.html">Up a level</a></li>\n'
        '<li><a href="https://example.com/">External</a></li>\n</ul>\n',
        "text/html",
    ),
    "/site/a.html": ('<!doctype html>\n<title>Page A</title>\n<h1>Page A</h1>\n<p><a href="index.html">Back</a></p>\n', "text/html"),
    "/site/b.html": ('<!doctype html>\n<title>Page B</title>\n<h1>Page B</h1>\n<p><a href="index.html">Back</a></p>\n', "text/html"),
    "/site/sub/deep.html": ('<!doctype html>\n<title>Deeper</title>\n<h1>Deeper</h1>\n<p><a href="deeper.html">Deeper still</a></p>\n', "text/html"),
    "/site/sub/deeper.html": ('<!doctype html>\n<title>Deeper still</title>\n<h1>Deeper still</h1>\n<p>Two levels below the index.</p>\n', "text/html"),
    "/top.html": ('<!doctype html>\n<title>Top</title>\n<h1>Top</h1>\n<p>Above the site directory.</p>\n', "text/html"),
    "/site/img/logo.png": ("PNG-PLACEHOLDER-" + "0123456789" * 6 + "\n", "image/png"),
    # 64KB of deterministic filler, big enough for a partial download to be resumed.
    "/large.bin": (("0123456789abcdef" * 4 + "\n") * 1000, "application/octet-stream"),
}

# Fixed so that -N (timestamping) and -S (server response) print the same thing on every
# run. A real server would send the file's own mtime.
LAST_MODIFIED = "Sun, 05 Jul 2026 15:35:00 GMT"

# Every response carries a Date header, generated from the clock by the framework. Pinning
# it is the difference between a page printing `curl -i` output verbatim and a page having
# to mask a line — and a masked line is one a reader can never check.
DATE = "Sun, 05 Jul 2026 15:40:00 GMT"


def body(handler):
    """Reads the request body, decoded as UTF-8."""
    length = int(handler.headers.get("Content-Length") or 0)
    return handler.rfile.read(length).decode("utf-8") if length else ""


class Handler(BaseHTTPRequestHandler):
    # A fixed token rather than the real Python and OS versions, so the Server header
    # cannot shift when the image is rebuilt.
    server_version = "mockhttp/1.0"
    sys_version = ""

    def version_string(self):
        """`server_version + " " + sys_version`, the default, leaves a trailing space on
        every Server header when sys_version is empty. Invisible, legal, and enough to
        make a page that prints the header not quite byte-for-byte true."""
        return self.server_version

    def date_time_string(self, timestamp=None):
        """Pinned; see DATE."""
        return DATE

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
        # A HEAD response must not carry a body. It went unnoticed here because HTTP/1.0
        # closes the connection, so the stray bytes died with the socket — but `wget
        # --spider` against a JSON endpoint was reading them, and under keep-alive it
        # would desynchronise every request after it.
        if self.command != "HEAD":
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

    def send_static(self, text, content_type):
        """Serves a file, honouring a Range request so `wget -c` can resume a partial
        download, and sending a fixed Last-Modified so `wget -N` has something stable to
        compare against."""
        # wget -N (and curl -z) ask with If-Modified-Since and expect a 304 when the file
        # has not changed. Without this the client reports that the server ignored the
        # header, and timestamping silently turns itself off.
        #
        # The date is compared rather than assumed. Answering 304 to any conditional
        # request at all made the "not modified" branch the only branch this server could
        # express: a reader who backdated their local copy to see wget fetch it again was
        # told "not modified" by a server that had not read the question.
        since = self.headers.get("If-Modified-Since")
        if since:
            try:
                unchanged = parsedate_to_datetime(since) >= parsedate_to_datetime(LAST_MODIFIED)
            except (TypeError, ValueError):
                unchanged = False  # an unparseable date is not a claim about anything
            if unchanged:
                self.send_response(304)
                self.send_header("Last-Modified", LAST_MODIFIED)
                self.end_headers()
                return

        raw = text.encode()
        start = 0
        rng = self.headers.get("Range", "")
        if rng.startswith("bytes="):
            try:
                start = int(rng.split("=", 1)[1].split("-", 1)[0])
            except ValueError:
                start = -1  # malformed: not a request for the whole file
            # A range that starts at or past the end is unsatisfiable. Answering 200 with
            # the whole file instead means `wget -c` on an already-complete download
            # fetches it all over again rather than reporting that there is nothing to do.
            if start >= len(raw) or start < 0:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{len(raw)}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
        partial = 0 < start < len(raw)
        chunk = raw[start:] if partial else raw
        self.send_response(206 if partial else 200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(chunk)))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Last-Modified", LAST_MODIFIED)
        if partial:
            self.send_header("Content-Range", f"bytes {start}-{len(raw) - 1}/{len(raw)}")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(chunk)

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
        if path in SITE:
            return self.send_static(*SITE[path])
        # A directory URL serves its index, the way a real server does — `wget -r` starts
        # from http://host/site/ rather than naming index.html itself.
        if path.endswith("/") and path + "index.html" in SITE:
            return self.send_static(*SITE[path + "index.html"])
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


def self_signed_cert():
    """A throwaway localhost certificate, generated once per temp directory.

    Nothing trusts it, which is the entire point: it is what lets the page show curl
    refusing a connection and then accepting the same one under `-k`. Generated rather
    than committed, because a private key in a public repository is a bad habit even when
    the key is worthless.
    """
    directory = os.path.join(tempfile.gettempdir(), "http-mock-tls")
    os.makedirs(directory, exist_ok=True)
    cert = os.path.join(directory, "cert.pem")
    key = os.path.join(directory, "key.pem")
    if not (os.path.exists(cert) and os.path.exists(key)):
        subprocess.run(
            ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
             "-keyout", key, "-out", cert, "-days", "365", "-subj", "/CN=localhost"],
            check=True,
            capture_output=True,
        )
    return cert, key


class V6Server(ThreadingHTTPServer):
    """Listens on IPv6, which is what `localhost` resolves to first.

    Binding IPv4-only makes every client that tries ::1 first print a "Connection
    refused" line before falling back, and that lands in the middle of the documented
    output on both pages. The default bind is ::1 — loopback — so use `localhost` in a
    URL rather than 127.0.0.1, which a socket bound to ::1 will not accept.
    """

    address_family = socket.AF_INET6


if __name__ == "__main__":
    server = V6Server((BIND, PORT), Handler)
    if TLS:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(*self_signed_cert())
        server.socket = context.wrap_socket(server.socket, server_side=True)
    server.serve_forever()
