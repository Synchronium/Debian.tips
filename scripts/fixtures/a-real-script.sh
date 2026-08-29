#!/usr/bin/env bash
# Fixtures for content/scripting/a-real-script.md.

# The tree the capstone archives. Three files across two levels, because the script reports a
# file count with `find -type f` and a flat directory would not show that it descends.
mkdir -p site/assets
printf '<!doctype html>\n' > site/index.html
printf 'body { font-family: monospace; }\n' > site/style.css
printf '<svg></svg>\n' > site/assets/logo.svg

# The script itself, rather than the page writing it out. The page shows it with `cat backup.sh`,
# which is a checked block like any other, so the listing a reader reads is the file that ran.
# Written with a quoted terminator: every expansion in here belongs to backup.sh at run time and
# none of it to this script.
cat > backup.sh <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

here=$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")

keep=5
outdir=$here/archives
label=$(date +%Y%m%d-%H%M%S)

usage() {
  echo "usage: ${0##*/} [-k keep] [-o outdir] [-l label] dir..." >&2
  exit 64
}

log() { echo "${0##*/}: $*"; }

while getopts ":k:o:l:" opt; do
  case $opt in
    k) keep=$OPTARG ;;
    o) outdir=$OPTARG ;;
    l) label=$OPTARG ;;
    *) usage ;;
  esac
done
shift $(( OPTIND - 1 ))
(( $# > 0 )) || usage

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

mkdir -p "$outdir"

for dir in "$@"; do
  if [ ! -d "$dir" ]; then
    log "no such directory: $dir"
    exit 2
  fi

  name=${dir%/}
  name=${name##*/}

  tar -czf "$work/$name-$label.tar.gz" -C "$(dirname "$dir")" "$name"
  mv "$work/$name-$label.tar.gz" "$outdir/"
  log "archived $name ($(find "$dir" -type f | wc -l) files)"

  mapfile -t old < <(ls -1 "$outdir/$name-"*.tar.gz | sort -r | tail -n +$(( keep + 1 )))
  if (( ${#old[@]} > 0 )); then
    rm -f "${old[@]}"
    log "pruned ${#old[@]} archive(s)"
  fi
done
SCRIPT
chmod +x backup.sh
