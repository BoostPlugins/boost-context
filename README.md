# boost-context

A TypeScript-powered CLI skeleton for the Boost Context project. The command structure is organised for multiple sub-commands while the current implementation simply echoes the first argument provided.

## Getting started

```bash
npm install
```

During development you can run the CLI without building:

```bash
npm run dev -- hello world
# prints: hello
```

To produce build artefacts and execute the compiled CLI:

```bash
npm run build
node dist/index.js hello
```

Optionally link the executable locally so you can invoke the `bctx` command directly:

```bash
npm link
bctx echo hello
```

## Project structure

- `src/index.ts` wires the CLI and shared configuration.
- `src/commands/` holds individual commands. `echo.ts` is an example that prints the first argument.
- `bin/bctx.js` is the Node shebang shim used when the package is installed globally.
- `tsconfig.json` controls TypeScript compilation into the `dist/` directory.

## Commands

- `bctx echo <values...>` – echoes the first provided value.
- `bctx context [options] [ext ...]` – replicates the legacy `context` bash script by printing a filtered tree then dumping file contents while honouring `.gitignore` rules.

Examples:

```bash
# Show TypeScript files under src without building first
npm run dev -- context -C src ts tsx

# Exclude test fixtures while inspecting JavaScript and TypeScript
bctx context -x '*fixture*' js ts
```

## Available scripts

- `npm run dev` – execute the CLI through `tsx` without building.
- `npm run build` – compile TypeScript to `dist/`.
- `npm run start` – run the compiled CLI from `dist/`.
- `npm run clean` – remove build artefacts.
