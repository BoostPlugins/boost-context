#!/usr/bin/env node

const { run } = require('../dist/index.js');

run(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
