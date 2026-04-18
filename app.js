const statusEl = document.querySelector("#status");
const rangeControlEl = document.querySelector("#rangeControl");
const rangeLabelEl = document.querySelector("#rangeLabel");
const startRangeEl = document.querySelector("#startRange");
const endRangeEl = document.querySelector("#endRange");
const resetRangeEl = document.querySelector("#resetRange");
const lastMonthRangeEl = document.querySelector("#lastMonthRange");
const lastSixMonthsRangeEl = document.querySelector("#lastSixMonthsRange");
const lastYearRangeEl = document.querySelector("#lastYearRange");
const totalsEl = document.querySelector("#totals");
const plotterEl = document.querySelector("#plotter");
const plotSummaryEl = document.querySelector("#plotSummary");
const plotFieldEl = document.querySelector("#plotField");
const plotQueryEl = document.querySelector("#plotQuery");
const plotAggregateEl = document.querySelector("#plotAggregate");
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

const exampleRows = [
  row("05.01.2026", "Example salary payment", "Income", "5'800.00", "Salary & pensions"),
  row("07.01.2026", "Migros grocery run", "Expense", "-86.40", "Groceries"),
  row("11.01.2026", "Coop city food", "Expense", "-42.15", "Groceries"),
  row("18.01.2026", "Tennisclub winter court", "Expense", "-210.00", "Sports"),
  row("24.01.2026", "Rent payment", "Expense", "-2'100.00", "Household"),
  row("03.02.2026", "Example salary payment", "Income", "5'800.00", "Salary & pensions"),
  row("06.02.2026", "SBB mobile ticket", "Expense", "-58.00", "Transportation"),
  row("10.02.2026", "Migros weekly shop", "Expense", "-112.70", "Groceries"),
  row("15.02.2026", "Tennisclub coaching", "Expense", "-160.00", "Sports"),
  row("22.02.2026", "Freelance refund", "Income", "420.00", "Other income"),
  row("04.03.2026", "Example salary payment", "Income", "5'800.00", "Salary & pensions"),
  row("08.03.2026", "Coop weekend groceries", "Expense", "-74.35", "Groceries"),
  row("12.03.2026", "Restaurant evening", "Expense", "-96.20", "Restaurants & bars"),
  row("19.03.2026", "Tennisclub membership", "Expense", "-320.00", "Sports"),
  row("27.03.2026", "Health insurance", "Expense", "-348.80", "Insurance"),
];

let allRows = [];
let dates = [];
let showingExample = true;

function row(date, description, type, amount, category) {
  return {
    "Transaction date": date,
    "Account or card number": "Example account",
    Description: description,
    "Income or expense": type,
    Amount: amount,
    Currency: "CHF",
    Category: category,
  };
}

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

function firstDateIndexOnOrAfter(time) {
  const index = dates.findIndex((date) => date >= time);
  return index === -1 ? dates.length - 1 : index;
}

