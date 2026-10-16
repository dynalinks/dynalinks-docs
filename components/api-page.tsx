"use client";
import { createOpenAPIPage } from "fumadocs-openapi/ui";
import { Callout } from "fumadocs-ui/components/callout";
import { codeUsages } from "@/lib/code-usages";

export const OpenAPIPage = createOpenAPIPage({
  codeUsages,
  content: {
    // Same layout as the library's default, with the group's note added above
    // the operation description. The note comes from the spec's tag
    // description, copied onto each operation in lib/openapi.ts.
    renderOperationLayout(slots, { operation }) {
      const note = (operation as { "x-group-note"?: string })["x-group-note"];
      return (
        <div className="flex flex-col gap-x-6 gap-y-4 @4xl:flex-row @4xl:items-start">
          <div className="min-w-0 flex-1">
            {slots.header}
            {slots.apiPlayground}
            {note ? <Callout type="info">{note}</Callout> : null}
            {slots.description}
            {slots.authSchemes}
            {slots.parameters}
            {slots.body}
            {slots.responses}
            {slots.callbacks}
          </div>
          <div className="@4xl:sticky @4xl:top-[calc(var(--fd-docs-row-3,0px)+1rem)] @4xl:flex @4xl:max-h-[calc(var(--fd-docs-height,100dvh)-var(--fd-docs-row-3,0px)-2rem)] @4xl:w-[400px] @4xl:flex-col">
            {slots.apiExample}
          </div>
        </div>
      );
    },
  },
});
