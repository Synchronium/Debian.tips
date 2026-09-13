---
title: "A service won't start"
tagline: "Status, then journal, then the exit code"
description: "A service will not come up, and systemctl either reported a job failure or stayed silent. Read the status, read the journal, then branch on the code."
category: troubleshooting
tags: [systemd, sysadmin, processes]
updated: 2026-09-12
related: [systemctl, journalctl, systemd-services, ss, exit-codes-and-error-handling]
---

Two things happen when a service will not come up, and they look nothing alike. Either
`systemctl start` refuses in front of you:

<!-- verify: skip the unit name is whichever service you were starting -->
```
Job for tips-worker.service failed because the control process exited with error code.
See "systemctl status tips-worker.service" and "journalctl -xeu tips-worker.service" for details.
```

or it stays silent, returns zero, and leaves the service dead.

## Why a silent start still leaves the service dead

The default `Type=simple` tells systemd that the service is up as soon as it has been forked. The
program has not run yet at that point, so a missing binary, a bad argument or an immediate crash
all happen after `systemctl start` has already reported success.

```bash
systemctl start tips-api.service
echo "systemctl start exit status: $?"
sleep 1
systemctl is-active tips-api.service
```
```
systemctl start exit status: 0
failed
```

The `sleep` is doing real work there. systemd reaps the process and records the failure
asynchronously, so `is-active` asked immediately after `start` can still answer `activating`.

Units declaring `Type=notify`, `Type=oneshot` or `Type=forking` do report the failure to
`systemctl start`, because in each of those systemd has agreed to wait for something before calling
the job done. That is the whole difference between the two openings above, and it does not tell you
which service is more broken.

## Read the status block first

<!-- verify: shape the timestamps, the invocation id, the PID and the memory and CPU figures are this machine's -->
```bash
systemctl start tips-api.service
sleep 1
systemctl status tips-api.service --no-pager
```
```
× tips-api.service - Tips API
     Loaded: loaded (/etc/systemd/system/tips-api.service; static)
     Active: failed (Result: exit-code) since Sat 2026-09-12 19:35:42 UTC; 1s ago
   Duration: 10ms
 Invocation: b439443eb55c43abbf7b62b65b8b4867
    Process: 12760 ExecStart=/usr/local/bin/tips-api (code=exited, status=203/EXEC)
   Main PID: 12760 (code=exited, status=203/EXEC)
   Mem peak: 1.5M
        CPU: 5ms

Sep 12 19:35:42 deb1 systemd[1]: Started tips-api.service - Tips API.
Sep 12 19:35:42 deb1 (tips-api)[12760]: tips-api.service: Unable to locate executable '/usr/local/bin/tips-api': No such file or directory
Sep 12 19:35:42 deb1 (tips-api)[12760]: tips-api.service: Failed at step EXEC spawning /usr/local/bin/tips-api: No such file or directory
Sep 12 19:35:42 deb1 systemd[1]: tips-api.service: Main process exited, code=exited, status=203/EXEC
Sep 12 19:35:42 deb1 systemd[1]: tips-api.service: Failed with result 'exit-code'.
```

Three lines carry the diagnosis. `Loaded:` says whether systemd found a unit file and what it
thinks of it. `Active:` says the current state and, in brackets, why it left the last one.
`Process:` gives the exit code, which decides which of the branches below you are in:

| Code | What refused | Where to look |
| --- | --- | --- |
| `203/EXEC` | The kernel could not run the program | The path in `ExecStart=`, and its execute bit |
| `200/CHDIR` | The service could not enter `WorkingDirectory=` | Permissions along that path |
| `1/FAILURE` and other small numbers | The program ran and chose to exit | The journal, for what it printed first |
| `226/NAMESPACE`, `217/USER`, `208/STDIN` | A sandboxing or identity directive | The directive named in the code |

The last eight or so lines of the journal come free at the bottom of the status block, which is
usually enough. [journalctl](/commands/journalctl/) is how you get the rest.

## The unit systemd could not find

```bash
systemctl start tips-typo.service
systemctl status tips-typo.service
```
```
Failed to start tips-typo.service: Unit tips-typo.service not found.
Unit tips-typo.service could not be found.
```

