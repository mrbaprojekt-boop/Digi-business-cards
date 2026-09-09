# CDR Digital Business Cards

One shareable web page per employee, styled after the printed CDR card:
CDR logo, lime accent, tappable contacts (call / email / website), address, a QR code,
and two buttons:

- **Save contact** — downloads a `.vcf`; the phone offers to add the person to Contacts.
- **Share** — native share sheet on mobile, or copies the link on desktop.

Everything is generated from a single JSON file. No build tools, no framework — just Node.

---

## 1. Project layout

```
Digi-business-cards/
├── data/employees.json   ← YOU EDIT THIS (the only source of data)
├── build.mjs             ← generator (do not edit unless changing design)
├── serve.mjs             ← local preview server
├── package.json          ← npm scripts
├── docs/                 ← GENERATED output — published by GitHub Pages
│   ├── index.html            list of all cards
│   ├── <slug>.html           one employee card
│   └── <slug>.vcf            one contact file
└── README.md
```

`docs/` is rebuilt from scratch on every build — never edit it by hand.

---

## 2. Requirements

- [Node.js](https://nodejs.org) 18 or newer. Check with `node --version`.
- That's it.

---

## 3. Edit the data

Open **`data/employees.json`** in any text editor.

### Company block (applies to every card)

```json
"company": {
  "name": "CDR",
  "tagline": "Creative | Development | Research",
  "unit": "GPU & GSE Equipment",
  "website": "https://cdr.ee",
  "websiteLabel": "cdr.ee",
  "baseUrl": "https://mrbaprojekt-boop.github.io/Digi-business-cards",
  "address": {
    "street": "Taevavärava tee 6b-24",
    "locality": "Lehmja küla, Rae vald",
    "postalCode": "75306",
    "country": "Estonia"
  }
}
```

`baseUrl` is the address where the cards are published. The QR code and the Share
button are built from it. **If you move the site, update `baseUrl` and rebuild.**

### Add an employee

Add another object to the `employees` array (comma between objects, none after the last):

```json
"employees": [
  {
    "slug": "elmahdi-lamine",
    "firstName": "Elmahdi",
    "lastName": "Lamine",
    "title": "CEO",
    "phone": "+372 555 121 47",
    "email": "el@cdr.ee",
    "linkedin": "",
    "photo": "",
    "qr": ""
  },
  {
    "slug": "anna-tamm",
    "firstName": "Anna",
    "lastName": "Tamm",
    "title": "Sales Manager",
    "phone": "+372 5555 0000",
    "email": "anna@cdr.ee",
    "linkedin": "https://www.linkedin.com/in/annatamm",
    "photo": "",
    "qr": ""
  }
]
```

| Field | Meaning | If left `""` |
|---|---|---|
| `slug` | file name → `anna-tamm.html`, `anna-tamm.vcf`. Latin letters, digits, dashes, no spaces | auto-generated from first + last name |
| `firstName`, `lastName` | name | — |
| `title` | job title | row hidden |
| `phone` | phone, any readable format | row hidden |
| `email` | work email | row hidden |
| `linkedin` | full profile URL | row hidden |
| `qr` | where the QR code points | points to the card itself |
| `photo` | reserved, not used yet | — |

### Change an employee

Edit the values in their object. **Do not change `slug`** for someone who already has
cards printed / links shared — the QR codes point at `<slug>.html`.

### Remove an employee

Delete their object (and the stray comma). After the next build their files disappear from `docs/`.

---

## 4. Build

From the project folder:

```bash
npm run build
# or:  node build.mjs
```

Output:

```
OK  elmahdi-lamine.html  +  elmahdi-lamine.vcf
OK  anna-tamm.html  +  anna-tamm.vcf
OK  index.html

Done: 2 card(s) in docs/
```

---

## 5. Preview on localhost

```bash
npm run serve
# or:  node serve.mjs
```

Then open:

- All cards:      <http://localhost:8080/>
- One card:       <http://localhost:8080/elmahdi-lamine.html>

`npm start` does both — build, then serve.

To preview on your phone while it runs: make sure the phone is on the same Wi-Fi, find
your computer's local IP (e.g. `192.168.1.20`) and open `http://192.168.1.20:8080/`.

---

## 6. Publish (GitHub Pages)

The repo is already set up so that the `docs/` folder is the website.

1. Push to GitHub (see below).
2. On GitHub: **Settings → Pages**.
3. **Build and deployment → Source: Deploy from a branch.**
4. **Branch: `main`, folder: `/docs`.** Save.
5. Wait ~1 minute. The site goes live at:

   ```
   https://mrbaprojekt-boop.github.io/Digi-business-cards/
   ```

Every time you change data, run `npm run build`, then commit and push `docs/`:

```bash
npm run build
git add -A
git commit -m "Update cards"
git push
```

GitHub Pages redeploys automatically within a minute.

> Prefer a nicer URL like `cards.cdr.ee`? Add a `CNAME` record at your DNS provider
> pointing to `mrbaprojekt-boop.github.io`, set the custom domain in Settings → Pages,
> then change `baseUrl` in `data/employees.json` to `https://cards.cdr.ee` and rebuild.

---

## 7. How employees actually use the card

Each person has three things: a **URL**, a **QR code** (shown on their own card page),
and a **`.vcf`** contact file.

**Give each employee their link**, e.g. `https://mrbaprojekt-boop.github.io/Digi-business-cards/elmahdi-lamine.html`

Ways to hand it to a contact:

| Situation | What to do |
|---|---|
| Email signature | Add a line: `Digital card: <link>` — or paste the QR image and hyperlink it |
| In person | Open your own card page on your phone, let the other person scan the on-screen QR |
| Chat / WhatsApp / LinkedIn message | Tap **Share** on your card page, or just paste the link |
| Printed materials, badges, slide decks | Screenshot / save the QR from your card page and place it there |
| Someone wants your contact saved | Send them the link; they tap **Save contact** to import the `.vcf` |

Tip for the employee: open the link on the phone once and **Add to Home Screen** —
it then behaves like an app icon that opens the card instantly.

---

## 8. Restyle

Colors and fonts: the `THEME` object at the top of `build.mjs`.
Card layout: the `cardHTML()` function in `build.mjs`.
Rebuild after any change.

---

## 9. Working with Claude Code

Ask in plain language and the `business-card` skill handles it:

- "add employee Anna Tamm, Sales Manager, +372 5555 0000, anna@cdr.ee"
- "remove John Doe"
- "change the company address to ..."
- "make the accent color blue"
- "rebuild the cards"

The skill edits `data/employees.json`, runs the build, and reports what changed.
