# Disposable Debian trixie image for testing content-page command examples.
# Rebuilt on demand by scripts/sandbox.sh when missing; not part of the site build.
FROM debian:trixie

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client openssh-server \
    tar zstd gzip bzip2 xz-utils \
    grep sed gawk findutils coreutils diffutils patch \
    curl rsync less man-db procps iproute2 iputils-ping \
    cron python3 wget \
    sudo ca-certificates openssl \
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
