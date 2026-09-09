---
name: business-card
description: Generates CDR employee digital business cards from digital-business-cards/data/employees.json — one HTML page and one .vcf contact per person, plus a shared index.html. Handles adding/editing/removing an employee, changing company-wide data (address, website, unit), and restyling (colors, fonts). Use when asked to add/edit/remove an employee card, update company info on the cards, restyle the cards, or "rebuild the cards".
---

# business-card — CDR digital business cards

Project folder: `digital-business-cards/`

```
digital-business-cards/
  data/employees.json   ← the ONLY source of data
  build.mjs             ← generator (Node, no dependencies) — output goes to docs/
  serve.mjs             ← local preview server (http://localhost:8080)
  docs/                 ← GENERATED output, rebuilt every run; also what GitHub Pages serves — never hand-edit
  README.md             ← user-facing instructions
```

## ⚠️ This workspace path contains a non-breaking space (U+00A0)

The working directory is `module 5 Создание продуктов с нуля`, where the space before
«нуля» is U+00A0. Because of that:

- **The Read / Write / Edit / Glob tools do not work here** — they silently miss the real
  folder and can create a ghost folder with a normal space. **Do not use them for this project.**
- Use **PowerShell / Bash / node** only.
- In PowerShell, never type the Cyrillic path — derive it from `$PWD.Path` + `Join-Path`.
- Call node by a relative ASCII path: `node "digital-business-cards/build.mjs"`.

## Workflow

1. Understand the request: add / edit / remove an employee, change company data, or restyle.

2. **Read the data:**
   ```powershell
   Get-Content -Raw -LiteralPath (Join-Path $PWD.Path "digital-business-cards\data\employees.json")
   ```

3. **Write the data.** Build the full updated JSON and write it whole:
   ```powershell
   $json = @'
   { ...the entire updated employees.json... }
   '@
   Set-Content -LiteralPath (Join-Path $PWD.Path "digital-business-cards\data\employees.json") -Value $json -Encoding utf8
   ```
   Change only what was asked, but the file has to be rewritten in full.
   Design (colors/fonts): the `THEME` object and `cardHTML()` in `digital-business-cards/build.mjs`,
   read/written the same way through PowerShell.

4. **Rebuild:**
   ```powershell
   node "digital-business-cards/build.mjs"
   ```
   Expected: `OK <slug>.html + <slug>.vcf` per person, then `Done: N card(s) in docs/`.

5. **Verify and report:**
   ```powershell
   Get-ChildItem (Join-Path $PWD.Path "digital-business-cards\docs") | Select Name
   ```
   Tell the user who was affected and which files in `docs/` changed. Remind them to
   `git add -A && git commit && git push` so GitHub Pages redeploys.

### Visual check (optional / when restyling)

`file://` is blocked in the browser — run the preview server, then drive Playwright:
```powershell
Start-Process node -ArgumentList "digital-business-cards/serve.mjs" -WindowStyle Hidden
```
Then `mcp__playwright__browser_navigate` to `http://localhost:8080/<slug>.html`, screenshot,
and when done: `Get-Process node | Stop-Process -Force`.

## employees.json schema

```jsonc
{
  "company": {
    "name": "CDR",
    "tagline": "Creative | Development | Research",
    "unit": "GPU & GSE Equipment",       // badge under the tagline; "" removes it
    "website": "https://cdr.ee",
    "websiteLabel": "cdr.ee",            // how the link is shown
    "baseUrl": "https://mrbaprojekt-boop.github.io/Digi-business-cards", // where cards are published; QR + Share derive from it. "" → QR points to the file itself
    "address": { "street": "...", "locality": "...", "postalCode": "...", "country": "..." }
  },
  "employees": [
    {
      "slug": "elmahdi-lamine",   // file names <slug>.html / <slug>.vcf. Latin, no spaces. Omit → generated from name
      "firstName": "Elmahdi",
      "lastName": "Lamine",
      "title": "CEO",
      "phone": "+372 555 121 47",
      "email": "el@cdr.ee",
      "linkedin": "",              // full URL or "" (row shown only when filled)
      "photo": "",                 // reserved
      "qr": ""                     // "" → QR to baseUrl/<slug>.html; otherwise any URL (Calendly, etc.)
    }
  ]
}
```

## Rules

- Only edit `data/employees.json` and (for design) `build.mjs`. `docs/` is generated.
- Do not change an existing person's `slug` without reason — external links and QR codes depend on it.
- `slug` is unique; a duplicate is skipped with a warning during build.
- Always rebuild after any edit and confirm the build had no errors.
- No Read/Write/Edit/Glob — PowerShell/Bash/node only (see the ⚠️ block above).

## Quick recipes

- **Add an employee** — new object in `employees`, rebuild.
- **Employee left** — remove the object from `employees`, rebuild (their files leave `docs/`).
- **Company address/website/unit changed** — edit `company`, rebuild (all cards update).
- **Different accent color / font** — `THEME` in `build.mjs`, rebuild, show a screenshot.
