# Boost Context CLI

A lightweight toolkit of CLI commands for gathering project context and capturing web page snapshots. Perfect for quickly sharing trees of relevant files or grabbing visual baselines during reviews. This repository was produced end-to-end with the help of ChatGPT Codex.

## Table of contents

- [Quick start](#quick-start)
- [Installation](#installation)
- [Commands](#commands)
  - [Dump](#dump)
  - [Tee](#tee)
  - [Snap](#snap)
- [Development](#development)
- [Project structure](#project-structure)
- [License](#license)

## Quick start

```bash
npm install
npm run dev -- dump src ts tsx

# or install the CLI globally from this clone
npm install -g .
bctx --help
```

## Installation

- **Development:** run commands with `npm run dev -- <subcommand>` to execute the TypeScript entry point directly.
- **Bundle + run:** build once with `npm run build`, then call `node dist/index.js <subcommand>`.
- **Global link:** `npm link` exposes the binary as `bctx` on your PATH for ad-hoc use.
- **Install globally:** from the project root run `npm install -g .` (or `pnpm add -g .` / `yarn global add .`) to install the CLI system-wide.

## Commands

### Dump

Dumps a filtered directory tree for all matching files, but only includes the _contents_ of files that are not excluded. This provides a complete structural overview while keeping the detailed context focused and relevant.

```bash
bctx dump [extensions...] [options]
```

| Option                    | Description                                                             |
| ------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| `extensions`              | Space- or `                                                             | `-separated list (with or without leading dots). |
| `-C, --cwd <dir>`         | Root directory to scan (defaults to current working directory).         |
| `-x, --exclude <pattern>` | Glob of files or directories whose **content** to exclude (repeatable). |

#### Content Exclusion Rules

The `dump` command uses a powerful, multi-layered approach to decide which file contents to exclude from the output. All files matching the specified extensions will appear in the tree, but their content will be omitted if they match any of the following exclusion rules:

1.  **.gitignore:** Rules from the standard `.gitignore` file are always applied.
2.  **.bctxignore:** If your project contains a `.bctxignore` file in the root, its rules are **combined** with the `.gitignore` rules. This is the recommended way to hide project-specific noise (like test files, mocks, or generated code) from the `bctx` output without modifying your project's `.gitignore`.
3.  **--exclude flag:** Any patterns passed via the `-x` or `--exclude` command-line option are also applied.

#### Example

Imagine a project with the following `.bctxignore` file:

```
# .bctxignore
**/*.test.ts
**/generated/**
```

Running the command:

```bash
bctx dump ts tsx --exclude "**/__mocks__/**"
```

Will produce an output where `api.ts` and `component.tsx` are included fully, but the test file, generated schema, and any files inside `__mocks__` are only listed in the tree:

```
### Tree (filtered):
  src/
    __mocks__/
      user.ts
    api.ts
    component.tsx
    component.test.ts
  generated/
    schema.ts

===== /src/api.ts =====
// contents of api.ts...

===== /src/component.tsx =====
// contents of component.tsx...

```

### Snap

Capture a PNG snapshot of a page once it loads.

```bash
bctx snap <url> [options]
```

| Option                       | Description                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-w, --width <value>`        | Viewport width in pixels or Tailwind token (`sm`, `md`, `lg`, `xl`, `2xl`). Defaults to `xl`.                                                                                       |
| `--wait <ms>`                | Milliseconds to wait after the page reports `load`.                                                                                                                                 |
| `-o, --output <file>`        | Filename for the PNG. Defaults to `bctx-browser <timestamp>.png` saved to your screenshot directory (macOS setting when available, otherwise `~/Desktop` or the current directory). |
| `-H, --header <header>`      | Add a request header (`Name: value`). May be repeated.                                                                                                                              |
| `-X, --request <method>`     | Override the HTTP method for the initial navigation.                                                                                                                                |
| `-d, --data <data>`          | Append body data (repeatable). Defaults to POST when provided.                                                                                                                      |
| `-A, --user-agent <agent>`   | Set a custom User-Agent string.                                                                                                                                                     |
| `-u, --user <user:password>` | Provide HTTP basic auth credentials.                                                                                                                                                |
| `-b, --cookie <cookie>`      | Send a cookie (`name=value`). Repeat to add more.                                                                                                                                   |
| `--cookie-file <path>`       | Load cookies from a Netscape `cookies.txt` or Chrome DevTools JSON export before navigation.                                                                                        |
| `--compressed`               | Include an `Accept-Encoding: gzip, deflate, br` header.                                                                                                                             |
| `-k, --insecure`             | Ignore TLS certificate errors when launching the browser.                                                                                                                           |

**Example**

```bash
bctx snap https://example.com -w md --wait 500 -o example-md.png
```

Supports common curl-style flags, for example:

```bash
bctx snap https://example.com -X POST -d token=123 -H "X-Env: staging" --compressed
```

Override the destination directory by setting `BCTX_SCREENSHOT_DIR=/path/to/screens`.

**Cookie imports**

Export cookies from Chrome/Chromium using an extension such as “Get cookies.txt” (Netscape format) or the DevTools Application → Cookies panel (JSON). Supply the exported file with `--cookie-file` to replay authenticated sessions without manually copying values.

### Tee

Pipe stdin to a file while still streaming it to stdout—handy for saving build logs or command output for LLM prompts without losing the console stream.

```bash
some-command | bctx tee logs/latest/output.txt
```

| Option | Description                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `file` | Destination file (optional). Defaults to `bctx-capture-<YYYYMMDD-HHMMSS>.log` in the current directory. Intermediate folders are created automatically. |

The command does not print additional output—whatever arrives on stdin is echoed as-is to stdout and written to the target file. Set `BCTX_CAPTURE_DIR` to capture into a specific directory by default.

## Development

- `npm run build` compiles TypeScript to `dist/`.
- `npm run dev -- <args>` runs the CLI with automatic reload.
- `npm test` builds and executes the Jest suites in `tests/`.

## Project structure

```
src/
  commands/
    dump/
      filters.ts
      fs.ts
      index.ts
      options.ts
      output.ts
      types.ts
      utils.ts
    snap/
      cookies.ts
      index.ts
      output.ts
      request.ts
      timing.ts
      types.ts
      url.ts
      viewport.ts
    tee/
      index.ts
  index.ts
```

## License

MIT