Either the name is wrong or the package that ships the unit is not installed. Tab completion after
`systemctl start` lists the real names, and `systemctl list-unit-files 'tips-*'` narrows a guess.
A unit that lives in a user session rather than the system one answers here too, so it wants
`systemctl --user`.

## The unit that is masked

```bash
systemctl start tips-legacy.service
systemctl status tips-legacy.service --no-pager | head -2
```
```
Failed to start tips-legacy.service: Unit tips-legacy.service is masked.
○ tips-legacy.service
     Loaded: masked (Reason: Unit tips-legacy.service is masked.)
```

Masking symlinks the unit to `/dev/null`, which is stronger than disabling it: it cannot be started
at all, not even by another unit that depends on it. `systemctl unmask tips-legacy.service` reverses it.

Somebody masked it deliberately, often a package's maintainer script or the image a container was
built from rather than a person, so find out why before undoing it.
`systemctl list-unit-files --state=masked` shows what else on the machine is in the same state.

## The program that ran and exited

```bash
systemctl start tips-worker.service
```
```
Job for tips-worker.service failed because the control process exited with error code.
See "systemctl status tips-worker.service" and "journalctl -xeu tips-worker.service" for details.
```

`status=1/FAILURE` means the program started, decided it could not continue and said so. Whatever
it printed on the way out went to the journal. `-o cat` strips the timestamps and unit prefixes, so
the program's own words are all that is left:

```bash
systemctl start tips-worker.service 2>/dev/null
sleep 1
journalctl -u tips-worker.service --no-pager -n 4 -o cat
```
```
tips-worker: cannot open /etc/tips/worker.conf: No such file or directory
tips-worker.service: Main process exited, code=exited, status=1/FAILURE
tips-worker.service: Failed with result 'exit-code'.
Failed to start tips-worker.service - Tips worker.
```

The first line is the answer and the other three are systemd narrating. A service that fails on
startup usually names its own reason like this, so read upward from the exit code until you reach a
line systemd did not write.

`journalctl -u tips-worker.service -b` gives everything since boot when the interesting line has
already scrolled past `-n 4`, and `-f` follows a unit you are restarting in another terminal.

## The directory the service could not enter

```bash
systemctl start tips-report.service 2>/dev/null
sleep 1
journalctl -u tips-report.service --no-pager -n 4 -o cat
```
```
tips-report.service: Failed at step CHDIR spawning /usr/local/bin/tips-report: Permission denied
tips-report.service: Main process exited, code=exited, status=200/CHDIR
tips-report.service: Failed with result 'exit-code'.
Failed to start tips-report.service - Tips report builder.
```

`200/CHDIR` happens before the program runs at all. systemd has already dropped to the `User=` the
unit names, and that user cannot enter `WorkingDirectory=`:

```bash
stat -c "%A %U %n" /srv/tips/reports
```
```
drwx------ root /srv/tips/reports
```

Mode 700 owned by root, against a service running as `tipssvc`. Every directory along the path
needs `x` for that user, not just the last one, which is the case
[file permissions](/concepts/file-permissions-explained/) covers in full. `Failed at step` is the
phrase to search for generally: systemd names the step it was on, so `NAMESPACE` points at
`ProtectSystem=` or `PrivateTmp=`, and `USER` points at a `User=` that does not exist.

## The port that was already taken

```bash
systemctl start tips-listener.service 2>/dev/null
sleep 1
journalctl -u tips-listener.service --no-pager -n 4 -o cat
```
```
tips-serve: cannot bind 127.0.0.1:9101: Address already in use
tips-listener.service: Main process exited, code=exited, status=1/FAILURE
tips-listener.service: Failed with result 'exit-code'.
Failed to start tips-listener.service - Tips listener.
```

This one reads as `1/FAILURE` like any other refusal to continue, and the program's own line is
what distinguishes it. [ss](/commands/ss/) names the holder:

<!-- verify: shape the PID belongs to whichever process holds the port on your machine -->
```bash
ss -ltnp "sport = :9101"
```
```
State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess                               
LISTEN 0      5          127.0.0.1:9101      0.0.0.0:*    users:(("tips-serve",pid=16700,fd=3))
```

