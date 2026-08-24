#!/usr/bin/env bash
# Fixtures for content/recipes/find-the-largest-files.md.
#
# The tree is `mk_projects` in _common.sh, the same sample data the du, find and ls pages
# document, so a reader arriving from any of them ranks a tree they have already been shown.
#
# Its sizes are written byte for byte rather than with `truncate`, and that matters more here
# than on the pages that only list the tree: `truncate` leaves a hole, `du` reports allocated
# blocks, so a sparse file is reported as 0 and the ranking this recipe teaches comes out empty.

. /tmp/fixtures-common.sh

mk_projects
