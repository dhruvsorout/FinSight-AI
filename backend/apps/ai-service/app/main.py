import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.gemini_client import gemini_service
from app.models import (
    CategorizeTransactionRequest,
    CategorizeTransactionResponse,
    ErrorEnvelope,
    InsightRequest,
    InsightResponse,
    StructuredQueryRequest,
    StructuredQueryResponse,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger("finsight.ai_service")


def _mask_api_key(value: str | None) -> str:
    if not value:
        return "missing"
    if len(value) <= 4:
        return f"{value[:1]}***"
    return f"{value[:4]}...{value[-4:]}"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info(
        "FinSight AI service starting with GEMINI_API_KEY loaded=%s masked_key=%s model=%s",
        bool(settings.gemini_api_key),
        _mask_api_key(settings.gemini_api_key),
        settings.gemini_model,
    )
    yield


app = FastAPI(title="FinSight AI Service", version="1.0.0", lifespan=lifespan)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred in the AI service.",
                "details": str(exc),
            }
        },
    )


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post(
    "/ai/categorize",
    response_model=CategorizeTransactionResponse,
    responses={500: {"model": ErrorEnvelope}},
)
async def categorize_transaction(payload: CategorizeTransactionRequest):
    return gemini_service.categorize(payload)


@app.post(
    "/ai/insights",
    response_model=InsightResponse,
    responses={500: {"model": ErrorEnvelope}},
)
async def generate_insights(payload: InsightRequest):
    return gemini_service.insights(payload)


@app.post(
    "/ai/query",
    response_model=StructuredQueryResponse,
    responses={500: {"model": ErrorEnvelope}},
)
async def translate_query(payload: StructuredQueryRequest):
    return gemini_service.query(payload)
