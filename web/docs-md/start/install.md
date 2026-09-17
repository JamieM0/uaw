---
title: "Install and verify"
description: "Install WorkSpec with Node.js and verify the CLI and JavaScript package."
section: "start"
type: "tutorial"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 20
---

# Install and verify

This tutorial prepares a local project to use WorkSpec from the terminal and JavaScript.

## Prerequisites

Install Node.js 18 or a later version. Confirm the installed versions:

```console
node --version
npm --version
```

## Install WorkSpec

1. Create a project directory and enter it.

   ```console
   mkdir parcel-workflow
   cd parcel-workflow
   ```

2. Create a local npm project.

   ```console
   npm init --yes
   ```

3. Install WorkSpec.

   ```console
   npm install workspec
   ```

4. Print the installed package version.

   ```console
   npx workspec --version
   ```

   The command prints a package version such as:

   ```text
   1.2.5
   ```

5. Optional: Install WorkSpec globally to run `workspec` without `npx`.

   ```console
   npm install --global workspec
   workspec --version
   ```

> **Checkpoint:** Both checks must succeed before you continue.

## Package version and language version

The command prints the npm package version. Your project files declare the WorkSpec language version separately.


## Next step

[Build your first WorkSpec project](/docs/start/first-project/) with validation, a snapshot, a Constraint, and SVG rendering.
