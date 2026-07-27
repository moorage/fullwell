import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("only the apex serves the application after the canonical-origin cutover", async () => {
  const [caddyfile, compose] = await Promise.all([
    readFile(new URL("Caddyfile", import.meta.url), "utf8"),
    readFile(new URL("compose.yaml", import.meta.url), "utf8"),
  ]);
  const aliasBlock = caddyfile.match(
    /^www\.fullwell\.ai, fullwell\.souschefstudio\.com \{(?<body>[\s\S]*?)\n\}/m,
  );
  const applicationBlock = caddyfile.match(/^fullwell\.ai \{(?<body>[\s\S]*)\n\}\s*$/m);

  assert.ok(aliasBlock?.groups?.body, "Caddy must manage HTTPS for www and the legacy host");
  assert.match(aliasBlock.groups.body, /redir https:\/\/fullwell\.ai\{uri\} permanent/);
  assert.doesNotMatch(aliasBlock.groups.body, /reverse_proxy/);
  assert.ok(applicationBlock?.groups?.body, "Caddy must serve the apex application origin");
  assert.match(applicationBlock.groups.body, /reverse_proxy app:3000/);
  assert.doesNotMatch(applicationBlock.groups.body, /redir /);
  assert.doesNotMatch(caddyfile, /\{\$PUBLIC_DOMAIN\}/);
  assert.match(compose, /PUBLIC_ORIGIN: https:\/\/\$\{PUBLIC_DOMAIN:\?set PUBLIC_DOMAIN\}/);
  assert.doesNotMatch(compose, /fullwell\.ai/);
});

test("the temporary gateway exposes only the apex WhatsApp webhook", async () => {
  const caddyfile = await readFile(new URL("Caddyfile.whatsapp-cutover", import.meta.url), "utf8");
  const apexBlock = caddyfile.match(
    /^fullwell\.ai \{(?<body>[\s\S]*?)\n\}\n\nfullwell\.souschefstudio\.com/m,
  );
  const legacyBlock = caddyfile.match(
    /^fullwell\.souschefstudio\.com \{(?<body>[\s\S]*)\n\}\s*$/m,
  );

  assert.ok(apexBlock?.groups?.body, "Temporary Caddy must terminate the apex");
  assert.match(apexBlock.groups.body, /path \/api\/messaging\/whatsapp\/webhook/);
  assert.match(apexBlock.groups.body, /method GET POST/);
  assert.match(apexBlock.groups.body, /handle @whatsapp_webhook \{\s+reverse_proxy app:3000/);
  assert.match(
    apexBlock.groups.body,
    /handle \{\s+redir https:\/\/fullwell\.souschefstudio\.com\{uri\} permanent/,
  );
  assert.equal(apexBlock.groups.body.match(/^\s*path \//gm)?.length, 1);
  assert.ok(legacyBlock?.groups?.body, "Temporary Caddy must keep the legacy application origin");
  assert.match(legacyBlock.groups.body, /reverse_proxy app:3000/);
});
