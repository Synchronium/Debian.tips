#!/usr/bin/env bash
# Fixtures for content/commands/ls/examples.yaml. Must match its `fixtures:` block.
#
# The tree is `mk_projects` in _common.sh, the same sample data the find page documents.
# Why its modes, owners and mtimes are all pinned is explained there, and this page needs
# every one of them: almost every example prints a mode, an owner, a size or a date.
#
# The one addition is a filename containing spaces and brackets, which sits beside the
# tree rather than inside it so that `projects/` stays identical to what the other pages
# show. It is what the quoting examples need, and `ls` quotes it by default.

. /tmp/fixtures-common.sh

mk_projects

: > 'Meeting Notes (final).docx'
chmod 644 'Meeting Notes (final).docx'
touch -d "2026-06-27 11:00:00" 'Meeting Notes (final).docx'
chown user:user 'Meeting Notes (final).docx' 2>/dev/null || true
