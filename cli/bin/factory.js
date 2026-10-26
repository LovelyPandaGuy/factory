#!/usr/bin/env node
import { main } from "../lib/cli.js";
import { flush } from "../lib/telemetry.js";

main(process.argv.slice(2))
  .then(async (code) => {
    await flush();
    process.exit(code);
  })
  .catch((error) => {
    console.error(error?.stack ?? error);
    process.exit(1);
  });
