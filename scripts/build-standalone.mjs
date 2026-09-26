// Generate flat, fully self-contained HTML files: content baked in,
// CSS inlined, portrait embedded as a data URI, links rewritten to flat
// filenames. Each file can be uploaded on its own — no assets folder,
// no JavaScript, no build step on the host.

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const outDir = join(root, 'dist-standalone');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// The rendered content + slug/title list come from the SSR bundle.
const ssr = await import(pathToFileURL(join(root, 'dist-ssr', 'entry-server.js')).href);
const { render, listPosts } = ssr;

// Inline the compiled CSS from the client build.
const assetsDir = join(root, 'dist', 'assets');
const cssName = readdirSync(assetsDir).find((f) => f.endsWith('.css'));
const css = readFileSync(join(assetsDir, cssName), 'utf8');

// Embed the portrait so the About page needs no image file.
const pngB64 = readFileSync(join(root, 'public', 'yuval-elbar.png')).toString('base64');
const portrait = `data:image/png;base64,${pngB64}`;

const pdfName = 'path-traversal-container-migration-digital-whisper-he.pdf';

const posts = listPosts();
const slugs = posts.map((p) => p.fields.slug);
const titleFor = new Map(posts.map((p) => [p.fields.slug, p.frontmatter.title]));

function rewrite(html) {
  html = html.split('/yuval-elbar.png').join(portrait);
  html = html.split(`/papers/${pdfName}`).join(pdfName);
  for (const s of slugs) {
    html = html.split(`href="/writing/${s}/"`).join(`href="${s}.html"`);
  }
  html = html.split('href="/#writing"').join('href="index.html#writing"');
  html = html.split('href="/#about"').join('href="index.html#about"');
  html = html.split('href="/"').join('href="index.html"');
  return html;
}

function doc(bodyHtml, title, description) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#0b0b0f" />
<meta name="description" content="${description}" />
<title>${title}</title>
<style>
${css}
</style>
</head>
<body>
<div id="root">${bodyHtml}</div>
</body>
</html>
`;
}

const pages = [
  ['/', 'index.html', 'Yuval Elbar — Security Research', 'Security research by Yuval Elbar — vulnerability writeups and CVEs across cloud and AI infrastructure.'],
  ...slugs.map((s) => [
    `/writing/${s}/`,
    `${s}.html`,
    `${titleFor.get(s)} · Yuval Elbar`,
    (titleFor.get(s) || '').replace(/"/g, '&quot;'),
  ]),
];

for (const [url, file, title, description] of pages) {
  const body = rewrite(render(url));
  writeFileSync(join(outDir, file), doc(body, title, description), 'utf8');
  console.log('wrote', file);
}

// Include the PDF (the one non-HTML asset the site links to).
copyFileSync(join(root, 'public', 'papers', pdfName), join(outDir, pdfName));
console.log('copied', pdfName);
console.log(`\nDone — ${pages.length} HTML files + 1 PDF in dist-standalone/`);
