import { constants } from "node:fs";
import {
  lstat,
  open,
  readdir,
  realpath,
  rm,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  LocalHouseholdError,
  acquireLocalLock,
  ensurePrivateDirectory,
  hasForbiddenAscii,
  releaseLocalLock,
  writePrivateFile,
} from "./local-household.mjs";

const MAX_CARDS = 48;
const MAX_HTML_BYTES = 1_048_576;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_RETAINED_BOARDS = 20;
const BOARD_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const BOARD_ID_PATTERN = /^lrb_[0-9a-f]{32}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

const BOARD_STYLE = `
:root{color:#1e2420;background:#fbfaf6;font-family:"Avenir Next",Avenir,"Gill Sans","Trebuchet MS",sans-serif;--paper:#fbfaf6;--surface:#fff;--ink:#1e2420;--muted:#626a63;--rule:#d8ddd6;--leaf:#236245;--tomato:#c9422f;--saffron:#e0a629;--sky:#d9ecf0;--serif:"Iowan Old Style","Palatino Linotype","Book Antiqua",serif}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at top right,#d9ecf0 0,transparent 36rem),var(--paper);color:var(--ink);line-height:1.5}a{color:inherit;text-underline-offset:3px}:focus-visible{outline:3px solid #87c9d7;outline-offset:3px}.board{width:min(1180px,calc(100% - 40px));margin:0 auto;padding:64px 0 80px}.eyebrow{margin:0 0 10px;color:var(--leaf);font-size:.78rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1,h2{font-family:var(--serif);font-weight:600}h1{max-width:16ch;margin:0;font-size:clamp(2.4rem,7vw,4.8rem);line-height:.98}.intro{max-width:44rem;margin:20px 0 44px;color:var(--muted);font-size:1.05rem}.context{display:inline-block;margin-top:16px;padding:5px 9px;border:1px solid var(--rule);background:var(--surface);font-size:.82rem;font-weight:800}.recipe-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin:0;padding:0;list-style:none}.card{display:flex;min-width:0;flex-direction:column;overflow:hidden;border:1px solid var(--rule);border-radius:6px;background:var(--surface)}.media{position:relative;min-height:210px;overflow:hidden;background:repeating-linear-gradient(135deg,#eef0eb,#eef0eb 12px,#e6e9e3 12px,#e6e9e3 24px)}.media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.image-fallback{position:absolute;inset:0;display:grid;place-items:center;padding:24px;color:var(--muted);text-align:center}.card-body{display:flex;flex:1;flex-direction:column;padding:20px}.source{margin:0 0 8px;color:var(--leaf);font-size:.78rem;font-weight:800;text-transform:uppercase}.card h2{margin:0 0 10px;font-size:1.55rem;line-height:1.08}.reason{margin:0 0 18px;color:var(--muted)}.badges{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 16px;padding:0;list-style:none}.badge{padding:3px 7px;border:1px solid var(--rule);border-radius:999px;background:#f1f3ef;font-size:.75rem;font-weight:800}.slot{margin:auto 0 12px;padding-top:12px;border-top:1px solid var(--rule);font-weight:800}.compatibility{display:grid;grid-template-columns:1.4rem 1fr;gap:8px;margin:0;padding:12px;background:#fffaf0;font-size:.86rem}.compatibility--appears_compatible{background:#f4faf6}.compatibility--needs_recheck{background:#fff7f5}.compatibility-mark{display:grid;width:1.35rem;height:1.35rem;place-items:center;border-radius:50%;background:var(--saffron);font-weight:900}.compatibility--appears_compatible .compatibility-mark{background:var(--leaf);color:#fff}.compatibility--needs_recheck .compatibility-mark{background:var(--tomato);color:#fff}.links{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px;font-size:.85rem;font-weight:800}.privacy{margin:48px 0 0;padding:18px;border-left:4px solid var(--leaf);background:var(--sky);font-size:.9rem}.privacy p{margin:0}
@media(max-width:860px){.recipe-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.board{width:calc(100% - 28px);padding-top:42px}.recipe-grid{grid-template-columns:1fr}.media{min-height:190px}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important}}@media print{.board{width:100%;padding:20px}.recipe-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;

function fail(code, message) {
  throw new LocalHouseholdError(code, message);
}

function assertExactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail("VALIDATION_FAILED", `${label} contains an unsupported field: ${key}`);
  }
}

function assertObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("VALIDATION_FAILED", `${label} must be an object`);
  return value;
}

function assertText(value, label, maximum, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== "string"
    || value.length < 1
    || value.length > maximum
    || !value.isWellFormed()
    || value.trim() !== value
    || hasForbiddenAscii(value)) {
    fail("VALIDATION_FAILED", `${label} must be trimmed text of at most ${maximum} characters`);
  }
  return value;
}

function assertHttpsUrl(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || value.length > 2_048 || hasForbiddenAscii(value, true)) {
    fail("VALIDATION_FAILED", `${label} must be a bounded HTTPS URL`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("VALIDATION_FAILED", `${label} must be a valid HTTPS URL`);
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
    fail("VALIDATION_FAILED", `${label} must be a credential-free HTTPS URL`);
  }
  return url.toString();
}

function parseCard(input, index) {
  const value = assertObject(input, `cards[${index}]`);
  assertExactKeys(value, new Set([
    "id",
    "title",
    "image_url",
    "image_page_url",
    "recipe_url",
    "source_label",
    "why_recommended",
    "journal_statuses",
    "proposed_slot",
    "compatibility",
    "compatibility_caveat",
  ]), `cards[${index}]`);
  if (!Array.isArray(value.journal_statuses) || value.journal_statuses.length > 3) {
    fail("VALIDATION_FAILED", `cards[${index}].journal_statuses is invalid`);
  }
  const journalStatuses = value.journal_statuses.map((status) => {
    if (!["Saved", "Cooked", "Liked"].includes(status)) fail("VALIDATION_FAILED", `cards[${index}] contains an unsupported journal status`);
    return status;
  });
  if (new Set(journalStatuses).size !== journalStatuses.length) fail("VALIDATION_FAILED", `cards[${index}] journal statuses must be unique`);
  if (!["appears_compatible", "incomplete_evidence", "needs_recheck"].includes(value.compatibility)) {
    fail("VALIDATION_FAILED", `cards[${index}].compatibility is unsupported`);
  }
  const imageUrl = assertHttpsUrl(value.image_url, `cards[${index}].image_url`, { nullable: true });
  const imagePageUrl = assertHttpsUrl(value.image_page_url, `cards[${index}].image_page_url`, { nullable: true });
  if ((imageUrl === null) !== (imagePageUrl === null)) {
    fail("VALIDATION_FAILED", `cards[${index}] requires image_page_url exactly when image_url is present`);
  }
  return {
    id: assertText(value.id, `cards[${index}].id`, 120),
    title: assertText(value.title, `cards[${index}].title`, 300),
    image_url: imageUrl,
    image_page_url: imagePageUrl,
    recipe_url: assertHttpsUrl(value.recipe_url, `cards[${index}].recipe_url`, { nullable: true }),
    source_label: assertText(value.source_label, `cards[${index}].source_label`, 200),
    why_recommended: assertText(value.why_recommended, `cards[${index}].why_recommended`, 1_000),
    journal_statuses: journalStatuses,
    proposed_slot: assertText(value.proposed_slot, `cards[${index}].proposed_slot`, 120, { nullable: true }),
    compatibility: value.compatibility,
    compatibility_caveat: assertText(value.compatibility_caveat, `cards[${index}].compatibility_caveat`, 1_000),
  };
}

function parseInput(input) {
  const value = assertObject(input, "recipe board input");
  assertExactKeys(value, new Set(["idempotency_key", "title", "context_label", "cards"]), "recipe board input");
  if (typeof value.idempotency_key !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(value.idempotency_key)) {
    fail("VALIDATION_FAILED", "idempotency_key is invalid");
  }
  if (!Array.isArray(value.cards) || value.cards.length < 1 || value.cards.length > MAX_CARDS) {
    fail("VALIDATION_FAILED", `cards must contain between 1 and ${MAX_CARDS} recipes`);
  }
  const cards = value.cards.map(parseCard);
  if (new Set(cards.map(({ id }) => id)).size !== cards.length) fail("VALIDATION_FAILED", "recipe board card IDs must be unique");
  return {
    idempotency_key: value.idempotency_key,
    title: assertText(value.title, "title", 300),
    context_label: assertText(value.context_label, "context_label", 200, { nullable: true }),
    cards,
  };
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function compatibilityLabel(value) {
  if (value === "appears_compatible") return "Appears compatible";
  if (value === "needs_recheck") return "Needs recheck";
  return "Incomplete ingredient evidence";
}

function renderCard(card) {
  const image = card.image_url === null
    ? `<div class="media"><div class="image-fallback" role="img" aria-label="No image available for ${escapeHtml(card.title)}">No image available</div></div>`
    : `<div class="media"><div class="image-fallback" aria-hidden="true">Image unavailable</div><img src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.title)}" width="640" height="420" loading="lazy" crossorigin="anonymous" referrerpolicy="no-referrer"></div>`;
  const statuses = card.journal_statuses.length === 0
    ? ""
    : `<ul class="badges" aria-label="Journal status">${card.journal_statuses.map((status) => `<li class="badge">${status}</li>`).join("")}</ul>`;
  const slot = card.proposed_slot === null ? "" : `<p class="slot">${escapeHtml(card.proposed_slot)}</p>`;
  const links = [
    card.recipe_url === null ? "" : `<a href="${escapeHtml(card.recipe_url)}" target="_blank" rel="noopener noreferrer">Open recipe</a>`,
    card.image_page_url === null ? "" : `<a href="${escapeHtml(card.image_page_url)}" target="_blank" rel="noopener noreferrer">Image source</a>`,
  ].filter(Boolean).join("");
  const compatibilityMark = card.compatibility === "appears_compatible" ? "+" : "!";
  return `<li><article class="card">${image}<div class="card-body"><p class="source">${escapeHtml(card.source_label)}</p><h2>${escapeHtml(card.title)}</h2><p class="reason">${escapeHtml(card.why_recommended)}</p>${statuses}${slot}<p class="compatibility compatibility--${card.compatibility}"><span class="compatibility-mark" aria-hidden="true">${compatibilityMark}</span><span><strong>${compatibilityLabel(card.compatibility)}.</strong> ${escapeHtml(card.compatibility_caveat)}</span></p>${links === "" ? "" : `<nav class="links" aria-label="Sources for ${escapeHtml(card.title)}">${links}</nav>`}</div></article></li>`;
}

