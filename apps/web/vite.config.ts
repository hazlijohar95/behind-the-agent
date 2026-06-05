import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 3000 },
  // Vite 8 resolves `@/*` tsconfig paths natively; `#...` subpath imports in
  // package.json are resolved by Vite too.
  resolve: { tsconfigPaths: true },
  plugins: [
    // Cloudflare Workers SSR environment (replaces Vercel/Node serverless).
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    // Tailwind v4 via its Vite plugin (replaces the PostCSS pipeline).
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});
