from datetime import UTC, datetime, timedelta

from app.models import (
    Aggregation,
    CategorizeTransactionRequest,
    CategorizeTransactionResponse,
    InsightAnomaly,
    InsightRequest,
    InsightResponse,
    StructuredQueryFilter,
    StructuredQueryResponse,
    StructuredQuerySpec,
)


KEYWORD_RULES = [
    (["salary", "payroll", "bonus"], "Salary"),
    (["invoice", "freelance", "consulting"], "Freelance"),
    (["swiggy", "zomato", "restaurant", "cafe", "coffee"], "Food & Dining"),
    (["grocery", "supermarket", "mart"], "Groceries"),
    (["uber", "ola", "metro", "fuel", "gas"], "Transportation"),
    (["rent", "landlord"], "Rent"),
    (["netflix", "spotify", "movie", "cinema"], "Entertainment"),
    (["hospital", "doctor", "pharmacy"], "Healthcare"),
    (["amazon", "shopping", "flipkart"], "Shopping"),
]


def fallback_categorize(payload: CategorizeTransactionRequest) -> CategorizeTransactionResponse:
    description = payload.description.lower()
    for keywords, category in KEYWORD_RULES:
        if any(keyword in description for keyword in keywords):
            return CategorizeTransactionResponse(
                suggestedCategoryName=category,
                confidence=0.64,
                reasoning="Matched a deterministic fallback keyword rule.",
                provider="fallback",
            )

    return CategorizeTransactionResponse(
        suggestedCategoryName="Salary" if payload.amount >= 0 else "Shopping",
        confidence=0.35,
        reasoning="Used transaction direction fallback because Gemini was unavailable.",
        provider="fallback",
    )


def fallback_insights(payload: InsightRequest) -> InsightResponse:
    top_category = None
    if payload.category_summaries:
        top_category = max(payload.category_summaries, key=lambda item: abs(item.total))

    anomaly: InsightAnomaly | None = None
    if payload.weekly_summaries:
        spike = max(payload.weekly_summaries, key=lambda item: item.total_expense)
        if spike.total_expense > max(payload.totals.expense * 0.5, 1):
            anomaly = InsightAnomaly(
                label="Expense spike",
                detail=f"Week starting {spike.week_start} had noticeably higher expense activity.",
                severity="medium",
            )

    summary = (
        f"Net cash flow for this {payload.period} window is {payload.totals.net:.2f}. "
        + (
            f"The largest spending bucket is {top_category.category_name} at {top_category.total:.2f}."
            if top_category
            else "There is not enough categorized activity yet to identify a dominant category."
        )
    )

    suggestions = [
        "Review the highest-spend category and set a tighter target for the next period.",
        "Categorize uncategorized transactions so future AI summaries are more accurate.",
        (
            "Trim discretionary spending to move net cash flow back above zero."
            if payload.totals.net < 0
            else "Route a slice of the positive net cash flow into savings or investing."
        ),
    ]

    return InsightResponse(
        summary=summary,
        suggestions=suggestions,
        anomalies=[anomaly] if anomaly else [],
        provider="fallback",
    )


def _relative_date_range(question: str) -> tuple[str, str] | None:
    now = datetime.now(UTC)

    if "last month" in question:
        first_this_month = datetime(now.year, now.month, 1, tzinfo=UTC)
        last_month_end = first_this_month - timedelta(milliseconds=1)
        last_month_start = datetime(last_month_end.year, last_month_end.month, 1, tzinfo=UTC)
        return last_month_start.isoformat(), last_month_end.isoformat()

    if "this month" in question:
        start = datetime(now.year, now.month, 1, tzinfo=UTC)
        return start.isoformat(), now.isoformat()

    if "last week" in question:
        start = now - timedelta(days=7)
        return start.isoformat(), now.isoformat()

    return None


def fallback_query(question: str) -> StructuredQueryResponse:
    lower = question.lower()
    filters: list[StructuredQueryFilter] = []
    date_range = _relative_date_range(lower)
    if date_range:
        filters.append(
            StructuredQueryFilter(field="date", operator="between", value=list(date_range))
        )

    # Detect "group by category + rank" intent before anything else
    _top_keywords = ["most", "biggest", "highest", "top spending", "top category", "top expense"]
    _bottom_keywords = ["least", "lowest", "smallest", "bottom spending", "bottom category"]
    _is_top = any(kw in lower for kw in _top_keywords)
    _is_bottom = any(kw in lower for kw in _bottom_keywords)

    if _is_top or _is_bottom:
        # Add expense filter for spending questions
        if "spend" in lower or "spent" in lower or "expense" in lower or _is_top or _is_bottom:
            filters.append(
                StructuredQueryFilter(field="transactionType", operator="equals", value="expense")
            )
        return StructuredQueryResponse(
            query=StructuredQuerySpec(
                aggregation="sum",
                metric="amount",
                filters=filters,
                limit=None,
                answerLabel="Top category by spending" if _is_top else "Bottom category by spending",
                groupBy="categoryName",
                rank="top" if _is_top else "bottom",
                rankLimit=1,
            ),
            provider="fallback",
        )

    if "food" in lower:
        filters.append(
            StructuredQueryFilter(
                field="categoryName", operator="equals", value="Food & Dining"
            )
        )
    if "grocery" in lower:
        filters.append(
            StructuredQueryFilter(field="categoryName", operator="equals", value="Groceries")
        )
    if "spent" in lower or "expense" in lower:
        filters.append(
            StructuredQueryFilter(field="transactionType", operator="equals", value="expense")
        )
    if "income" in lower or "earned" in lower:
        filters.append(
            StructuredQueryFilter(field="transactionType", operator="equals", value="income")
        )

    aggregation: Aggregation = "sum"
    if "average" in lower:
        aggregation = "average"
    elif "how many" in lower or "count" in lower:
        aggregation = "count"
    elif "list" in lower or "show" in lower:
        aggregation = "list"

    return StructuredQueryResponse(
        query=StructuredQuerySpec(
            aggregation=aggregation,
            metric="amount",
            filters=filters,
            limit=10 if aggregation == "list" else None,
            answerLabel="Fallback parsed result",
        ),
        provider="fallback",
    )

