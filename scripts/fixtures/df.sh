#!/usr/bin/env bash
# Fixtures for content/commands/df/examples.yaml. Must match its `fixtures:` block.
#
# verify: --systemd
#
# Not for systemd. `--systemd` is the only sandbox flavour that runs `--privileged`, and mounting
# a filesystem needs CAP_SYS_ADMIN. Everything below is about what `df` reports, and `df` can only
# report what is mounted.
#
# The alternative was to document the container's own filesystems, and it is not an alternative at
# all. A container's root is `overlay`, on a disk belonging to whoever is running it: 224G in this
# devcontainer and something else on a CI runner, under a filesystem name no reader has. Every
# figure on the page would be unreproducible and the one word a reader would take away from it
# would be wrong.
#
# So the page measures filesystems this script creates, and every number it prints is one chosen
# here. `tmpfs` is a real filesystem type that a reader has several of, so nothing about the
# output is peculiar to a container.

# Remounted from scratch each time rather than created once. The restore only resets the page's
# working directory, and these are outside it: the example that fills the inode table would
# otherwise leave it full for every example after it.
for mnt in /srv/backups /srv/small; do
  mountpoint -q "$mnt" && umount -l "$mnt"
  mkdir -p "$mnt"
done

# `nr_inodes` on both, and it is not optional. A tmpfs left to itself sizes its inode table from
# how much memory the machine has, so `df -i` would print one number here and another on a runner.
mount -t tmpfs -o size=100M,nr_inodes=5000 tmpfs /srv/backups

# Few enough inodes to exhaust in one example. 32 is what the page's "No space left on device"
# block depends on: the file that fails is the 32nd, and the number is small enough that a reader
# can see the whole table fill up.
mount -t tmpfs -o size=10M,nr_inodes=32 tmpfs /srv/small

# A file of a size the page states, so `Used` and `Use%` are figures this script chose rather
# than whatever the machine happened to have. `status=none` because dd writes its transfer rate
# to stderr, and a rate is the one thing here that no two runs agree on.
dd if=/dev/zero of=/srv/backups/site-backup.tar bs=1M count=40 status=none
