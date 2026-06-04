#!/usr/bin/env node
process.argv.push("--check");
await import("./generate.mjs");
