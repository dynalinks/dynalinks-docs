import { llms, loader } from "fumadocs-core/source";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/macro";
import { kebab, openapi, slugifyTag } from "./openapi";
import { docsRoute } from "./shared";

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader(
  {
    docs: docs.toFumadocsSource(),
    openapi: await openapi.staticSource({
      baseDir: "reference",
      per: "operation",
      groupBy(entry) {
        if (entry.type !== "operation") return "other";
        return slugifyTag(
          (entry.item as { tags?: string[] }).tags?.[0] ?? "other",
        );
      },
      name(entry) {
        if (entry.type !== "operation") return kebab(entry.info.title);
        const { operationId } =
          this.fromExtractedOperation(entry.item)?.operation ?? {};
        return kebab(operationId ?? entry.info.title);
      },
      meta: false,
    }),
  },
  {
    baseUrl: docsRoute,
    plugins: [openapi.loaderPlugin()],
  },
);

export const docsLlms = llms(source, {
  renderPage: async (page) => {
    if (page.type === "openapi") {
      return `# ${page.data.title} (${page.url})\n\n${page.data.description ?? ""}`;
    }
    return `# ${page.data.title} (${page.url})

${await page.data.getText("processed")}`;
  },
});
