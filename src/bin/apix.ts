#!/usr/bin/env node
import { createCli } from '../cli/index.js';

const cli = createCli();

cli.parseAsync(process.argv).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
