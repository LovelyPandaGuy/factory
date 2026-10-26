#!/usr/bin/env node
import { main } from "../lib/cli.js";

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error?.stack ?? error);
    process.exit(1);
  });
