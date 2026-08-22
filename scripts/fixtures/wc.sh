#!/usr/bin/env bash
# Fixtures for content/commands/wc/examples.yaml. Must match its `fixtures:` block.
for i in $(seq 1 40); do echo "line $i of the report"; done > report.txt
cat <<'EOF' > users.csv
name,age,department
Alice,34,Engineering
Bob,29,Sales
Carol,41,Engineering
Dave,25,Marketing
Erin,38,Sales
Frank,31,Engineering
EOF
cat <<'EOF' > wordlist.txt
banana
apple
Cherry
apple
date
banana
apple
Elderberry
cherry
EOF
cat <<'EOF' > access.log
203.0.113.5 - - [13/Aug/2026:09:12:01] "GET /index.html HTTP/1.1" 200 512
203.0.113.5 - - [13/Aug/2026:09:12:03] "GET /style.css HTTP/1.1" 200 231
198.51.100.7 - - [13/Aug/2026:09:14:22] "GET /index.html HTTP/1.1" 200 512
198.51.100.7 - - [13/Aug/2026:09:14:25] "GET /missing.html HTTP/1.1" 404 162
203.0.113.5 - - [13/Aug/2026:09:15:47] "GET /index.html HTTP/1.1" 200 512
192.0.2.44 - - [13/Aug/2026:09:16:03] "POST /login HTTP/1.1" 302 0
192.0.2.44 - - [13/Aug/2026:09:16:04] "GET /dashboard HTTP/1.1" 200 4021
198.51.100.7 - - [13/Aug/2026:09:18:51] "GET /index.html HTTP/1.1" 200 512
203.0.113.5 - - [13/Aug/2026:09:19:10] "GET /api/status HTTP/1.1" 500 89
192.0.2.44 - - [13/Aug/2026:09:20:33] "GET /dashboard HTTP/1.1" 200 4021
EOF
printf 'line1\r\nline2\r\n' > crlf.txt
printf 'report.txt\0wordlist.txt\0' > filelist.bin
cp users.csv users2.csv
