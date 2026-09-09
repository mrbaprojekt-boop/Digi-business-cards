// ─────────────────────────────────────────────────────────────────────────────
//  C.D.R Technology — digital business card generator
//
//  Run:     node build.mjs      (npm run build)
//  Input:   data/employees.json           + assets/logo.svg|png (optional)
//                                          + assets/<slug>.src.png (photo source)
//  Output:  docs/<slug>.html      standalone card (self-contained)
//           docs/<slug>.webp      optimised photo (from assets/<slug>.src.png)
//           docs/<slug>.vcf       contact file
//           docs/index.html       list of all cards
//           docs/embed/<slug>.txt paste-into-Webflow <iframe> (auto-height, minified)
//           docs/embed/index.html copy-button helper page
//
//  Design tokens: THEME.  Card markup: cardHTML().  QR: qrSvg() (build-time SVG).
//  sharp + jsqr (devDependencies) are used to (re)encode the photo and to verify
//  that the generated QR really decodes to the right URL. If they are missing the
//  build still runs (photo reuse / QR check skipped with a warning).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import qrcode from "./vendor/qrcode.cjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA = join(ROOT, "data", "employees.json");
const OUT = join(ROOT, "docs");
const ASSETS = join(ROOT, "assets");

let sharp = null, jsQR = null;
try { sharp = (await import("sharp")).default; } catch { /* optional */ }
try { jsQR = (await import("jsqr")).default; } catch { /* optional */ }

// ─── THEME ───────────────────────────────────────────────────────────────────
const THEME = {
  lime: "#d1ec3a",
  ink: "#111111",
  paper: "#ffffff",
  muted: "#6b6b6b",
  line: "#e7e7e7",
  pageBg: "#f4f4f2",
};
const PHOTO_TOKEN = "PASTE_WEBFLOW_ASSET_URL_HERE";

// ─── helpers ─────────────────────────────────────────────────────────────────
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attr = (s = "") => esc(s).replace(/'/g, "&#39;");
const vc = (s = "") =>
  String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const telHref = (p = "") => "tel:" + String(p).replace(/[^\d+]/g, "");
const mapsHref = (q) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);

function slugify(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function findLogo() {
  for (const n of ["logo.svg", "logo.png", "logo.webp", "logo.jpg", "logo.jpeg"])
    if (existsSync(join(ASSETS, n))) return n;
  return null;
}

// collapse whitespace for the embed's srcdoc (safe here: no <pre>, scripts are single-line)
const mini = (s) => s
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\n\s*/g, "")
  .replace(/\s{2,}/g, " ")
  .trim();

// ─── QR → compact inline SVG (quiet zone = 4 modules, #111 on #fff) ───────────
function qrSvg(text, px = 190, quiet = 4) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const dim = n + quiet * 2;
  let d = "";
  for (let r = 0; r < n; r++) {
    let run = 0;
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) { run++; continue; }
      if (run) { d += `M${c - run + quiet} ${r + quiet}h${run}v1h-${run}z`; run = 0; }
    }
    if (run) d += `M${n - run + quiet} ${r + quiet}h${run}v1h-${run}z`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="QR code linking to ${esc(text)}"><rect width="${dim}" height="${dim}" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
  return { svg, modules: n, dim };
}

