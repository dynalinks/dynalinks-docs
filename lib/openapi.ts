import { createOpenAPI } from "fumadocs-openapi/server";

export const OPENAPI_URL =
  process.env.OPENAPI_URL ?? "https://dynalinks.app/api/v1/openapi.json";

export const openapi = createOpenAPI({
  input: {
    dynalinks: () => OPENAPI_URL,
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
