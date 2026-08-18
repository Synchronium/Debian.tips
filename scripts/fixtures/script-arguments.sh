#!/usr/bin/env bash
# Fixtures for content/scripting/script-arguments.md.
#
# One small script per example, each shown on the page next to the run that produced its
# output. Written here rather than inline so the page can show the file and the invocation
# separately, which is how a reader meets them.

cat > args.sh <<'EOF'
#!/usr/bin/env bash
echo "count: $#"
for a in "$@"; do echo "at: [$a]"; done
for a in "$*"; do echo "star: [$a]"; done
EOF

cat > shifty.sh <<'EOF'
#!/usr/bin/env bash
echo "first: $1"
shift
echo "after shift, first: $1"
echo "remaining count: $#"
EOF

cat > deploy.sh <<'EOF'
#!/usr/bin/env bash
target="${1:-staging}"
echo "deploying to $target"
EOF

cat > needs-arg.sh <<'EOF'
#!/usr/bin/env bash
if [ $# -eq 0 ]; then
  echo "usage: $0 <name>" >&2
  exit 2
fi
echo "Hello, $1"
EOF

cat > greet-flags.sh <<'EOF'
#!/usr/bin/env bash
verbose=0
name=""
while getopts "vn:" opt; do
  case "$opt" in
    v) verbose=1 ;;
    n) name=$OPTARG ;;
    *) echo "usage: $0 [-v] [-n name]" >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))
echo "verbose=$verbose name=$name remaining=$*"
EOF

chmod 755 args.sh shifty.sh deploy.sh needs-arg.sh greet-flags.sh
