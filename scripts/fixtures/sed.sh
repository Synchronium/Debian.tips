# Reconstructed from the documented outputs, then proven by scripts/replay/command-page.ts.
cat > app.log <<'EOF'
INFO: service starting
DEBUG: loading config from /etc/app.conf
INFO: listening on port 8080
WARN: deprecated option 'foo' used
ERROR: connection refused
INFO: retrying connection
ERROR: connection refused
INFO: connected successfully
EOF
cat > config.conf <<'EOF'
# Server configuration
host=localhost
port=8080
debug=false
timeout=30
EOF
cat > names.csv <<'EOF'
alice,30,engineer
bob,25,designer
carol,35,manager
EOF
