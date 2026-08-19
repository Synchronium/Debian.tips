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
    jq \
    && rm -rf /var/lib/apt/lists/*

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
