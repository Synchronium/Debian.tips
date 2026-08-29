---
title: "Arrays"
tagline: "Lists whose elements keep their spaces"
description: "Indexed and associative arrays in bash: building them, why the @ and * subscripts differ, and filling one from command output without splitting."
category: scripting
tags: [scripting, beginner]
updated: 2026-08-29
order: 7
related: [variables-and-quoting, loops, script-arguments]
---

A variable holds one string. An array holds a list of them, each element kept separate from the
next even when it contains a space:

```bash
hosts=(deb1 deb2 "web server")

echo "${hosts[0]}"
echo "${hosts[2]}"
echo "count: ${#hosts[@]}"
```
```
deb1
web server
count: 3
```

Elements are numbered from zero. The braces are part of the syntax here rather than the optional
emphasis they are around a plain variable name: `$hosts[0]` is the variable `hosts` followed by
the literal text `[0]`, and `$hosts` on its own is element zero.

```bash
hosts=(deb1 deb2 "web server")
echo $hosts[0]
```
```
deb1[0]
```

Nothing there is an error, so nothing warns you.

## `"${hosts[@]}"` and `"${hosts[*]}"` are different lists

Both mean every element. Inside double quotes, `[@]` expands to one word per element and `[*]`
expands to a single word with the elements joined by spaces. Unquoted, either is then split on
whitespace, discarding the grouping the array existed to keep:

```bash
hosts=(deb1 deb2 "web server")

for h in "${hosts[@]}"; do echo "[$h]"; done
echo "--- unquoted"
for h in ${hosts[@]}; do echo "[$h]"; done
echo "--- star"
for h in "${hosts[*]}"; do echo "[$h]"; done
```
```
[deb1]
[deb2]
[web server]
--- unquoted
[deb1]
[deb2]
[web]
[server]
--- star
[deb1 deb2 web server]
```

Three elements, then four, then one. The unquoted form also runs each element through filename
expansion, so an element containing `*` is replaced by whatever it matches in the current
directory.

A script's positional parameters are an array in everything but the way they are written, and
`"$@"` is this same expansion applied to them.
[Script arguments](/scripting/script-arguments/) covers that side of it.

## Appending, and asking what is in one

`+=` appends. Keep the parentheses: the right-hand side is a list even when it holds one element,
and `files+=notes.txt` without them appends to element zero instead of adding an element.

```bash
files=(report.txt)
files+=("notes 2026.txt")
files+=(archive.tar.gz)

echo "${#files[@]} entries"
printf "%s\n" "${files[@]}"
echo "last: ${files[-1]}"
echo "indices: ${!files[@]}"
```
```
3 entries
report.txt
notes 2026.txt
archive.tar.gz
last: archive.tar.gz
indices: 0 1 2
```

`${#files[@]}` counts the elements and `${!files[@]}` lists their indices. `unset` removes an
element without renumbering the ones after it, which is how those two come to disagree:

```bash
hosts=(deb1 deb2 deb3 deb4)
unset "hosts[1]"

echo "count: ${#hosts[@]}"
echo "indices: ${!hosts[@]}"
printf "%s\n" "${hosts[@]}"
```
```
count: 3
indices: 0 2 3
deb1
deb3
deb4
```

Iterate over `"${hosts[@]}"` for the values, or over `"${!hosts[@]}"` when you need the index
too. A counting loop from `0` to `${#hosts[@]}` reads a hole in the middle of that array and never
reaches the last element.

## Filling an array from command output

A command substitution produces one string. The shell splits it on whitespace before the array is
built, so the obvious spelling breaks on any name containing a space:

```bash
files=( $(ls *.txt) )
echo "${#files[@]} entries"
printf "[%s]\n" "${files[@]}"
```
```
3 entries
[notes]
[2026.txt]
[report.txt]
```

Two files went in and three elements came out. `mapfile` reads its input a line at a time, so a
space inside a line is just a space:

```bash
mapfile -t files < <(ls *.txt)
echo "${#files[@]} entries"
printf "[%s]\n" "${files[@]}"
```
```
2 entries
[notes 2026.txt]
[report.txt]
```

`-t` strips the newline from the end of each line; without it every element ends in one.
`readarray` is the same builtin under a second name.

For filenames the glob does this on its own, with no external command involved:

```bash
files=(*.txt)
echo "${#files[@]} entries"
printf "[%s]\n" "${files[@]}"
```
```
2 entries
[notes 2026.txt]
[report.txt]
```

> [!WARNING]
> A glob that matches nothing expands to itself. `files=(*.csv)` in a directory with no CSV files
> gives you one element containing the two characters `*.csv`, rather than the empty array you
> were expecting, and the loop that follows runs once against a filename that does not exist.
> `shopt -s nullglob` changes that for the rest of the script.

