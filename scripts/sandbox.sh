#!/usr/bin/env bash
# Disposable Debian trixie sandbox for testing content-page command examples.
#
# Everything run via `exec` happens inside a throwaway `docker run --rm`
# container with no host mounts and no access to the docker socket — never on
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
ensure_image() {
  local created epoch
  if created=$(docker image inspect -f '{{.Created}}' "$IMAGE" 2>/dev/null); then
    epoch=$(date -d "$created" +%s 2>/dev/null) || epoch=0
    # Anything in the build context newer than the image means a rebuild, not just the
    # Dockerfile — whatever gets added alongside it later is covered without editing this.
    if [[ -z "$(find "$DOCKERFILE_DIR" -type f -newermt "@$epoch" -print -quit 2>/dev/null)" ]]; then
      return
    fi
    echo "sandbox: $DOCKERFILE_DIR is newer than $IMAGE — rebuilding" >&2
  fi
  docker build -t "$IMAGE" "$DOCKERFILE_DIR" >&2
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
  $0 start [name]                        start a disposable sandbox, prints its name
  $0 exec [-u user] <name> <command...>  run a command inside the sandbox (bash -c)
  $0 stop <name>                         stop and remove the sandbox
  $0 list                                list running sandboxes
EOF
  exit 1
}

cmd="${1:-}"; shift || true

case "$cmd" in
  start)
    ensure_image
    name="${1:-${NAME_PREFIX}$$-${RANDOM}}"
    require_sandbox_name "$name"
    docker run -d --rm --name "$name" "$IMAGE" >/dev/null
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
    docker stop "$name" >/dev/null
    ;;
  list)
    docker ps --filter "name=${NAME_PREFIX}" --format '{{.Names}}\t{{.Status}}'
    ;;
  *)
    usage
    ;;
esac
