import logging
from typing import TypeVar, cast

from google import genai
from google.genai import types

from app.config import settings
from app.fallbacks import fallback_categorize, fallback_insights, fallback_query
from app.models import (
    CategorizeTransactionRequest,
    CategorizeTransactionGeminiResponse,
    CategorizeTransactionResponse,
    InsightGeminiResponse,
    InsightRequest,
    InsightResponse,
    StructuredQueryGeminiResponse,
    StructuredQueryRequest,
    StructuredQueryResponse,
)
from pydantic import BaseModel

logger = logging.getLogger("finsight.ai_service.gemini")
ResponseModelT = TypeVar("ResponseModelT", bound=BaseModel)


def _describe_exception(exc: Exception) -> str:
    details = [f"{exc.__class__.__name__}: {exc}"]

    status_code = getattr(exc, "status_code", None)
    if status_code is not None:
        details.append(f"status_code={status_code}")

    code = getattr(exc, "code", None)
    if code is not None:
        details.append(f"code={code}")

    response = getattr(exc, "response", None)
    if response is not None:
        response_status = getattr(response, "status_code", None) or getattr(
            response, "status", None
        )
        if response_status is not None:
            details.append(f"response_status={response_status}")

        response_text = getattr(response, "text", None)
        if response_text:
            details.append(f"response_text={response_text}")

    return " | ".join(details)


class GeminiService:
    def __init__(self) -> None:
        self.client = (
            genai.Client(api_key=settings.gemini_api_key)
            if settings.gemini_api_key
            else None
        )

    def _generate_structured(self, prompt: str, response_schema: type[ResponseModelT]) -> ResponseModelT:
        if self.client is None:
            raise RuntimeError("GEMINI_API_KEY is not configured.")

        response = self.client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
            ),
        )
        parsed = getattr(response, "parsed", None)
        if parsed is not None:
            return cast(ResponseModelT, parsed)
        if response.text is None:
            raise ValueError("Gemini returned an empty text response.")
        return response_schema.model_validate_json(response.text)

    def categorize(
        self, payload: CategorizeTransactionRequest
    ) -> CategorizeTransactionResponse:
        prompt = f"""
You are a finance categorization engine.
Choose the single best category from the provided list when possible.
If none fits well, propose a short new category name.
Return only valid JSON matching the schema.

Transaction description: {payload.description}
Transaction amount: {payload.amount}
Existing categories: {[category.model_dump() for category in payload.existing_categories]}
        """.strip()

        try:
            result = self._generate_structured(prompt, CategorizeTransactionGeminiResponse)
            return CategorizeTransactionResponse(
                suggestedCategoryName=result.suggested_category_name,
                confidence=result.confidence,
                reasoning=result.reasoning,
                provider="gemini",
            )
        except Exception as exc:
            logger.error(
                "Gemini categorize call failed. %s",
                _describe_exception(exc),
                exc_info=True,
            )
            return fallback_categorize(payload)

    def insights(self, payload: InsightRequest) -> InsightResponse:
        prompt = f"""
You are an AI financial coach.
Analyze the aggregated finance summary below and respond with:
1. A concise natural-language summary.
2. Two or three concrete suggestions.
3. Any anomalies worth flagging.
Only use the data provided. Do not invent missing facts.
Return only valid JSON matching the schema.

Payload:
{payload.model_dump(by_alias=True)}
        """.strip()

        try:
            result = self._generate_structured(prompt, InsightGeminiResponse)
            return InsightResponse(
                summary=result.summary,
                suggestions=result.suggestions,
                anomalies=result.anomalies,
                provider="gemini",
            )
        except Exception as exc:
            logger.error(
                "Gemini insights call failed. %s",
                _describe_exception(exc),
                exc_info=True,
            )
            return fallback_insights(payload)

    def query(self, payload: StructuredQueryRequest) -> StructuredQueryResponse:
        prompt = f"""
You convert personal finance questions into a structured query specification.
Rules:
- Use only the fields and operators provided.
- Never return SQL.
- Prefer exact category names from the provided category list.
- Use transactionType=expense for spending questions and income for earning questions.
- If the question asks for a list, use aggregation=list and include a reasonable limit.
- Return only valid JSON matching the schema.
- For questions asking "which category did I spend the most/least on", "top spending
  category", "biggest/smallest expense category", "highest/lowest category", or any
  question that requires ranking categories by their aggregate amount:
    * Set groupBy="categoryName"
    * Set aggregation="sum"
    * Set rank="top" for most/biggest/highest, rank="bottom" for least/smallest/lowest
    * Set rankLimit=1 (or higher if the user asks for top N)
    * Do NOT add a categoryName filter — groupBy replaces it
    * Still add transactionType and date filters if the question implies them

Question: {payload.question}
Available fields: {[field.model_dump() for field in payload.available_fields]}
Known categories: {[category.model_dump() for category in payload.categories]}
        """.strip()

        try:
            result = self._generate_structured(prompt, StructuredQueryGeminiResponse)
            return StructuredQueryResponse(query=result.query, provider="gemini")
        except Exception as exc:
            logger.error(
                "Gemini query call failed. %s",
                _describe_exception(exc),
                exc_info=True,
            )
            return fallback_query(payload.question)


gemini_service = GeminiService()
