const statusEl = document.querySelector("#status");
const rangeControlEl = document.querySelector("#rangeControl");
const rangeLabelEl = document.querySelector("#rangeLabel");
const startRangeEl = document.querySelector("#startRange");
const endRangeEl = document.querySelector("#endRange");
const resetRangeEl = document.querySelector("#resetRange");
const totalsEl = document.querySelector("#totals");
const plotterEl = document.querySelector("#plotter");
const plotSummaryEl = document.querySelector("#plotSummary");
const plotFieldEl = document.querySelector("#plotField");
const plotQueryEl = document.querySelector("#plotQuery");
const matchPlotEl = document.querySelector("#matchPlot");
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

let allRows = [];
let dates = [];

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

function parseDate(value) {
  const [day, month, year] = String(value).split(".").map(Number);
  if (!day || !month || !year) return NaN;
  return new Date(year, month - 1, day).getTime();
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

function dateText(time) {
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(time));
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
    const amount = row._amount;
    const key = row._month;
    if (!Number.isFinite(amount) || amount === 0 || !key) continue;

    if (!months.has(key)) months.set(key, { income: new Map(), expenses: new Map() });
    const month = months.get(key);
    const category = (row.Category ?? "").trim() || "Uncategorized";

    if (amount > 0) add(month.income, category, amount, row);
    if (amount < 0) add(month.expenses, category, Math.abs(amount), row);
  }

  return [...months.entries()].sort(([a], [b]) => b.localeCompare(a));
}

function prepareRows(rows) {
  return rows
    .map((row) => {
      const amount = parseAmount(row.Amount);
      const time = parseDate(row["Transaction date"]);
      return {
        ...row,
        _amount: amount,
        _time: time,
        _month: monthKey(row["Transaction date"]),
      };
    })
    .filter((row) => Number.isFinite(row._amount) && Number.isFinite(row._time))
    .sort((a, b) => a._time - b._time);
}

function selectedRange() {
  const start = Math.min(Number(startRangeEl.value), Number(endRangeEl.value));
  const end = Math.max(Number(startRangeEl.value), Number(endRangeEl.value));
  return { start, end };
}

function updateRangeUI() {
  if (!dates.length) return;
  const { start, end } = selectedRange();
  startRangeEl.value = start;
  endRangeEl.value = end;
  startRangeEl.style.zIndex = start === end ? 2 : 1;
  endRangeEl.style.zIndex = 2;

  const max = dates.length - 1;
  const left = max ? (start / max) * 100 : 0;
  const right = max ? (end / max) * 100 : 100;
  rangeControlEl.style.setProperty("--range-left", `${left}%`);
  rangeControlEl.style.setProperty("--range-right", `${right}%`);
  rangeLabelEl.textContent = `${dateText(dates[start])} to ${dateText(dates[end])}`;
}

function filteredRows() {
  if (!dates.length) return [];
  const { start, end } = selectedRange();
  const startTime = dates[start];
  const endTime = dates[end];
  return allRows.filter((row) => row._time >= startTime && row._time <= endTime);
}

