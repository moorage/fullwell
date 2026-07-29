import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(root, "../..");

export const requiredSkills = [
  "audit-food-delivery-orders",
  "audit-grocery-purchases",
  "import-food-collection",
  "manage-household-food-journal",
  "plan-household-meals",
  "reorder-food-delivery",
  "restock-groceries",
  "share-food-collection",
  "track-recipe-history"
];

export const requiredTools = [
  "hfj_accept_family_invite",
  "hfj_add_meal_proposal",
  "hfj_append_evidence",
  "hfj_commit_change_set",
  "hfj_commit_delivery_index",
  "hfj_commit_onboarding",
  "hfj_create_collection",
  "hfj_create_collection_share",
  "hfj_create_family_invite",
  "hfj_create_household",
  "hfj_export_household",
  "hfj_get_context",
  "hfj_get_delivery_index",
  "hfj_get_delivery_order",
  "hfj_get_item",
  "hfj_get_meal_plan",
  "hfj_get_profile",
  "hfj_import_collection_items",
  "hfj_list_members",
  "hfj_plan_collection_import",
  "hfj_preview_shared_collection",
  "hfj_remove_member",
  "hfj_review_meal_constraints",
  "hfj_revoke_collection_share",
  "hfj_revoke_family_invite",
  "hfj_search_delivery_history",
  "hfj_search_items",
  "hfj_select_household",
  "hfj_update_household_name",
  "hfj_update_onboarding",
  "hfj_update_member",
  "hfj_update_meal_planning_constraints",
  "hfj_update_profile",
  "hfj_update_user_display_name",
  "hfj_withdraw_meal_proposal"
];

export const requiredLocalTools = [
  "fullwell_local_household_delete_collecting",
  "fullwell_local_household_load",
  "fullwell_local_household_update",
  "fullwell_local_profile_load",
  "fullwell_local_profile_update",
  "fullwell_local_recipe_board_create",
  "fullwell_local_whatsapp_runner_stop"
];

