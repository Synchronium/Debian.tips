#!/usr/bin/env bash
# Fixtures for content/scripting/debugging-and-robustness.md.

# Two files, because the traced script counts them and the page documents the count in the middle
# of an execution trace. A third would change a line of that trace rather than a line of ordinary
# output, which is the sort of drift that is easy to miss on review.
mkdir -p site
printf '<!doctype html>\n' > site/index.html
printf 'body { font-family: monospace; }\n' > site/style.css
