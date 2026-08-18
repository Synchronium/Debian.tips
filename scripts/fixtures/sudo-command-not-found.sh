#!/usr/bin/env bash
# Fixtures for content/troubleshooting/sudo-command-not-found.md.
#
# Creates `newbie`: a user in no groups but their own, with a password, which is exactly what
# Debian's installer leaves you with when you set a root password during installation. Every
# diagnostic and fix on the page is then run against a real account in that state.
#
# The literal "sudo: command not found" is the one thing not reproduced here. Removing sudo
# would break every other page in the batch — `npm run replay` shares one sandbox, and the apt
# page's examples all begin with `sudo` — so the page quotes that message as the error the
# reader arrived with and verifies the diagnosis and the fix instead.

export DEBIAN_FRONTEND=noninteractive

if ! id newbie >/dev/null 2>&1; then
  useradd -m -s /bin/bash newbie
fi

# A password, because sudo will not report "not in the sudoers file" until it has authenticated
# you — with `-n` it stops at the password prompt instead, which is a different message and not
# the one this page is about.
echo 'newbie:demo' | chpasswd

# Never in the sudo group at the start: the page's fix example adds them, and fixtures are
# restored by re-running this script rather than by rolling the system back.
gpasswd -d newbie sudo >/dev/null 2>&1 || true

# The sandbox image grants the `user` account passwordless sudo through /etc/sudoers.d/user.
# That is why the page uses `newbie` rather than `user` — `user` cannot demonstrate this error
# at all, and reaching for it would have produced a page that quietly proved nothing.
