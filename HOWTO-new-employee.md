# Добавить нового сотрудника

Общие данные компании (адрес, сайт, тэглайн, `GPU & GSE Equipment`, LinkedIn компании,
почта для квотации `info@cdr.ee`) подставляются **автоматически** — трогать их не нужно.
Меняется только блок конкретного человека.

---

## Быстрый путь — попросить Claude

Напиши в этом проекте:

> добавь сотрудника: Anna Tamm, Sales Manager, +372 5555 0000, anna@cdr.ee,
> LinkedIn https://www.linkedin.com/in/... (если есть),
> фото: C:\...\anna.png

Claude сделает всё: обрежет фото, добавит в данные, пересоберёт, запушит и даст
готовый Embed-код + ссылку.

---

## Вручную — 6 шагов

**Slug** — имя латиницей через дефис, без пробелов: `anna-tamm`. Это и адрес страницы,
и имя файлов. Менять потом нельзя (на него завязан QR).

### 1. Фото

Сохрани фото сотрудника (примерно квадратное, лицо в верхней части) как:

```
digital-business-cards\assets\anna-tamm.src.png
```

### 2. Данные

Открой `digital-business-cards\data\employees.json`. В массив `"employees": [ ... ]`
добавь блок (запятая между блоками, после последнего блока запятой нет):

```json
{
  "slug": "anna-tamm",
  "firstName": "Anna",
  "lastName": "Tamm",
  "title": "Sales Manager",
  "phone": "+372 5555 0000",
  "email": "anna@cdr.ee",
  "linkedin": "",
  "photo": "anna-tamm.webp",
  "qr": ""
}
```

- `linkedin` — личный профиль сотрудника, **только если есть точная ссылка**; иначе `""`
  (иконка «Profile» просто не появится). LinkedIn компании добавляется сам.
- `photo` — оставь `"anna-tamm.webp"` (файл создаст сборка из `.src.png`).
- `qr` — оставь `""` (QR сам укажет на страницу сотрудника).

### 3. Пересобрать

В папке `digital-business-cards`:

```
node build.mjs
```

Появятся `docs\anna-tamm.html`, `docs\anna-tamm.webp`, `docs\embed\anna-tamm.txt`.

### 4. Запушить (обязательно ДО Webflow)

Фото сотрудника грузится с GitHub Pages, поэтому его нужно сначала выложить:

```
git add -A
git commit -m "Add Anna Tamm"
git push
```

Подожди ~1 минуту (пока GitHub Pages обновится).

### 5. Webflow

1. Создай страницу с URL **ровно** `business-cards/anna-tamm`
   (родитель `business-cards`, slug `anna-tamm`).
2. Перетащи на неё элемент **HTML Embed**.
3. Открой `digital-business-cards\docs\embed\anna-tamm.txt`, выдели всё (Ctrl+A),
   скопируй, вставь в HTML Embed **целиком**. Это один блок: комментарий `<!-- -->`,
   строка `<link ... Bebas Neue>`, затем `<div id="cdrcard-...">…</div>`. Не режь его.
   Это НЕ iframe — карточка вставляется прямо в страницу, без внутренней прокрутки,
   высота всегда по содержимому.
4. **Publish**.

### 6. Готово

- Страница: `https://cdr.ee/business-cards/anna-tamm`
- QR на карточке ведёт туда же
- Кнопка «Save contact» кладёт в телефон полный контакт
- «Request a quotation» → меню: почта / Gmail / скопировать `info@cdr.ee`

---

## Изменить данные существующего сотрудника

Поправь его блок в `employees.json` (или замени `assets\<slug>.src.png` для нового
фото) → `node build.mjs` → `git push` → в Webflow заново вставь код из
`docs\embed\<slug>.txt` → Publish.

## Сотрудник уволился

Удали его блок из `employees.json` → `node build.mjs` → `git push`. В Webflow удали
или скрой его страницу.
