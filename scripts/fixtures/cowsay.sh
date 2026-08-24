#!/usr/bin/env bash
# Fixtures for content/commands/cowsay/examples.yaml. Must match its `fixtures:` block.
#
# Three files and a directory. `notes.txt` is the multi-line input that shows what `-n` is for,
# `cows/server.cow` is a hand-written cowfile exercising every variable the format has, and
# `downloaded.cow` is the one that proves a cowfile is a program rather than a picture.
# `access.log` comes from _common.sh so the summary example uses the same sample log as
# /commands/grep/, /commands/awk/ and the rest.
#
# Note for anyone extending this page: cowsay lives in /usr/games, which is on a login shell's
# PATH and not on a `docker exec`'s. scripts/sandbox/Dockerfile adds it to the image's PATH for
# that reason, so `cowsay` works here exactly as it does at a reader's prompt. Do not paper
# over it per-example with an absolute path, and do not document `command -v cowsay` output as
# anything other than /usr/games/cowsay.
. /tmp/fixtures-common.sh

export DEBIAN_FRONTEND=noninteractive

# cowsay is in the sandbox image, but other pages use it as their worked example and one of them
# autoremoves it. Guarded rather than assumed.
if ! dpkg -l cowsay 2>/dev/null | grep -q '^ii'; then
  apt-get install -y cowsay >/dev/null 2>&1
fi

# Note for anyone extending this page: cowsay-off must stay absent. It adds three cowfiles to
# /usr/share/cowsay/cows, so `cowsay -l` lists 50 rather than 47 whenever it is installed, and
# this page documents both the list and the count. The image does not ship it, and no example
# here installs it, so nothing has to be undone; an example that installed it would have to.

mk_access_log

cat > notes.txt <<'EOF'
Backup finished
14 files copied
0 errors
EOF

# A hand-written cowfile. Every substitution the format offers appears exactly once:
# $thoughts (the line joining balloon to figure, `\` for cowsay and `o` for cowthink),
# $eyes (two characters, set by -e or by a mode flag) and $tongue (two characters, set by -T,
# two spaces when unset, which is why the line below is padded to look empty rather than
# short). The doubled backslash is the trap the page documents: the heredoc interpolates, so a
# single backslash would be eaten before the art ever reached the screen.
mkdir -p cows
cat > cows/server.cow <<'EOF'
$the_cow = <<"EOC";
     $thoughts
      $thoughts
        .-------------.
        |  $eyes  ------ |
        |  $tongue         |
        '-------------'
         \\___________/
EOC
EOF

# A cowfile that runs code, for the section on why `-f` on a file from the internet is a
# problem. cowsay loads a cowfile with Perl's `do`, which executes it, so the print below lands
# above the balloon because get_cow runs before the balloon is written out. Harmless on purpose:
# the page makes the point with a print rather than with something worth copying.
cat > downloaded.cow <<'EOF'
print "(this line came from the cowfile, before any cow was drawn)\n";
$the_cow = <<"EOC";
      $thoughts
       $thoughts  (a perfectly ordinary cow)
EOC
EOF
