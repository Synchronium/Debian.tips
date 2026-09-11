#!/usr/bin/env bash
# Fixtures for content/commands/lsof/examples.yaml. Must match its `fixtures:` block.
#
# verify: --privileged
#
# Mounting a tmpfs needs CAP_SYS_ADMIN. `mk_open_files` says why the page wants one: lsof's
# DEVICE column names a filesystem, and a container's root is an overlay on a disk belonging to
# whoever started it.
#
# A page about what is open on a machine has to be careful what else is open on it. The sandbox
# holds itself up with a `sleep` as pid 1 and runs the example under a `bash -c`, so any example
# that does not narrow reports on the harness. Every example here selects by name, by user, by
# path or by port.

umask 0022

. /tmp/fixtures-common.sh

mk_open_files
