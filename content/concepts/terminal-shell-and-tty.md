---
title: "Terminal, shell and tty"
tagline: "Four words people use for one window"
description: "What a terminal, a tty, a shell and a console each actually are, why Ctrl-D is not a signal, and why Ctrl-S appears to freeze everything."
category: concepts
tags: [terminal, processes, environment, beginner]
updated: 2026-08-27
related: [processes-and-signals, environment-variables-and-path, ps, ssh]
---

Four words get used for the window you type commands into. Underneath they are four separate
things. They line up most of the time, so the distinctions rarely come up until something
behaves oddly.

- A **terminal** is what you type into. It was a piece of hardware with a keyboard and a screen;
  now it is nearly always a program drawing a window, or the far end of an [SSH](/commands/ssh/)
  connection.
- A **tty** is the kernel device sitting between that terminal and whatever is reading from it.
  The name is short for teletype. That was the hardware.
- A **shell** is a program that reads lines and runs commands. `bash` is one. It has no special
  relationship with terminals at all.
- The **console** is the machine's own primary terminal, the one attached to the physical box.
  Linux gives you several as virtual consoles, `/dev/tty1` through `/dev/tty6`.

Every example below runs with no terminal at all. So does a cron job, and so does a CI script.
Where a block needs one it wraps the command in `script`, which allocates a pseudo-terminal for
the duration.

## The tty is a file

```bash
tty
```
```
not a tty
```

A shell runs perfectly well with nothing attached. Under a terminal the same command answers
differently:

<!-- verify: shape the device's timestamp is from when it was allocated -->
```bash
script -qec 'ls -l $(tty)' /dev/null
```
```
crw--w---- 1 root tty 136, 0 Aug 27 06:35 /dev/pts/0
```

The leading `c` says this is a **character device** rather than a regular file. `136, 0` is its
major and minor number. Major 136 is the pseudo-terminal driver, and it is pseudo because there
is no hardware anywhere in this picture. A pty comes in two halves. One program holds the master
end, another is handed `/dev/pts/0` for its input and output, and the second one cannot tell it
apart from a real terminal.

Your terminal emulator is the first of those programs. It opens a pty, keeps the master end, and
starts a shell on the slave end. Press a key and the emulator writes it to the master; the shell
reads it from `/dev/pts/N`. `sshd` does the same job for a remote session.

The name tells you which kind you have. `/dev/pts/N` is a pseudo-terminal. `/dev/ttyN` is one of
the machine's real virtual consoles.

## A shell does not need a terminal

```bash
echo 'echo a shell with nothing attached' | bash
```
```
a shell with nothing attached
```

No terminal, no tty, and bash runs the command anyway. Every script from cron, from a systemd
unit or from a CI runner starts like this. `bash` reading a script is the same program as `bash`
at a prompt with its interactive parts switched off. It also reads different startup files, which
[environment variables and PATH](/concepts/environment-variables-and-path/) goes through.

## Programs ask whether they have one

A program can ask whether its output is a terminal, and plenty of them do. `ls` is the one
everybody has met:

```bash
script -qec 'ls /etc/apt' /dev/null
```
```
apt.conf.d  auth.conf.d  keyrings  preferences.d  sources.list.d  trusted.gpg.d
```

```bash
ls /etc/apt | cat
```
```
apt.conf.d
auth.conf.d
keyrings
preferences.d
sources.list.d
trusted.gpg.d
```

Same command, same directory, two different formats. `ls` columnises for a terminal and prints
one name per line for anything else. That is why `ls | wc -l` counts entries correctly and
counting the lines on your screen does not. Colour is decided the same way, and so is
`grep --color=auto`.

## The tty turns keystrokes into signals and characters

The tty device is not a dumb pipe. In front of it sits a **line discipline**, which intercepts a
handful of control characters before the program at the other end sees anything. `stty` prints
the current settings. These five are the ones people meet:

