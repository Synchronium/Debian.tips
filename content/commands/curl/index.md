---
title: "curl"
tagline: "Transfer data to and from a server"
description: "80+ tested curl examples: GET/POST/PUT/DELETE, headers, auth, cookies, uploads, redirects, retries, and scripting."
category: commands
tags: [networking, one-liners]
updated: 2026-07-05
tier: flagship
related: [tar, exit-codes-and-error-handling]
---

`curl` sends an HTTP (or FTP, or a dozen other protocols') request and prints or saves whatever
comes back. It's the tool behind "let me just check what this API returns," behind download
scripts, behind health checks, and behind debugging why a webhook isn't firing.

## The mental model: build a request, read a response

Every `curl` invocation assembles a request from pieces (method, URL, headers, body), sends
it, and by default prints the response **body** to stdout. Everything else (status line,
response headers, timing, progress) is opt-in via flags:

```bash
curl https://example.com              # GET, print the body
curl -I https://example.com           # HEAD, print only the response headers
curl -i https://example.com           # GET, print headers AND body
curl -v https://example.com           # GET, print the whole conversation (connect, TLS, headers, body)
```

`-i`/`-I`/`-v` are about **what curl shows you**, not what request it sends. A common
confusion is meaning "make a HEAD request" but reaching for `-i`.

## GET is implicit; other methods usually aren't

Without `-X`, `curl` sends GET, unless you give it a request body with `-d`/`--data` or
`-F`/`--form`, in which case it switches to POST automatically. This is why you'll see
`curl -X POST url -d "..."` written both with and without the explicit `-X POST`. The flag is
often redundant but harmless, and worth keeping for readability. `-X` is *not* redundant for
`PUT` or `DELETE`, which curl never infers.

## `-d` vs `-F`: two different request bodies

- **`-d` / `--data`** sends `application/x-www-form-urlencoded` data (or literally whatever
  string you give it, if you set `Content-Type` yourself for a JSON body).
- **`-F` / `--form`** sends `multipart/form-data`, the format browsers use for `<form>`
  uploads, and the one you need for actually uploading a file (`-F "file=@report.pdf"`).

Mixing these up is the single most common reason a "curl works but the server doesn't seem to
see the data" bug happens. Check whether the endpoint expects urlencoded or multipart.

## Exit codes tell scripts what actually happened

By default, `curl` exits `0` even for a `404` or `500` response. As far as curl is concerned,
it successfully transferred *something*. Two flags change that:

- **`-f` / `--fail`** makes curl exit non-zero (`22`) on HTTP error status codes, instead of
  printing the error page and exiting `0`.
- **`-m` / `--max-time`** bounds the whole operation; on timeout curl exits `28`.

A script that checks `curl`'s exit code without `--fail` is almost always checking the wrong
thing. See [Exit codes and error handling](/concepts/exit-codes-and-error-handling/).

## Redirects don't follow themselves

By default `curl` prints whatever the server sends back for a `3xx`, including a redirect's
near-empty body, without ever requesting the new location. Add `-L` / `--location` to follow
redirects automatically. This trips up more people than it should, because the failure mode
looks like "the page is just... blank" rather than an obvious error.

## Getting machine-readable facts out of a response

`-w` / `--write-out` prints values from a template string after the transfer completes: status
code, total time, effective URL after redirects, and more, without you having to parse curl's
normal output:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://example.com
```

`-o /dev/null` throws away the body, `-s` silences the progress meter, and `-w` prints just the
one number you asked for. This pattern, discard the body and print one templated fact, is the
backbone of most health-check and monitoring scripts built on `curl`.

## Saving output

`-o file` saves to a name you choose; `-O` saves using the remote URL's own filename (which
means the URL needs an actual filename in its path; `-O` on `https://example.com/` with no
path fails, since there's nothing to name the file). `-C -` resumes an interrupted download
instead of restarting from zero, when the server supports range requests.
