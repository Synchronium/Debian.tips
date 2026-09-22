#!/usr/bin/env bash
# Fixtures for content/commands/rsync/examples.yaml. Must match its `fixtures:` block.
#
# Replayed as the unprivileged `user`. `-a` preserves ownership, and the page prints `ls -l` of a
# synchronised tree, so as root every documented line would name root instead of user.
# verify: --user

# Everything below sits inside the working directory, which the harness empties before every
# example. That is what lets an example delete half the tree, or synchronise into it, without
# arranging what the next example sees.

rm -rf site backup

# A small static site, which is the shape rsync is most often pointed at: a tree that is copied
# somewhere repeatedly, where almost nothing changes between copies.
mkdir -p site/css site/img site/drafts

printf '<h1>Home</h1>\n' > site/index.html
printf '<h1>About</h1>\n' > site/about.html
printf 'body { margin: 0 }\n' > site/css/main.css
printf '<h1>Draft: 3.5 release notes</h1>\n' > site/drafts/release-notes.html

# Bytes rather than text, and a size worth reporting. The transfer-accounting examples print a
# byte total, so the tree needs a file large enough that the total is not dominated by rsync's
# own protocol overhead.
head -c 2048 /dev/zero | tr '\0' 'x' > site/img/logo.png

# A build artefact, which is what the --exclude examples exclude. Named for what it is: an
# exclude example that filters `*.txt` teaches a pattern nobody has, where every tree this
# command is pointed at really does have something that should not be copied.
printf 'built 2026-01-01\n' > site/build.tmp

# Two names for one inode. Without -H, rsync copies the contents twice and the destination has
# two independent files; the page shows that difference, so the link has to exist before it can.
printf '<h1>Release notes</h1>\n' > site/drafts/latest.html
ln -f site/drafts/latest.html site/drafts/v2.html

# Modes set rather than inherited: the umask a `docker exec` inherits belongs to the host, so a
# tree that took its permissions from the umask would document one machine's.
chmod 755 site site/css site/img site/drafts
chmod 644 site/index.html site/about.html site/css/main.css site/img/logo.png \
  site/build.tmp site/drafts/release-notes.html site/drafts/latest.html site/drafts/v2.html

# Fixed timestamps, so `ls -l` prints the same date on every machine and in every run, and so
# the examples that turn on mtime comparison have a stable thing to compare. Deepest first: a
# directory's own mtime changes whenever something inside it is written.
touch -d '2026-01-05 09:00:00' site/index.html site/about.html site/css/main.css \
  site/img/logo.png site/build.tmp site/drafts/release-notes.html \
  site/drafts/latest.html site/drafts/v2.html
touch -d '2026-01-05 09:00:00' site/css site/img site/drafts site

# The destination. Created empty rather than left missing, because rsync will happily create it
# and the first example is about what it puts inside, not about whether it can make a directory.
mkdir -p backup
chmod 755 backup
touch -d '2026-01-05 09:00:00' backup

# --- The far end -------------------------------------------------------------------------
#
# The remote examples talk to this same container over ssh. A loopback peer is enough for every
# claim they make, because what changes over a network is the direction marker, the transport
# flags and the byte accounting, none of which depend on the far end being another machine.

# sshd on two ports, started once and left running. Port 2222 exists so the `-e` example is
# choosing a real port rather than restating the default. Host keys are generated on first boot
# only: regenerating them per example would invalidate known_hosts and turn a transfer into a
# prompt.
if ! ss -ltn 'sport = :22' | grep -q ':22'; then
  sudo ssh-keygen -A >/dev/null 2>&1
  sudo mkdir -p /run/sshd
  sudo /usr/sbin/sshd
  sudo /usr/sbin/sshd -p 2222
  for _ in $(seq 1 40); do
    ss -ltn 'sport = :22' | grep -q ':22' && break
    sleep 0.1
  done
fi

# A key authorised against this same host, and a `deb1` alias for it, so the documented command
# is the command that runs. 127.0.0.1 rather than localhost, and LogLevel ERROR, for the reason
# the recipe's fixture gives: what localhost resolves to belongs to the reader's machine, and the
# host-key banner would otherwise be output nobody else reproduces.
rm -rf ~/.ssh
mkdir -p ~/.ssh && chmod 700 ~/.ssh
ssh-keygen -q -t ed25519 -N "" -C "user@deb1" -f ~/.ssh/id_ed25519
cp ~/.ssh/id_ed25519.pub ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat > ~/.ssh/config <<'CFG'
Host deb1
    HostName 127.0.0.1
    User user
    IdentityFile ~/.ssh/id_ed25519
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    LogLevel ERROR
CFG
chmod 600 ~/.ssh/config

# A remote path is relative to the far end's home directory, which sits outside the working
# directory the harness empties, so this script owns its lifecycle. Without the reset, the second
# example to push here would find the tree already present and report nothing to send.
rm -rf ~/backup ~/site
sudo rm -rf /opt/tips
