import type { CodeUsageGenerator } from "fumadocs-openapi/requests/generators";

type RequestData = Parameters<CodeUsageGenerator["generate"]>[0];

function quote(value: string) {
  return JSON.stringify(value);
}

function rubyLiteral(value: unknown, indent = ""): string {
  if (value === null || value === undefined) return "nil";
  if (typeof value === "string") return quote(value);
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value))
    return `[${value.map((item) => rubyLiteral(item, indent)).join(", ")}]`;
  if (typeof value === "object") {
    const inner = `${indent}  `;
    const entries = Object.entries(value).map(
      ([key, item]) => `${inner}${quote(key)} => ${rubyLiteral(item, inner)}`,
    );
    return entries.length === 0
      ? "{}"
      : `{\n${entries.join(",\n")}\n${indent}}`;
  }
  return quote(String(value));
}

export const ruby: CodeUsageGenerator = {
  label: "Ruby",
  lang: "ruby",
  generate(data: RequestData) {
    const method =
      data.method.charAt(0).toUpperCase() + data.method.slice(1).toLowerCase();
    const lines = [
      'require "net/http"',
      'require "json"',
      "",
      `uri = URI(${quote(data.url)})`,
      `request = Net::HTTP::${method}.new(uri)`,
    ];

    for (const [name, header] of Object.entries(data.header ?? {})) {
      lines.push(`request[${quote(name)}] = ${quote(String(header.value))}`);
    }

    if (data.body !== undefined && data.bodyMediaType === "application/json") {
      lines.push(`request["Content-Type"] = "application/json"`);
      lines.push(`request.body = JSON.dump(${rubyLiteral(data.body)})`);
    }

    lines.push(
      "",
      "response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|",
      "  http.request(request)",
      "end",
      "",
      "puts response.body",
    );
    return lines.join("\n");
  },
};