const requiredEvalIds = [
  "existing-account-setup-oauth",
  "codex-logged-out-cloud-chat-recovers-oauth",
  "first-time-setup-asks-account-before-oauth",
  "first-time-no-account-starts-local-groceries",
  "bare-fullwell-greeting-asks-account",
  "claude-natural-greeting-asks-account",
  "snack-decline-advances-to-recipes",
  "recipe-no-sources-finishes-guided-run",
  "confirmed-onboarding-commits-once",
  "explicit-setup-stop-does-not-advance",
  "skipped-onboarding-resumes",
  "local-onboarding-draft-resumes",
  "stale-local-onboarding-draft-fails-closed",
  "invite-explicit-acceptance",
  "golden-vs-classic",
  "same-golden-sizes",
  "cereals-distinct",
  "cashew-brands-distinct",
  "order-list-summary-is-incomplete",
  "discoverable-recipe-unknown",
  "cooked-not-liked",
  "collection-private-fields",
  "select-two-of-five",
  "import-recipe-status",
  "import-snack-no-purchase",
  "duplicate-url-choice",
  "import-prompt-injection",
  "concurrent-update-conflict",
  "restock-clear-leader",
  "restock-historical-ambiguity",
  "restock-no-internet-ambiguity",
  "restock-retry-idempotency",
  "restock-no-checkout",
  "one-pass-whole-grocery-audit",
  "restock-usual-parsley-source",
  "restock-mayo-negative-formulation",
  "declined-cloud-backup-stays-local",
  "local-journal-backs-up-after-consent",
  "failed-cloud-backup-retains-local",
  "guest-sharing-offers-account",
  "local-tool-permission-survives-upgrade",
  "meal-first-time-constraints",
  "meal-explicit-none-review",
  "meal-recorded-constraints-review",
  "meal-resolved-profile-missing-weekly-review",
  "meal-general-planning-no-research-approval",
  "meal-changed-constraints",
  "meal-free-form-proposal",
  "meal-known-liked-recipe",
  "meal-liked-incompatible",
  "meal-web-search-disclosure",
  "meal-search-disclosure-declined",
  "meal-search-unavailable",
  "meal-external-recipe-provenance",
  "meal-prompt-injection",
  "meal-same-slot-proposals-survive",
  "meal-local-actor-attribution",
  "meal-two-local-actors-same-slot",
  "meal-exact-retry",
  "meal-stale-recipe-recheck",
  "meal-withdrawal-authority",
  "meal-proposer-withdrawal-success",
  "meal-owner-withdrawal-success",
  "meal-local-withdrawal",
  "meal-no-safety-guarantee",
  "meal-visual-board-handoff",
  "meal-visual-board-decline",
  "meal-visual-board-open-failure",
  "meal-visual-board-no-image",
  "meal-visual-board-exact-retry",
  "meal-visual-board-unsafe-image",
  "meal-visual-board-open-success",
  "meal-visual-board-connected-cloud-source",
  "weekly-meal-onboarding-offer",
  "weekly-meal-default-schedule",
  "weekly-meal-custom-schedule",
  "weekly-meal-vague-time",
  "weekly-meal-one-time-versus-recurring",
  "weekly-meal-task-reconciliation",
  "weekly-meal-unknown-create-result",
  "weekly-meal-exact-replay",
  "weekly-meal-lifecycle",
  "weekly-meal-skip-and-deferral",
  "weekly-meal-dst-and-zone-change",
  "weekly-meal-already-planned",
  "weekly-meal-multiple-members",
  "weekly-meal-local-data-boundary",
  "weekly-meal-scheduled-visual-handoff",
  "weekly-meal-scheduled-prompt-privacy",
  "weekly-meal-missed-runs",
  "weekly-meal-host-unavailable",
  "weekly-meal-rollback-cleanup",
  "change-local-member-name",
  "change-connected-member-name",
  "change-connected-household-name",
  "stop-local-whatsapp-runner",
  "stop-weekly-meal-reminder",
  "cloud-household-invite-next-step",
  "cloud-items-collection-next-step",
  "delivery-no-providers",
  "delivery-provider-set-changed",
  "delivery-household-visibility-declined",
  "delivery-local-promotion-success",
  "delivery-local-promotion-retry",
  "delivery-local-promotion-conflict",
  "delivery-local-promotion-declined",
  "delivery-history-pagination",
  "delivery-history-cross-household-denial",
  "delivery-provider-origin-revoked",
  "delivery-member-departure",
  "delivery-sign-in-block",
  "delivery-partial-order",
  "delivery-completed-order",
  "delivery-versus-pickup",
  "delivery-two-providers-one-restaurant",
  "delivery-same-name-locations",
  "delivery-location-alias",
  "delivery-renamed-merchant",
  "delivery-same-dish-two-locations",
  "delivery-modifier-variants",
  "delivery-duplicate-lines",
  "delivery-one-off-dish",
  "delivery-alcohol-indexing",
  "delivery-excluded-goods",
  "delivery-user-refusal",
  "delivery-prompt-injection",
  "delivery-uncertain-commit-recovery",
  "delivery-reorder-provider-ambiguity",
  "delivery-reorder-location-ambiguity",
  "delivery-reorder-stanford-swap",
  "delivery-reorder-most-recent",
  "delivery-reorder-usual-ambiguity",
  "delivery-reorder-pickup-block",
  "delivery-reorder-preserve-cart",
  "delivery-reorder-source-line-in-cart",
  "delivery-reorder-excess-source-quantity",
  "delivery-reorder-replacement-confirmation",
  "delivery-reorder-retry-reread",
  "delivery-reorder-later-session",
  "delivery-reorder-price-confirmation",
  "delivery-reorder-alcohol-maximum",
  "delivery-reorder-age-ui",
  "delivery-reorder-excluded-line",
  "delivery-reorder-signin-captcha-drift",
  "delivery-reorder-prompt-injection",
  "delivery-reorder-completion-no-checkout"
];

const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
const readWorkspaceJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(workspaceRoot, relativePath), "utf8"));

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const parseFrontmatter = (content, file) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  assert(match, `${file} must begin with YAML frontmatter`);
  const fields = Object.fromEntries(
    match[1].split("\n").map((line) => {
      const separator = line.indexOf(":");
      assert(separator > 0, `${file} has invalid frontmatter`);
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    })
  );
  assert(
    Object.keys(fields).sort().join(",") === "description,name",
    `${file} frontmatter may contain only name and description`
  );
  return fields;
};

