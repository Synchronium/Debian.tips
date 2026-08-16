#!/usr/bin/env bash
# Fixtures for content/commands/sort/examples.yaml — must match its `fixtures:` block.
#
# The directories exist for `du | sort -h`: their sizes are set with dd so the ordering the
# page documents is a property of the fixtures, not of whatever the filesystem rounded to.

. /tmp/fixtures-common.sh

mk_wordlist; mk_users_csv; mk_access_log; mk_report
printf '10\n2\n33\n4\n' > numbers.txt
printf 'Team Alpha 89\nTeam Beta 42\nTeam Gamma 100\nTeam Delta 7\n' > scores.txt
printf 'report.txt 1.2K\naccess.log 890\nphotos.tar.gz 4.3G\nbackup.sql 128M\nnotes.txt 340\n' > sizes.txt
printf 'xAAAy\nxCCCa\nxBBBz\n' > data.txt
printf 'Carol,Eng\nBob,Sales\nAlice,Eng\nDave,Sales\n' > people.csv
printf 'a\tz\nb\ta\n' > data.tsv
printf '1e2\n3\n2.5e1\n' > numbers-sci.txt
printf '10\n2\n' > numbers-pair.txt
printf 'a\nc\nb\n' > setA.txt; printf 'b\nd\na\n' > setB.txt
sort -n numbers.txt -o numbers-sorted.txt; printf '1\n5\n50\n' > other-sorted.txt
sort wordlist.txt > wordlist-sorted.txt
mkdir -p photos docs archive
dd if=/dev/zero of=photos/x bs=1024 count=500 2>/dev/null
dd if=/dev/zero of=docs/x bs=1024 count=50 2>/dev/null
dd if=/dev/zero of=archive/x bs=1024 count=2000 2>/dev/null
