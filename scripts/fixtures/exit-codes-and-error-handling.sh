#!/usr/bin/env bash
# Fixtures for content/concepts/exit-codes-and-error-handling.md.
#
# The page is almost all self-contained shell — `true`, `false`, pipelines, `set -e` — which
# needs nothing created. The one exception is the 126 example, which has to find a real file
# that it is allowed to read and not allowed to execute.

# The example runs `chmod 644` itself before executing it, so the mode here only has to be
# something `chmod 644` can be seen to change. The file must be a real script: a 126 comes
# from the kernel refusing to exec it, and an empty file would be refused for the wrong
# reason on some kernels.
cat > noexec.sh <<'EOF'
#!/usr/bin/env bash
echo "this never runs"
EOF
chmod 755 noexec.sh
