from typing import Literal

from pydantic import BaseModel, Field


Provider = Literal["gemini", "fallback"]
CategoryType = Literal["income", "expense"]
Severity = Literal["low", "medium", "high"]
Aggregation = Literal["sum", "count", "average", "list"]
QueryField = Literal["categoryName", "accountName", "transactionType", "date"]
QueryOperator = Literal["equals", "between"]
GroupByField = Literal["categoryName"]
RankDirection = Literal["top", "bottom"]


class ExistingCategory(BaseModel):
    name: str
    type: CategoryType


class CategorizeTransactionRequest(BaseModel):
    description: str = Field(min_length=1, max_length=200)
    amount: float
    existing_categories: list[ExistingCategory] = Field(alias="existingCategories")

    model_config = {"populate_by_name": True}


class CategorizeTransactionResponse(BaseModel):
    suggested_category_name: str = Field(alias="suggestedCategoryName")
    confidence: float = Field(ge=0, le=1)
    reasoning: str | None = None
    provider: Provider

    model_config = {"populate_by_name": True}


class CategorizeTransactionGeminiResponse(BaseModel):
    suggested_category_name: str = Field(alias="suggestedCategoryName")
    confidence: float = Field(ge=0, le=1)
    reasoning: str | None = None

    model_config = {"populate_by_name": True}


class CategorySummaryInput(BaseModel):
    category_name: str = Field(alias="categoryName")
    total: float
    transaction_count: int = Field(alias="transactionCount", ge=0)

    model_config = {"populate_by_name": True}


class WeeklySummaryInput(BaseModel):
    week_start: str = Field(alias="weekStart")
    total_income: float = Field(alias="totalIncome")
    total_expense: float = Field(alias="totalExpense")
    net: float

    model_config = {"populate_by_name": True}


class InsightDateRange(BaseModel):
    start: str
    end: str


class InsightTotals(BaseModel):
    income: float
    expense: float
    net: float


class InsightRequest(BaseModel):
    period: Literal["weekly", "monthly"]
    date_range: InsightDateRange = Field(alias="dateRange")
    totals: InsightTotals
    category_summaries: list[CategorySummaryInput] = Field(alias="categorySummaries")
    weekly_summaries: list[WeeklySummaryInput] = Field(alias="weeklySummaries")

    model_config = {"populate_by_name": True}


class InsightAnomaly(BaseModel):
    label: str
    detail: str
    severity: Severity


class InsightResponse(BaseModel):
    summary: str
    suggestions: list[str] = Field(min_length=1, max_length=5)
    anomalies: list[InsightAnomaly]
    provider: Provider


class InsightGeminiResponse(BaseModel):
    summary: str
    suggestions: list[str] = Field(min_length=1, max_length=5)
    anomalies: list[InsightAnomaly]


class QueryFieldDescriptor(BaseModel):
    field: QueryField
    description: str
    operators: list[QueryOperator]


class StructuredQueryRequest(BaseModel):
    question: str = Field(min_length=5, max_length=300)
    available_fields: list[QueryFieldDescriptor] = Field(alias="availableFields")
    categories: list[ExistingCategory]

    model_config = {"populate_by_name": True}


class StructuredQueryFilter(BaseModel):
    field: QueryField
    operator: QueryOperator
    value: str | list[str]


class StructuredQuerySpec(BaseModel):
    aggregation: Aggregation
    metric: Literal["amount"]
    filters: list[StructuredQueryFilter]
    limit: int | None = Field(default=None, ge=1, le=50)
    answer_label: str = Field(alias="answerLabel")
    group_by: GroupByField | None = Field(default=None, alias="groupBy")
    rank: RankDirection | None = None
    rank_limit: int | None = Field(default=None, alias="rankLimit", ge=1, le=10)

    model_config = {"populate_by_name": True}


class StructuredQueryResponse(BaseModel):
    query: StructuredQuerySpec
    provider: Provider


class StructuredQueryGeminiResponse(BaseModel):
    query: StructuredQuerySpec


class ErrorEnvelope(BaseModel):
    error: dict
