# C.D.R Technology — digital business cards

One shareable card per employee, in the CDR brand style (lime / black / white,
Bebas Neue wordmark). Every card has: the CDR logo, the person's photo, name, title,
company, unit, tappable phone / email / website, a work address that opens in Google
Maps, small social icons, a QR code, and three big buttons — **Save contact**,
**Request a quotation**, **Share**.

Two outputs from one JSON file:

1. **`docs/<slug>.html`** — a standalone card page (self-contained, opens from disk).
2. **`docs/embed/<slug>.txt`** — a CSS-scoped `<div>` (NOT an iframe) to paste into a
   **Webflow HTML Embed** (no inner scrollbar, height follows content, style-isolated).

---

## 1. Project layout

```
Digi-business-cards/
├── data/employees.json      ← YOU EDIT THIS (the only source of data)
├── assets/
│   ├── logo.svg | logo.png      official CDR logo (optional; falls back to Bebas "CDR")
│   └── <slug>.src.png           photo source, roughly square — auto-cropped on build
├── build.mjs                ← generator
├── serve.mjs                ← local preview server
├── vendor/qrcode.cjs        ← bundled QR library
├── Rebuild and open.bat     ← Windows: double-click to rebuild + open
├── docs/                    ← GENERATED — the website
│   ├── index.html               list of all cards
│   ├── <slug>.html              standalone card
│   ├── <slug>.webp              optimised photo (also usable in Webflow Assets)
│   ├── <slug>.vcf               contact file
│   └── embed/
│       ├── index.html               open this, click "Copy embed code"
│       └── <slug>.txt               the embed snippet for Webflow (scoped <div>)
└── README.md
```

`docs/` is rebuilt from scratch every run — never hand-edit it.

---

## 2. Setup (once)

```bash
cd Digi-business-cards
npm install
```

Installs `sharp` + `jsqr` (dev only). They let the build (re)encode the photo to WebP
and automatically verify that the generated QR decodes to the right URL. If they are
missing the build still runs — it reuses the last `assets/<slug>.webp` and skips the
QR self-check.

---

## 3. Edit the data — `data/employees.json`

### `company` (applies to every card)

```json
"company": {
  "name": "CDR",
  "legalName": "C.D.R Technology OÜ",
  "tagline": "Creative | Development | Research",
  "unit": "GPU & GSE Equipment",
  "website": "https://cdr.ee",
  "websiteLabel": "cdr.ee",
  "baseUrl": "https://cdr.ee/business-cards",
  "urlSuffix": "",
  "linkedin": "https://www.linkedin.com/company/c-d-r-technology-o%C3%BC/",
  "quotation": "",
  "address": {
    "street": "Taevavärava tee 6b-24",
    "locality": "Lehmja küla, Rae vald, Harju maakond",
    "postalCode": "75306",
    "country": "Estonia"
  }
}
```

| Key | Meaning |
|---|---|
| `name` | the wordmark shown in the lime header (kept short — "CDR") |
| `legalName` | full company name shown on the card and saved into the contact |
| `baseUrl` + `urlSuffix` | how the card's own URL is built: `baseUrl` + `/` + `slug` + `urlSuffix`. `urlSuffix:""` gives clean Webflow URLs (`…/elmahdi-lamine`). **The QR code and Share point here — it must match the real published page.** |
| `linkedin` | company LinkedIn (small icon). |
| `quotation` | URL for a real "Request a quotation" page/popup. **Leave `""`** and the button becomes a pre-filled email to the person with subject *Quotation request* (there is no direct URL for the cdr.ee quotation popup). |

### `employees` (one object each)

```json
{
  "slug": "elmahdi-lamine",
  "firstName": "Elmahdi",
  "lastName": "Lamine",
  "title": "CEO",
  "phone": "+372 555 121 47",
  "email": "el@cdr.ee",
  "linkedin": "",
  "photo": "elmahdi-lamine.webp",
  "qr": ""
}
```

| Field | Notes | Empty `""` |
|---|---|---|
| `slug` | file name + URL segment. Latin, no spaces. **Don't change once shared.** | generated from the name |
| `title` | job title | row hidden |
| `phone` / `email` | clickable | row hidden |
| `linkedin` | the person's **own** LinkedIn URL — only add if you have the exact link | icon hidden |
| `photo` | any truthy value turns the photo on; put the source at `assets/<slug>.src.png` | no photo (lime initials block) |
| `qr` | override the QR target; normally leave `""` to use the card's own URL | uses the card URL |

### Add / change / remove a person

- **Add:** new object in `employees` + `assets/<slug>.src.png` (a roughly square photo), then build.
- **Change:** edit the values. Replace `assets/<slug>.src.png` to change the photo.
- **Remove:** delete the object. Its files leave `docs/` on the next build.

---

## 4. Build & preview

**Windows:** double-click **`Rebuild and open.bat`**.

**Or:** `npm run build` then open `docs/index.html` (double-click, or right-click →
Open with → your browser). `npm run serve` starts a local server at
<http://localhost:8080> (needed only for the Share button's native share to work).

The build prints, per person: the QR check result, the photo sizes, and the embed size.

---

## 5. Publish

### A. Webflow (recommended)

1. `npm run build`
2. Open **`docs/embed/index.html`** → **Copy embed code** for the person.
3. Webflow → their page → drag in an **HTML Embed** → paste → **Save** → **Publish**.

The embed is a `<div id="cdrcard-<slug>">` — no iframe (~15 KB, well under Webflow's
50 000-char limit). Every CSS selector inside is prefixed with `#cdrcard-<slug>`, so the
page's styles can't reach in and the card's styles can't reach out. The QR is inline SVG;
the photo loads from `company.assetBase` (GitHub Pages). The card sits in normal document
flow, so its height is always correct — no postMessage, no auto-resize, nothing to crop.
(An iframe fed by `srcdoc` / `document.write` renders blank on iOS Safari — hence a div.)

Publish each person's page at exactly `baseUrl + "/" + slug` (e.g.
`https://cdr.ee/business-cards/elmahdi-lamine`) so the QR and Share resolve.

> To serve the photo from Webflow's CDN instead of inline: upload `docs/<slug>.webp`
> to Webflow → Assets and replace the `src="data:image/webp;base64,…"` value with the
> Asset URL.

### B. Static upload (cdr.ee server / Netlify / …)

Copy the contents of `docs/` to the host. The card URLs are `<host>/<slug>` (or
`<slug>.html` if you set `urlSuffix` back to `".html"`).

---

## 6. What the buttons do

| Button | Action |
|---|---|
| **Save contact** | downloads a vCard (`data:` URI — works everywhere) with full name, title, company `C.D.R Technology OÜ`, phone, email, website, address |
| **Request a quotation** | opens the `company.quotation` URL if set; otherwise a pre-filled email to the person, subject **Quotation request** |
| **Share** | native share sheet on mobile, copy-link on desktop |

---

## 7. Design / logo

Colours + type: `THEME` in `build.mjs`. Layout: `cardHTML()`.
Official logo: drop `assets/logo.svg` (or `.png`) and it is used unchanged inside the
lime header; otherwise "CDR" is set in Bebas Neue.

---

## 8. With Claude Code

"add employee …", "change the address", "swap Elmahdi's photo", "rebuild the cards" —
the `business-card` skill edits `data/employees.json`, runs the build (QR verified,
photo re-encoded) and reports the embed size + where the QR points.
