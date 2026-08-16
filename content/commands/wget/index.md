---
title: "wget"
tagline: "Download files and mirror sites from the command line"
description: "Tested wget examples: downloading, resuming, retries, authentication, recursive mirroring, and scripting with exit codes."
category: commands
tags: [networking, files]
updated: 2026-08-16
tier: standard
related: [curl, tar, exit-codes-and-error-handling]
---

`wget` retrieves things over HTTP, HTTPS and FTP and writes them to disk. It is the tool
you reach for when you want a file on the filesystem rather than a response on your
terminal, and the one that will walk an entire site and bring back every page it links to.

## wget or curl?

They overlap heavily, and on Debian both are a package away. The difference that matters
day to day is what each does by default:

```bash
wget https://example.com     # saves the body to ./index.html
curl https://example.com     # prints the body to stdout
```

Everything follows from that. `wget` has a progress bar, resumes interrupted transfers
with `-c`, and can recurse through links with `-r`; [`curl`](/commands/curl/) has finer
control over the request itself and pipes naturally into other commands. Reach for `wget`
to fetch files and mirror sites, and `curl` to talk to an API.

## Output goes to stderr

`wget` writes its progress report to stderr, not stdout, so `wget -O - URL | tar -xz`
works without the report corrupting the pipe. That is also why `wget URL > file.log`
captures nothing useful: use `-o file.log` for the report, `-O file` for the payload.

## Recursion needs limits

`wget -r` will follow links until it runs out, which on a real site means far more than
you intended. Two flags do most of the work: `-l` caps the depth, and `-np` stops it
climbing above the directory you started in. Add `-A`/`-R` to filter by extension.

> [!NOTE]
> The examples below run against `http://127.0.0.1:8080`, a small test server kept in
> this site's repository at `scripts/fixtures/http-mock.py`. Start it with
> `python3 http-mock.py` and every result on this page is reproducible on your own
> machine. Three things will differ: the timestamps, the transfer rates, and the progress
> bar, which is left out here because wget redraws it to fit your terminal.
