# Shared fixture bodies sourced by the per-page setup scripts.
mk_users_csv() { cat > users.csv <<'EOF'
name,age,department
Alice,34,Engineering
Bob,29,Sales
Carol,41,Engineering
Dave,25,Marketing
Erin,38,Sales
Frank,31,Engineering
EOF
}
mk_wordlist() { cat > wordlist.txt <<'EOF'
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
}
mk_access_log() { cat > access.log <<'EOF'
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
}
mk_report() { for i in $(seq 1 40); do echo "line $i of the report"; done > report.txt; }
mk_wordlist; mk_users_csv; mk_access_log; mk_report
printf '10\n2\n33\n4\n' > numbers.txt
printf 'Team Alpha 89\nTeam Beta 42\nTeam Gamma 100\nTeam Delta 7\n' > scores.txt
printf 'report.txt 1.2K\naccess.log 890\nphotos.tar.gz 4.3G\nbackup.sql 128M\nnotes.txt 340\n' > sizes.txt
printf 'xAAAy\nxCCCa\nxBBBz\n' > data.txt
printf 'Carol,Eng\nBob,Sales\nAlice,Eng\nDave,Sales\n' > people.csv
printf 'a\tz\nb\ta\n' > data.tsv
printf '1e2\n3\n2.5e1\n' > numbers-sci.txt
printf '10\n2\n' > numbers-pair.txt
printf 'a\nc\nb\n' > setA.txt; printf 'b\nd\na\n' > setB.txt
sort -n numbers.txt -o numbers-sorted.txt; printf '1\n5\n50\n' > other-sorted.txt
sort wordlist.txt > wordlist-sorted.txt
mkdir -p photos docs archive
dd if=/dev/zero of=photos/x bs=1024 count=500 2>/dev/null
dd if=/dev/zero of=docs/x bs=1024 count=50 2>/dev/null
dd if=/dev/zero of=archive/x bs=1024 count=2000 2>/dev/null
