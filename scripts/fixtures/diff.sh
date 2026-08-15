cat > nginx-old.conf <<'X'
server {
    listen 80;
    server_name example.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
X
cat > nginx-new.conf <<'X'
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
    }
}
X
printf 'a  b\n' > sp1.txt; printf 'a b\n' > sp2.txt
printf 'a b  c\n' > ws1.txt; printf 'a   b c\n' > ws2.txt
printf 'Hello\n' > c1.txt; printf 'hello\n' > c2.txt
printf 'a\nb\nc\n' > bl1.txt; printf 'a\n\nb\nc\n' > bl2.txt
printf 'line1\r\nline2\r\n' > crlf-a.txt; printf 'line1\nline2\n' > crlf-b.txt
mkdir -p confA confB
cp nginx-old.conf confA/nginx.conf; cp nginx-new.conf confB/nginx.conf
echo 'same content' > confA/common.conf; echo 'same content' > confB/common.conf
echo 'only in A' > confA/onlyA.conf; echo 'only in B' > confB/onlyB.conf
diff -u nginx-old.conf nginx-new.conf > changes.patch
cp nginx-old.conf test-apply.conf
