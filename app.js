const statusEl = document.querySelector("#status");
const monthsEl = document.querySelector("#months");
const fileEl = document.querySelector("#file");
const detailsEl = document.querySelector("#details");
const detailsBodyEl = document.querySelector("#detailsBody");
const closeDetailsEl = document.querySelector("#closeDetails");
const scrimEl = document.querySelector("#scrim");

const colors = [
  "#0ead69",
  "#e71d36",
  "#118ab2",
  "#ff9f1c",
  "#2ec4b6",
  "#ef476f",
  "#3a86ff",
  "#8ac926",
  "#ff595e",
  "#43aa8b",
  "#6d6875",
];

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);

  const headers = rows.shift().map((header) => header.trim());
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function parseAmount(value) {
  return Number(String(value).trim().replace(/[',\s]/g, ""));
}

function monthKey(date) {
  const [day, month, year] = date.split(".");
  if (!day || !month || !year) return "";
  return `${year}-${month.padStart(2, "0")}`;
}

function monthName(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1).toLocaleString("en", { month: "long", year: "numeric" });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[ch]));
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(value);
}

function add(map, key, value, row) {
  const item = map.get(key) ?? { amount: 0, transactions: [] };
  item.amount += value;
  item.transactions.push({
    date: row["Transaction date"],
    description: row.Description,
    category: key,
    amount: value,
  });
  map.set(key, item);
}

function colorFor(category) {
  if (category === "Other") return "#8d99ae";
  let hash = 0;
  for (const ch of category) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}

function topCategories(map) {
  const sorted = [...map.entries()]
    .map(([category, item]) => ({
      category,
      amount: item.amount,
      transactions: item.transactions,
    }))
    .sort((a, b) => b.amount - a.amount);
  const top = sorted.slice(0, 10);
  const other = sorted.slice(10);
  const otherAmount = other.reduce((sum, item) => sum + item.amount, 0);
  const otherTransactions = other.flatMap((item) => item.transactions);
  if (otherAmount > 0) {
    top.push({ category: "Other", amount: otherAmount, transactions: otherTransactions });
  }
  return top;
}

function aggregate(rows) {
  const months = new Map();

  for (const row of rows) {
    const amount = parseAmount(row.Amount);
    const key = monthKey(row["Transaction date"]);
    if (!Number.isFinite(amount) || amount === 0 || !key) continue;

    if (!months.has(key)) months.set(key, { income: new Map(), expenses: new Map() });
    const month = months.get(key);
    const category = (row.Category ?? "").trim() || "Uncategorized";

    if (amount > 0) add(month.income, category, amount, row);
    if (amount < 0) add(month.expenses, category, Math.abs(amount), row);
  }

  return [...months.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function showTransactions(month, title, segment, total) {
  const transactions = [...segment.transactions].sort((a, b) => b.amount - a.amount);
  const percent = total ? Math.round((segment.amount / total) * 100) : 0;
  detailsBodyEl.innerHTML = `
    <h3>${escapeHTML(month)} / ${escapeHTML(title)} / ${escapeHTML(segment.category)}</h3>
    <p>${money(segment.amount)} · ${percent}% · ${transactions.length} transactions</p>
    <ul class="tx-list">
      ${transactions.map((tx) => `
        <li>
          <span class="tx-date">${escapeHTML(tx.date)}</span>
          <span>
            <span class="tx-desc">${escapeHTML(tx.description)}</span>
            <span class="tx-cat">${escapeHTML(tx.category)}</span>
          </span>
          <span class="tx-amount">${money(tx.amount)}</span>
        </li>
      `).join("")}
    </ul>
  `;
  detailsEl.classList.add("open");
  detailsEl.setAttribute("aria-hidden", "false");
  scrimEl.hidden = false;
}

function closeDetails() {
  detailsEl.classList.remove("open");
  detailsEl.setAttribute("aria-hidden", "true");
  scrimEl.hidden = true;
}

function renderPlot(month, title, segments) {
  const total = segments.reduce((sum, segment) => sum + segment.amount, 0);
  const root = document.createElement("div");
  root.className = "plot";

  root.innerHTML = `
    <div class="plot-head">
      <span>${title}</span>
      <span>${money(total)}</span>
    </div>
  `;

  if (!total) {
    root.insertAdjacentHTML("beforeend", `<div class="empty">No transactions</div>`);
    return root;
  }

  const bar = document.createElement("div");
  bar.className = "bar";
  for (const segment of segments) {
    const width = (segment.amount / total) * 100;
    const part = document.createElement("div");
    part.className = "segment";
    part.tabIndex = 0;
    part.style.flexBasis = `${width}%`;
    part.style.background = colorFor(segment.category);
    part.title = `${segment.category}: ${money(segment.amount)}`;
    part.innerHTML = width >= 9
      ? `<span class="segment-label">${escapeHTML(segment.category)}</span>`
      : "";
    part.addEventListener("click", () => showTransactions(month, title, segment, total));
    part.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") showTransactions(month, title, segment, total);
    });
    bar.append(part);
  }
  root.append(bar);

  const list = document.createElement("ul");
  list.className = "breakdown";
  for (const segment of segments) {
    const item = document.createElement("li");
    item.innerHTML = `
      <span class="swatch" style="background:${colorFor(segment.category)}"></span>
      <span class="cat">${escapeHTML(segment.category)}</span>
      <span>${money(segment.amount)}</span>
    `;
    item.addEventListener("click", () => showTransactions(month, title, segment, total));
    list.append(item);
  }
  root.append(list);
  return root;
}

function render(rows) {
  const months = aggregate(rows);
  monthsEl.textContent = "";
  statusEl.textContent = `${rows.length.toLocaleString()} rows parsed. Positive amounts are income. Negative amounts are expenses.`;

  for (const [key, values] of months) {
    const label = monthName(key);
    const income = topCategories(values.income);
    const expenses = topCategories(values.expenses);
    const incomeTotal = income.reduce((sum, item) => sum + item.amount, 0);
    const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);

    const section = document.createElement("section");
    section.className = "month";
    section.innerHTML = `
      <div class="month-head">
        <h2>${label}</h2>
        <span class="net">Net ${money(incomeTotal - expenseTotal)}</span>
      </div>
      <div class="plots"></div>
    `;
    const plots = section.querySelector(".plots");
    plots.append(renderPlot(label, "Income", income));
    plots.append(renderPlot(label, "Expenses", expenses));
    monthsEl.append(section);
  }
}

async function loadDefault() {
  try {
    const response = await fetch("transactions.csv");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(parseCSV(await response.text()));
  } catch {
    statusEl.textContent = "Open through a local server, or load the CSV manually.";
  }
}

fileEl.addEventListener("change", async () => {
  const file = fileEl.files[0];
  if (file) render(parseCSV(await file.text()));
});

closeDetailsEl.addEventListener("click", closeDetails);
scrimEl.addEventListener("click", closeDetails);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDetails();
});

loadDefault();
