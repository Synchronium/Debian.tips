# scripts/fixtures/

The sample data every example on this site was run against, one file per page.

You have probably arrived from the foot of a page, which links to the setup script behind it. That
script is the answer to "where did `report.txt` come from": it creates the page's sample files
inside a throwaway Debian container, and the page's documented output is what the commands printed
against exactly those files.

## `<slug>.sh` is a page's setup script, and is what opts it into the replay

A page is replayed if and only if a script here carries its slug. There is no list anywhere and no
flag on the page: this directory is the register. A page with no script is reported by
`npm run replay` as unreplayed rather than passed over, and is counted as such on
[the about page](https://debian.tips/about/).

A page that needs no sample files still gets a script, holding a comment saying so. An explicit
"nothing to create here" is a decision; an absent file reads as an oversight.

The script runs **before every example on the page**, not once. Examples mutate their input
(`sed -i`, `sort -o`), and each one is documented against the files as the page shows them. What
the restore does not undo is what an example did outside the working directory: installing a
package, writing to `/etc`. That much every later example on the page inherits.

## `# verify:` lines declare how the page has to be replayed

A directive is a comment at the top of a setup script. The harness reads them and starts the
container to match, so the documented `npm run replay -- <slug>` is correct for every page without
anyone having to know a flag in advance.

| | |
| --- | --- |
| `# verify: --user` | Run the examples as the unprivileged `user`. Needed by any page printing file ownership, a `~` path or a permission denial: root is never denied, and every `ls -l` would say `root root`. |
| `# verify: --privileged` | The page mounts a filesystem or attaches a loop device. |
| `# verify: --systemd` | The page needs systemd as PID 1, for `systemctl` and `journalctl`. |

`scripts/lib/replayMetadata.ts` is where the list is defined, and an unrecognised directive is an
error rather than an ignored line. ADR-0025 is why the privilege is graded rather than given to
everything.

## `<slug>.skip` lists what a batch cannot run

Some examples cannot reproduce in a batch at all: they need a concurrent writer, a live log
rotation, or a network peer. Those are named here by example title, with a comment saying how each
was checked instead.

An entry has to name a real example that documents an output, or the replay refuses the page. An
exemption that matches nothing exempts nothing while reading as though it does, which is the one
outcome this arrangement exists to prevent. The count shows at the foot of the page, so a reader is
told how much of it is re-run and how much is not. ADR-0021.

## `_common.sh` holds the sample files several pages share

A reader moving from `cut` to `sort` to `uniq` should meet the same `users.csv`, not three files
that happen to share a name. A page sources it by absolute path, because a setup script runs inside
the sandbox where this repository is not mounted:

```sh
. /tmp/fixtures-common.sh
```

It also holds `apt_update_once`, which is what stops an apt-driven page spending a minute
re-fetching an index that has not changed between its examples.

## `http-mock.py` is the local HTTP server

The `curl` and `wget` pages need something to talk to, and it has to answer identically on every
run. This serves fixed responses with a pinned `Date` and `Last-Modified`, which is what lets those
pages publish response headers and have them checked like any other output. Helpers are installed
to `/opt/mock` in the container rather than the working directory, which is wiped before every
example.

## Changing something here

Every file here stands behind a claim some page makes, so a change is only done once the replay
agrees:

```sh
npm run replay -- <slug>
```

`.claude/reference/verification.md` is the full explanation of the harness, and `scripts/README.md`
is the map of the tools around it.