function setRangeByDays(days) {
  if (!dates.length) return;
  const end = dates.length - 1;
  const startTime = dates[end] - days * 24 * 60 * 60 * 1000;
  startRangeEl.value = String(firstDateIndexOnOrAfter(startTime));
  endRangeEl.value = String(end);
  render();
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

function loadRows(rows, isExample = false) {
  showingExample = isExample;
  document.body.classList.toggle("example", isExample);
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

function openTransactionList(title, subtitle, rows) {
  const transactions = [...rows].sort((a, b) => Math.abs(b._amount) - Math.abs(a._amount));
  detailsBodyEl.innerHTML = `
    <h3>${escapeHTML(title)}</h3>
    <p>${escapeHTML(subtitle)} · ${transactions.length} transactions</p>
    <ul class="tx-list">
      ${transactions.map((row) => `
        <li>
          <span class="tx-date">${escapeHTML(row["Transaction date"])}</span>
          <span>
            <span class="tx-desc">${escapeHTML(row.Description)}</span>
            <span class="tx-cat">${escapeHTML(row.Category || "Uncategorized")}</span>
          </span>
          <span class="tx-amount">${money(Math.abs(row._amount))}</span>
        </li>
      `).join("")}
    </ul>
  `;
  detailsEl.classList.add("open");
  detailsEl.setAttribute("aria-hidden", "false");
  scrimEl.hidden = false;
}

function showSingleTransaction(row) {
  const direction = row._amount >= 0 ? "Income" : "Expense";
  openTransactionList(
    `${direction} / ${row.Category || "Uncategorized"}`,
    `${money(Math.abs(row._amount))} · ${row["Transaction date"]}`,
    [row],
  );
}

function periodKey(row, aggregate) {
  const date = new Date(row._time);
  if (aggregate === "month") {
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      time: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
      label: date.toLocaleString("en", { month: "long", year: "numeric" }),
    };
  }

  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  return {
    key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
    time: start.getTime(),
    label: `Week of ${dateText(start.getTime())}`,
  };
}

function plotPoints(matches, aggregate) {
  if (aggregate === "transaction") {
    return matches.map((row) => ({
      time: row._time,
      amount: Math.abs(row._amount),
      rows: [row],
      label: row["Transaction date"],
      fill: row._amount >= 0 ? "var(--income)" : "var(--expense)",
    }));
  }

  const buckets = new Map();
  for (const row of matches) {
    const period = periodKey(row, aggregate);
    const bucket = buckets.get(period.key) ?? { ...period, amount: 0, rows: [], timeSum: 0 };
    bucket.amount += Math.abs(row._amount);
    bucket.rows.push(row);
    bucket.timeSum += row._time;
    buckets.set(period.key, bucket);
  }

  return [...buckets.values()]
    .sort((a, b) => a.time - b.time)
    .map((bucket) => ({
      ...bucket,
      time: bucket.timeSum / bucket.rows.length,
      fill: "#118ab2",
    }));
}

function queryTerms(query) {
  return query.toLowerCase().split("|").map((term) => term.trim()).filter(Boolean);
}

function renderMatcher(rows) {
  plotterEl.hidden = false;
  const query = plotQueryEl.value.trim();
  const field = plotFieldEl.value;
  const aggregate = plotAggregateEl.value;
  const lineOn = aggregate !== "transaction";

  const terms = queryTerms(query);
  if (!terms.length) {
    plotSummaryEl.textContent = "Type to search transactions";
    matchPlotEl.hidden = true;
    matchPlotEl.innerHTML = "";
    return;
  }

  matchPlotEl.hidden = false;

  const matches = rows
    .filter((row) => {
      const value = String(row[field] ?? "").toLowerCase();
      return terms.some((term) => value.includes(term));
    })
    .sort((a, b) => a._time - b._time);

  if (!matches.length) {
    plotSummaryEl.textContent = `No matches for "${plotQueryEl.value}"`;
    matchPlotEl.innerHTML = `<div class="match-empty">No transactions match this search in the selected period.</div>`;
    return;
  }

  const total = matches.reduce((sum, row) => sum + Math.abs(row._amount), 0);
  const incomeCount = matches.filter((row) => row._amount > 0).length;
  const expenseCount = matches.filter((row) => row._amount < 0).length;
  const points = plotPoints(matches, aggregate);
  const mode = lineOn ? ` · ${points.length} ${aggregate} buckets` : ` · ${points.length} daily points`;
  plotSummaryEl.textContent = `${matches.length} matches${mode} · ${money(total)} total size · ${incomeCount} in / ${expenseCount} out`;

  const compact = window.matchMedia("(max-width: 760px)").matches;
  const width = compact ? 390 : 980;
  const height = compact ? 340 : 300;
  const pad = compact
    ? { top: 18, right: 8, bottom: 40, left: 8 }
    : { top: 22, right: 28, bottom: 42, left: 74 };
  const { start, end } = selectedRange();
  const startTime = dates[start];
  const endTime = dates[end];
  const minTime = startTime === endTime ? startTime - 43200000 : startTime;
  const maxTime = startTime === endTime ? endTime + 43200000 : endTime;
  const maxAmount = Math.max(...points.map((point) => point.amount), 1);
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const x = (time) => {
    const clamped = Math.min(Math.max(time, minTime), maxTime);
    return pad.left + ((clamped - minTime) / (maxTime - minTime)) * plotWidth;
  };
  const y = (amount) => pad.top + plotHeight - (Math.abs(amount) / maxAmount) * plotHeight;
  const yMid = Math.ceil(maxAmount / 2);
  const yLabels = compact
    ? `
      <text class="axis-label y-label" x="${pad.left + 6}" y="${y(maxAmount) + 14}">${escapeHTML(money(maxAmount))}</text>
      <text class="axis-label y-label" x="${pad.left + 6}" y="${y(yMid) - 6}">${escapeHTML(money(yMid))}</text>
      <text class="axis-label y-label" x="${pad.left + 6}" y="${height - pad.bottom - 7}">${escapeHTML(money(0))}</text>
    `
    : `
      <text class="axis-label" x="${pad.left - 8}" y="${y(maxAmount) + 4}" text-anchor="end">${escapeHTML(money(maxAmount))}</text>
      <text class="axis-label" x="${pad.left - 8}" y="${y(yMid) + 4}" text-anchor="end">${escapeHTML(money(yMid))}</text>
      <text class="axis-label" x="${pad.left - 8}" y="${height - pad.bottom + 4}" text-anchor="end">${escapeHTML(money(0))}</text>
    `;

  matchPlotEl.innerHTML = `
    <svg class="scatter" viewBox="0 0 ${width} ${height}" role="img" aria-label="Matched transactions over time">
      <line class="grid" x1="${pad.left}" y1="${y(yMid)}" x2="${width - pad.right}" y2="${y(yMid)}"></line>
      <line class="axis" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}"></line>
      <line class="axis" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}"></line>
      <text class="axis-label" x="${pad.left}" y="${height - 12}">${escapeHTML(dateText(startTime))}</text>
      <text class="axis-label" x="${width - pad.right}" y="${height - 12}" text-anchor="end">${escapeHTML(dateText(endTime))}</text>
      ${yLabels}
    </svg>
  `;

  const svg = matchPlotEl.querySelector("svg");
  if (lineOn && points.length > 1) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("plot-line");
    path.setAttribute("d", points.map((point, index) => {
      const cmd = index === 0 ? "M" : "L";
      return `${cmd}${x(point.time).toFixed(2)},${y(point.amount).toFixed(2)}`;
    }).join(" "));
    svg.append(path);
  }

  for (const pointData of points) {
    const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    point.classList.add("plot-point");
    point.setAttribute("cx", x(pointData.time));
    point.setAttribute("cy", y(pointData.amount));
    point.setAttribute("r", compact ? (pointData.rows.length > 1 ? "10" : "8") : (pointData.rows.length > 1 ? "8" : "7"));
    point.setAttribute("tabindex", "0");
    point.setAttribute("fill", pointData.fill);
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${pointData.label} · ${money(pointData.amount)} · ${pointData.rows.length} transactions`;
    point.append(title);
    point.addEventListener("click", () => {
      if (pointData.rows.length === 1) {
        showSingleTransaction(pointData.rows[0]);
      } else {
        openTransactionList(pointData.label, money(pointData.amount), pointData.rows);
      }
    });
    point.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (pointData.rows.length === 1) {
          showSingleTransaction(pointData.rows[0]);
        } else {
          openTransactionList(pointData.label, money(pointData.amount), pointData.rows);
        }
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
  statusEl.textContent = showingExample
    ? `${rows.length.toLocaleString()} example rows shown. Upload a UBS CSV to use your own transactions.`
    : `${rows.length.toLocaleString()} of ${allRows.length.toLocaleString()} rows shown. Positive amounts are income. Negative amounts are expenses.`;

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

function loadDefault() {
  loadRows(exampleRows, true);
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

lastMonthRangeEl.addEventListener("click", () => setRangeByDays(31));
lastSixMonthsRangeEl.addEventListener("click", () => setRangeByDays(183));
lastYearRangeEl.addEventListener("click", () => setRangeByDays(365));

plotFieldEl.addEventListener("change", render);
plotQueryEl.addEventListener("input", render);
plotAggregateEl.addEventListener("change", render);

closeDetailsEl.addEventListener("click", closeDetails);
scrimEl.addEventListener("click", closeDetails);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDetails();
});

loadDefault();
