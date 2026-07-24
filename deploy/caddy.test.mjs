import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("brand aliases redirect to the canonical application origin", async () => {
  const [caddyfile, compose] = await Promise.all([
    readFile(new URL("Caddyfile", import.meta.url), "utf8"),
    readFile(new URL("compose.yaml", import.meta.url), "utf8"),
  ]);
  const aliasBlock = caddyfile.match(
    /fullwell\.ai, www\.fullwell\.ai \{(?<body>[\s\S]*?)\n\}/,
  );

  assert.ok(aliasBlock?.groups?.body, "Caddy must manage HTTPS for the apex and www aliases");
  assert.match(aliasBlock.groups.body, /redir https:\/\/\{\$PUBLIC_DOMAIN\}\{uri\} permanent/);
  assert.doesNotMatch(aliasBlock.groups.body, /reverse_proxy/);
  assert.ok(caddyfile.indexOf("fullwell.ai") < caddyfile.indexOf("{$PUBLIC_DOMAIN} {"));
  assert.match(compose, /PUBLIC_ORIGIN: https:\/\/\$\{PUBLIC_DOMAIN:\?set PUBLIC_DOMAIN\}/);
  assert.doesNotMatch(compose, /fullwell\.ai/);
});
