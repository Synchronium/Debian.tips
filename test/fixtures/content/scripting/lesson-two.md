---
title: "Lesson two"
description: "Fixture scripting lesson two, used only by the generator's test suite."
category: scripting
tags: [demo]
updated: 2026-01-02
order: 2
---

Fixture lesson two body.

A pair whose only block is exempt, so a harness that gives this page a setup script still has
nothing automated to run on it:

<!-- verify: skip fixture page, nothing here is ever executed -->
```bash
echo "hello"
```
```
hello
```
