# Disposable Debian trixie image for testing content-page command examples.
# Rebuilt on demand by scripts/sandbox.sh when missing; not part of the site build.
FROM debian:trixie

# Every tool the site documents is installed here rather than by the page that documents it.
# `npm run replay` runs all the pages in one sandbox, so a setup script that installed its own
# tool would leave it installed for whatever ran next — and `--changed` replays subsets, so
# which pages those are varies. Installing in the image makes the package set the same for
# every page in every ordering. (`jq` is not part of a base Debian install; its page says so.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client openssh-server \
    tar zstd gzip bzip2 xz-utils \
    grep sed gawk findutils coreutils diffutils patch \
    curl rsync less man-db procps iproute2 iputils-ping \
    cron python3 wget \
    sudo ca-certificates openssl \
    jq lsof psmisc cowsay \
    && rm -rf /var/lib/apt/lists/*

# cowsay installs into /usr/games, which Debian puts on a login shell's PATH via
# /etc/login.defs and leaves off everything else — /troubleshooting/sudo-command-not-found/
# documents the same list from the other end. A `docker exec` is not a login shell, so without
# this the whole cowsay page would have to spell out /usr/games/cowsay on every line, and none
# of those lines would be what a reader types. Pinned here for the same reason the harness pins
# the umask: it removes a difference caused by how the sandbox is entered, not a difference in
# what the command does. `su -` resets PATH from login.defs regardless, so the sudo page's
# `echo $PATH` block is unaffected.
ENV PATH="${PATH}:/usr/games"

# A container cannot load kernel modules — the host owns the kernel — so this unit fails on
# every boot and leaves `systemctl is-system-running` reporting "degraded" for a reason no
# reader would ever see on their own machine. Masking it means the systemctl page documents
# a healthy system rather than a container artifact. Masking is a symlink to /dev/null, so
# it works at build time with no systemd running.
RUN systemctl mask systemd-modules-load.service

RUN useradd -m -s /bin/bash user \
    && echo "user:user" | chpasswd \
    && echo "user ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/user

WORKDIR /home/user
CMD ["sleep", "infinity"]
