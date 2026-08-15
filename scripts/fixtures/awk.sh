# Reconstructed from the documented outputs, then proven by scripts/verify-examples.mjs.
# The per-IP byte totals and the avg_bytes=1120 example between them pin the individual
# byte values: they must sum to 5376 / 2560 / 1024 per IP, and 8960 overall.
cat > app.log <<'EOF'
Jul  5 09:14:20 deb1 app[312]: info: service starting
Jul  5 09:14:21 deb1 app[312]: info: listening on port 8080
Jul  5 09:14:22 deb1 app[312]: error: connection refused
Jul  5 09:14:23 deb1 app[312]: warning: retrying in 5s
Jul  5 09:14:28 deb1 app[312]: error: connection refused
Jul  5 09:14:33 deb1 app[312]: info: connected
Jul  5 09:15:01 deb1 app[313]: error: connection refused
Jul  5 09:15:05 deb1 app[313]: info: connected
EOF
cat > config.conf <<'EOF'
# Server configuration
host=localhost
port=8080
debug=false
timeout=30
EOF
cat > employees.csv <<'EOF'
name,department,salary
alice,engineering,95000
bob,design,72000
carol,engineering,110000
dave,sales,68000
erin,design,81000
frank,engineering,88000
EOF
cat > access.log <<'EOF'
198.51.100.7 - - [05/Jul/2026:09:12:01 +0000] "GET /index.html HTTP/1.1" 200 1024 0.021
203.0.113.5 - - [05/Jul/2026:09:12:03 +0000] "GET /style.css HTTP/1.1" 200 512 0.008
203.0.113.5 - - [05/Jul/2026:09:12:07 +0000] "GET /app.js HTTP/1.1" 200 2048 0.014
198.51.100.7 - - [05/Jul/2026:09:12:15 +0000] "POST /login HTTP/1.1" 401 128 0.045
203.0.113.9 - - [05/Jul/2026:09:12:22 +0000] "GET /index.html HTTP/1.1" 200 1024 0.019
198.51.100.7 - - [05/Jul/2026:09:12:40 +0000] "POST /login HTTP/1.1" 401 128 0.052
203.0.113.9 - - [05/Jul/2026:09:13:02 +0000] "GET /missing HTTP/1.1" 404 0 0.003
198.51.100.7 - - [05/Jul/2026:09:13:10 +0000] "GET /dashboard HTTP/1.1" 200 4096 0.081
EOF
cat > passwd.txt <<'EOF'
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
user:x:1000:1000:user:/home/user:/bin/bash
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
EOF
printf 'alice\nbob\ncarol\n' > allowed.txt