async function verifyQr(svg, expected) {
  if (!sharp || !jsQR) return "skipped (sharp/jsqr not installed)";
  const { data, info } = await sharp(Buffer.from(svg), { density: 300 })
    .resize(360, 360, { fit: "contain", background: "#fff" })
    .flatten({ background: "#fff" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const res = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  if (!res) throw new Error("QR VERIFY FAILED — the generated QR did not decode");
  if (res.data !== expected)
    throw new Error(`QR VERIFY FAILED — decoded "${res.data}" but expected "${expected}"`);
  return `decoded OK -> ${res.data}`;
}

// ─── photo → optimised WebP (file for standalone/Assets, data-URI for the embed) ──
async function makePhoto(slug) {
  const src = join(ASSETS, `${slug}.src.png`);
  const dest = join(OUT, `${slug}.webp`);
  if (!existsSync(src)) {
    const prev = join(ASSETS, `${slug}.webp`);
    if (existsSync(prev) && !sharp) {
      copyFileSync(prev, dest);
      return { ok: true, note: "reused assets/*.webp (no source, sharp not installed)", dataUri: null };
    }
    return { ok: false, note: `no assets/${slug}.src.png`, dataUri: null };
  }
  if (!sharp) {
    const prev = join(ASSETS, `${slug}.webp`);
    if (existsSync(prev)) { copyFileSync(prev, dest); return { ok: true, note: "reused assets/*.webp (sharp not installed)", dataUri: null }; }
    return { ok: false, note: "sharp not installed and no prebuilt webp", dataUri: null };
  }
  // full-size file (standalone card + optional Webflow Assets upload)
  const info = await sharp(src)
    .resize({ width: 1200, height: 960, fit: "cover", position: "top" })
    .webp({ quality: 80, effort: 6 })
    .toFile(dest);
  copyFileSync(dest, join(ASSETS, `${slug}.webp`));
  // smaller build for inlining into the self-contained embed
  const small = await sharp(src)
    .resize({ width: 900, height: 720, fit: "cover", position: "top" })
    .webp({ quality: 74, effort: 6 })
    .toBuffer();
  return {
    ok: true,
    note: `file ${info.width}x${info.height} ${(info.size / 1024).toFixed(1)} KB; embed inline 900x720 ${(small.length / 1024).toFixed(1)} KB`,
    dataUri: `data:image/webp;base64,${small.toString("base64")}`,
  };
}

// ─── vCard ───────────────────────────────────────────────────────────────────
function vcard(emp, co) {
  const a = co.address || {};
  const org = [co.legalName || co.name, co.unit].filter(Boolean).map(vc).join(";");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${vc(emp.lastName)};${vc(emp.firstName)};;;`,
    `FN:${vc(`${emp.firstName} ${emp.lastName}`.trim())}`,
    `ORG:${org}`,
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

// ─── icons ───────────────────────────────────────────────────────────────────
const LINKEDIN_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/></svg>`;

// ─── card page ───────────────────────────────────────────────────────────────
function cardHTML(emp, co, ctx, opts = {}) {
  const T = THEME;
  const embed = !!opts.embed;
  const fullName = `${emp.firstName} ${emp.lastName}`.trim();
  const a = co.address || {};
  const addrLines = [
    a.street,
    [a.locality].filter(Boolean).join(""),
    [a.postalCode, a.country].filter(Boolean).join(" "),
  ].filter(Boolean);
  const addrOneLine = [a.street, a.locality, a.postalCode, a.country].filter(Boolean).join(", ");

  const base = (co.baseUrl || "").replace(/\/+$/, "");
  const suffix = co.urlSuffix ?? ".html";
  const shareUrl = base ? `${base}/${emp.slug}${suffix}` : "";
  const qrTarget = emp.qr || shareUrl || co.website || "";
  const vcfHref = "data:text/vcard;charset=utf-8," + encodeURIComponent(vcard(emp, co));

  // Request a quotation — self-contained:
  //  - co.quotation set to a URL → the button links there (opens on the top window)
  //  - otherwise                 → the button opens a small "how do you want to send it"
  //                                menu: email app (mailto) / Gmail / copy address
  const qEmail = co.quotationEmail || emp.email || co.email || "";
  const qSubject = "Quotation request";
  const qBody = "Hello, I would like to request a quotation.";
  const qMailto = `mailto:${qEmail}?subject=${encodeURIComponent(qSubject)}&body=${encodeURIComponent(qBody)}`;
  const qGmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(qEmail)}` +
    `&su=${encodeURIComponent(qSubject)}&body=${encodeURIComponent(qBody)}`;
  const quotationIsUrl = !!co.quotation && /^https?:/i.test(co.quotation);
  const quotationHref = quotationIsUrl ? co.quotation : qMailto;
  const quotationMenu = !quotationIsUrl;

  const logo = ctx.logoFile
    ? `<img class="brand-img" src="./${esc(ctx.logoFile)}" alt="${attr(co.name)}">`
    : `<span class="brand-text">${esc(co.name)}</span>`;

  const assetBase = (co.assetBase || "").replace(/\/+$/, "");
  const photoSrc = embed
    ? (assetBase ? `${assetBase}/${emp.slug}.webp` : (ctx.photoDataUri || PHOTO_TOKEN))
    : `./${esc(emp.slug)}.webp`;
  const initials = (emp.firstName[0] || "") + (emp.lastName[0] || "");
  const photo = emp.photo
    ? `<div class="photo">
      <img src="${attr(photoSrc)}" alt="${attr(fullName)}" loading="lazy" decoding="async"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="photo-fb" style="display:none">${esc(initials)}</div>
    </div>`
    : "";

  const qr = qrTarget ? `<div class="qr-wrap">
      <div class="qr">${ctx.qr.svg}</div>
      <div class="qr-hint">Scan to open this card</div>
    </div>` : "";

  const heightScript = embed ? `<script>(function(){var S=${JSON.stringify(emp.slug)};function m(){var c=document.querySelector(".card");return Math.ceil((c?c.getBoundingClientRect().height:document.body.scrollHeight))}function h(){parent.postMessage({__cdrcard:S,h:m()},"*")}addEventListener("load",h);addEventListener("resize",h);if(window.ResizeObserver){try{new ResizeObserver(h).observe(document.body)}catch(e){}}var im=document.images[0];if(im){im.addEventListener("load",h);im.addEventListener("error",h)}setTimeout(h,120);setTimeout(h,500);setTimeout(h,1500);setTimeout(h,3000)})();</script>` : "";

  const shareScript = shareUrl ? `<script>(function(){var u=${JSON.stringify(shareUrl)},b=document.getElementById("sh");if(!b)return;var d={title:${JSON.stringify(fullName + " — " + (co.legalName || co.name))},text:${JSON.stringify(fullName + ", " + (emp.title || ""))},url:u};b.addEventListener("click",function(e){if(navigator.share){e.preventDefault();navigator.share(d).catch(function(){})}else if(navigator.clipboard&&navigator.clipboard.writeText){e.preventDefault();navigator.clipboard.writeText(u).then(function(){var t=b.textContent;b.textContent="Link copied";setTimeout(function(){b.textContent=t},1800)})}})})();</script>` : "";

  const quoteScript = quotationMenu ? `<script>(function(){var b=document.getElementById("rq"),m=document.getElementById("qm");if(!b||!m)return;function rs(){try{window.dispatchEvent(new Event("resize"))}catch(e){}}b.addEventListener("click",function(e){e.preventDefault();m.hidden=!m.hidden;rs()});m.querySelectorAll("[data-copy]").forEach(function(x){x.addEventListener("click",function(){var v=x.getAttribute("data-copy");if(navigator.clipboard)navigator.clipboard.writeText(v);var o=x.textContent;x.textContent="Copied: "+v;setTimeout(function(){x.textContent=o;m.hidden=true;rs()},1200)})});var c=m.querySelector(".qx");if(c)c.addEventListener("click",function(){m.hidden=true;rs()});m.querySelectorAll("a").forEach(function(a){a.addEventListener("click",function(){setTimeout(function(){m.hidden=true;rs()},400)})})})();</script>` : "";


  const bodyRule = embed
    ? `body{margin:0;background:${T.paper};color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.5}`
    : `body{margin:0;background:${T.pageBg};color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}`;
  const cardRule = embed
    ? `.card{width:100%;max-width:460px;margin:0 auto;background:${T.paper};overflow:hidden}`
    : `.card{width:100%;max-width:420px;background:${T.paper};border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.08)}`;

  const head = embed
    ? `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet">`
    : `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(fullName)} — ${esc(co.legalName || co.name)}</title>
<meta name="description" content="${attr(fullName)}, ${attr(emp.title)} — ${attr(co.legalName || co.name)}. ${attr(co.unit || "")}">
${shareUrl ? `<meta property="og:title" content="${attr(fullName + " — " + (co.legalName || co.name))}">
<meta property="og:description" content="${attr((emp.title || "") + " · " + (co.unit || co.tagline))}">
<meta property="og:type" content="profile">
<meta property="og:url" content="${attr(shareUrl)}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;

  return `<!doctype html>
<html lang="en">
<head>
${head}
<style>
  :root{--lime:${T.lime};--ink:${T.ink};--muted:${T.muted};--line:${T.line}}
  *{box-sizing:border-box}
  ${bodyRule}
  ${cardRule}
  img{max-width:100%;display:block}
  a{color:inherit}
  .brand{background:var(--lime);padding:26px 30px;display:flex;align-items:center;justify-content:center}
  .brand-img{width:auto;max-width:52%;height:auto}
  .brand-text{font-family:"Bebas Neue","Arial Narrow",sans-serif;font-weight:400;font-size:64px;line-height:.8;letter-spacing:.02em;color:#000}
  .photo{position:relative;width:100%;aspect-ratio:5/4;background:#e9e9e9}
  .photo img{width:100%;height:100%;object-fit:cover;object-position:center 18%}
  .photo-fb{width:100%;height:100%;align-items:center;justify-content:center;font-family:"Bebas Neue",sans-serif;font-size:80px;color:#000;background:var(--lime)}
  .pad{padding:26px 30px 30px}
  .name{font-size:23px;font-weight:700;letter-spacing:-.01em}
  .role{color:var(--muted);font-size:15px;margin-top:2px}
  .org{font-size:14px;font-weight:600;margin-top:10px}
  .unit{display:inline-block;margin-top:10px;padding:5px 11px;border-radius:999px;background:var(--lime);font-size:12px;font-weight:700}
  .rows{margin-top:20px;border-top:1px solid var(--line)}
  .row{display:flex;flex-direction:column;gap:2px;padding:13px 0;border-bottom:1px solid var(--line);text-decoration:none}
  .row .k{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted)}
  .row .v{font-size:15px;font-weight:600;word-break:break-word}
  .row:hover .v{text-decoration:underline}
  .social{display:flex;flex-wrap:wrap;gap:8px;padding:16px 0 2px}
  .social a{display:inline-flex;align-items:center;gap:7px;padding:7px 11px 7px 9px;border:1px solid var(--line);border-radius:999px;color:var(--ink);font-size:12px;font-weight:600;text-decoration:none}
  .social a svg{flex:none;width:15px;height:15px}
  .social a:hover{background:var(--lime);border-color:var(--lime)}
  .qr-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:20px;text-align:center}
  .qr{width:190px;height:190px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px;overflow:hidden}
  .qr svg{width:100%;height:100%;display:block}
  .qr-hint{font-size:12px;color:var(--muted)}
  .actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}
  .btn{display:flex;align-items:center;justify-content:center;text-align:center;min-height:52px;padding:12px 14px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;cursor:pointer;border:1.5px solid var(--ink)}
  .btn.primary{background:var(--ink);color:#fff}
  .btn.ghost{background:#fff;color:var(--ink)}
  .btn.lime{background:var(--lime);color:#000;border-color:var(--lime);grid-column:1/-1}
  .btn:active{transform:translateY(1px)}
  .qmenu{grid-column:1/-1;flex-direction:column;gap:8px;margin-top:2px;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fafafa}
  .qmenu:not([hidden]){display:flex}
  .qmenu>*{display:block;width:100%;text-align:center;padding:12px;border-radius:10px;border:1.5px solid var(--ink);background:#fff;color:var(--ink);font:600 14px/1.2 inherit;text-decoration:none;cursor:pointer}
  .qmenu .qx{border-color:var(--line);color:var(--muted);font-weight:500}
  .foot{padding:15px 30px;background:#fafafa;border-top:1px solid var(--line);font-size:12px;color:var(--muted);display:flex;justify-content:space-between;gap:12px}
  .foot a{text-decoration:none}
  @media(max-width:360px){
    .pad{padding:22px 20px 26px}.brand{padding:22px}.brand-text{font-size:54px}
    .actions{grid-template-columns:1fr}.btn.ghost{grid-column:auto}
  }
</style>
</head>
<body>
<main class="card">
  <div class="brand">${logo}</div>
  ${photo}
  <div class="pad">
    <div class="name">${esc(fullName)}</div>
    ${emp.title ? `<div class="role">${esc(emp.title)}</div>` : ""}
    ${co.legalName ? `<div class="org">${esc(co.legalName)}</div>` : ""}
    ${co.unit ? `<div class="unit">${esc(co.unit)}</div>` : ""}

    <div class="rows">
      ${emp.phone ? `<a class="row" href="${attr(telHref(emp.phone))}"${embed ? ' target="_top"' : ""}><span class="k">Phone</span><span class="v">${esc(emp.phone)}</span></a>` : ""}
      ${emp.email ? `<a class="row" href="mailto:${attr(emp.email)}"${embed ? ' target="_top"' : ""}><span class="k">Email</span><span class="v">${esc(emp.email)}</span></a>` : ""}
      ${co.website ? `<a class="row" href="${attr(co.website)}" target="_blank" rel="noopener noreferrer"><span class="k">Website</span><span class="v">${esc(co.websiteLabel || co.website)}</span></a>` : ""}
      ${addrOneLine ? `<a class="row" href="${attr(mapsHref(addrOneLine))}" target="_blank" rel="noopener noreferrer"><span class="k">Address (open in Maps)</span><span class="v">${addrLines.map(esc).join("<br>")}</span></a>` : ""}
    </div>

    ${(emp.linkedin || co.linkedin) ? `<div class="social">
      ${emp.linkedin ? `<a href="${attr(emp.linkedin)}" target="_blank" rel="noopener noreferrer" title="${attr(fullName)} on LinkedIn">${LINKEDIN_ICON}<span>Profile</span></a>` : ""}
      ${co.linkedin ? `<a href="${attr(co.linkedin)}" target="_blank" rel="noopener noreferrer" title="${attr(co.legalName || co.name)} on LinkedIn">${LINKEDIN_ICON}<span>Company</span></a>` : ""}
    </div>` : ""}

    ${qr}

    <div class="actions">
      <a class="btn primary" href="${attr(vcfHref)}" download="${attr(emp.slug)}.vcf">Save contact</a>
      ${shareUrl ? `<a class="btn ghost" id="sh" href="${attr(shareUrl)}">Share</a>` : ""}
      <a class="btn lime" id="rq" href="${attr(quotationHref)}"${(quotationIsUrl || (embed && !quotationMenu)) ? ` target="_top"${quotationIsUrl ? ' rel="noopener noreferrer"' : ""}` : ""}>Request a quotation</a>
      ${quotationMenu ? `<div class="qmenu" id="qm" hidden>
        <a href="${attr(qMailto)}" target="_top">Open in email app</a>
        <a href="${attr(qGmail)}" target="_blank" rel="noopener noreferrer">Open in Gmail</a>
        <button type="button" data-copy="${attr(qEmail)}">Copy ${esc(qEmail)}</button>
        <button type="button" class="qx">Cancel</button>
      </div>` : ""}
    </div>
  </div>

  <div class="foot">
    <span>${esc(co.legalName || co.name)}</span>
    ${co.website ? `<a href="${attr(co.website)}" target="_blank" rel="noopener noreferrer">${esc(co.websiteLabel || co.website)}</a>` : ""}
  </div>
</main>
${heightScript}
${shareScript}
${quoteScript}
</body>
</html>
`;
}

// ─── Webflow embed ───────────────────────────────────────────────────────────
function embedSnippet(emp, co, ctx) {
  const fullName = `${emp.firstName} ${emp.lastName}`.trim();
  const doc = mini(cardHTML(emp, co, ctx, { embed: true }))
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
  const s = JSON.stringify(emp.slug);
  // Generous initial height so the card is never clipped even if the resize
  // script below is missing (e.g. an incomplete copy-paste). The script then
  // trims it to the exact content height.
  return `<!-- ${fullName} — C.D.R Technology digital business card -->
<div style="width:100%;max-width:460px;margin:0 auto">
  <iframe id="cdrcard-${esc(emp.slug)}" title="${attr(fullName)} — business card" loading="lazy"
    scrolling="no" style="width:100%;border:0;display:block;overflow:hidden;height:2000px"
    srcdoc="${doc}"></iframe>
</div>
<script>
(function(){
  var f = document.getElementById("cdrcard-${esc(emp.slug)}");
  if (!f) return;
  window.addEventListener("message", function(e){
    var d = e.data;
    if (d && d.__cdrcard === ${s} && d.h) f.style.height = d.h + "px";
  });
})();
</script>
`;
}

function embedIndexHTML(list, co, ctx) {
  const T = THEME;
  const rows = list.map((e) => {
    const name = `${e.firstName} ${e.lastName}`.trim();
    const full = embedSnippet(e, co, ctx[e.slug]);
    return `<article>
  <header><b>${esc(name)}</b><span>${esc(e.title || "")}</span>
    <button data-t="f-${esc(e.slug)}">Copy embed code</button></header>
  <textarea readonly id="f-${esc(e.slug)}">${esc(full)}</textarea>
</article>`;
  }).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(co.name)} — Webflow embed codes</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Inter,Arial,sans-serif;background:${T.pageBg};color:${T.ink};padding:32px 20px;line-height:1.5}
  .wrap{max-width:820px;margin:0 auto}
  h1{font-size:22px;margin-bottom:6px}
  p.lead{color:${T.muted};margin-bottom:22px}
  .note{background:#fff;border:1px solid ${T.line};border-left:4px solid ${T.lime};border-radius:8px;padding:12px 14px;margin-bottom:22px;font-size:13px}
  code{background:#eee;padding:1px 5px;border-radius:4px;font-size:12px}
  article{background:#fff;border:1px solid ${T.line};border-radius:12px;padding:16px;margin-bottom:14px}
  header{display:flex;align-items:center;gap:12px;margin-bottom:10px}
  header b{font-size:15px}header span{color:${T.muted};font-size:13px;flex:1}
  button{padding:9px 15px;border:1px solid ${T.ink};background:${T.ink};color:#fff;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
  button.alt{background:#fff;color:${T.ink}}
  button.ok{background:${T.lime};color:#000;border-color:${T.lime}}
  textarea{width:100%;height:120px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;border:1px solid ${T.line};border-radius:8px;padding:10px;resize:vertical;background:#fafafa;color:#333;white-space:pre}
</style></head><body><div class="wrap">
  <h1>${esc(co.name)} — Webflow embed codes</h1>
  <p class="lead">One HTML Embed per person. The photo is embedded in the code — nothing else to upload.
  The card is an auto-resizing <code>&lt;iframe&gt;</code>: no inner scrollbar, height follows the content,
  isolated from the page's CSS.</p>
  <div class="note">
    <b>Copy embed code</b> → in Webflow drag in an <b>HTML Embed</b> → paste → <b>Save</b> → <b>Publish</b> the page.
    Publish the page at <code>${esc(co.baseUrl || "")}/&lt;slug&gt;</code> so the QR resolves.
  </div>
  ${rows}
</div>
<script>
  document.querySelectorAll("button[data-t]").forEach(function(b){
    b.addEventListener("click",function(){
      var ta=document.getElementById(b.dataset.t);
      ta.hidden=false;ta.select();navigator.clipboard.writeText(ta.value);
      if(ta.id[0]==="l")ta.hidden=true;
      var o=b.textContent;b.textContent="Copied \u2713";b.classList.add("ok");
      setTimeout(function(){b.textContent=o;b.classList.remove("ok")},1600);
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(co.legalName || co.name)} — business cards</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Inter,Arial,sans-serif;background:${T.pageBg};color:${T.ink};padding:40px 20px;line-height:1.5}
  .wrap{max-width:520px;margin:0 auto}
  h1{font-family:"Bebas Neue","Arial Narrow",sans-serif;font-weight:400;font-size:52px;letter-spacing:.02em;margin-bottom:2px}
  .sub{color:${T.muted};margin-bottom:26px;padding-bottom:16px;border-bottom:1px solid ${T.ink}}
  ul{list-style:none}
  li a{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px;background:#fff;border:1px solid ${T.line};border-radius:12px;margin-bottom:10px;text-decoration:none;color:inherit}
  li a:hover{border-color:${T.ink}}
  li a b{font-size:16px}li a span{color:${T.muted};font-size:14px}
</style></head><body><div class="wrap">
  <h1>${esc(co.name)}</h1>
  <div class="sub">${esc(co.legalName || "")} · ${esc(co.tagline)}</div>
  <ul>${items}</ul>
</div></body></html>
`;
}

// ─── run ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(DATA)) { console.error("data/employees.json not found"); process.exit(1); }
  const { company, employees } = JSON.parse(readFileSync(DATA, "utf8"));
  if (!company || !Array.isArray(employees)) {
    console.error("employees.json: expected { company, employees: [] }"); process.exit(1);
  }

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "embed"), { recursive: true });
  writeFileSync(join(OUT, ".nojekyll"), "");

  const logoFile = findLogo();
  if (logoFile) { copyFileSync(join(ASSETS, logoFile), join(OUT, logoFile)); console.log(`OK  logo: assets/${logoFile}`); }
  else console.log(`..  no assets/logo.* — using the "CDR" text wordmark`);

  console.log(sharp ? "OK  sharp available" : "..  sharp NOT installed — photo reuse only");
  console.log(jsQR ? "OK  jsqr available (QR will be verified)" : "..  jsqr NOT installed — QR check skipped");

  const seen = new Set();
  const built = [];
  const ctxBySlug = {};
  for (const raw of employees) {
    const emp = { ...raw };
    emp.slug = emp.slug || slugify(`${emp.firstName}-${emp.lastName}`);
    if (seen.has(emp.slug)) { console.error(`Duplicate slug: ${emp.slug} — skipped`); continue; }
    seen.add(emp.slug);

    const base = (company.baseUrl || "").replace(/\/+$/, "");
    const suffix = company.urlSuffix ?? ".html";
    const qrTarget = emp.qr || (base ? `${base}/${emp.slug}${suffix}` : "") || company.website || "";
    const qr = qrSvg(qrTarget, 190, 4);
    const check = await verifyQr(qr.svg, qrTarget);
    console.log(`OK  QR ${emp.slug}: v?${qr.modules}x${qr.modules} + 4-module quiet zone — ${check}`);

    let photoNote = "no photo";
    let photoDataUri = null;
    if (emp.photo) {
      const r = await makePhoto(emp.slug);
      photoNote = r.note;
      photoDataUri = r.dataUri;
      if (!r.ok) console.warn(`⚠  photo ${emp.slug}: ${r.note}`);
    }

    const ctx = { logoFile, qr, photoDataUri };
    ctxBySlug[emp.slug] = ctx;

    writeFileSync(join(OUT, `${emp.slug}.html`), cardHTML(emp, company, ctx, { embed: false }));
    writeFileSync(join(OUT, `${emp.slug}.vcf`), vcard(emp, company));
    const snip = embedSnippet(emp, company, ctx);
    writeFileSync(join(OUT, "embed", `${emp.slug}.txt`), snip);
    const bytes = Buffer.byteLength(snip);
    console.log(`OK  ${emp.slug}: .html + .vcf + embed (${(bytes / 1024).toFixed(1)} KB${bytes > 50000 ? "  ⚠ OVER Webflow 50k Code Embed limit" : " — well under Webflow's 50k Code Embed limit"}) — photo: ${photoNote}`);
    built.push(emp);
  }

  writeFileSync(join(OUT, "index.html"), indexHTML(built, company));
  writeFileSync(join(OUT, "embed", "index.html"), embedIndexHTML(built, company, ctxBySlug));
  console.log(`\nDone: ${built.length} card(s) in docs/`);
}

main().catch((e) => { console.error("\nBUILD FAILED:\n" + (e && e.stack || e)); process.exit(1); });
