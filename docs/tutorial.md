# Analyze Sales History with Select AI Analyzer

Find which products sold the most by amount, check the rows behind the answer, and save the result to a dashboard. You can ask the question in plain language.

## What you need

Sign in to a configured Select AI Analyzer instance with your application account. This exercise uses the [Sales History demo](../data/README.md) and assumes the `SH_DEMO.SALES` table is registered. If you need to set up the application or load the demo, use the [deployment guide](../terraform/README.md).

## Ask a question and check the result

1. Open **Data Source** in the sidebar. Find the `SALES` table under the Oracle schema `SH_DEMO`. Use **View rows** to see sample records. `PROD_ID` identifies each product, and `AMOUNT_SOLD` is the amount for a sale.
2. Select **New chat**. Enter the following question and select **Send**.

   > In SH_DEMO.SALES, what is the total AMOUNT_SOLD for each PROD_ID? Show the five products with the highest totals, sorted from highest to lowest.

3. Read the answer and select **SQL** below it. **Generated SQL** shows the query the app sent to Oracle and the result table. With the unmodified demo data, expect five products. The first row should be product `10` with a total of `4,797.00`. Compare the result table with the chart when one is available. Check that the query adds sale amounts and groups them by product.
4. Ask a follow-up in the same chat if you want a narrower result, such as totals for a specific month. Name the dates and the table so the query reflects the scope you intend.

## Save the result to a dashboard

Select **Add visualization** on the result table or chart. Choose **New dashboard** and then **Next**. Enter a name, choose **Private**, and select **Add**. In **Visualization list**, select **Generate dashboard** to save and open it. You can also choose **Existing dashboard** that you own and finish with **Add to dashboard**. A **Shared** dashboard is visible to other signed-in users.

## If the table is missing

With an Oracle table that your team has approved for use in Select AI, open **Data Source**, select the **Object** button, and pick **Existing table**. Choose the **Owner** and **Table**, then select **Register Table**. The owner is the Oracle schema that contains the table. You can also use **CSV file** in the same dialog to import a file into a schema you can use. Registered sources can be queried by other signed-in users, so use approved or sample data.

## How the solution runs this example

1. **Analytics** sends the question to `POST /api/analytics/ask`. The backend selects active registered objects using the names and intent in the question. The Select AI profile limits generation to those objects. [Source matching](../apps/backend/app/select_ai/scoped_profile_operations.py)
2. Oracle Select AI generates SQL. The backend checks that it is read-only, runs it in Oracle, and returns rows, a written answer, and a chart specification when it can infer one. The default request returns up to 500 rows. [Query execution](../apps/backend/app/select_ai/select_ai_ask.py) · [API route](../apps/backend/app/api/routes/analytics.py)
3. Saving the visualization stores the query and chart configuration in a dashboard. When opened later, the dashboard runs the saved read-only query again, so totals can reflect changed data. [Dashboard queries](../apps/backend/app/select_ai/dashboard_queries.py)

Use this read-only query as a reference for the expected totals. The generated SQL can express the same aggregation differently.

```sql
SELECT prod_id, SUM(amount_sold) AS total_amount
FROM sh_demo.sales
GROUP BY prod_id
ORDER BY total_amount DESC, prod_id
FETCH FIRST 5 ROWS ONLY;
```

[Sales History data](../data/sh_demo/data/SALES.csv) · [Architecture](architecture.md) · [Testing](testing.md)
