#!/usr/bin/env bash
# Disposable Debian trixie sandbox for testing content-page command examples.
#
# Everything run via `exec` happens inside a throwaway `docker run --rm`
# container with no host mounts and no access to the docker socket, never on
# the host devcontainer. This is what makes it safe to grant broad permission
# to invoke this script: the isolation is structural (a real disposable
# container), not a command-name blocklist. See
# memory/project_unattended_content_workflow.md for the reasoning.
set -euo pipefail

IMAGE="debian-tips-sandbox:trixie"
DOCKERFILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/sandbox" && pwd)"
NAME_PREFIX="content-sandbox-"

# Builds the image when it's missing *or* out of date. Checking only for existence meant a
# Dockerfile edit never reached an already-built image, and the symptom is misleading:
# examples replay against a stale toolset and fail as though the page were wrong. Adding
# `patch` to the image once surfaced days later as the diff page dropping to 16/17.
#
# The staleness test is a label holding a hash of the build context, rather than the image's own
# creation time. Those are not the same thing: a rebuild that hits the layer cache keeps the
# *cached* layer's creation time, so an image compared that way stays permanently older than the
# context that just rebuilt it, and every call rebuilds. That went unnoticed while the replay
# started one container per run and shouted once. Starting one per page made it 56 rebuild
# attempts and 56 lines of log, which is how it was found.
#
# **A hash of the contents, not of when they were last touched.** Git does not record mtimes, so a
# fresh clone stamps every file with the moment it was checked out: an mtime says which working
# copy a file came from and nothing about what is in it. Two machines with the same commit agree
# on this hash and disagree on every mtime, which is what lets an image built on one of them be
# recognised on the other. It also stops `touch Dockerfile` costing a rebuild.
#
# Anything in the build context counts, not just the Dockerfile, so whatever gets added alongside
# it later is covered without editing this. Sorted before hashing, because `find` returns
# directory order and two machines do not share one.
#
# Hashed from inside the directory, so the paths that go into it are `./Dockerfile` rather than
# `/home/runner/work/...`. `sha256sum` prints the path beside the digest, and an absolute one
# would put the checkout location into the hash: the same commit would then have a different hash
# on a runner and on a laptop, which is the mtime problem again wearing a hash.
CONTEXT_LABEL="tips.context-hash"
context_hash() {
  (cd "$DOCKERFILE_DIR" && find . -type f -exec sha256sum {} + | sort -k2 | sha256sum | cut -d' ' -f1)
}

ensure_image() {
  local wanted stamp
  wanted=$(context_hash)
  if stamp=$(docker image inspect -f "{{index .Config.Labels \"$CONTEXT_LABEL\"}}" "$IMAGE" 2>/dev/null); then
    [[ "$stamp" == "$wanted" ]] && return
    echo "sandbox: $DOCKERFILE_DIR has changed since $IMAGE was built, rebuilding" >&2
  fi
  docker build --label "$CONTEXT_LABEL=$wanted" -t "$IMAGE" "$DOCKERFILE_DIR" >&2
}

require_sandbox_name() {
  local name="$1"
  case "$name" in
    "$NAME_PREFIX"*) ;;
    *) echo "error: '$name' is not a sandbox (must start with $NAME_PREFIX)" >&2; exit 1 ;;
  esac
}

usage() {
  cat >&2 <<EOF
Usage:
  $0 build                               build the sandbox image if it is missing or stale
  $0 start [--systemd] [name]            start a disposable sandbox, prints its name
  $0 exec [-u user] <name> <command...>  run a command inside the sandbox (bash -c)
  $0 stop <name>                         stop and remove the sandbox
  $0 list                                list running sandboxes
EOF
  exit 1
}

cmd="${1:-}"; shift || true

case "$cmd" in
  # Exposed so a caller that wants the image built before it starts timing something can ask for
  # it here rather than running `docker build` itself. A caller that builds its own way gets an
  # image with no context label, which reads as stale, and the next `start` rebuilds it anyway.
  build)
    ensure_image
    ;;
  start)
    ensure_image
    systemd=0
    if [[ "${1:-}" == "--systemd" ]]; then systemd=1; shift; fi
    name="${1:-${NAME_PREFIX}$$-${RANDOM}}"
    require_sandbox_name "$name"

    if (( systemd )); then
      # Same image: systemd is already installed. What the systemctl and journalctl pages
      # need isn't more packages, it's PID 1: with `sleep` as init, every example on those
      # pages prints "System has not been booted with systemd as init system (PID 1)".
      #
      # This costs more privilege than the default sandbox: --privileged and the host's
      # cgroup tree, because systemd manages cgroups and refuses to start without them.
      # That's why it isn't the default. Pages ask for it explicitly with a
      # `# verify: --systemd` line in their setup script, so the stronger grant is visible
      # in the page's own fixtures rather than applied to everything.
      docker run -d --rm --name "$name" --hostname deb1 \
        --privileged --cgroupns=host \
        -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
        "$IMAGE" /lib/systemd/systemd >/dev/null

      # Wait for the boot to finish. Without this, an early example races the units it is
      # about: `systemctl status cron` answers "activating" or not at all, which reads as
      # a page that has drifted. `is-system-running` returns non-zero for `degraded`, which
      # is a normal state for a container (no udev, no network target), so the exit status
      # is deliberately ignored, since `running` and `degraded` are both booted.
      for _ in $(seq 1 50); do
        state=$(docker exec "$name" systemctl is-system-running 2>/dev/null || true)
        case "$state" in
          running|degraded) break ;;
        esac
        sleep 0.2
      done
      if [[ "$state" != "running" && "$state" != "degraded" ]]; then
        echo "error: systemd did not finish booting in $name (last state: ${state:-none})" >&2
        docker stop "$name" >/dev/null 2>&1 || true
        exit 1
      fi
    else
      docker run -d --rm --name "$name" --hostname deb1 "$IMAGE" >/dev/null
    fi
    echo "$name"
    ;;
  exec)
    user_flag=()
    if [[ "${1:-}" == "-u" ]]; then
      user_flag=(-u "$2")
      shift 2
    fi
    name="${1:-}"; shift || true
    require_sandbox_name "$name"
    docker exec "${user_flag[@]}" "$name" bash -c "$*"
    ;;
  stop)
    name="${1:-}"
    require_sandbox_name "$name"
    # `-t 0` kills immediately instead of sending SIGTERM and waiting out the ten-second grace
    # period. Nothing in here has anything to flush, and neither init reacts to SIGTERM: `sleep
    # infinity` has no handler, and systemd wants SIGRTMIN+3 rather than SIGTERM to shut down. So
    # the default timeout was paid in full every time, ten seconds per container, and the replay
    # starts one per page.
    docker stop -t 0 "$name" >/dev/null
    ;;
  list)
    docker ps --filter "name=${NAME_PREFIX}" --format '{{.Names}}\t{{.Status}}'
    ;;
  *)
    usage
    ;;
esac
