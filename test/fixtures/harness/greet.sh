#!/usr/bin/env bash
# Setup script for the fixture tree's `greet` command page.
#
# Never executed: no test starts a container. It exists because a page opts into the replay by
# having a setup script, and the build counts only the pages that do — so without this file the
# fixture tree would build an about page claiming zero replayed outputs, which is exactly the
# claim `fillStats` refuses to ship.
echo "hello"
