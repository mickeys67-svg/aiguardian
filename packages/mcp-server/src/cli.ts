#!/usr/bin/env node
import { runServer } from "./server.js";

runServer().catch((err) => {
  console.error("[tg-mcp] fatal:", err);
  process.exit(1);
});