## Arrays indexed by string

`declare -A` makes an associative array, whose subscripts are strings rather than numbers:

```bash
declare -A owner
owner[report.txt]=alice
owner["quarterly plan.txt"]=alice
owner[notes.txt]=bob

echo "${owner[notes.txt]}"
echo "${#owner[@]} entries"
```
```
bob
3 entries
```

Leaving out the declaration does not produce an error. In an ordinary indexed array the subscript
is an arithmetic expression, where an unset variable evaluates to zero, so every assignment below
writes to element zero:

```bash
owner=()
owner[alice]=report.txt
owner[bob]=notes.txt

echo "count: ${#owner[@]}"
echo "alice has: ${owner[alice]}"
```
```
count: 1
alice has: notes.txt
```

Keys come back from an associative array in a hash order: not insertion order, not sorted, and
not guaranteed to hold across bash versions. Sort them wherever the output is read by a person or
compared by a test.

```bash
declare -A owner
owner[report.txt]=alice
owner["quarterly plan.txt"]=alice
owner[notes.txt]=bob

while IFS= read -r key; do
  echo "$key is owned by ${owner[$key]}"
done < <(printf "%s\n" "${!owner[@]}" | sort)
```
```
notes.txt is owned by bob
quarterly plan.txt is owned by alice
report.txt is owned by alice
```

That is `IFS= read -r` rather than `for key in $(...)` for the reason in
[Loops](/scripting/loops/): a command substitution there would split `quarterly plan.txt` back
into two keys.

## Building up a command line

A script that decides its arguments while it runs should build the command as an array. Each
element stays one word however many spaces it contains:

```bash
cmd=(wc -l "notes 2026.txt" report.txt)
"${cmd[@]}"
```
```
 1 notes 2026.txt
 1 report.txt
 2 total
```

The same list in a string does not survive. Quote removal happens before word splitting, so by the
time `$cmd` is expanded the apostrophes in it are ordinary characters:

```bash
cmd="wc -l 'notes 2026.txt' report.txt"
$cmd
```
```
wc: "'notes": No such file or directory
wc: "2026.txt'": No such file or directory
 1 report.txt
 1 total
```

Options accumulate the same way. A flag that depends on something the script only learns at run
time gets appended rather than pasted into a string:

```bash
opts=(-n)
ignore_case=yes
[ "$ignore_case" = yes ] && opts+=(-i)

grep "${opts[@]}" ALICE *.txt
```
```
notes 2026.txt:1:ask alice about the report
```

## Exercises

1. This loop over a four-element array prints three lines, one of them empty. Explain both.

   ```bash
   hosts=(deb1 deb2 deb3 deb4)
   unset "hosts[1]"
   for ((i = 0; i < ${#hosts[@]}; i++)); do echo "$i: [${hosts[i]}]"; done
   ```

   <details><summary>Answer</summary>

   It prints `0: [deb1]`, then `1: []`, then `2: [deb3]`.

   `unset` left the indices at 0, 2 and 3 while `${#hosts[@]}` counts what is present, which is 3.
   The loop therefore reads index 1, which no longer exists, and stops before index 3. Writing it
   as `for host in "${hosts[@]}"` visits exactly the three elements that are there.
   </details>

2. Fill an array with every `.txt` file in a directory whose names may contain spaces, in three
   ways, and say which you would use.

   <details><summary>Answer</summary>

   ```bash
   files=(*.txt)                        # no external command, no splitting
   mapfile -t files < <(ls *.txt)       # a line at a time
   mapfile -d '' files < <(find . -name '*.txt' -print0)   # any depth, any character
   ```

   The glob for one directory, `find -print0` when the search is recursive or a filename might
   contain a newline. `files=( $(ls) )` is the one to avoid.
   </details>

3. Count how many files each person owns, given the `owner` array above.

   <details><summary>Answer</summary>

   ```bash
   declare -A count
   for file in "${!owner[@]}"; do
     count[${owner[$file]}]=$(( ${count[${owner[$file]}]:-0} + 1 ))
   done
   ```

   `:-0` supplies the starting value, since an unset key expands to the empty string and arithmetic
   on that is an error. [Parameter expansion](/scripting/parameter-expansion/) is where the rest of
   that syntax lives.
   </details>

## What's next

A function cannot take an array as an argument, since arguments are strings. Pass `"${arr[@]}"`
and [the function](/scripting/functions/) reads it back as `"$@"`, one element per positional
parameter. The syntax around the elements themselves, `${var#prefix}` and its relatives, is
[Parameter expansion](/scripting/parameter-expansion/).
