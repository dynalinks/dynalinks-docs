import { createCodeUsageGeneratorRegistry } from "fumadocs-openapi/requests/generators";
import { curl } from "fumadocs-openapi/requests/generators/curl";
import { javascript } from "fumadocs-openapi/requests/generators/javascript";
import { python } from "fumadocs-openapi/requests/generators/python";
import { ruby } from "./ruby-generator.ts";

export const codeUsages = createCodeUsageGeneratorRegistry();
codeUsages.add("curl", curl);
codeUsages.add("js", javascript);
codeUsages.add("python", python);
codeUsages.add("ruby", ruby);