function renderBoard(input) {
  const context = input.context_label === null ? "" : `<p class="context">${escapeHtml(input.context_label)}</p>`;
  const csp = "default-src 'none'; style-src 'unsafe-inline'; img-src https:; connect-src 'none'; object-src 'none'; frame-src 'none'; media-src 'none'; form-action 'none'; base-uri 'none'";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<title>${escapeHtml(input.title)} - Fullwell</title>
<style>${BOARD_STYLE}</style>
</head>
<body>
<main class="board">
<header><p class="eyebrow">Private Fullwell recipe board</p><h1>${escapeHtml(input.title)}</h1>${context}<p class="intro">These are the same recommendations from our conversation, arranged visually. This local snapshot does not edit your journal.</p></header>
<ol class="recipe-grid">${input.cards.map(renderCard).join("")}</ol>
<aside class="privacy"><p><strong>Private local snapshot.</strong> No Fullwell login is required. Images use anonymous requests but load directly from source sites, which can still receive ordinary network metadata. Recipe links open separately and may use your existing site state.</p></aside>
</main>
</body>
</html>
`;
}

export function localRecipeBoardsPath(root) {
  return path.join(path.resolve(root), "fullwell", "local", "views", "recipe-boards");
}

function boardPath(root, boardId) {
  return path.join(localRecipeBoardsPath(root), boardId);
}

async function readBoundedJson(filePath, maximumBytes) {
  let handle;
  try {
    const fileStat = await lstat(filePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink() || fileStat.size > maximumBytes) return null;
    handle = await open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    return JSON.parse(await handle.readFile("utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  } finally {
    await handle?.close();
  }
}

function parseManifest(value, boardId) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const expected = ["board_id", "card_count", "created_at", "fingerprint", "html_sha256", "idempotency_key", "remote_image_count", "schema_version"];
  if (Object.keys(value).sort().join(",") !== expected.join(",")) return null;
  if (value.schema_version !== 1 || value.board_id !== boardId || !BOARD_ID_PATTERN.test(value.board_id)) return null;
  if (typeof value.idempotency_key !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(value.idempotency_key)) return null;
  if (typeof value.fingerprint !== "string" || !/^[0-9a-f]{64}$/.test(value.fingerprint)) return null;
  if (typeof value.html_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.html_sha256)) return null;
  if (typeof value.created_at !== "string" || !Number.isFinite(Date.parse(value.created_at))) return null;
  if (!Number.isSafeInteger(value.card_count) || value.card_count < 1 || value.card_count > MAX_CARDS) return null;
  if (!Number.isSafeInteger(value.remote_image_count) || value.remote_image_count < 0 || value.remote_image_count > value.card_count) return null;
  return value;
}

async function assertDurableBoardFile(filePath, expectedDigest) {
  const fileStat = await lstat(filePath);
  if (!fileStat.isFile() || fileStat.isSymbolicLink() || fileStat.size > MAX_HTML_BYTES) {
    fail("CORRUPT_LOCAL_RECIPE_BOARD", "recipe board HTML is not a bounded regular file");
  }
  const handle = await open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const content = await handle.readFile();
    const digest = createHash("sha256").update(content).digest("hex");
    if (digest !== expectedDigest) fail("CORRUPT_LOCAL_RECIPE_BOARD", "recipe board HTML failed its integrity check");
  } finally {
    await handle.close();
  }
}

function resultFromManifest(root, manifest, status) {
  const filePath = path.join(boardPath(root, manifest.board_id), "index.html");
  return {
    status,
    board_id: manifest.board_id,
    file_path: filePath,
    file_url: pathToFileURL(filePath).href,
    card_count: manifest.card_count,
    remote_image_count: manifest.remote_image_count,
    created_at: manifest.created_at,
  };
}

async function cleanupBoards(root, currentBoardId, now) {
  const boardsRoot = localRecipeBoardsPath(root);
  const rootRealPath = await realpath(boardsRoot);
  const candidates = [];
  const invalid = [];
  for (const entry of await readdir(boardsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !BOARD_ID_PATTERN.test(entry.name) || entry.name === currentBoardId) continue;
    const directory = path.join(boardsRoot, entry.name);
    const directoryStat = await lstat(directory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) continue;
    const manifest = parseManifest(await readBoundedJson(path.join(directory, "manifest.json"), MAX_MANIFEST_BYTES), entry.name);
    if (manifest === null) {
      invalid.push({ directory });
      continue;
    }
    try {
      await assertDurableBoardFile(path.join(directory, "index.html"), manifest.html_sha256);
      candidates.push({ directory, manifest });
    } catch (error) {
      if (error?.code !== "ENOENT"
        && !(error instanceof LocalHouseholdError && error.code === "CORRUPT_LOCAL_RECIPE_BOARD")) {
        throw error;
      }
      invalid.push({ directory });
    }
  }
  candidates.sort((left, right) => Date.parse(right.manifest.created_at) - Date.parse(left.manifest.created_at));
  const removable = [
    ...invalid,
    ...candidates.filter(({ manifest }, index) =>
      index >= MAX_RETAINED_BOARDS - 1 || now.getTime() - Date.parse(manifest.created_at) > BOARD_RETENTION_MS),
  ];
  for (const { directory } of removable) {
    const parent = path.dirname(await realpath(directory));
    if (parent !== rootRealPath) fail("UNSAFE_LOCAL_PATH", "generated recipe board escaped its private directory");
    await rm(directory, { recursive: true, force: false });
  }
}

/**
 * Creates one deterministic, private, static recipe-board snapshot.
 *
 * The renderer has no network or browser authority. A manifest written after
 * the HTML is the durable commit marker for exact retry and changed-key
 * conflict detection.
 */
export async function createLocalRecipeBoard(root, input, now = new Date()) {
  const request = parseInput(input);
  const fingerprint = createHash("sha256").update(JSON.stringify(request)).digest("hex");
  const boardId = `lrb_${createHash("sha256").update(`recipe-board:${request.idempotency_key}`).digest("hex").slice(0, 32)}`;
  const boardsRoot = localRecipeBoardsPath(root);
  await ensurePrivateDirectory(root, boardsRoot);
  const lock = await acquireLocalLock(boardsRoot, now, {
    lockName: ".recipe-boards.lock",
    waitForLiveWriter: true,
  });
  try {
    const directory = boardPath(root, boardId);
    await ensurePrivateDirectory(root, directory);
    const manifestPath = path.join(directory, "manifest.json");
    const existing = parseManifest(await readBoundedJson(manifestPath, MAX_MANIFEST_BYTES), boardId);
    if (existing !== null) {
      if (existing.fingerprint !== fingerprint) fail("IDEMPOTENCY_CONFLICT", "idempotency_key was already used for different recipe-board input");
      await assertDurableBoardFile(path.join(directory, "index.html"), existing.html_sha256);
      await cleanupBoards(root, boardId, now);
      return resultFromManifest(root, existing, "replayed");
    }
    try {
      await lstat(manifestPath);
      fail("CORRUPT_LOCAL_RECIPE_BOARD", "recipe board manifest is invalid");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }

    const html = renderBoard(request);
    const manifest = {
      schema_version: 1,
      board_id: boardId,
      idempotency_key: request.idempotency_key,
      fingerprint,
      html_sha256: createHash("sha256").update(html).digest("hex"),
      card_count: request.cards.length,
      remote_image_count: request.cards.filter(({ image_url: imageUrl }) => imageUrl !== null).length,
      created_at: now.toISOString(),
    };
    await writePrivateFile(root, path.join(directory, "index.html"), html, MAX_HTML_BYTES, "recipe board HTML");
    await writePrivateFile(root, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, MAX_MANIFEST_BYTES, "recipe board manifest");
    await cleanupBoards(root, boardId, now);
    return resultFromManifest(root, manifest, "created");
  } finally {
    await releaseLocalLock(lock);
  }
}
