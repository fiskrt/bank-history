# UBS Transaction Dashboard

Dashboard for bank transactions with following funcionality:

- Keyword search for transactions and see graph how the spending evolves
  - search `migros|coop|aldi` and you'll see a graph over some time period of spendings there
- See a breakdown of transactions for each month
- See total amount in/out.

## CSV Format

Export transactions as CSV from UBS (works both from ios app and website). The app expects these columns:

```csv
"Transaction date","Account or card number","Description","Income or expense","Amount","Currency","Category"
"16.04.2026","CH40 ...","STADT Z RICH ...","Expense","-131.00","CHF","Utilities"
"27.03.2026","CH40 ...","migros supermarket ...","Expense","30.00","CHF","Food"
```

Amounts may use Swiss thousands separators like `1'150.00`.

## Running locally

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765`, and load the CSV file manually.

## Programming

No build step or dependencies, just 3 simple files.
