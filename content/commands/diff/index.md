---
title: "diff"
tagline: "Compare files or directories and show what changed"
description: "27 tested diff examples: unified and context formats, directory comparison, ignoring whitespace or case, and generating a patch file with patch to apply it."
category: commands
tags: [text-processing, files]
updated: 2026-08-14
tier: standard
related: [tr, sed]
---

`diff` compares two files line by line and reports what's different. Its exit code carries real
information: `0` means the files are identical, `1` means they differ, `2` means something went
wrong (a missing file, a permission error). Scripts can and should check it directly instead of
parsing output.

The default output — a compact `3c3,4` / `8a10,13` style — is precise but hard to read. `-u`
(unified format) is what everyone actually reaches for: a few lines of context around each
change, `-` for removed lines, `+` for added ones. It's also exactly the format `patch` expects,
which is what makes `diff -u old new > changes.patch` followed by `patch < changes.patch`
work — this is the same mechanism behind `git diff` and every `.patch` file you've ever
downloaded.

`-r` makes `diff` recurse into directories, comparing every file it finds and reporting which
ones exist on only one side. `-w`, `-b`, `-i`, and `-B` ignore whitespace, whitespace *amount*,
case, and blank-line changes respectively — useful for confirming two files are meaningfully the
same even when formatting drifted.
