"""Verify the selected demo fixtures and starter questions through the Analyzer API."""

import json
import re
import sys
from contextlib import closing
from http.client import HTTPConnection, HTTPException
from urllib.parse import quote

from scripts.load_demo_data import demo_questions, selected_demo_entries


DEMO_QUERIES = {
    "SH_DEMO": (
        "SALES",
        "In SH_DEMO.SALES, what is the total AMOUNT_SOLD for each PROD_ID? "
        "Show the five products with the highest totals, sorted from highest to lowest.",
    ),
    "FLEXCUBE_DEMO": (
        "FLEX_ACTB_ACCBAL_HISTORY",
        "How many historical account balance records are there for each ACC_CCY in "
        "FLEXCUBE_DEMO.FLEX_ACTB_ACCBAL_HISTORY? Return the currency and number of records by currency.",
    ),
}
CURRENCY_COUNTS = {"BRL": 456, "EUR": 456, "PEN": 456, "USD": 457}


class DemoCheckError(RuntimeError):
    pass


def request_json(method, path, token, payload=None, *, timeout=150):
    headers = {"Authorization": f"Bearer {token}"}
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode("utf-8")
    with closing(HTTPConnection("127.0.0.1", 8012, timeout=timeout)) as connection:
        connection.request(method, f"/api{path}", body=body, headers=headers)
        with connection.getresponse() as response:
            if response.status != 200:
                codes = dict.fromkeys(re.findall(rb"\b(?:ORA|DPI|DPY)-[0-9]{4,5}\b", response.read(4096)))
                detail = ", ".join(code.decode("ascii") for code in codes)
                raise DemoCheckError(f"Analyzer API returned HTTP {response.status}" + (f" ({detail})" if detail else ""))
            data = json.load(response)
            if not isinstance(data, dict):
                raise DemoCheckError("Analyzer API returned an invalid response")
            return data


def expected_result(schema, table, result):
    scope = next((step.get("objects", []) for step in result.get("agent_trace", [])
                  if step.get("stage") == "select_ai.scope_profile"), [])
    rows = result.get("rows", [])
    if (
        {"owner": schema, "name": table} not in scope
        or not re.search(r"\b" + table + r"\b", result.get("sql", ""), re.IGNORECASE)
        or not rows
    ):
        return False
    if schema == "SH_DEMO":
        return len(rows) == 5 and {10, 4797}.issubset(row_numbers(rows[0]))

    if len(rows) != len(CURRENCY_COUNTS):
        return False
    actual = {}
    for row in rows:
        currency = next((value for value in row.values() if isinstance(value, str) and value in CURRENCY_COUNTS), None)
        numbers = row_numbers(row)
        if currency is None or len(numbers) != 1:
            return False
        actual[currency] = numbers.pop()
    return actual == CURRENCY_COUNTS


def row_numbers(row):
    numbers = set()
    for value in row.values():
        if isinstance(value, (int, float, str)) and not isinstance(value, bool):
            try:
                numbers.add(float(value))
            except ValueError:
                pass
    return numbers


def verify(schemas, token):
    for schema in schemas:
        table, question = DEMO_QUERIES[schema]
        try:
            response = request_json("POST", "/analytics/ask", token, {"question": question, "max_rows": 15})
            conversation = response.get("conversation_id", "")
            try:
                if not expected_result(schema, table, response):
                    raise DemoCheckError("Analytics results did not match the packaged demo")
            finally:
                if isinstance(conversation, str) and re.fullmatch(r"[A-Za-z0-9_$#-]{1,128}", conversation):
                    try:
                        request_json("DELETE", f"/analytics/conversations/{quote(conversation, safe='')}", token, timeout=10)
                    except (DemoCheckError, OSError, HTTPException, ValueError):
                        print(f"Could not remove the temporary {schema} acceptance conversation.", file=sys.stderr)
        except DemoCheckError as exc:
            raise DemoCheckError(f"{schema} query verification failed: {exc}") from None
        except (OSError, HTTPException, ValueError, AttributeError, TypeError):
            raise DemoCheckError(f"{schema} query verification failed: Analytics response could not be read") from None
        print(f"{schema} Select AI query verified.")


def verify_starter_questions(schemas, token):
    if not schemas:
        return
    try:
        expected = [
            question
            for entry in selected_demo_entries(",".join(schemas))
            for question in demo_questions(entry)
        ]
        payload = request_json("GET", "/settings/public", token, timeout=10)
    except DemoCheckError as exc:
        raise DemoCheckError(f"Starter questions verification failed: {exc}") from None
    except (OSError, HTTPException, ValueError):
        raise DemoCheckError("Starter questions verification failed: could not read the application or packaged catalog") from None
    if payload.get("suggested_questions") != {"items": expected}:
        raise DemoCheckError("Starter questions verification failed: the application did not return the catalog for the selected demos")
    print("Packaged demo starter questions verified.")


def main():
    try:
        inputs = json.load(sys.stdin)
        token = inputs["token"]
        schemas = inputs["schemas"]
        if not isinstance(token, str) or not re.fullmatch(r"[A-Za-z0-9_.-]+", token):
            raise ValueError
        if not isinstance(schemas, list) or any(not isinstance(schema, str) or schema not in DEMO_QUERIES for schema in schemas):
            raise ValueError
    except (KeyError, ValueError, TypeError):
        print("Invalid demo query verification inputs.", file=sys.stderr)
        return 1
    try:
        verify_starter_questions(schemas, token)
        verify(schemas, token)
    except DemoCheckError as exc:
        print(exc, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
