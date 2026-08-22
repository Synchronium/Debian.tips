#!/usr/bin/env bash
# Fixtures for content/commands/jq/examples.yaml. Must match its `fixtures:` block.
#
# Four files, one per shape of JSON a reader actually meets: an object with an array inside it
# (an API response), a bare top-level array, a nested configuration object, and a file of
# one-object-per-line NDJSON. Which of those you have is what decides whether a filter starts
# `.users[]`, `.[]` or nothing at all, so the page needs all four to say anything useful.
#
# Written with printf rather than a heredoc so the JSON stays exactly as the page shows it:
# a heredoc is fine here too, but every one of these is also read back by `cat` in the
# fixtures block, so trailing whitespace and the final newline decide whether it matches.

cat > api-response.json <<'EOF'
{
  "page": 1,
  "per_page": 3,
  "total": 7,
  "users": [
    {
      "id": 1,
      "name": "Alice",
      "email": "alice@example.com",
      "active": true,
      "roles": ["admin", "dev"]
    },
    {
      "id": 2,
      "name": "Bob",
      "email": "bob@example.com",
      "active": false,
      "roles": ["dev"]
    },
    {
      "id": 3,
      "name": "Carol",
      "email": "carol@example.com",
      "active": true,
      "roles": []
    }
  ]
}
EOF

# Deliberately not pretty-printed: this is what a real API hands you, and it is why the very
# first example on the page is `jq . services.json`.
cat > services.json <<'EOF'
[{"name":"nginx","state":"running","restarts":0,"memory_mb":42},{"name":"postgres","state":"running","restarts":2,"memory_mb":310},{"name":"redis","state":"stopped","restarts":11,"memory_mb":0},{"name":"worker","state":"running","restarts":1,"memory_mb":128}]
EOF

cat > config.json <<'EOF'
{
  "server": {
    "host": "deb1",
    "port": 8080,
    "tls": {
      "enabled": false
    }
  },
  "logging": {
    "level": "info",
    "file": "/var/log/app.log"
  },
  "workers": 4
}
EOF

# NDJSON: four separate JSON values in one file, not an array. jq reads them as a stream, which
# is the whole point of the -s and --slurp examples.
cat > events.jsonl <<'EOF'
{"ts":"2026-08-19T09:00:00Z","level":"info","msg":"started"}
{"ts":"2026-08-19T09:01:12Z","level":"warn","msg":"slow query","ms":420}
{"ts":"2026-08-19T09:02:03Z","level":"error","msg":"connection refused"}
{"ts":"2026-08-19T09:04:44Z","level":"info","msg":"recovered"}
EOF

# A file with a syntax error in it, for the example about what jq says when the input is not
# JSON at all, which is the single most common thing to happen when you pipe a curl response in.
cat > broken.json <<'EOF'
{"name": "nginx", "state": "running",}
EOF

rm -f config-tls.json services-sorted.json
