// src/server.ts
// Local development only — NOT included in Edge deploy archive.
// Uses @hono/node-server (Node built-in) which is incompatible with Edge runtime.

import { serve } from "@hono/node-server";
import app from "./index.js";

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`LUCK Snap Casino dev server running at http://localhost:${info.port}`);
  console.log(
    `Test GET:  curl -sS -H 'Accept: application/vnd.farcaster.snap+json' http://localhost:${info.port}/`
  );
});
