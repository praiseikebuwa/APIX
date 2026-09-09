#!/usr/bin/env node
import {
  createCli
} from "../chunk-PJECUFEJ.js";

// src/bin/apix.ts
var cli = createCli();
cli.parseAsync(process.argv).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
//# sourceMappingURL=apix.js.map