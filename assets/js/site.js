/* =========================================================================
   Yuval Elbar — site logic
   Handles: theme toggle, post-list rendering, search/filter, markdown viewer.
   Pure vanilla JS. Runs on GitHub Pages with no build step.
   ========================================================================= */

/* ---- Edit your links here ------------------------------------------------ */
const SITE = {
  github: "https://github.com/YuvalElbar6",
  linkedin: "https://www.linkedin.com/in/REPLACE-ME", // TODO: set your LinkedIn URL
};
/* ------------------------------------------------------------------------- */

/* --------------------------------------------------------------- utilities */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

const sevOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

/* ------------------------------------------------------------------- theme */
function initTheme() {
  const btn = $("#theme-toggle");
  if (!btn) return;
  const setIcon = () => {
    const dark = document.documentElement.getAttribute("data-theme") !== "light";
    btn.innerHTML = dark ? ICON.moon : ICON.sun;
    btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  };
  setIcon();
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = cur === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (_) {}
    setIcon();
  });
}

/* ------------------------------------------------------------------- icons */
const ICON = {
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  sun:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 22.29 24 17.79 24 12.5 24 5.87 18.63.5 12 .5z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
};

/* --------------------------------------------------------- post rendering */
function postCard(p) {
  const sev = (p.severity || "info").toLowerCase();
  const card = el("a", { class: "post-item", href: `post.html?p=${encodeURIComponent(p.slug)}` });

  const row1 = el("div", { class: "row1" },
    el("h3", {}, p.title),
    el("span", { class: `badge sev-${sev}` }, sev)
  );
  card.append(row1);

  if (p.summary) card.append(el("p", { class: "summary" }, p.summary));

  const meta = el("div", { class: "meta" });
  if (p.vendor) meta.append(el("span", { class: "vendor" }, p.vendor));
  if (p.cve)    meta.append(el("span", {}, p.cve));
  else if (p.id) meta.append(el("span", {}, p.id));
  if (Array.isArray(p.tags)) p.tags.slice(0, 3).forEach(t => meta.append(el("span", { class: "tag" }, t)));
  meta.append(el("time", { datetime: p.date }, fmtDate(p.date)));
  card.append(meta);

  return card;
}

