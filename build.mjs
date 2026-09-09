// ─────────────────────────────────────────────────────────────────────────────
//  CDR — digital business card generator
//
//  Run:     node build.mjs   (or: npm run build)
//  Input:   data/employees.json
//  Output:  docs/<slug>.html   — the employee's card (fully self-contained,
//                                works when opened directly from disk)
//           docs/<slug>.vcf    — contact file for phones ("Save contact")
//           docs/index.html    — list of all cards
//           docs/.nojekyll     — harmless; only matters if hosted on GitHub Pages
//
//  Design tokens (colors / fonts) live in the THEME object below.
//  Card markup lives in the cardHTML() function.
//  The QR code is generated here at build time and inlined as SVG — no internet
//  needed to display it.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import qrcode from "./vendor/qrcode.cjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA = join(ROOT, "data", "employees.json");
const OUT = join(ROOT, "docs");
const ASSETS = join(ROOT, "assets");

// ─── THEME ───────────────────────────────────────────────────────────────────
const THEME = {
  lime: "#d1ec3a",   // CDR brand green (from the logo lockup)
  ink: "#111111",    // primary text / black
  paper: "#ffffff",  // card background
  muted: "#6b6b6b",  // labels, address
  line: "#e6e6e6",   // dividers
  pageBg: "#f4f4f2", // page background around the card
  qrDark: "#111111",
  qrLight: "#f0f0f0",
};

