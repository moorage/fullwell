import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(root, "../..");

export const requiredSkills = [
  "audit-grocery-purchases",
  "import-food-collection",
  "manage-household-food-journal",
  "restock-groceries",
  "share-food-collection",
  "track-recipe-history"
];

export const requiredTools = [
  "hfj_accept_family_invite",
  "hfj_append_evidence",
  "hfj_commit_change_set",
  "hfj_create_collection",
  "hfj_create_collection_share",
  "hfj_create_family_invite",
  "hfj_create_household",
  "hfj_export_household",
  "hfj_get_context",
  "hfj_get_item",
  "hfj_get_profile",
  "hfj_import_collection_items",
  "hfj_list_members",
  "hfj_plan_collection_import",
  "hfj_preview_shared_collection",
  "hfj_remove_member",
  "hfj_revoke_collection_share",
  "hfj_revoke_family_invite",
  "hfj_search_items",
  "hfj_select_household",
  "hfj_update_onboarding",
  "hfj_update_member",
  "hfj_update_profile"
];

const requiredEvalIds = [
  "first-time-setup-oauth",
  "first-time-setup-starts-snacks",
  "snack-decline-advances-to-recipes",
  "recipe-no-sources-finishes-guided-run",
  "explicit-setup-stop-does-not-advance",
  "skipped-onboarding-resumes",
  "invite-explicit-acceptance",
  "golden-vs-classic",
  "same-golden-sizes",
  "cereals-distinct",
  "cashew-brands-distinct",
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
  "restock-no-checkout"
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
  const [packageJson, codex, claude, mcp, codexMarket, claudeMarket, install, evals] =
    await Promise.all([
      readJson("package.json"),
      readJson(".codex-plugin/plugin.json"),
      readJson(".claude-plugin/plugin.json"),
      readJson(".mcp.json"),
      readWorkspaceJson(".agents/plugins/marketplace.json"),
      readWorkspaceJson(".claude-plugin/marketplace.json"),
      readJson("install-metadata.json"),
      readJson("evals/cases/v1.json")
    ]);

  assert(codex.name === claude.name, "Host manifests must share a plugin name");
  assert(codex.version === claude.version, "Host manifests must share a version");
  assert(codex.version === packageJson.version, "Package and host versions must match");
  assert(codex.interface?.displayName === "Fullwell", "Codex must expose the Fullwell mention name");
  assert(codex.interface?.defaultPrompt?.[0] === "Set up Fullwell.", "Codex must expose the conversational setup starter");
  assert(codex.interface.defaultPrompt.every((prompt) => !prompt.includes("@")), "Codex starter prompts must not contain mention syntax");
  assert(codex.skills === "./skills/" && claude.skills === "./skills/", "Hosts must use shared skills");
  assert(codex.mcpServers === "./.mcp.json" && claude.mcpServers === "./.mcp.json", "Hosts must use shared MCP config");
  assert(Object.keys(mcp).length === 1, "MCP config must declare exactly one service");

  const endpoint = mcp["household-food-journal"];
  assert(endpoint?.type === "http", "MCP transport must be HTTP");
  assert(endpoint?.url === install.mcp_url, "Install metadata and MCP config URL differ");
  const endpointUrl = new URL(endpoint.url);
  assert(endpointUrl.protocol === "https:" && endpointUrl.pathname === "/mcp", "MCP URL must be public HTTPS /mcp");
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
  assert(setupUrl.searchParams.get("prompt") === "[@Fullwell](plugin://household-food-journal@fullwell-plugins) hi", "Codex setup link must prefill the installed plugin mention");
  assert(install.platforms.claude.setup_prompt === "Set up Fullwell." && install.platforms.claude.setup_href === null, "Claude must provide a natural-language setup prompt without a Codex link");

  for (const market of [codexMarket, claudeMarket]) {
    const plugin = market.plugins?.find((candidate) => candidate.name === codex.name);
    assert(plugin, `Marketplace ${market.name} is missing the plugin`);
    assert(plugin.source?.source === "npm", `Marketplace ${market.name} must use immutable npm packaging`);
    assert(plugin.source?.package === packageJson.name, `Marketplace ${market.name} package differs`);
    assert(plugin.source?.version === packageJson.version, `Marketplace ${market.name} version differs`);
  }
  const codexMarketPlugin = codexMarket.plugins.find((candidate) => candidate.name === codex.name);
  assert(codexMarketPlugin.policy?.installation === "AVAILABLE", "Codex marketplace installation policy must be AVAILABLE");
  assert(codexMarketPlugin.policy?.authentication === "ON_USE", "Codex marketplace authentication policy must be ON_USE");

  await Promise.all([validatePath(codex.skills), validatePath(codex.mcpServers)]);
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

  const contract = await readFile(path.join(root, "references/mcp-tool-contract.md"), "utf8");
  for (const tool of requiredTools) {
    assert(contract.includes(`\`${tool}\``), `MCP reference omits ${tool}`);
    assert(combinedSkills.some((skill) => skill.includes(`\`${tool}\``)), `No skill uses ${tool}`);
  }

  assert(evals.hosts?.sort().join(",") === "claude,codex", "Evals must target Codex and Claude");
  const ids = new Set(evals.cases?.map((testCase) => testCase.id));
  for (const id of requiredEvalIds) assert(ids.has(id), `Missing required eval ${id}`);
  for (const testCase of evals.cases) {
    assert(testCase.invariants?.length > 0, `Eval ${testCase.id} has no invariants`);
    for (const skill of testCase.skills) assert(requiredSkills.includes(skill), `Eval ${testCase.id} uses unknown skill`);
    for (const tool of testCase.required_tools) assert(requiredTools.includes(tool), `Eval ${testCase.id} uses unknown tool`);
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
    toolCount: requiredTools.length
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validatePackage();
  process.stdout.write(`Validated ${result.skillCount} skills, ${result.toolCount} tools, and ${result.evalCount} eval cases.\n`);
}
