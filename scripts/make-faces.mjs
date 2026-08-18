import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ink = "#1A1020";

function rects(cells) {
  return cells
    .map(([x, y, w, h, c, cls]) => {
      const klass = cls ? ` class="${cls}"` : "";
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"${klass}/>`;
    })
    .join("");
}

function face({ wash, hair, blush, extra = [], blink = 2.6, delay = 0, flicker = 0.8 }) {
  const cells = [
    [10, 6, 12, 1, ink],
    [9, 7, 1, 3, ink],
    [22, 7, 1, 3, ink],
    [10, 7, 12, 3, hair],
    [8, 10, 1, 12, ink],
    [23, 10, 1, 12, ink],
    [9, 10, 14, 12, wash],
    [9, 13, 3, 2, wash],
    [12, 13, 2, 2, "#FFF6E8", "eye"],
    [18, 13, 2, 2, "#FFF6E8", "eye"],
    [20, 13, 3, 2, wash],
    [12, 14, 1, 1, ink, "pupil"],
    [19, 14, 1, 1, ink, "pupil"],
    [13, 18, 1, 1, ink],
    [18, 18, 1, 1, ink],
    [14, 19, 4, 1, ink],
    [11, 21, 2, 1, blush],
    [19, 21, 2, 1, blush],
    [9, 22, 1, 1, ink],
    [22, 22, 1, 1, ink],
    [10, 22, 12, 2, wash],
    [10, 24, 1, 1, ink],
    [21, 24, 1, 1, ink],
    [11, 24, 10, 1, wash],
    [11, 25, 10, 1, ink],
    ...extra,
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges">
<style>
  @media (prefers-reduced-motion: no-preference) {
    .idle { animation: face-flicker ${flicker}s steps(1, end) infinite; }
    .lid { animation: blink ${blink}s steps(1, end) infinite; animation-delay: ${delay}s; }
  }
  .lid { opacity: 0; }
  @keyframes blink {
    0%, 88%, 100% { opacity: 0; }
    90%, 94% { opacity: 1; }
  }
  @keyframes face-flicker {
    0%, 100% { opacity: 1; }
    6% { opacity: 0.82; }
    8% { opacity: 1; }
    40% { opacity: 1; }
    43% { opacity: 0.88; }
    45% { opacity: 1; }
    72% { opacity: 1; }
    74% { opacity: 0.9; }
    76% { opacity: 1; }
  }
</style>
<g class="idle">
${rects(cells)}
<rect class="lid" x="12" y="13" width="2" height="2" fill="${wash}"/>
<rect class="lid" x="18" y="13" width="2" height="2" fill="${wash}"/>
</g>
</svg>
`;
}

const faces = [
  { wash: "#FF8FB3", hair: "#4A1F7A", blush: "#F09090", extra: [[10, 5, 12, 2, "#4A1F7A"], [14, 4, 4, 1, "#4A1F7A"]], blink: 2.4, delay: 0.1, flicker: 0.72 },
  { wash: "#8CFF2E", hair: "#2A6B12", blush: "#C8F090", extra: [[11, 16, 10, 1, "#2A6B12"]], blink: 3.1, delay: 0.4, flicker: 0.91 },
  { wash: "#FFE566", hair: "#C48A00", blush: "#FFB4A0", extra: [[9, 8, 3, 2, "#C48A00"], [20, 8, 3, 2, "#C48A00"]], blink: 2.7, delay: 0.8, flicker: 0.66 },
  { wash: "#56B2FD", hair: "#0B3A82", blush: "#F09090", extra: [[11, 12, 10, 1, ink], [11, 12, 1, 3, ink], [20, 12, 1, 3, ink]], blink: 2.9, delay: 0.2, flicker: 0.84 },
  { wash: "#FF9F43", hair: "#7A3B00", blush: "#FFB4A0", extra: [[8, 9, 16, 2, "#7A3B00"], [12, 6, 8, 3, "#7A3B00"]], blink: 2.2, delay: 1.1, flicker: 0.77 },
  { wash: "#C084FC", hair: "#5B21B6", blush: "#F09090", extra: [[13, 17, 6, 1, "#FFF6E8"]], blink: 3.4, delay: 0.5, flicker: 1.02 },
  { wash: "#4ADE80", hair: "#14532D", blush: "#C8F090", extra: [[10, 6, 12, 2, "#14532D"], [15, 4, 2, 2, "#14532D"]], blink: 2.5, delay: 0.0, flicker: 0.69 },
  { wash: "#FF6B6B", hair: "#7F1D1D", blush: "#FFB4A0", extra: [[12, 13, 2, 2, "#FFF6E8"], [18, 13, 2, 2, "#FFF6E8"], [12, 14, 2, 1, ink], [18, 14, 2, 1, ink]], blink: 2.8, delay: 0.7, flicker: 0.88 },
  { wash: "#67E8F9", hair: "#155E75", blush: "#F09090", extra: [[14, 10, 4, 2, "#155E75"]], blink: 3.0, delay: 0.3, flicker: 0.74 },
  { wash: "#F5E6C8", hair: "#44403C", blush: "#F09090", extra: [[9, 7, 14, 3, "#44403C"], [10, 6, 12, 1, "#44403C"]], blink: 2.6, delay: 1.4, flicker: 0.95 },
  { wash: "#D4A574", hair: "#431407", blush: "#E8A090", extra: [[8, 11, 2, 6, "#431407"], [22, 11, 2, 6, "#431407"]], blink: 3.2, delay: 0.6, flicker: 0.81 },
  { wash: "#FFF7ED", hair: "#1E293B", blush: "#FECACA", extra: [[10, 5, 12, 3, "#1E293B"], [13, 4, 6, 1, "#334155"]], blink: 2.3, delay: 0.9, flicker: 0.7 },
];

faces.forEach((spec, i) => {
  const svg = face(spec);
  writeFileSync(join(root, "public/avatars", `ink-${i}.svg`), svg);
  writeFileSync(join(root, "public/img", `ink-${i}.svg`), svg);
});

console.log("wrote 12 flickering faces");
