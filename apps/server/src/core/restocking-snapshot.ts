export function isRestockingSnapshotPath(path: string): boolean {
  return path === "FORMAT_VERSION" ||
    path === "profiles/snacks.md" ||
    path === "snacks/reports/recurring-snacks.md" ||
    /^snacks\/items\/(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+\.md$/.test(path) ||
    /^snacks\/evidence\/(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+\.json$/.test(path);
}
