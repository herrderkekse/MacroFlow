const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

/* ========================= CONFIGURATION ========================= */

const CONFIG = {
    size: 1024,
    faviconSize: 512,

    outputDir: "./assets/images",

    // Positions (relative to center)
    center: { x: 512, y: 512 },

    nodes: {
        center: { dx: 0, dy: 0, r: 120 },
        topRight: { dx: 240, dy: -160, r: 80 },
        bottomRight: { dx: 240, dy: 160, r: 80 },
        left: { dx: -240, dy: 58, r: 80 },
    },

    // Colors
    colors: {
        backgroundGradient: [
            { offset: "0%", color: "#324249" },
            { offset: "40%", color: "#22303a" },
            { offset: "100%", color: "#0b1419" },
        ],

        connectingLine: "#1F2937",
        connectingLineDarkMode: "#9CA3AF",

        nodes: {
            center: "#10B981",
            topRight: "#60A5FA",
            bottomRight: "#F87171",
            left: "#FBBF24",
        },

        highlight: "#FFFFFF",
        monochrome: "#FFFFFF",
    },

    strokeWidth: 28,
    highlightOpacity: 0.18,
};

/* ========================= HELPERS ========================= */

function resolvePosition(center, node) {
    return {
        x: center.x + node.dx,
        y: center.y + node.dy,
    };
}

function svgWrapper(content) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${CONFIG.size} ${CONFIG.size}"
     width="${CONFIG.size}" height="${CONFIG.size}">
${content}
</svg>`;
}

/* ========================= BACKGROUND ========================= */

function buildBackground() {
    const stops = CONFIG.colors.backgroundGradient
        .map(
            (s) => `<stop offset="${s.offset}" stop-color="${s.color}" />`
        )
        .join("\n");

    return `
<defs>
  <radialGradient id="bg" cx="50%" cy="48%" r="70%" gradientUnits="userSpaceOnUse">
    ${stops}
  </radialGradient>
</defs>
<rect width="100%" height="100%" fill="url(#bg)" />
`;
}

/* ========================= CONNECTION LINES ========================= */

function buildLines(monochrome = false, strokeOverride = null) {
    const c = CONFIG.center;

    const tr = resolvePosition(c, CONFIG.nodes.topRight);
    const br = resolvePosition(c, CONFIG.nodes.bottomRight);
    const l = resolvePosition(c, CONFIG.nodes.left);

    const stroke = monochrome
        ? CONFIG.colors.monochrome
        : (strokeOverride || CONFIG.colors.connectingLine);

    return `
<g fill="none"
   stroke="${stroke}"
   stroke-width="${CONFIG.strokeWidth}"
   stroke-linecap="round"
   stroke-linejoin="round"
   opacity="0.95">
  <line x1="${c.x}" y1="${c.y}" x2="${tr.x}" y2="${tr.y}" />
  <line x1="${c.x}" y1="${c.y}" x2="${br.x}" y2="${br.y}" />
  <line x1="${c.x}" y1="${c.y}" x2="${l.x}" y2="${l.y}" />
</g>
`;
}

/* ========================= NODES ========================= */

function buildNodes(monochrome = false) {
    const c = CONFIG.center;

    function circle(node, color) {
        const p = resolvePosition(c, node);
        return `<circle cx="${p.x}" cy="${p.y}" r="${node.r}" fill="${color}" />`;
    }

    return `
${circle(CONFIG.nodes.center, monochrome ? CONFIG.colors.monochrome : CONFIG.colors.nodes.center)}
${circle(CONFIG.nodes.topRight, monochrome ? CONFIG.colors.monochrome : CONFIG.colors.nodes.topRight)}
${circle(CONFIG.nodes.bottomRight, monochrome ? CONFIG.colors.monochrome : CONFIG.colors.nodes.bottomRight)}
${circle(CONFIG.nodes.left, monochrome ? CONFIG.colors.monochrome : CONFIG.colors.nodes.left)}
`;
}

/* ========================= HIGHLIGHTS ========================= */

function buildHighlights(monochrome = false) {
    if (monochrome) return ""; // usually omitted

    const c = CONFIG.center;

    function highlight(node, offsetX, offsetY, r) {
        const p = resolvePosition(c, node);
        return `<circle cx="${p.x + offsetX}" cy="${p.y + offsetY}" r="${r}" />`;
    }

    return `
<g fill="${CONFIG.colors.highlight}" opacity="${CONFIG.highlightOpacity}">
  ${highlight(CONFIG.nodes.center, -42, -42, 20)}
  ${highlight(CONFIG.nodes.topRight, -22, -32, 14)}
  ${highlight(CONFIG.nodes.bottomRight, -22, -32, 14)}
  ${highlight(CONFIG.nodes.left, -32, -24, 14)}
</g>
`;
}

/* ========================= BUILD VARIANTS ========================= */

function buildFull() {
    return svgWrapper(
        buildBackground() +
        buildLines() +
        buildNodes() +
        buildHighlights()
    );
}

function buildForeground() {
    return svgWrapper(
        buildLines() +
        buildNodes() +
        buildHighlights()
    );
}

function buildForegroundDark() {
    return svgWrapper(
        buildLines(false, CONFIG.colors.connectingLineDarkMode) +
        buildNodes() +
        buildHighlights()
    );
}

function buildBackgroundOnly() {
    return svgWrapper(buildBackground());
}

function buildMonochrome() {
    return svgWrapper(
        buildLines(true) +
        buildNodes(true)
    );
}

/* ========================= WRITE FILES ========================= */

// function writeSvg(name, content) {
//     const outPath = path.join(CONFIG.outputDir, name);
//     fs.mkdirSync(CONFIG.outputDir, { recursive: true });
//     fs.writeFileSync(outPath, content);
//     console.log("✔", outPath);
// }

async function writePng(name, svgContent, size = CONFIG.size) {
    const outPath = path.join(CONFIG.outputDir, name);
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    await sharp(Buffer.from(svgContent)).resize(size, size, { fit: "contain" }).png().toFile(outPath);
    console.log("✔", outPath);
}

/* =========================
   RUN
   ========================= */

// Generate PNGs
(async function run() {
    const fullSvg = buildFull();
    await writePng("icon.png", fullSvg, CONFIG.size);
    await writePng("favicon.png", fullSvg, CONFIG.faviconSize);

    const fgSvg = buildForeground();
    await writePng("android-icon-foreground.png", fgSvg, CONFIG.size);
    await writePng("splash-icon-light.png", fgSvg, CONFIG.size);

    const fgDarkSvg = buildForegroundDark();
    await writePng("splash-icon-dark.png", fgDarkSvg, CONFIG.size);

    const bgSvg = buildBackgroundOnly();
    await writePng("android-icon-background.png", bgSvg, CONFIG.size);

    const monoSvg = buildMonochrome();
    await writePng("android-icon-monochrome.png", monoSvg, CONFIG.size);
})();