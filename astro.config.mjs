import { readFileSync } from "node:fs";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import rehypeMermaid from "rehype-mermaid";

const readJson = (relativePath) =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));

function rehypeTableWrapper() {
  return (tree) => {
    const walk = (node) => {
      if (!Array.isArray(node.children)) return;
      node.children = node.children.map((child) => {
        walk(child);
        if (child.type === "element" && child.tagName === "table") {
          return {
            type: "element",
            tagName: "div",
            properties: { className: ["table-wrap"] },
            children: [child],
          };
        }
        return child;
      });
    };
    walk(tree);
  };
}

const taxonomy = readJson("./src/data/taxonomy.json");
const published = new Set(readJson("./src/data/published.json").urls);

const redirects = Object.fromEntries(
  Object.entries(taxonomy.concepts).flatMap(([slug, concept]) =>
    concept.redirectFrom.map((from) => [
      `/concepts/${from}`,
      `/concepts/${slug}`,
    ]),
  ),
);

export default defineConfig({
  site: "https://ohaio.dev",
  redirects,
  markdown: {
    syntaxHighlight: { type: "shiki", excludeLangs: ["mermaid"] },
    rehypePlugins: [
      rehypeTableWrapper,
      [
        rehypeMermaid,
        {
          strategy: "inline-svg",
          mermaidConfig: {
            theme: "base",
            htmlLabels: false,
            themeVariables: {
              fontFamily: "Inter Variable, ui-sans-serif, sans-serif",
              fontSize: "14px",
              primaryColor: "#eef0f4",
              primaryTextColor: "#20212a",
              primaryBorderColor: "#d3d7de",
              lineColor: "#7a7f8c",
              secondaryColor: "#e9edf8",
              tertiaryColor: "#e8efe9",
              noteBkgColor: "#e9edf8",
              noteTextColor: "#20212a",
              noteBorderColor: "#c9d0df",
              actorBkg: "#f1f3f6",
              actorBorder: "#d3d7de",
              actorTextColor: "#20212a",
              signalColor: "#4f5563",
              signalTextColor: "#20212a",
              labelBoxBkgColor: "#f1f3f6",
              labelBoxBorderColor: "#d3d7de",
              labelTextColor: "#20212a",
              activationBkgColor: "#e9edf8",
              activationBorderColor: "#b9c1d4",
            },
            flowchart: {
              curve: "basis",
              nodeSpacing: 36,
              rankSpacing: 48,
              padding: 12,
            },
          },
        },
      ],
    ],
  },
  integrations: [
    react(),
    mdx(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, "");
        if (path.startsWith("/concepts/")) return published.has(path);
        return true;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
