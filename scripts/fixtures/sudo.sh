#!/usr/bin/env bash
# Fixtures for content/commands/sudo/examples.yaml. Must match its `fixtures:` block.
#
# Replayed as the unprivileged `user`, because the page is about a normal account reaching for
# a privilege it does not have. As root every example succeeds without sudo doing anything, the
# refusals cannot happen, and `sudo whoami` answers a question nobody asked.
# verify: --user

# `user` has passwordless sudo in the sandbox image, which is what lets this script make changes
# it could not otherwise make. A page example may not rely on that being true of a reader's
# machine, and none does: nothing below is the subject of an example, only the state one needs.

# A second account, so `-u` and `su` have somewhere to go that is neither root nor the account
# already running the command. Both of those make the answer trivially the name it started with.
if ! id -u deploy >/dev/null 2>&1; then
  sudo useradd -m -s /bin/bash deploy
fi

# One command that needs a password, so `-n` has something to refuse.
#
# Sorted after `user`, and that matters: sudo reads /etc/sudoers.d in lexical order and the last
# matching rule wins, so a file sorting before the image's `NOPASSWD: ALL` would be overridden by
# it and this page would show `-n` succeeding.
#
# `passwd` and nothing else, because the rule applies whatever the target user is. Naming a
# command another example runs makes that example ask for a password too, and one without `-n`
# then fails with sudo's askpass advice rather than the line the page documents.
printf 'user ALL=(ALL) PASSWD: /usr/bin/passwd\n' | sudo tee /etc/sudoers.d/zz-page >/dev/null
sudo chmod 440 /etc/sudoers.d/zz-page

# The `tee` example writes here, and the restore only resets the page's working directory, so
# without this the second example onwards would find the file already written and the third
# would show `tee` overwriting rather than creating.
sudo rm -f /etc/tips.conf

# A directory to stand in for wherever a reader happens to be. The examples contrasting `-i` with
# a plain `sudo` turn on the working directory, and the page may not print the harness's own:
# /home/user/verify-sudo is a path no reader has and would read as a mistake. So they `cd` here
# first, and the path they print is one that could be on anybody's machine.
sudo mkdir -p /srv/app
sudo chmod 755 /srv/app
