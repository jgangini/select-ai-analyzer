from apps.backend.app.select_ai.question_recommendations import (
    build_question_recommendations,
    compact_questions,
    normalize_question_text,
)


def test_normalize_question_text_ignores_case_spacing_and_question_marks() -> None:
    assert normalize_question_text(" ¿Qué cuentas tienen saldo? ") == "qué cuentas tienen saldo"
    assert normalize_question_text("Qué   cuentas  tienen saldo") == "qué cuentas tienen saldo"


def test_compact_questions_removes_blank_and_duplicate_questions() -> None:
    assert compact_questions([" Balance by branch ", "", "balance by branch?", "Credit trend"]) == [
        "Balance by branch",
        "Credit trend",
    ]


def test_build_question_recommendations_prioritizes_unused_for_new_chat_and_usage_for_home() -> None:
    recommendations = build_question_recommendations(
        catalog_questions=[
            "Balance by branch",
            "Credit trend",
            "Hidden transactions",
            "Customer growth",
        ],
        usage_rows=[
            {"question_text": "Balance by branch", "usage_count": 4, "last_used_at": "2026-03-04T10:00:00"},
            {"question_text": "Hidden transactions", "usage_count": 1, "last_used_at": "2026-03-03T10:00:00"},
            {"question_text": "Custom liquidity question", "usage_count": 7, "last_used_at": "2026-03-05T10:00:00"},
        ],
        limit=3,
    )

    assert [item["question"] for item in recommendations["new_chat"]] == [
        "Credit trend",
        "Customer growth",
        "Hidden transactions",
    ]
    assert [item["question"] for item in recommendations["frequent"]] == [
        "Custom liquidity question",
        "Balance by branch",
        "Hidden transactions",
    ]
    assert recommendations["frequent"][1]["source"] == "starter"
    assert recommendations["catalog_size"] == 4
