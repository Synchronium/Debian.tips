---
title: "How this site is tested"
description: "A fixture copy of the about page, small enough to assert on."
---

Every example is run for real: {{replayed}} outputs, across {{commandPages}} command pages.

Kept to one line per claim so a test can assert on a whole sentence — the real about page wraps
its prose, and matching across that wrap is what made the assertion brittle.
