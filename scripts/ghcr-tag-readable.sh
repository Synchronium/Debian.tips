#!/usr/bin/env bash
# Whether a tag in a GHCR repository can be fetched with no credentials.
#
#   scripts/ghcr-tag-readable.sh ghcr.io/owner/name <tag>
#
# Exit 0 if it can, 1 if it cannot. Prints nothing; the caller says what the answer means to it.
#
# No credentials is the whole point. A GHCR package is created private, and the visibility a token
# can read is a different claim from an unauthenticated pull succeeding. Only the second one
# decides whether a consumer skips its build.
#
# `publish-sandbox.yml` asks twice: once to skip building something already published, and once
# after a push to confirm the result is reachable.
set -uo pipefail

repository="${1:?usage: $0 <ghcr.io/owner/name> <tag>}"
tag="${2:?usage: $0 <ghcr.io/owner/name> <tag>}"
path="${repository#ghcr.io/}"

# `|| true` on the token fetch, because the endpoint refuses a repository it will not serve
# anonymously. That refusal is the answer this is asking for rather than an error, and under
# `set -e` it would end the script instead of being reported.
token=$(curl -fsSL "https://ghcr.io/token?service=ghcr.io&scope=repository:${path}:pull" |
  jq -r '.token // empty' || true)

# Both manifest-list media types, because which one is returned depends on how the image was
# built, and asking for only one gets a 404 for an image that is perfectly reachable.
curl -fsS -o /dev/null \
  -H "Authorization: Bearer ${token}" \
  -H 'Accept: application/vnd.oci.image.index.v1+json' \
  -H 'Accept: application/vnd.docker.distribution.manifest.list.v2+json' \
  "https://ghcr.io/v2/${path}/manifests/${tag}"