```bash
script -qec 'stty -a | tr ";" "\n" | grep -E "^ *(intr|susp|eof|stop|start)"' /dev/null
```
```
intr = ^C
 eof = ^D
 start = ^Q
 stop = ^S
 susp = ^Z
```

Two of those send signals. `intr` sends INT and `susp` sends TSTP, both to the foreground
process group, so Ctrl-C stops a whole pipeline rather than one command;
[processes and signals](/concepts/processes-and-signals/) follows that through. The other three
never involve a signal.

## Ctrl-D is not a signal

`eof = ^D` says Ctrl-D means end of input. It sends nothing at all. Instead it makes the read
your program is blocked in return zero bytes, and a program that reads until its input runs out
treats that as "there is no more".

```bash
bash -c 'read line; echo "read returned $?"' </dev/null
```
```
read returned 1
```
```bash
printf 'hello\n' | bash -c 'read line; echo "read returned $?, got: $line"'
```
```
read returned 0, got: hello
```

Empty input and Ctrl-D amount to the same thing. The read fails, and `read` reports it. Press
Ctrl-D at a shell prompt and you log out for exactly that reason: the shell is reading commands,
its input ends, so it exits. Press it at a program that is busy rather than reading and nothing
happens, where Ctrl-C would have worked.

## Why Ctrl-S appears to freeze everything

`stop = ^S` and `start = ^Q` are flow control, from the days when a terminal could genuinely be
overwhelmed by output arriving faster than it could print it. Ctrl-S tells the tty to stop
sending; Ctrl-Q tells it to resume.

The program carries on regardless until its output buffer fills, then blocks on the write. Press
Ctrl-Q and both it and the screen pick up where they left off. Nothing is lost. Ctrl-S is the
save key almost everywhere else, so people press it in a terminal out of habit and meet a screen
that ignores them.

If you never want it, turn it off:

```sh
stty -ixon
```

Put that in `~/.bashrc` and Ctrl-S becomes an ordinary keystroke. It also frees the key for
`readline`'s forward search.

## Line editing happens before the program sees anything

The same line discipline lets you type a command, backspace over a typo, and have the program
receive only the corrected line. In its default **canonical** mode the tty buffers a whole line
and handles the editing keys itself. The program is handed the result when you press Enter, and
sees none of the corrections.

`vim`, `top` and anything else with a full-screen interface need every keystroke as it happens,
so they switch that off and take raw characters instead. A program that crashes in that state
leaves the tty configured for it. Your shell then stops echoing what you type, or Enter no longer
starts a new line. `reset` puts it back.

## $TERM and the terminfo database

Terminals differ in the escape sequences they use for moving the cursor and setting colours.
Rather than assume, a program looks up what the terminal in front of it can do. `$TERM` names
the entry, and the entries live in the terminfo database:

```bash
infocmp -1 xterm-256color | head -4
```
```
#	Reconstructed via infocmp from file: /usr/share/terminfo/x/xterm-256color
xterm-256color|xterm with 256 colors,
	am,
	bce,
```

Your emulator sets `$TERM` when it starts the shell. Two common complaints come out of that.

Over SSH the value travels with you and describes *your* terminal. A `$TERM` the remote machine
has no entry for gives you "terminal is not fully functional" and a broken-looking
[`less`](/commands/less/).
Install `ncurses-term` there, or set `TERM=xterm` for the session.

In cron or a systemd unit there is no terminal and usually no `$TERM` at all. `clear` and `tput`
fail there while working perfectly when you run the same script by hand.

## When the terminal goes away

Closing the window, or losing the connection, destroys the pty. The kernel notices and sends HUP
to the session's foreground process group, which by default terminates it. That is a signals
question rather than a terminal one, and
[processes and signals](/concepts/processes-and-signals/) covers what arrives, what survives it,
and why `nohup`, `disown` and `setsid` are three different answers.
