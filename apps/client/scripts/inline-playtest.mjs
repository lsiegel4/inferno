// Inline the built floor lab's scripts and styles into one self-contained HTML file
// (dist-playtest/floor-lab.html), easy to share or open without a server.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "dist-playtest";
let html = readFileSync(join(dir, "playtest.html"), "utf8");
html = html.replace(/<script type="module" crossorigin src="\/([^"]+)"><\/script>/g, (_, src) => {
  const js = readFileSync(join(dir, src), "utf8").replace(/<\/script/g, "<\\/script");
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\/([^"]+)">/g, (_, href) => {
  return `<style>${readFileSync(join(dir, href), "utf8")}</style>`;
});
writeFileSync(join(dir, "floor-lab.html"), html);
console.log(`wrote ${join(dir, "floor-lab.html")} (${Math.round(html.length / 1024)} KB)`);