async function loadPosts() {
  const res = await fetch("posts.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Could not load posts.json");
  const posts = await res.json();
  return posts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

/* home page: show most recent N */
async function renderHomeList() {
  const mount = $("#recent-posts");
  if (!mount) return;
  try {
    const posts = await loadPosts();
    mount.innerHTML = "";
    posts.slice(0, 4).forEach(p => mount.append(postCard(p)));
    const counter = $("#post-count");
    if (counter) counter.textContent = posts.length;
  } catch (e) {
    mount.innerHTML = `<div class="empty-state">Could not load writeups (${e.message}).</div>`;
  }
}

/* writeups page: full list with search + severity filter */
async function renderWriteupsPage() {
  const mount = $("#all-posts");
  if (!mount) return;
  let posts = [];
  try {
    posts = await loadPosts();
  } catch (e) {
    mount.innerHTML = `<div class="empty-state">Could not load writeups (${e.message}).</div>`;
    return;
  }

  const search = $("#search");
  const filterBtns = $$(".filter-btn");
  let activeSev = "all";

  const apply = () => {
    const q = (search?.value || "").trim().toLowerCase();
    const filtered = posts.filter(p => {
      const sevOk = activeSev === "all" || (p.severity || "").toLowerCase() === activeSev;
      if (!sevOk) return false;
      if (!q) return true;
      const hay = [p.title, p.summary, p.vendor, p.cve, p.id, ...(p.tags || [])]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
    mount.innerHTML = "";
    if (!filtered.length) {
      mount.append(el("div", { class: "empty-state" }, "// no writeups match your filter"));
      return;
    }
    filtered.forEach(p => mount.append(postCard(p)));
  };

  search?.addEventListener("input", apply);
  filterBtns.forEach(b => b.addEventListener("click", () => {
    filterBtns.forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    activeSev = b.dataset.sev;
    apply();
  }));
  apply();
}

/* ---------------------------------------------------- markdown post viewer */
function slugify(text) {
  return text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function enhanceCallouts(root) {
  $$("blockquote", root).forEach(bq => {
    const first = bq.querySelector("p");
    if (!first) return;
    const m = first.innerHTML.match(/^\[!(\w+)\]\s*(.*)/s);
    if (!m) return;
    const type = m[1].toLowerCase();
    const known = { warning: "⚠", danger: "⛔", note: "ℹ", tip: "✓" };
    const kind = known[type] ? type : "note";
    const callout = el("div", { class: `callout ${kind}` });
    callout.append(el("div", { class: "callout-title" }, `${known[kind] || "ℹ"}  ${type.toUpperCase()}`));
    first.innerHTML = m[2];
    while (bq.firstChild) callout.append(bq.firstChild);
    bq.replaceWith(callout);
  });
}

function addCopyButtons(root) {
  $$("pre", root).forEach(pre => {
    const btn = el("button", { class: "copy-btn", type: "button" }, "copy");
    btn.addEventListener("click", async () => {
      const code = pre.querySelector("code")?.innerText ?? pre.innerText;
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = "copied!";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "copy"; btn.classList.remove("copied"); }, 1400);
      } catch (_) { btn.textContent = "err"; }
    });
    pre.append(btn);
  });
}

function addHeadingAnchors(root) {
  $$("h2, h3", root).forEach(h => {
    if (!h.id) h.id = slugify(h.textContent);
  });
}

async function renderPostViewer() {
  const mount = $("#post-body");
  if (!mount) return;

  const slug = new URLSearchParams(location.search).get("p");
  if (!slug || !/^[\w-]+$/.test(slug)) {
    mount.innerHTML = `<div class="empty-state">// no writeup specified — <a href="writeups.html">browse all writeups</a></div>`;
    return;
  }

  let posts, meta;
  try {
    posts = await loadPosts();
    meta = posts.find(p => p.slug === slug);
  } catch (_) { /* still try to render md */ }

  let md;
  try {
    const res = await fetch(`writeups/${slug}.md`, { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    md = await res.text();
  } catch (e) {
    mount.innerHTML = `<div class="empty-state">// writeup not found — <a href="writeups.html">browse all writeups</a></div>`;
    return;
  }

  // Header from manifest
  const head = $("#article-head");
  if (head && meta) {
    const sev = (meta.severity || "info").toLowerCase();
    head.innerHTML = "";
    const kicker = el("div", { class: "kicker" });
    kicker.append(el("span", { class: `badge sev-${sev}` }, sev));
    if (meta.cve) kicker.append(el("span", {}, meta.cve));
    if (meta.cwe) kicker.append(el("span", {}, meta.cwe));
    head.append(kicker);
    head.append(el("h1", {}, meta.title));
    const m = el("div", { class: "article-meta" });
    if (meta.vendor) m.append(el("span", {}, `vendor: ${meta.vendor}`));
    m.append(el("span", {}, `published: ${fmtDate(meta.date)}`));
    if (meta.status) m.append(el("span", { class: "dl" }, meta.status));
    head.append(m);
    document.title = `${meta.title} · Yuval Elbar`;
  }

  // Render markdown
  marked.setOptions({
    highlight: (code, lang) => {
      if (window.hljs && lang && hljs.getLanguage(lang)) {
        try { return hljs.highlight(code, { language: lang }).value; } catch (_) {}
      }
      return window.hljs ? hljs.highlightAuto(code).value : code;
    },
    breaks: false,
    gfm: true,
  });
  mount.innerHTML = marked.parse(md);
  mount.querySelectorAll("pre code").forEach(b => { if (window.hljs) hljs.highlightElement(b); });
  enhanceCallouts(mount);
  addHeadingAnchors(mount);
  addCopyButtons(mount);
}

/* -------------------------------------------------------------- footer links */
function wireLinks() {
  $$("[data-link=github]").forEach(a => a.href = SITE.github);
  $$("[data-link=linkedin]").forEach(a => a.href = SITE.linkedin);
}

/* ----------------------------------------------------------------- bootstrap */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  wireLinks();
  renderHomeList();
  renderWriteupsPage();
  renderPostViewer();
});