// Official logo: drop a file at assets/logo.svg (preferred) or assets/logo.png and
// it is used verbatim inside the lime header block. If none is present, the wordmark
// "CDR" is set in a heavy grotesque as a stand-in.
function findLogo() {
  for (const name of ["logo.svg", "logo.png", "logo.webp", "logo.jpg", "logo.jpeg"]) {
    if (existsSync(join(ASSETS, name))) return name;
  }
  return null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// escape a value for a .vcf file (vCard 3.0)
const vc = (s = "") =>
  String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

const telHref = (p = "") => "tel:" + String(p).replace(/[^\d+]/g, "");

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// build-time QR code → inline SVG string
function qrSvg(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR code">` +
    `<rect width="${n}" height="${n}" fill="${THEME.qrLight}"/><path d="${d}" fill="${THEME.qrDark}"/></svg>`;
}

// ─── vCard ───────────────────────────────────────────────────────────────────
function vcard(emp, co) {
  const a = co.address || {};
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${vc(emp.lastName)};${vc(emp.firstName)};;;`,
    `FN:${vc(`${emp.firstName} ${emp.lastName}`.trim())}`,
    `ORG:${vc(co.name)}${co.unit ? ";" + vc(co.unit) : ""}`,
    emp.title ? `TITLE:${vc(emp.title)}` : "",
    emp.phone ? `TEL;TYPE=WORK,VOICE:${vc(emp.phone)}` : "",
    emp.email ? `EMAIL;TYPE=WORK:${vc(emp.email)}` : "",
    co.website ? `URL:${vc(co.website)}` : "",
    emp.linkedin ? `X-SOCIALPROFILE;TYPE=linkedin:${vc(emp.linkedin)}` : "",
    (a.street || a.locality)
      ? `ADR;TYPE=WORK:;;${vc(a.street)};${vc(a.locality)};;${vc(a.postalCode)};${vc(a.country)}`
      : "",
    "END:VCARD",
  ];
  return lines.filter(Boolean).join("\r\n") + "\r\n";
}

// ─── card page ───────────────────────────────────────────────────────────────
// opts.qr: "inline" (build-time SVG, default) or "client" (cdnjs script — smaller
//          markup, used for the Webflow embed which has a ~10k character limit)
function cardHTML(emp, co, logoFile, opts = {}) {
  const T = THEME;
  const qrMode = opts.qr || "inline";
  const fullName = `${emp.firstName} ${emp.lastName}`.trim();
  const logo = logoFile
    ? `<img class="brand-img" src="./${esc(logoFile)}" alt="${esc(co.name)}">`
    : `<span class="brand-text">${esc(co.name)}</span>`;
  const a = co.address || {};
  const addr = [a.street, a.locality, [a.postalCode, a.country].filter(Boolean).join(" ")]
    .filter(Boolean);
  const base = (co.baseUrl || "").replace(/\/+$/, "");
  const suffix = co.urlSuffix ?? ".html";   // "" for Webflow-style clean URLs
  const shareUrl = base ? `${base}/${emp.slug}${suffix}` : "";
  const qrTarget = emp.qr || shareUrl || co.website || "";
  const vcfHref = "data:text/vcard;charset=utf-8," + encodeURIComponent(vcard(emp, co));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullName)} — ${esc(co.name)}</title>
<meta name="description" content="${esc(fullName)}, ${esc(emp.title)} at ${esc(co.name)}. ${esc(co.tagline)}">
<meta property="og:title" content="${esc(fullName)} — ${esc(co.name)}">
<meta property="og:description" content="${esc(emp.title)} · ${esc(co.tagline)}">
${shareUrl ? `<meta property="og:url" content="${esc(shareUrl)}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --lime:${T.lime}; --ink:${T.ink}; --paper:${T.paper};
    --muted:${T.muted}; --line:${T.line}; --page:${T.pageBg};
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
    background:var(--page); color:var(--ink);
    min-height:100vh; display:flex; align-items:center; justify-content:center;
    padding:24px; line-height:1.5;
  }
  .card{
    width:100%; max-width:420px; background:var(--paper);
    border:1px solid var(--line); border-radius:18px; overflow:hidden;
    box-shadow:0 20px 60px rgba(0,0,0,.08);
  }
  .brand{
    background:var(--lime); padding:48px 32px 44px;
    display:flex; align-items:center; justify-content:center;
  }
  .brand-img{display:block;width:auto;max-width:64%;height:auto}
  .brand-text{
    font-family:"Bebas Neue","Oswald","Arial Narrow",sans-serif;
    font-weight:400; font-size:132px; line-height:.8; letter-spacing:.01em; color:#000;
  }
  .pad{padding:32px}
  .tagline{
    text-align:center;
    font-size:13px;font-weight:600;letter-spacing:.01em;color:var(--ink)
  }
  .unit{
    display:block;width:fit-content;margin:12px auto 0;padding:4px 10px;border-radius:999px;
    background:var(--lime);font-size:12px;font-weight:700
  }
  .who{margin-top:24px}
  .who h1{font-size:24px;font-weight:700;letter-spacing:-.01em}
  .who .title{color:var(--muted);font-size:15px;margin-top:2px}
  .rows{margin-top:24px;border-top:1px solid var(--line)}
  .row{
    display:flex;flex-direction:column;gap:2px;
    padding:14px 0;border-bottom:1px solid var(--line);text-decoration:none;color:inherit
  }
  .row .k{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
  .row .v{font-size:16px;font-weight:600;word-break:break-word}
  a.row:hover .v{color:#000;text-decoration:underline}
  .addr{padding:14px 0 0;font-size:14px;color:var(--muted)}
  .qr-wrap{margin-top:24px;display:flex;gap:16px;align-items:center}
  .qr{width:104px;height:104px;flex:none;background:${T.qrLight};border-radius:10px;padding:8px;overflow:hidden}
  .qr svg,.qr img,.qr canvas{display:block!important;width:100%!important;height:100%!important;border:0}
  .qr-hint{font-size:12px;color:var(--muted)}
  .actions{display:flex;gap:10px;margin-top:26px;flex-wrap:wrap}
  .btn{
    flex:1 1 140px;text-align:center;padding:13px 16px;border-radius:12px;
    font-size:14px;font-weight:600;text-decoration:none;cursor:pointer;border:1px solid var(--ink)
  }
  .btn.primary{background:var(--ink);color:#fff}
  .btn.ghost{background:transparent;color:var(--ink)}
  .btn:active{transform:translateY(1px)}
  .foot{padding:16px 32px;background:#fafafa;border-top:1px solid var(--line);
    font-size:12px;color:var(--muted);display:flex;justify-content:space-between}
  .foot a{color:var(--muted)}
  @media(max-width:400px){.pad{padding:24px}.brand{padding:40px 24px}.brand-text{font-size:108px}}
</style>
</head>
<body>
<main class="card">
  <div class="brand">${logo}</div>
  <div class="pad">
    <div class="tagline">${esc(co.tagline)}</div>
    ${co.unit ? `<div class="unit">${esc(co.unit)}</div>` : ""}

    <div class="who">
      <h1>${esc(fullName)}</h1>
      ${emp.title ? `<div class="title">${esc(emp.title)}</div>` : ""}
    </div>

    <div class="rows">
      ${emp.phone ? `<a class="row" href="${esc(telHref(emp.phone))}"><span class="k">Phone</span><span class="v">${esc(emp.phone)}</span></a>` : ""}
      ${emp.email ? `<a class="row" href="mailto:${esc(emp.email)}"><span class="k">Email</span><span class="v">${esc(emp.email)}</span></a>` : ""}
      ${co.website ? `<a class="row" href="${esc(co.website)}" target="_blank" rel="noopener"><span class="k">Web</span><span class="v">${esc(co.websiteLabel || co.website)}</span></a>` : ""}
      ${emp.linkedin ? `<a class="row" href="${esc(emp.linkedin)}" target="_blank" rel="noopener"><span class="k">LinkedIn</span><span class="v">${esc(emp.linkedin.replace(/^https?:\/\/(www\.)?/, ""))}</span></a>` : ""}
      ${addr.length ? `<div class="addr">${addr.map(esc).join("<br>")}</div>` : ""}
    </div>

    ${qrTarget ? `<div class="qr-wrap">
      <div class="qr" id="qrbox">${qrMode === "inline" ? qrSvg(qrTarget) : ""}</div>
      <div class="qr-hint">Scan with a phone camera<br>to open this card</div>
    </div>` : ""}

    <div class="actions">
      <a class="btn primary" href="${vcfHref}" download="${esc(emp.slug)}.vcf">Save contact</a>
      ${shareUrl ? `<a class="btn ghost" id="share" href="${esc(shareUrl)}">Share</a>` : ""}
    </div>
  </div>

  <div class="foot">
    <span>${esc(co.name)}</span>
    ${co.website ? `<a href="${esc(co.website)}" target="_blank" rel="noopener">${esc(co.websiteLabel || co.website)}</a>` : ""}
  </div>
</main>

${qrTarget && qrMode === "client" ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
  (function(){
    var box = document.getElementById("qrbox");
    function draw(){ try{ new QRCode(box, { text:${JSON.stringify(qrTarget)}, width:220, height:220, colorDark:"${T.qrDark}", colorLight:"${T.qrLight}", correctLevel:QRCode.CorrectLevel.M }); }catch(e){} }
    if (window.QRCode) draw(); else { var s=document.querySelector('script[src*="qrcode"]'); if(s) s.addEventListener("load", draw); }
  })();
</script>` : ""}
${shareUrl ? `<script>
  (function(){
    var url = ${JSON.stringify(shareUrl)};
    var share = document.getElementById("share");
    if (!share) return;
    var data = { title: ${JSON.stringify(fullName + " — " + co.name)}, text: ${JSON.stringify(fullName + ", " + emp.title)}, url: url };
    share.addEventListener("click", function(ev){
      if (navigator.share) { ev.preventDefault(); navigator.share(data).catch(function(){}); }
      else if (navigator.clipboard && navigator.clipboard.writeText) {
        ev.preventDefault();
        navigator.clipboard.writeText(url).then(function(){
          var t = share.textContent; share.textContent = "Link copied";
          setTimeout(function(){ share.textContent = t; }, 2000);
        });
      }
      // otherwise: let the link open normally
    });
  })();
</script>` : ""}
</body>
</html>
`;
}

// ─── Webflow / CMS embed snippet ─────────────────────────────────────────────
// A single self-contained <iframe> you paste into a Webflow "Code Embed" (HTML
// Embed) block. The card lives inside the iframe, so its styles never clash with
// the Webflow page. Uses the client-side QR build to stay under Webflow's ~10k
// character limit for one embed.
function embedSnippet(emp, co, logoFile) {
  const fullName = `${emp.firstName} ${emp.lastName}`.trim();
  // srcdoc attribute value: escape & first, then " — so the inner document is
  // reproduced exactly after the browser decodes the attribute.
  const doc = cardHTML(emp, co, logoFile, { qr: "client" })
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
  return `<iframe title="${esc(fullName)} — ${esc(co.name)} business card" loading="lazy" ` +
    `style="width:100%;max-width:460px;height:1000px;border:0;display:block;margin:0 auto" ` +
    `srcdoc="${doc}"></iframe>\n`;
}

function embedIndexHTML(list, co, logoFile) {
  const T = THEME;
  const rows = list.map((e) => {
    const name = `${e.firstName} ${e.lastName}`.trim();
    return `<article>
  <header><b>${esc(name)}</b><span>${esc(e.title || "")}</span>
    <button data-slug="${esc(e.slug)}">Copy embed code</button></header>
  <textarea readonly id="t-${esc(e.slug)}">${esc(embedSnippet(e, co, logoFile))}</textarea>
</article>`;
  }).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(co.name)} — Webflow embed codes</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Inter,Arial,sans-serif;background:${T.pageBg};color:${T.ink};padding:32px 20px;line-height:1.5}
  .wrap{max-width:760px;margin:0 auto}
  h1{font-size:22px;margin-bottom:6px}
  p.lead{color:${T.muted};margin-bottom:24px}
  article{background:#fff;border:1px solid ${T.line};border-radius:12px;padding:16px;margin-bottom:14px}
  header{display:flex;align-items:center;gap:12px;margin-bottom:10px}
  header b{font-size:15px}header span{color:${T.muted};font-size:13px;flex:1}
  button{padding:8px 14px;border:1px solid ${T.ink};background:${T.ink};color:#fff;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
  button.ok{background:${T.lime};color:#000;border-color:${T.lime}}
  textarea{width:100%;height:90px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;
    border:1px solid ${T.line};border-radius:8px;padding:10px;resize:vertical;background:#fafafa;color:#333}
</style></head><body><div class="wrap">
  <h1>${esc(co.name)} — Webflow embed codes</h1>
  <p class="lead">For each person: open their Webflow page, add an <b>HTML Embed</b> element,
  and paste the code below. Publish the page. That's the whole card.</p>
  ${rows}
</div>
<script>
  document.querySelectorAll("button[data-slug]").forEach(function(b){
    b.addEventListener("click", function(){
      var ta = document.getElementById("t-" + b.dataset.slug);
      ta.select(); navigator.clipboard.writeText(ta.value);
      var o = b.textContent; b.textContent = "Copied ✓"; b.classList.add("ok");
      setTimeout(function(){ b.textContent = o; b.classList.remove("ok"); }, 1600);
    });
  });
</script>
</body></html>
`;
}

// ─── index ───────────────────────────────────────────────────────────────────
function indexHTML(list, co) {
  const T = THEME;
  const items = list.map((e) => {
    const name = `${e.firstName} ${e.lastName}`.trim();
    return `<li><a href="./${esc(e.slug)}.html"><b>${esc(name)}</b><span>${esc(e.title || "")}</span></a></li>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(co.name)} — business cards</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Inter,Arial,sans-serif;background:${T.pageBg};color:${T.ink};padding:40px 20px;line-height:1.5}
  .wrap{max-width:520px;margin:0 auto}
  h1{font-family:"Bebas Neue","Arial Narrow",sans-serif;font-weight:400;font-size:56px;letter-spacing:.02em;margin-bottom:4px}
  .sub{color:${T.muted};margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid ${T.ink}}
  ul{list-style:none}
  li a{display:flex;justify-content:space-between;align-items:center;gap:16px;
    padding:18px;background:#fff;border:1px solid ${T.line};border-radius:12px;
    margin-bottom:10px;text-decoration:none;color:inherit}
  li a:hover{border-color:${T.ink}}
  li a b{font-size:16px}
  li a span{color:${T.muted};font-size:14px}
</style></head>
<body><div class="wrap">
  <h1>${esc(co.name)}</h1>
  <div class="sub">${esc(co.tagline)}</div>
  <ul>${items}</ul>
</div></body></html>
`;
}

// ─── run ─────────────────────────────────────────────────────────────────────
function main() {
  if (!existsSync(DATA)) {
    console.error("data/employees.json not found");
    process.exit(1);
  }
  const { company, employees } = JSON.parse(readFileSync(DATA, "utf8"));
  if (!company || !Array.isArray(employees)) {
    console.error("employees.json: expected an object { company, employees: [] }");
    process.exit(1);
  }

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, ".nojekyll"), "");

  const logoFile = findLogo();
  if (logoFile) {
    copyFileSync(join(ASSETS, logoFile), join(OUT, logoFile));
    console.log(`OK  logo: assets/${logoFile}`);
  } else {
    console.log(`..  no assets/logo.svg|png — using the "CDR" text wordmark as a stand-in`);
  }

  const seen = new Set();
  const built = [];
  for (const raw of employees) {
    const emp = { ...raw };
    emp.slug = emp.slug || slugify(`${emp.firstName}-${emp.lastName}`);
    if (seen.has(emp.slug)) {
      console.error(`Duplicate slug: ${emp.slug} — skipped`);
      continue;
    }
    seen.add(emp.slug);

    writeFileSync(join(OUT, `${emp.slug}.html`), cardHTML(emp, company, logoFile));
    writeFileSync(join(OUT, `${emp.slug}.vcf`), vcard(emp, company));
    built.push(emp);
    console.log(`OK  ${emp.slug}.html  +  ${emp.slug}.vcf`);
  }

  writeFileSync(join(OUT, "index.html"), indexHTML(built, company));
  console.log(`OK  index.html`);

  // Webflow / CMS embed codes
  const embedDir = join(OUT, "embed");
  mkdirSync(embedDir, { recursive: true });
  for (const emp of built) {
    const snip = embedSnippet(emp, company, logoFile);
    writeFileSync(join(embedDir, `${emp.slug}.txt`), snip);
    const kb = (Buffer.byteLength(snip) / 1024).toFixed(1);
    console.log(`OK  embed/${emp.slug}.txt  (${kb} KB${Buffer.byteLength(snip) > 10000 ? "  ⚠ over Webflow 10k limit" : ""})`);
  }
  writeFileSync(join(embedDir, "index.html"), embedIndexHTML(built, company, logoFile));
  console.log(`OK  embed/index.html  ← open this, click "Copy embed code"`);

  console.log(`\nDone: ${built.length} card(s) in docs/`);
}

main();