const validatePath = async (relativePath) => {
  const absolute = path.resolve(root, relativePath);
  assert(absolute.startsWith(`${root}${path.sep}`), `Path escapes package: ${relativePath}`);
  assert((await stat(absolute)).isFile() || (await stat(absolute)).isDirectory(), `Missing ${relativePath}`);
};

export const validatePackage = async () => {
  const [packageJson, codex, claude, codexMcp, claudeMcp, codexMarket, claudeMarket, install, evals] =
    await Promise.all([
      readJson("package.json"),
      readJson(".codex-plugin/plugin.json"),
      readJson(".claude-plugin/plugin.json"),
      readJson("codex-mcp.json"),
      readJson(".mcp.json"),
      readWorkspaceJson(".agents/plugins/marketplace.json"),
      readWorkspaceJson(".claude-plugin/marketplace.json"),
      readJson("install-metadata.json"),
      readJson("evals/cases/v1.json")
    ]);

  assert(codex.name === "fullwell", "Codex must expose the public fullwell plugin name");
  assert(claude.name === "fullwell", "Claude must expose the public fullwell plugin name");
  assert(codex.version === claude.version, "Host manifests must share a version");
  assert(codex.version === packageJson.version, "Package and host versions must match");
  assert(install.release === packageJson.version, "Install metadata and package versions must match");
  assert(packageJson.files?.includes("runtime"), "Package must include the local onboarding runtime");
  assert(packageJson.files?.includes("assets"), "Package must include plugin artwork");
  assert(codex.interface?.displayName === "Fullwell", "Codex must expose the Fullwell mention name");
  assert(codex.interface?.logo === "./assets/fullwell-icon.png", "Codex must expose the canonical Fullwell plugin logo");
  assert(
    JSON.stringify(codex.interface?.defaultPrompt) === JSON.stringify([
      "Fullwell hi",
      "Fullwell i'm out of cashews",
      "Fullwell reorder from Wanpo in stanford mall"
    ]),
    "Codex must expose the approved Fullwell starter prompts"
  );
  assert(codex.interface.defaultPrompt.every((prompt) => !prompt.includes("@")), "Codex starter prompts must not contain mention syntax");
  assert(codex.skills === "./skills/" && claude.skills === "./skills/", "Hosts must use shared skills");
  assert(codex.mcpServers === "./codex-mcp.json" && claude.mcpServers === "./.mcp.json", "Hosts must use their portable MCP adapters");
  for (const mcp of [codexMcp, claudeMcp]) {
    assert(Object.keys(mcp).sort().join(",") === "fullwell-cloud,fullwell-local", "MCP config must declare only the local and hosted Fullwell services");
  }

  const codexLocalEndpoint = codexMcp["fullwell-local"];
  assert(codexLocalEndpoint?.command === "node", "Codex local Fullwell MCP must use the packaged Node runtime");
  assert(codexLocalEndpoint.args?.join(",") === "./runtime/local-household-mcp.mjs", "Codex local Fullwell MCP must use the packaged server entrypoint");
  assert(codexLocalEndpoint.cwd === ".", "Codex local Fullwell MCP must resolve from the plugin root");
  assert(codexLocalEndpoint.env_vars?.join(",") === "CODEX_HOME", "Codex local Fullwell MCP may inherit only CODEX_HOME");
  assert(codexLocalEndpoint.startup_timeout_sec === 5, "Codex local Fullwell MCP must retain its bounded startup timeout");
  assert(Object.keys(codexLocalEndpoint).sort().join(",") === "args,command,cwd,env_vars,startup_timeout_sec", "Codex local Fullwell MCP config contains unsupported authority");

  const claudeLocalEndpoint = claudeMcp["fullwell-local"];
  assert(claudeLocalEndpoint?.command === "node", "Claude local Fullwell MCP must use the packaged Node runtime");
  assert(claudeLocalEndpoint.args?.join(",") === "${CLAUDE_PLUGIN_ROOT}/runtime/local-household-mcp.mjs", "Claude local Fullwell MCP must resolve the installed plugin root");
  assert(claudeLocalEndpoint.env_vars?.join(",") === "CODEX_HOME", "Claude local Fullwell MCP may inherit only CODEX_HOME");
  assert(claudeLocalEndpoint.startup_timeout_sec === 5, "Claude local Fullwell MCP must retain its bounded startup timeout");
  assert(Object.keys(claudeLocalEndpoint).sort().join(",") === "args,command,env_vars,startup_timeout_sec", "Claude local Fullwell MCP config contains unsupported authority");

  const endpoint = codexMcp["fullwell-cloud"];
  assert(JSON.stringify(endpoint) === JSON.stringify(claudeMcp["fullwell-cloud"]), "Host MCP adapters must share one hosted endpoint");
  assert(endpoint?.type === "http", "MCP transport must be HTTP");
  assert(endpoint?.url === install.mcp_url, "Install metadata and MCP config URL differ");
  const endpointUrl = new URL(endpoint.url);
  assert(endpointUrl.protocol === "https:" && endpointUrl.pathname === "/mcp", "MCP URL must be public HTTPS /mcp");
  assert(endpointUrl.origin === "https://fullwell.ai", "MCP URL must use the canonical Fullwell origin");
  assert(Object.keys(endpoint).sort().join(",") === "type,url", "MCP config must contain no credentials or tenant data");
  const installUrl = new URL(install.install_page);
  assert(installUrl.protocol === "https:" && installUrl.pathname === "/install", "Install page must be public HTTPS /install");
  const publicUrls = [
    [codex.homepage, "/install"],
    [codex.interface?.websiteURL, "/install"],
    [codex.interface?.privacyPolicyURL, "/privacy"],
    [codex.interface?.termsOfServiceURL, "/terms"],
    [claude.homepage, "/install"],
  ];
  for (const [value, pathname] of publicUrls) {
    const url = new URL(value);
    assert(url.origin === endpointUrl.origin && url.pathname === pathname, `Packaged ${pathname} URL must use the MCP service origin`);
  }
  assert(installUrl.origin === endpointUrl.origin, "Install metadata and MCP config origins differ");
  assert(install.platforms.codex.setup_prompt === "@Fullwell hi", "Codex setup prompt must use the Fullwell mention");
  const setupUrl = new URL(install.platforms.codex.setup_href);
  assert(setupUrl.protocol === "codex:" && setupUrl.host === "new", "Codex setup link must open a new conversation");
  assert(setupUrl.searchParams.get("prompt") === "[@Fullwell](plugin://fullwell@fullwell) hi", "Codex setup link must prefill the installed plugin mention");
  assert(install.platforms.claude.setup_prompt === "Hi Fullwell." && install.platforms.claude.setup_href === null, "Claude must provide a conversational greeting without a Codex link");

  const hostMarkets = [
    { host: "Codex", market: codexMarket, manifest: codex, install: install.platforms.codex, marketplace: "fullwell" },
    { host: "Claude", market: claudeMarket, manifest: claude, install: install.platforms.claude, marketplace: "fullwell" },
  ];
  for (const { host, market, manifest, install: hostInstall, marketplace } of hostMarkets) {
    assert(market.name === marketplace, `${host} marketplace name differs`);
    assert(hostInstall.marketplace === market.name && hostInstall.plugin === manifest.name, `${host} install selector differs`);
    const plugin = market.plugins?.find((candidate) => candidate.name === manifest.name);
    assert(plugin, `Marketplace ${market.name} is missing the plugin`);
    assert(plugin.source?.source === "npm", `Marketplace ${market.name} must use immutable npm packaging`);
    assert(plugin.source?.package === packageJson.name, `Marketplace ${market.name} package differs`);
    assert(plugin.source?.version === packageJson.version, `Marketplace ${market.name} version differs`);
  }
  const codexMarketPlugin = codexMarket.plugins.find((candidate) => candidate.name === codex.name);
  assert(codexMarketPlugin.policy?.installation === "AVAILABLE", "Codex marketplace installation policy must be AVAILABLE");
  assert(codexMarketPlugin.policy?.authentication === "ON_USE", "Codex marketplace authentication policy must be ON_USE");

  await Promise.all([
    validatePath(codex.interface.logo),
    validatePath(codex.skills),
    validatePath(codex.mcpServers),
    validatePath(claude.mcpServers),
    validatePath("runtime/onboarding-draft.mjs"),
    validatePath("runtime/local-household.mjs"),
    validatePath("runtime/local-household-mcp.mjs"),
  ]);
  const pluginLogo = await readFile(path.join(root, codex.interface.logo));
  assert(
    createHash("sha256").update(pluginLogo).digest("hex") === "696d832540acdd66044a5cfe8273fe60018fa48855e961c6b71e1705cd007189",
    "Codex plugin logo must match the approved Fullwell artwork",
  );
  const skillDirectories = (await readdir(path.join(root, "skills"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert(skillDirectories.join(",") === requiredSkills.join(","), "Skill directory set differs from the required set");

  const combinedSkills = [];
  for (const skill of requiredSkills) {
    const relative = `skills/${skill}/SKILL.md`;
    const content = await readFile(path.join(root, relative), "utf8");
    const fields = parseFrontmatter(content, relative);
    assert(fields.name === skill, `${relative} name must match its directory`);
    assert(fields.description.length >= 40, `${relative} description is too vague`);
    assert(content.split("\n").length < 500, `${relative} exceeds 500 lines`);
    for (const reference of content.matchAll(/\]\(\.\.\/\.\.\/references\/([^)]+)\)/g)) {
      await validatePath(`references/${reference[1]}`);
    }
    combinedSkills.push(content);
  }
  const deliveryAgentMetadata = await readFile(
    path.join(root, "skills/audit-food-delivery-orders/agents/openai.yaml"),
    "utf8",
  );
  assert(
    deliveryAgentMetadata.includes("$audit-food-delivery-orders"),
    "Delivery audit OpenAI metadata must invoke its packaged skill",
  );
  const reorderAgentMetadata = await readFile(
    path.join(root, "skills/reorder-food-delivery/agents/openai.yaml"),
    "utf8",
  );
  assert(
    reorderAgentMetadata.includes("Prepare prior delivery carts without checkout")
      && reorderAgentMetadata.includes("$reorder-food-delivery"),
    "Delivery reorder OpenAI metadata must describe and invoke its packaged skill",
  );

  const contract = await readFile(path.join(root, "references/mcp-tool-contract.md"), "utf8");
  for (const tool of requiredTools) {
    assert(contract.includes(`\`${tool}\``), `MCP reference omits ${tool}`);
    assert(combinedSkills.some((skill) => skill.includes(`\`${tool}\``)), `No skill uses ${tool}`);
  }
  for (const tool of requiredLocalTools) {
    assert(contract.includes(`\`${tool}\``), `MCP reference omits ${tool}`);
    assert(combinedSkills.some((skill) => skill.includes(`\`${tool}\``)), `No skill uses ${tool}`);
  }

  assert(evals.hosts?.sort().join(",") === "claude,codex", "Evals must target Codex and Claude");
  const ids = new Set(evals.cases?.map((testCase) => testCase.id));
  for (const id of requiredEvalIds) assert(ids.has(id), `Missing required eval ${id}`);
  for (const testCase of evals.cases) {
    assert(testCase.invariants?.length > 0, `Eval ${testCase.id} has no invariants`);
    for (const skill of testCase.skills) assert(requiredSkills.includes(skill), `Eval ${testCase.id} uses unknown skill`);
    for (const tool of testCase.required_tools) {
      assert([...requiredTools, ...requiredLocalTools].includes(tool), `Eval ${testCase.id} uses unknown tool`);
    }
  }

  const packagedFiles = await walk(root);
  const ignoredSegments = [`${path.sep}tests${path.sep}`, `${path.sep}scripts${path.sep}`, `${path.sep}evals${path.sep}`];
  const forbiddenSecret = /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:password|client_secret|access_token|refresh_token|authorization)\s*[=:]\s*["'][^"']+["']|\bsk-[A-Za-z0-9_-]{20,})/i;
  for (const file of packagedFiles.filter((candidate) => !ignoredSegments.some((segment) => candidate.includes(segment)))) {
    const content = await readFile(file, "utf8");
    assert(!forbiddenSecret.test(content), `Packaged file contains secret-shaped data: ${path.relative(root, file)}`);
    assert(!content.includes("/Users/") && !content.includes("C:\\Users\\"), `Packaged file contains a local path: ${path.relative(root, file)}`);
  }

  return {
    endpoint: endpoint.url,
    evalCount: evals.cases.length,
    skillCount: requiredSkills.length,
    toolCount: requiredTools.length + requiredLocalTools.length
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validatePackage();
  process.stdout.write(`Validated ${result.skillCount} skills, ${result.toolCount} tools, and ${result.evalCount} eval cases.\n`);
}
