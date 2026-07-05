---
title: "Monitor a log file in real time"
description: "Watch a log file as new lines are written, filter it live, and keep watching across log rotation."
category: recipes
tags: [monitoring, sysadmin]
updated: 2026-07-05
related: [grep, exit-codes-and-error-handling]
---

**Problem:** You need to watch a log file as new entries arrive, instead of repeatedly reopening
it to check for updates.

**Solution:**

```bash
tail -f app.log
```
```
info: worker started
error: connection refused
```

**How it works:**

- `-f` (`--follow`) keeps `tail` running after printing the last 10 lines, printing each new
  line as it's appended to the file.
- The command doesn't exit on its own; stop it with `Ctrl-C` when you're done watching.

**Variations:**

```bash
# Filter the live stream for a specific pattern
tail -f app.log | grep --line-buffered "error"

# Follow a log that gets rotated (renamed and recreated) while you watch
tail -F app.log
```
```
before rotate
tail: 'app.log' has been replaced;  following new file
after rotate
```

`grep --line-buffered` is needed here because `grep`'s output normally buffers in blocks once
it's writing into a pipe rather than a terminal; without it, matching lines can sit unprinted
for a while. See [grep](/commands/grep/) for more on this flag.

`-F` (capital) is `--follow=name --retry`: instead of following the file descriptor `tail`
opened at startup, it re-opens the file by name, so it keeps working when a log gets rotated out
from under it (moved aside and replaced with a fresh, empty file), which is exactly what tools
like `logrotate` do on a schedule. Plain `-f` (lowercase) keeps watching the original,
now-renamed file instead, and silently stops seeing new entries once the application switches to
writing the new one.

> [!TIP]
> `tail -f` on its own doesn't tell you whether the file even exists yet. `tail -F` also implies
> `--retry`, so it keeps trying periodically if the file is missing at startup, useful for
> watching a log that a service hasn't created yet.

For a service managed by systemd, `journalctl -u servicename -f` is the equivalent for its
journal entries rather than a plain file, and doesn't need `-F`'s rotation handling since the
journal manages that itself.
