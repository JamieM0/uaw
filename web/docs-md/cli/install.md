---
title: "CLI installation and environment"
description: "Install the WorkSpec CLI and verify the installed package version."
section: "cli"
type: "how-to"
level: "beginner"
workspec_version: "2.2"
status: "canonical"
order: 20
package_min_version: "1.2.4"
---

# CLI installation and environment

The WorkSpec package requires Node.js 18 or a later version.

## Install the CLI globally

To use `workspec` from any directory, run:

```console
npm install --global workspec
```

npm creates an executable link on macOS and Linux. On Windows, npm creates command shims.

## Use a project-local installation

To keep the package version in a project dependency, run:

```console
npm install workspec
npx workspec --version
```

## Verify the installation

To print the installed package version, run:

```console
workspec --version
```

Expected output for the documented package release:

```text
1.2.4
```

To check command discovery and available options, run `workspec --help`.

> **Note:** The npm package version and the WorkSpec language version are separate. Package `1.2.4` documents WorkSpec language `2.2`.