function loadRows(rows) {
  allRows = prepareRows(rows);
  dates = [...new Set(allRows.map((row) => row._time))];

  if (!dates.length) {
    statusEl.textContent = "No valid transactions found.";
    rangeControlEl.hidden = true;
    totalsEl.hidden = true;
    monthsEl.textContent = "";
    return;
  }

  startRangeEl.min = "0";
  endRangeEl.min = "0";
  startRangeEl.max = String(dates.length - 1);
  endRangeEl.max = String(dates.length - 1);
  startRangeEl.value = "0";
  endRangeEl.value = String(dates.length - 1);
  rangeControlEl.hidden = false;
  render();
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

function showSingleTransaction(row) {
  const amount = Math.abs(row._amount);
  const direction = row._amount >= 0 ? "Income" : "Expense";
  detailsBodyEl.innerHTML = `
    <h3>${escapeHTML(direction)} / ${escapeHTML(row.Category || "Uncategorized")}</h3>
    <p>${money(amount)} · ${escapeHTML(row["Transaction date"])}</p>
    <ul class="tx-list">
      <li>
        <span class="tx-date">${escapeHTML(row["Transaction date"])}</span>
        <span>
          <span class="tx-desc">${escapeHTML(row.Description)}</span>
          <span class="tx-cat">${escapeHTML(row.Category || "Uncategorized")}</span>
        </span>
        <span class="tx-amount">${money(amount)}</span>
      </li>
    </ul>
  `;
  detailsEl.classList.add("open");
  detailsEl.setAttribute("aria-hidden", "false");
  scrimEl.hidden = false;
}

function renderMatcher(rows) {
  plotterEl.hidden = false;
  const query = plotQueryEl.value.trim().toLowerCase();
  const field = plotFieldEl.value;

  if (!query) {
    plotSummaryEl.textContent = "Type to search transactions";
    matchPlotEl.innerHTML = `<div class="match-empty">Search a field, for example Description contains tennisclub.</div>`;
    return;
  }

  const matches = rows
    .filter((row) => String(row[field] ?? "").toLowerCase().includes(query))
    .sort((a, b) => a._time - b._time);

  if (!matches.length) {
    plotSummaryEl.textContent = `No matches for "${plotQueryEl.value}"`;
    matchPlotEl.innerHTML = `<div class="match-empty">No transactions match this search in the selected period.</div>`;
    return;
  }

  const total = matches.reduce((sum, row) => sum + Math.abs(row._amount), 0);
  const incomeCount = matches.filter((row) => row._amount > 0).length;
  const expenseCount = matches.filter((row) => row._amount < 0).length;
  plotSummaryEl.textContent = `${matches.length} matches · ${money(total)} total size · ${incomeCount} in / ${expenseCount} out`;

  const width = 980;
  const height = 300;
  const pad = { top: 22, right: 28, bottom: 42, left: 74 };
  const { start, end } = selectedRange();
  const startTime = dates[start];
  const endTime = dates[end];
  const minTime = startTime === endTime ? startTime - 43200000 : startTime;
  const maxTime = startTime === endTime ? endTime + 43200000 : endTime;
  const maxAmount = Math.max(...matches.map((row) => Math.abs(row._amount)), 1);
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const x = (time) => pad.left + ((time - minTime) / (maxTime - minTime)) * plotWidth;
  const y = (amount) => pad.top + plotHeight - (Math.abs(amount) / maxAmount) * plotHeight;
  const yMid = Math.ceil(maxAmount / 2);

  matchPlotEl.innerHTML = `
    <svg class="scatter" viewBox="0 0 ${width} ${height}" role="img" aria-label="Matched transactions over time">
      <line class="grid" x1="${pad.left}" y1="${y(yMid)}" x2="${width - pad.right}" y2="${y(yMid)}"></line>
      <line class="axis" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}"></line>
      <line class="axis" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}"></line>
      <text class="axis-label" x="${pad.left}" y="${height - 12}">${escapeHTML(dateText(startTime))}</text>
      <text class="axis-label" x="${width - pad.right}" y="${height - 12}" text-anchor="end">${escapeHTML(dateText(endTime))}</text>
      <text class="axis-label" x="10" y="${y(maxAmount) + 4}">${escapeHTML(money(maxAmount))}</text>
      <text class="axis-label" x="10" y="${y(yMid) + 4}">${escapeHTML(money(yMid))}</text>
      <text class="axis-label" x="10" y="${height - pad.bottom + 4}">${escapeHTML(money(0))}</text>
    </svg>
  `;

  const svg = matchPlotEl.querySelector("svg");
  for (const row of matches) {
    const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    point.classList.add("plot-point");
    point.setAttribute("cx", x(row._time));
    point.setAttribute("cy", y(row._amount));
    point.setAttribute("r", "7");
    point.setAttribute("tabindex", "0");
    point.setAttribute("fill", row._amount >= 0 ? "var(--income)" : "var(--expense)");
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${row["Transaction date"]} · ${row.Description} · ${money(Math.abs(row._amount))}`;
    point.append(title);
    point.addEventListener("click", () => showSingleTransaction(row));
    point.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showSingleTransaction(row);
      }
    });
    svg.append(point);
  }
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

function render() {
  closeDetails();
  updateRangeUI();
  const rows = filteredRows();
  const months = aggregate(rows);
  monthsEl.textContent = "";
  statusEl.textContent = `${rows.length.toLocaleString()} of ${allRows.length.toLocaleString()} rows shown. Positive amounts are income. Negative amounts are expenses.`;

  let totalIncome = 0;
  let totalExpenses = 0;
  for (const [, values] of months) {
    totalIncome += [...values.income.values()].reduce((sum, item) => sum + item.amount, 0);
    totalExpenses += [...values.expenses.values()].reduce((sum, item) => sum + item.amount, 0);
  }
  const net = totalIncome - totalExpenses;
  totalsEl.hidden = false;
  totalsEl.innerHTML = `
    <div class="total"><span>Total in</span><strong>${money(totalIncome)}</strong></div>
    <div class="total"><span>Total out</span><strong>${money(totalExpenses)}</strong></div>
    <div class="total ${net >= 0 ? "net-positive" : "net-negative"}"><span>Difference</span><strong>${money(net)}</strong></div>
  `;
  renderMatcher(rows);

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
    loadRows(parseCSV(await response.text()));
  } catch {
    statusEl.textContent = "Open through a local server, or load the CSV manually.";
  }
}

fileEl.addEventListener("change", async () => {
  const file = fileEl.files[0];
  if (file) loadRows(parseCSV(await file.text()));
});

startRangeEl.addEventListener("input", () => {
  if (Number(startRangeEl.value) > Number(endRangeEl.value)) endRangeEl.value = startRangeEl.value;
  render();
});

endRangeEl.addEventListener("input", () => {
  if (Number(endRangeEl.value) < Number(startRangeEl.value)) startRangeEl.value = endRangeEl.value;
  render();
});

resetRangeEl.addEventListener("click", () => {
  startRangeEl.value = "0";
  endRangeEl.value = String(dates.length - 1);
  render();
});

plotFieldEl.addEventListener("change", render);
plotQueryEl.addEventListener("input", render);

closeDetailsEl.addEventListener("click", closeDetails);
scrimEl.addEventListener("click", closeDetails);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDetails();
});

loadDefault();
