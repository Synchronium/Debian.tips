---
title: "tee"
tagline: "Write a stream to a file and pass it on"
description: "Tested tee examples: saving a pipeline's output while still seeing it, appending with -a, and the sudo tee trick for writing files your shell cannot."
category: commands
tags: [text-processing, scripting, one-liners]
updated: 2026-08-19
tier: light
related: [pipes-and-redirection, sort, systemctl, crontab]
---

`tee` reads standard input, writes an unmodified copy to every file you name, and passes the
same bytes along to standard output. It is named after a T-junction in plumbing, which is
exactly what it does to a pipeline.

That covers two jobs that look unrelated. The first is keeping a copy of something you are
watching go past, without running the command twice: `make | tee build.log` puts the build on
screen and on disk at once.

The second is the one people arrive here for. `sudo echo something > /etc/somefile` **does not
work**, and the reason surprises everyone: `sudo` applies to `echo`, but the redirect is
performed by your shell, which is still you. `sudo tee` moves the writing into the command that
was elevated, which is why every guide tells you to pipe into it.
