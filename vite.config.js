import { defineConfig } from "vite";
import { resolve } from "node:path";
import { cp, access } from "node:fs/promises";

const root = import.meta.dirname;

/**
 * The writeups (Markdown), the posts manifest, and the PDF are fetched at
 * runtime rather than imported, so Vite's bundler never "sees" them. This
 * tiny plugin copies them into the build output verbatim after bundling —
 * which also lets the raw project keep working with no build step at all.
 */
function copyRuntimeData() {
  const items = [
    "posts.json",
    "writeups",
    "assets/papers",
    ".nojekyll",
  ];
  return {
    name: "copy-runtime-data",
    apply: "build",
    async closeBundle() {
      for (const item of items) {
        const src = resolve(root, item);
        try {
          await access(src);
        } catch {
          continue; // skip anything that isn't present
        }
        await cp(src, resolve(root, "dist", item), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  // Relative base so the built site works from any path: Hostinger's
  // public_html root, a subfolder, or a GitHub Pages user site.
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        writeups: resolve(root, "writeups.html"),
        about: resolve(root, "about.html"),
        post: resolve(root, "post.html"),
      },
    },
  },
  plugins: [copyRuntimeData()],
});
