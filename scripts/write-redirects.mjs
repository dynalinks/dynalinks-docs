// Writes a meta-refresh page for every old Jekyll URL whose path changed.
// GitHub Pages can't send server redirects, so these stand in for them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_URL = "https://docs.dynalinks.app";

function redirectPage(target, basePath) {
  const url = `${basePath}${target}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved</title>
<meta http-equiv="refresh" content="0; url=${url}">
<link rel="canonical" href="${SITE_URL}${target}">
<meta name="robots" content="noindex">
</head>
<body>
<p>This page has moved to <a href="${url}">${SITE_URL}${target}</a>.</p>
</body>
</html>
`;
}

export function writeRedirects({ outDir, redirects, basePath }) {
  const written = [];
  for (const [oldPath, target] of Object.entries(redirects)) {
    const file = join(outDir, oldPath);
    if (oldPath === target || existsSync(file)) continue;

    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, redirectPage(target, basePath));
    written.push(oldPath);
  }
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const written = writeRedirects({
    outDir: join(root, "out"),
    redirects: JSON.parse(readFileSync(join(root, "redirects.json"), "utf8")),
    basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  });
  console.log(`Wrote ${written.length} redirect pages`);
}
