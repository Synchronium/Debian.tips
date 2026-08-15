# Disposable Debian trixie image for testing content-page command examples.
# Rebuilt on demand by scripts/sandbox.sh when missing; not part of the site build.
FROM debian:trixie

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client openssh-server \
    tar zstd gzip bzip2 xz-utils \
    grep sed gawk findutils coreutils diffutils patch \
    curl rsync less man-db procps iproute2 iputils-ping \
    cron python3 wget \
    sudo ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash user \
    && echo "user:user" | chpasswd \
    && echo "user ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/user

WORKDIR /home/user
CMD ["sleep", "infinity"]
