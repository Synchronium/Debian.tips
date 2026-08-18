#!/usr/bin/env bash
# Fixtures for content/scripting/your-first-script.md.
#
# The lesson's output includes `Hello, user` from `$(whoami)`, and a permission denial on a
# script with no execute bit. Both are answers about who is running the command.
# verify: --user

# Not executable: the lesson's first example is the `chmod +x` that fixes that, so the mode
# has to start wrong. Set explicitly rather than left to the umask.
cat > hello.sh <<'EOF'
#!/usr/bin/env bash

echo "Hello, $(whoami)"
EOF
chmod 644 hello.sh

# Stays non-executable for the whole lesson: it is the example of what that looks like.
cp hello.sh hello2.sh
chmod 644 hello2.sh

# Executable, since its example runs it directly without a chmod first.
cat > greet.sh <<'EOF'
#!/usr/bin/env bash
echo "Script name: $0"
echo "First argument: $1"
echo "All arguments: $@"
echo "Argument count: $#"
EOF
chmod 755 greet.sh
