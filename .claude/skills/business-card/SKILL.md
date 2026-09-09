---
name: business-card
description: Generates C.D.R Technology employee digital business cards from digital-business-cards/data/employees.json — a standalone HTML card, an optimised WebP photo, a .vcf, and a self-contained Webflow <iframe> embed per person. Handles adding/editing/removing an employee, company-wide data (address, LinkedIn, quotation), photos, and restyling. Use when asked to add/edit/remove a card, swap a photo, update company info, or "rebuild the cards".
---

# business-card — C.D.R Technology digital business cards

Project: `digital-business-cards/`  (repo `github.com/mrbaprojekt-boop/Digi-business-cards`, private)

```
data/employees.json     the ONLY source of data
assets/<slug>.src.png   photo source (~square) — build crops it to WebP
assets/logo.svg|png     optional official logo
build.mjs               generator (needs devDeps sharp + jsqr for photo + QR check)
docs/                    GENERATED: <slug>.html, <slug>.webp, <slug>.vcf, index.html,
                         embed/<slug>.txt (Webflow iframe), embed/index.html (copy page)
```

## ⚠️ Workspace path has a non-breaking space (U+00A0)

Read / Write / Edit / Glob **silently miss** the real folder here. Use **PowerShell /
Bash / node only**. In PowerShell derive paths from `$PWD.Path` + `Join-Path`, never
type the Cyrillic path. Run node by relative ASCII path: `node "digital-business-cards/build.mjs"`.

## Workflow

1. Read data:
   `Get-Content -Raw -LiteralPath (Join-Path $PWD.Path "digital-business-cards\data\employees.json")`
2. Write the whole updated JSON back:
   `Set-Content -LiteralPath (...) -Value $json -Encoding utf8`  (here-string).
   For a new/changed photo, copy the image to `digital-business-cards\assets\<slug>.src.png`.
3. Rebuild: `node "digital-business-cards/build.mjs"`
   - It prints, per person: `QR <slug>: … decoded OK -> <url>` (fails the build if the
     QR does not decode to the expected URL), photo sizes, and the embed KB
     (must be under Webflow's 50 000-char limit).
4. Verify + report: which files in `docs/` changed, the QR target, the embed size,
   and remind the user to re-copy the embed from `docs/embed/<slug>.txt` into Webflow
   (or re-upload `docs/`), then `git add -A && git commit && git push`.

### Visual check (when restyling / new photo)

```
node "digital-business-cards/serve.mjs" 8080   (background)
```
Playwright → `http://localhost:8080/<slug>.html` and, for the embed, a tiny test page
that includes `docs/embed/<slug>.txt`. Check widths 320 / 375 / 390 / 430. Stop node after.

## Data model (employees.json)

`company`: `name` (wordmark), `legalName` ("C.D.R Technology OÜ"), `tagline`, `unit`,
`website`, `websiteLabel`, `baseUrl`, `urlSuffix` (`""` = clean Webflow URLs),
`linkedin` (company), `quotation` (`""` → button becomes a pre-filled email to the
person, subject "Quotation request"), `address {street, locality, postalCode, country}`.

`employees[]`: `slug` (URL segment + filenames; don't change once shared),
`firstName`, `lastName`, `title`, `phone`, `email`, `linkedin` (personal — only if an
exact URL was given), `photo` (truthy → uses `assets/<slug>.src.png`), `qr` (`""` →
the card's own URL = `baseUrl` + `/` + `slug` + `urlSuffix`).

## Rules

- Edit only `data/employees.json`, `assets/*`, and (for design) `build.mjs`.
- `slug` unique and stable; the QR encodes `baseUrl/<slug><urlSuffix>`.
- Always rebuild; the build self-verifies the QR — do not ship if it fails.
- The Webflow embed is one self-contained `<iframe srcdoc>` with the photo inlined as
  WebP and an auto-height postMessage script. Keep it under 50 000 characters.
- No Read/Write/Edit/Glob in this project — PowerShell/Bash/node only.
