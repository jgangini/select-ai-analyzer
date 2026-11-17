from __future__ import annotations

from collections.abc import Callable


BRANCHES = [f"{i:03d}" for i in range(1, 26)]
CUSTOMERS = [f"CUST{i:06d}" for i in range(1, 801)]
ACCOUNTS = [f"{i:012d}" for i in range(100000000001, 100000001801)]
CURRENCIES = ["USD", "PEN", "EUR", "BRL"]
PRODUCTS = ["SAV1", "CURR", "LOAN", "TD01", "CARD", "CLRG"]
TRN_CODES = ["ATM", "DEP", "WDR", "TRF", "FEE", "INT", "REV", "PAY"]

TextColumnRule = tuple[Callable[[str], bool], Callable[[str, int], object]]


def _cycle(values: list[str], row_index: int) -> str:
    return values[row_index % len(values)]


def _is_named_column(name: str, exact: set[str], *, contains: tuple[str, ...] = (), suffixes: tuple[str, ...] = ()) -> bool:
    return name in exact or any(token in name for token in contains) or any(name.endswith(suffix) for suffix in suffixes)


TEXT_COLUMN_RULES: tuple[TextColumnRule, ...] = (
    (
        lambda name: _is_named_column(
            name,
            {"BRANCH_CODE", "AC_BRANCH", "TXN_BRANCH", "FC_AC_BRANCH", "BRN"},
            contains=("BRANCH",),
        ),
        lambda _name, row_index: _cycle(BRANCHES, row_index),
    ),
    (
        lambda name: _is_named_column(
            name,
            {"CUSTOMER_NO", "RELATED_CUSTOMER", "CUST_NO", "REL_CUSTOMER", "CR_CUST_NO"},
            contains=("CUSTOMER",),
        ),
        lambda _name, row_index: _cycle(CUSTOMERS, row_index),
    ),
    (
        lambda name: _is_named_column(
            name,
            {"CCY", "ACC_CCY", "AC_CCY", "TXN_CCY", "CURRENCY"},
            suffixes=("_CCY",),
        ),
        lambda _name, row_index: _cycle(CURRENCIES, row_index),
    ),
    (
        lambda name: _is_named_column(
            name,
            {"CUST_AC_NO", "ACCOUNT", "ACCOUNT_NO", "AC_NO", "TXN_ACC", "RELATED_ACCOUNT"},
        )
        or ("ACC" in name and "CLASS" not in name and "CCY" not in name),
        lambda _name, row_index: _cycle(ACCOUNTS, row_index),
    ),
    (lambda name: "PRODUCT" in name, lambda _name, row_index: _cycle(PRODUCTS, row_index)),
    (lambda name: "TRN_CODE" in name or name == "TXN_CODE", lambda _name, row_index: _cycle(TRN_CODES, row_index)),
    (lambda name: name == "DRCR_IND" or "DRCR" in name, lambda _name, row_index: "D" if row_index % 2 == 0 else "C"),
    (lambda name: name in {"AUTH_STAT", "AUTH_STATUS"}, lambda _name, row_index: "U" if row_index % 23 == 0 else "A"),
    (lambda name: name in {"RECORD_STAT", "ONCE_AUTH", "DELETE_STAT"}, lambda name, _row_index: "O" if name == "RECORD_STAT" else "Y"),
    (
        lambda name: "HIDE_TXN_IN_STMT" in name or "REVERSAL_IND" in name or "REVERSED" in name,
        lambda _name, row_index: "Y" if row_index % 19 == 0 else "N",
    ),
    (
        lambda name: name in {"TRANS_STATUS", "TRANS_MATCH_STATUS"},
        lambda _name, row_index: "FAILED" if row_index % 17 == 0 else "APPROVED",
    ),
    (lambda name: name == "TRN_REF_NO" or name.endswith("REFERENCE_NO"), lambda _name, row_index: f"TRN{row_index + 1:012d}"),
    (lambda name: name == "TXN_ID", lambda _name, row_index: f"TXN{row_index + 1:016d}"),
    (lambda name: "NAME" in name, lambda name, row_index: f"{name.title().replace('_', ' ')} {row_index + 1}"),
    (
        lambda name: "DESC" in name or "NARRATIVE" in name,
        lambda name, row_index: f"Synthetic banking {name.lower()} row {row_index + 1}",
    ),
    (lambda name: name.endswith("_FLAG") or name.endswith("_IND"), lambda _name, row_index: "Y" if row_index % 5 == 0 else "N"),
)


def text_value_for_column(name: str, row_index: int) -> object:
    for predicate, factory in TEXT_COLUMN_RULES:
        if predicate(name):
            return factory(name, row_index)
    return f"{name}_{row_index + 1}"
