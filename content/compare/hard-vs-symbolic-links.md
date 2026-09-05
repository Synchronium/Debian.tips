---
title: "Hard links vs symbolic links"
tagline: "A second name for the data, or a note saying where it went"
description: "A hard link is another name for the same data, a symlink a small file holding a path. What that means when the original goes, when sed edits it, and on disk."
category: compare
tags: [files, disk, beginner]
updated: 2026-09-05
related: [ln, cp, du, file-permissions-explained]
---

The same stylesheet, linked two ways:

```bash
printf 'body { font-family: monospace; }\n' > style.css
ln style.css style.css.bak
ln -s style.css latest.css
stat -c '%-14n %-14F links=%h' style.css style.css.bak latest.css
```
```
style.css      regular file   links=2
style.css.bak  regular file   links=2
latest.css     symbolic link  links=1
```

`style.css.bak` is not a copy and not a pointer. It is the same file, reached by a second name, and
the link count on both names says so. `latest.css` is a file of its own, nine bytes long, holding
the text `style.css`.

## What happens when the original name goes

Remove `style.css` and the two links answer differently:

```bash
printf 'body { font-family: monospace; }\n' > style.css
ln style.css style.css.bak
ln -s style.css latest.css
rm style.css
cat style.css.bak
cat latest.css
```
```
body { font-family: monospace; }
cat: latest.css: No such file or directory
```

The data has not gone anywhere. `rm` removed a name, and a file's contents are freed when the last
name is gone, so `style.css.bak` still holds them. The symlink was never attached to the data at
all: it holds a path, that path no longer resolves, and nothing warned anybody when it stopped.

## Ordinary tools break both, in opposite directions

Editing a hard-linked file is where the arrangement usually comes apart. `sed -i` does not write
into the file it was given. It writes a new file and renames it over the old name:

```bash
printf 'body { font-family: monospace; }\n' > style.css
ln style.css style.css.bak
sed -i 's/monospace/serif/' style.css
stat -c '%-14n links=%h' style.css style.css.bak
cat style.css style.css.bak
```
```
style.css      links=1
style.css.bak  links=1
body { font-family: serif; }
body { font-family: monospace; }
```

Both link counts are back to one, and the two names now hold different text. Nothing failed and
nothing printed a warning. Anything that writes a temporary file and renames it over the original
behaves this way, which is how a save is made atomic, so a hard link can stop being one at any
point without the arrangement being touched directly.

Point the same command at the symlink and it goes wrong the other way:

```bash
printf 'body { font-family: monospace; }\n' > style.css
ln -s style.css latest.css
sed -i 's/monospace/serif/' latest.css
stat -c '%-12n %F' latest.css style.css
cat style.css
```
```
latest.css   regular file
style.css    regular file
body { font-family: monospace; }
```

The rename landed on the link, so `latest.css` is now an ordinary file and `style.css` was never
touched. GNU sed has a flag for it:

```bash
printf 'body { font-family: monospace; }\n' > style.css
ln -s style.css latest.css
sed -i --follow-symlinks 's/monospace/serif/' latest.css
stat -c '%-12n %F' latest.css
cat style.css
```
```
latest.css   symbolic link
body { font-family: serif; }
```

There is no equivalent flag for the hard-link case, because from sed's side there is nothing to
detect: it was handed a path and it replaced what was at that path.

## Hard-linked data is counted once

A second backup directory, sharing one archive with the first:

```bash
ln backups/daily-1/archive.tar backups/daily-2/archive.tar
du -sh backups/daily-1 backups/daily-2
du -sh --count-links backups/daily-1 backups/daily-2
```
```
68K	backups/daily-1
4.0K	backups/daily-2
68K	backups/daily-1
68K	backups/daily-2
```

`du` credits the data to whichever name it walks first and shows the second directory as almost
empty, though a full copy of the archive is reachable through it. `--count-links` gives the figure
you would need if you replaced every link with a copy. This is the mechanism behind snapshot
backups: `rsync --link-dest` hard-links every unchanged file into the new snapshot, so a daily
backup of a mostly unchanged tree costs the size of what changed. A symlink cannot do this job,
since it would break the moment an old snapshot was deleted.

## Copying a tree keeps one kind and not the other

```bash
mkdir tree
printf 'one\n' > tree/data.txt
ln tree/data.txt tree/data-copy.txt
cp -r tree plain
cp -a tree archive
for d in tree plain archive; do
  printf '%-8s data.txt links=%s\n' "$d" "$(stat -c %h $d/data.txt)"
done
```
```
tree     data.txt links=2
plain    data.txt links=1
archive  data.txt links=2
```

`cp -r` copies each name separately, so a snapshot tree that fitted in a few megabytes can arrive
at its destination full size. `cp -a` includes `--preserve=links` and keeps the sharing. See
[`cp`](/commands/cp/) for what else `-a` brings with it. `tar` detects the sharing and records it
without being asked; [`rsync`](/recipes/copy-files-between-machines/) needs `-H`.

## Which to use

**A symlink, unless you have a reason.** It can name a directory, cross a filesystem, point at
something that does not exist yet, and be read with `ls -l` by anyone wondering what is going on.
Every one of those is a hard link's limitation:

```bash
stat -c '%N' /bin
ln /usr usr-hard
```
```
'/bin' -> 'usr/bin'
ln: /usr: hard link not allowed for directory
```

**A hard link when the data must survive its original name.** Snapshot backups are the honest use,
and `--link-dest` is the tool that makes them. Deduplicating a large tree by hand is possible and
rarely worth it, since the first save through any of the linked names undoes that file's share of
the saving.

Neither is a copy. Writing through either name changes the one file, so a link is not a backup of
anything.

## Where Debian uses each

Debian's alternatives system is a symlink pointing at a symlink:

```bash
stat -c '%N' /usr/bin/awk /etc/alternatives/awk
readlink -f /usr/bin/awk
```
```
'/usr/bin/awk' -> '/etc/alternatives/awk'
'/etc/alternatives/awk' -> '/usr/bin/gawk'
/usr/bin/gawk
```

`update-alternatives` repoints the middle link, and every package that ships an `awk` keeps its own
file under its own name. Nothing else would work: the two links cross package boundaries, and one
of them has to be allowed to point at a file that is not installed yet.

The `/bin` in the block above is usrmerge, which turned `/bin`, `/sbin` and `/lib` into symlinks
under `/usr`. A directory is the one thing `ln` refuses outright, so that transition had no other
shape available to it.