Often the holder is an older copy of the same service that systemd has lost track of, started by
hand or left behind by a unit that was edited while running. Where the port is held by something
you cannot identify, [kill whatever is using a port](/recipes/kill-whatever-is-using-a-port/) is
the fuller procedure.

## The service that is running and not answering

```bash
systemctl start tips-quiet.service
systemctl is-active tips-quiet.service
ss -ltn "sport = :9102"
echo "nothing is listening on 9102"
```
```
active
State Recv-Q Send-Q Local Address:Port Peer Address:Port
nothing is listening on 9102
```

systemd is telling the truth: the process it started is alive. `active` is a claim about a process,
never about whether that process is doing its job, so a daemon that read the wrong config and never bound
a socket, or bound `127.0.0.1` when the client is on another host, is `active (running)` throughout.

Check the socket rather than the unit whenever the complaint is that something cannot connect.
`ss -ltnp` with no filter lists every listener on the machine, which answers "is it bound to the
address I think it is" in one line.

## Reading the unit file itself

`systemctl cat` prints the unit as systemd loaded it, drop-ins and all, which is not always the file
you were editing:

```bash
systemctl cat tips-api.service
```
```
# /etc/systemd/system/tips-api.service
[Unit]
Description=Tips API

[Service]
ExecStart=/usr/local/bin/tips-api
```

A mistyped directive is not an error to systemd. It is ignored, so the unit runs with the default
you were trying to override, which is a much quieter failure than a syntax error would be:

```bash
printf "ExecStrat=/usr/local/bin/tips-api\n" >> /etc/systemd/system/tips-api.service
systemd-analyze verify /etc/systemd/system/tips-api.service
```
```
/etc/systemd/system/tips-api.service:6: Unknown key 'ExecStrat' in section [Service], ignoring.
tips-api.service: Command /usr/local/bin/tips-api is not executable: No such file or directory
```

`systemd-analyze verify` catches both at once: the key nobody will ever act on, and the program that
is not there. Worth running on any unit you have hand-edited, before wondering why the setting had
no effect.

## The daemon-reload answer, and where it stopped applying

The standard reply to a unit change that had no effect is that you forgot `systemctl daemon-reload`.
On Debian 13 that is out of date: systemd 257 notices a changed unit file by itself, and acts on
the new contents without being asked.

```bash
sed -i "s|^ExecStart=.*|ExecStart=/usr/bin/tips-api|" /etc/systemd/system/tips-api.service
systemctl show -p ExecStart --value tips-api.service | grep -o "path=[^ ]*"
```
```
path=/usr/bin/tips-api
```

No reload was run there, and a unit file created from scratch behaves the same way. Running
`daemon-reload` is still harmless and still correct on Debian 12 and earlier, so keep it in a
provisioning script that has to work on both. What it will not do is restart anything: a running
service keeps the settings it started with until `systemctl restart` gives it the new ones.

## Clearing the failed state

A failed unit stays failed in the list until it starts successfully or is reset, which is what makes
the failed list worth reading at all:

```bash
systemctl start tips-api.service tips-worker.service 2>/dev/null
sleep 1
systemctl list-units --failed --no-pager --no-legend
```
```
● tips-api.service    loaded failed failed Tips API
● tips-worker.service loaded failed failed Tips worker
```

This is the first command to run on a machine that is misbehaving in a way nobody has pinned down
yet. `systemctl reset-failed` clears an entry once you have dealt with it:

```bash
systemctl start tips-worker.service 2>/dev/null
sleep 1
systemctl is-failed tips-worker.service
systemctl reset-failed tips-worker.service
systemctl is-failed tips-worker.service
```
```
failed
inactive
```

Resetting clears the start-rate counter as well as the failed state. A unit carrying
`Restart=on-failure` restarts itself until it trips `StartLimitBurst=`, after which systemd stops
trying and refuses for a reason that has nothing to do with the original fault. A service that has
been failing all morning is worth resetting before the next attempt, so that what you see is the
error you are trying to fix.
