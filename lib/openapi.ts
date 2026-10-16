import type { Document } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";

export const OPENAPI_URL =
  process.env.OPENAPI_URL ?? "https://dynalinks.app/api/v1/openapi.json";

type SpecTag = { name: string; description?: string };

// CI builds from a URL; the local dev loop points OPENAPI_URL at a JSON file.
async function readSpec(): Promise<{ paths?: Record<string, unknown>; tags?: SpecTag[] }> {
  if (/^https?:\/\//.test(OPENAPI_URL)) {
    const response = await fetch(OPENAPI_URL);
    if (!response.ok) {
      throw new Error(`[OpenAPI] ${OPENAPI_URL} returned ${response.status}`);
    }

    return response.json();
  }

  const { readFile } = await import("node:fs/promises");

  return JSON.parse(await readFile(OPENAPI_URL, "utf8"));
}

// A tag's description is its group's note: who can call those endpoints. It is
// written once, in the spec, and copied onto every operation in the group
// because the renderer that draws the note only ever sees one operation.
async function loadSpecWithGroupNotes(): Promise<Document> {
  const spec = await readSpec();
  if (!spec.paths || Object.keys(spec.paths).length === 0) {
    throw new Error(`[OpenAPI] ${OPENAPI_URL} has no paths`);
  }

  const notes = new Map<string, string>();
  for (const tag of spec.tags ?? []) {
    if (tag.description) notes.set(tag.name, tag.description);
  }

  for (const pathItem of Object.values(spec.paths)) {
    for (const operation of Object.values(pathItem ?? {})) {
      if (typeof operation !== "object" || operation === null) continue;

      const op = operation as { tags?: string[]; [key: string]: unknown };
      const note = op.tags?.[0] ? notes.get(op.tags[0]) : undefined;
      if (note) op["x-group-note"] = note;
    }
  }

  return spec as Document;
}

export const openapi = createOpenAPI({
  input: {
    dynalinks: loadSpecWithGroupNotes,
  },
});

export function slugifyTag(tag: string) {
  return tag.toLowerCase().replace(/\s+/g, "-");
}

export function kebab(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}
