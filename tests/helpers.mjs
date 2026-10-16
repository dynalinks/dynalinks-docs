import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const OUT = join(ROOT, "out");
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function readOut(relPath) {
  return readFileSync(join(OUT, relPath), "utf8");
}

// Resolves a URL path the way GitHub Pages does: `/a/b` serves `a/b`,
// `a/b.html` or `a/b/index.html`. Returns the path relative to out/, or null.
export function outFileFor(urlPath) {
  let path = decodeURI(urlPath.split("#")[0].split("?")[0]);
  if (BASE_PATH && (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`))) {
    path = path.slice(BASE_PATH.length);
  }
  path = path.replace(/^\/+/, "");
  const candidates =
    path === ""
      ? ["index.html"]
      : [path, `${path}.html`, join(path, "index.html")];

  for (const candidate of candidates) {
    const full = join(OUT, candidate);
    if (existsSync(full) && statSync(full).isFile()) return candidate;
  }
  return null;
}

export function walk(dir, predicate = () => true) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, predicate);
    return predicate(full) ? [full] : [];
  });
}

export function outHtmlFiles() {
  return walk(OUT, (file) => file.endsWith(".html")).map((file) =>
    relative(OUT, file),
  );
}
