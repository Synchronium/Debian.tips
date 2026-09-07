---
title: "date"
tagline: "Print, format and calculate with dates"
description: "Tested date examples: formatting with a + string, parsing a date with -d, arithmetic that crosses a month boundary, file timestamps, and time zones."
category: commands
tags: [scripting, one-liners, sysadmin]
updated: 2026-09-07
tier: standard
related: [stat, touch, crontab, arithmetic]
---

`date` prints the current time, and that is the least of what it does. `-d` hands it a date to
work on instead of now, `+` describes the output down to the character, and the two together turn
it into a calculator: a date read in one format and printed in another, a month added, a file's
timestamp converted to seconds and back.

Everything after the `+` is printed as written except the `%` specifiers, so `date "+%F %T"`
gives `2026-06-01 09:00:00` and `date "+backup-%F.tar.gz"` gives a filename. `%F` and `%T` cover
most of what anyone needs. `%s` is seconds since 1970, and it is the form to use whenever two
times have to be compared or subtracted, since a shell can do arithmetic on it and cannot do
arithmetic on `Mon Jun  1 09:00:00 UTC 2026`.

Parsing is looser than it looks and is worth testing before trusting. `date -d "01/06/2026"` reads
the American way round and returns 6 January, and `date -d "2026-01-31 + 1 month"` returns 3 March,
because adding a month to the 31st gives 31 February and the result is normalised. `--debug` prints
what it decided and warns about both.

Setting the clock is a different job. `date -s` exists and needs privileges, and on a machine
running `systemd-timesyncd` or `ntpd` anything it sets is corrected again shortly afterwards.
`timedatectl` is the interface that sticks, and it is part of the same
[systemd](/commands/systemctl/) tooling.
