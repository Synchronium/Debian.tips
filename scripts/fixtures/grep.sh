# Reconstructed from the documented outputs, then proven by scripts/replay/command-page.ts.
cat > app.log <<'EOF'
Jul  5 09:14:22 deb1 app[312]: error: connection refused
Jul  5 09:14:23 deb1 app[312]: warning: retrying in 5s
Jul  5 09:14:25 deb1 app[312]: info: retry scheduled
Jul  5 09:14:28 deb1 app[312]: error: connection refused
Jul  5 09:14:33 deb1 app[312]: info: connected
Jul  5 09:15:01 deb1 app[313]: Traceback (most recent call last):
Jul  5 09:15:01 deb1 app[313]:   File "worker.py", line 42, in run
Jul  5 09:15:01 deb1 app[313]:     result = process(item)
Jul  5 09:15:01 deb1 app[313]: ValueError: invalid item
EOF
cat > config.conf <<'EOF'
# app configuration
listen 8080
# workers = number of worker processes
workers 4
timeout 30
EOF
cat > notes.txt <<'EOF'
Meeting notes

The login system needs work.
Login attempts are logged separately.

catalogue entries pending review
See the log for details.
EOF
cat > access.log <<'EOF'
203.0.113.5 - - [05/Jul/2026:09:12:01 +0000] "GET /index.html HTTP/1.1" 200 1024
203.0.113.5 - - [05/Jul/2026:09:12:03 +0000] "GET /style.css HTTP/1.1" 200 512
203.0.113.9 - - [05/Jul/2026:09:13:20 +0000] "GET /index.html HTTP/1.1" 200 1024
203.0.113.9 - - [05/Jul/2026:09:13:25 +0000] "GET /about.html HTTP/1.1" 200 768
198.51.100.7 - - [05/Jul/2026:09:14:10 +0000] "POST /login HTTP/1.1" 401 128
198.51.100.7 - - [05/Jul/2026:09:14:12 +0000] "POST /login HTTP/1.1" 401 128
198.51.100.7 - - [05/Jul/2026:09:14:15 +0000] "GET /dashboard HTTP/1.1" 200 2048
EOF
printf 'bob\ndave\n' > allowed-users.txt
printf 'alice\nbob\ncarol\ndave\n' > current-users.txt
mkdir -p projects/app/src
printf '# App\nTODO: write docs\n' > projects/app/README.md
printf '// TODO: refactor this\nexport const main = () => {};\n' > projects/app/src/main.ts
printf 'export const util = () => {};\n' > projects/app/src/util.ts
printf 'binarydata\n\x00\n' > binary.bin
gzip -kf app.log
