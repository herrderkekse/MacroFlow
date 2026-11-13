#!/usr/bin/env node
/**
 * Screen gallery dev server: `npm run gallery`, then open http://localhost:8090/gallery
 * (see gallery/README.md).
 *
 * Runs the Expo web dev server on an internal port and puts a small proxy in
 * front of it that adds the cross-origin-isolation headers expo-sqlite's web
 * build needs (SharedArrayBuffer). Expo serves the HTML page from its own
 * middleware, which Metro's `enhanceMiddleware` can't reach, hence the proxy.
 */
const fs = require("fs");
const http = require("http");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");

const PUBLIC_PORT = Number(process.env.GALLERY_PORT ?? 8090);
const EXPO_PORT = PUBLIC_PORT + 1;

const ISOLATION_HEADERS = {
    "cross-origin-embedder-policy": "credentialless",
    "cross-origin-opener-policy": "same-origin",
};

// Extra arguments go to Expo, e.g. `npm run gallery -- --clear`.
const expo = spawn("npx", ["expo", "start", "--web", "--port", String(EXPO_PORT), ...process.argv.slice(2)], {
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, BROWSER: "none" },
});
expo.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => expo.kill(signal));
}

const GALLERY_PAGE = path.join(__dirname, "index.html");

const server = http.createServer((req, res) => {
    // The gallery page itself is plain HTML (read on every request, so edits
    // show on reload); everything else is the app, served by Expo.
    if (/^\/gallery\/?(\?.*)?$/.test(req.url ?? "")) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...ISOLATION_HEADERS });
        res.end(fs.readFileSync(GALLERY_PAGE));
        return;
    }
    // Placeholder picture for the photo-details frame (its route takes image URIs).
    if (req.url === "/gallery/photo.svg") {
        res.writeHead(200, { "content-type": "image/svg+xml", ...ISOLATION_HEADERS });
        res.end(fs.readFileSync(path.join(__dirname, "photo.svg")));
        return;
    }
    const upstream = http.request(
        { host: "localhost", port: EXPO_PORT, path: req.url, method: req.method, headers: req.headers },
        (upstreamRes) => {
            res.writeHead(upstreamRes.statusCode ?? 502, { ...upstreamRes.headers, ...ISOLATION_HEADERS });
            upstreamRes.pipe(res);
        },
    );
    upstream.on("error", () => {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end("Expo dev server is not ready yet. Reload in a moment.");
    });
    req.pipe(upstream);
});

// Pass websocket upgrades (Fast Refresh, dev tools) straight through.
server.on("upgrade", (req, socket, head) => {
    const upstream = net.connect(EXPO_PORT, "localhost", () => {
        const headerLines = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`);
        upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${headerLines.join("\r\n")}\r\n\r\n`);
        upstream.write(head);
        upstream.pipe(socket).pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
});

server.listen(PUBLIC_PORT, () => {
    console.log(`\nScreen gallery: http://localhost:${PUBLIC_PORT}/gallery\n`);
});
