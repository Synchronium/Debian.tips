#!/usr/bin/env bash
# Fixtures for content/commands/mount/examples.yaml. Must match its `fixtures:` block.
#
# verify: --privileged
#
# Mounting anything needs CAP_SYS_ADMIN. `mk_loop_disks` says why the page brings its own
# filesystem rather than reporting on the container's.
#
# The page prints no unfiltered `mount` and no bare `lsblk`. Both answer about the whole machine,
# and in a container that machine is the host: `lsblk` lists its nbd devices and `mount` lists the
# dozen entries the runtime set up, none of which a reader has.

umask 0022

. /tmp/fixtures-common.sh

mk_loop_disks

# /etc/fstab is outside the page's working directory, so the restore does not undo an example
# that writes to it. Rebuilt from nothing here, with the entry the fstab examples expect to find
# already absent.
cat > /etc/fstab <<'EOF'
# /etc/fstab: static file system information.
EOF
chmod 644 /etc/fstab
