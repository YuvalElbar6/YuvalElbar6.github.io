# yuval elbar · security research notepad

A static portfolio of vulnerability writeups and CVEs. No framework, no build step —
plain HTML/CSS/JS served directly by GitHub Pages.

Live: **https://yuvalelbar6.github.io** (once Pages is enabled — see below)

## How it works

| File | Purpose |
|------|---------|
| `index.html` | Home — intro + most recent writeups |
| `writeups.html` | Full list with search + severity filter |
| `post.html?p=<slug>` | Renders a single writeup from Markdown |
| `about.html` | About / contact |
| `posts.json` | **The manifest** — one entry per writeup (drives every list) |
| `writeups/<slug>.md` | The writeup content, in Markdown |
| `assets/css/style.css` | All styling (dark + light themes) |
| `assets/js/site.js` | Theme toggle, list rendering, Markdown viewer |

Markdown is rendered client-side with [marked](https://marked.js.org/) +
[highlight.js](https://highlightjs.org/) from a CDN.

## Adding a new writeup

1. Create `writeups/my-new-finding.md` (write in Markdown; fenced code blocks get
   syntax highlighting; blockquotes starting with `[!warning]`, `[!danger]`, `[!note]`,
   or `[!tip]` become callout boxes).
2. Add one entry to the top of `posts.json`:

   ```json
   {
     "slug": "my-new-finding",
     "title": "My New Finding",
     "date": "2026-10-01",
     "severity": "high",
     "vendor": "Acme Corp",
     "product": "acme-thing",
     "cve": "CVE-2026-99999",
     "cwe": "CWE-79",
     "id": "GHSA-xxxx-xxxx-xxxx",
     "status": "Fixed in 2.0.0",
     "role": "Reporter",
     "tags": ["xss", "web"],
     "advisory": "https://github.com/acme/acme-thing/security/advisories/...",
     "summary": "One-sentence summary shown in the list."
   }
   ```

   `slug` must match the `.md` filename. `severity` is one of
   `critical` / `high` / `medium` / `low` / `info`. That's it — the home page,
   the writeups list, and the article header all update automatically.

## Configure your links

Edit the `SITE` object at the top of [`assets/js/site.js`](assets/js/site.js):

```js
const SITE = {
  github:   "https://github.com/YuvalElbar6",
  linkedin: "https://www.linkedin.com/in/REPLACE-ME",  // ← set this
};
```

## Run locally

Because the site fetches `posts.json` and `.md` files, open it over HTTP (not `file://`):

```bash
python -m http.server 4173
# then open http://localhost:4173
```

## Deploy (GitHub Pages)

This repo is named `YuvalElbar6.github.io`, so it's a **user site** served from the
repo root:

1. `git add -A && git commit -m "Launch security research portfolio"`
2. `git push origin main`
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   Branch: `main` / `/ (root)`, Save.
4. It goes live at `https://yuvalelbar6.github.io` within a minute or two.

The `.nojekyll` file tells Pages to serve everything as-is (no Jekyll processing).
