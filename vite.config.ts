import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

function devBadgeArt(): Plugin {
  const dir = resolve(__dirname, "./public/badge-art");
  return {
    name: "unison-dev-badge-art",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/badge-art", (req, res, next) => {
        const name = (req.url ?? "").split("?")[0].replace(/^\//, "");
        if (!/^[a-z0-9_-]+\.svg$/i.test(name)) return next();
        const file = resolve(dir, name);
        if (!file.startsWith(dir) || !existsSync(file)) return next();
        res.setHeader("content-type", "image/svg+xml");
        res.end(readFileSync(file));
      });
    },
  };
}

function spa404(): Plugin {
  return {
    name: "unison-spa-404",
    closeBundle() {
      const indexFile = resolve(__dirname, "./dist/index.html");
      const notFoundFile = resolve(__dirname, "./dist/404.html");
      if (existsSync(indexFile)) {
        copyFileSync(indexFile, notFoundFile);
      }
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), devBadgeArt(), spa404()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    entries: ["index.html", "src/main.tsx"],
  },
  server: {
    port: 5173,
    fs: {
      deny: ["**/Reference/**"],
    },
    watch: {
      ignored: ["**/Reference/**"],
    },
    proxy: {
      "/leaderboard": {
        target: "https://unison.betterlyrics.org",
        changeOrigin: true,
      },
      "/artwork": {
        target: "https://unison.betterlyrics.org",
        changeOrigin: true,
      },
      "/lyrics": {
        target: "https://unison.betterlyrics.org",
        changeOrigin: true,
      },
      "/users": {
        target: "https://unison.betterlyrics.org",
        changeOrigin: true,
      },
      "/badges": {
        target: "https://unison.betterlyrics.org",
        changeOrigin: true,
      },
      "/avatars": {
        target: "https://unison.betterlyrics.org",
        changeOrigin: true,
      },
      "/feed": {
        target: "https://unison.betterlyrics.org",
        changeOrigin: true,
      },
      "/requests": {
        target: "https://unison.betterlyrics.org",
        changeOrigin: true,
      },
      "/auth": {
        target: "https://unison.betterlyrics.org",
        changeOrigin: true,
      },
      "/links": {
        target: "https://unison.betterlyrics.org",
        changeOrigin: true,
      },
      "/exam/": {
        target: "https://unison.betterlyrics.org",
        changeOrigin: true,
      },
      "/health": {
        target: "https://unison.betterlyrics.org",
        changeOrigin: true,
      },
    },
  },
});
