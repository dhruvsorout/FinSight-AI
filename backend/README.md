# FinSight AI Backend

Backend-only monorepo for **FinSight AI**, an AI-powered personal finance application.

## Architecture

```text
                    +----------------------+
                    |  Frontend (separate) |
                    +----------+-----------+
                               |
                               v
                    +----------------------+
                    |  Node.js API         |
                    |  Express + TS        |
                    |  Auth + CRUD +       |
                    |  business logic      |
                    +----+------------+----+
                         |            |
             Prisma ORM  |            | Internal HTTP
                         v            v
               +----------------+   +----------------------+
               | PostgreSQL     |   | FastAPI AI Service   |
               | source of truth|   | stateless reasoning  |
               +----------------+   +----------+-----------+
                                               |
                                               v
                                     +----------------------+
                                     | Google Gemini API    |
                                     +----------------------+
```

## Monorepo Layout

```text
apps/
  api/         Node.js + Express + TypeScript + Prisma
  ai-service/  Python + FastAPI + Gemini integration
docker-compose.yml
README.md
```

## What Is Included

- JWT auth with access + refresh token rotation
- Accounts, categories, and transactions CRUD
- CSV transaction import with row-level error reporting
- AI categorization with fallback keyword rules
- AI financial insights with 1-hour API-side caching
- Natural-language finance query with grounded execution against Prisma data
- Prisma schema, SQL migration, and demo seed data
- Docker Compose for Postgres + API + AI service

## Quick Start

### Option 1: Docker Compose

1. Make sure Docker is running.
2. From the repo root:

```bash
docker compose up --build
```

Services:

- API: `http://localhost:3000`
- AI service: `http://localhost:8000`
- Postgres: `localhost:5432`

### Option 2: Local Development

1. Install Node and Python dependencies:

```bash
npm install
pip install -r apps/ai-service/requirements.txt
```

2. Start PostgreSQL locally and make sure `apps/api/.env` points at it.
3. Run Prisma migration and seed:

```bash
cd apps/api
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

4. Start the AI service:

```bash
cd apps/ai-service
uvicorn app.main:app --reload --port 8000
```

5. Start the API:

```bash
cd apps/api
npm run dev
```

## Environment Files

- API example: [apps/api/.env.example](/C:/Projects/New%20folder/FinsightAI/apps/api/.env.example)
- AI service example: [apps/ai-service/.env.example](/C:/Projects/New%20folder/FinsightAI/apps/ai-service/.env.example)

Important API env vars:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `AI_SERVICE_URL`
- `AI_SERVICE_TIMEOUT_MS`
- `AI_SERVICE_RETRY_COUNT`
- `INSIGHTS_CACHE_TTL_SECONDS`
- `DEMO_USER_EMAIL`
- `DEMO_USER_PASSWORD`

Important AI env vars:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`

## Demo Seed

The seed script creates a demo user with 50+ realistic transactions across multiple categories and accounts.

- Email: `demo@finsight.ai`
- Password: `DemoPass123!`

## Auth Flow

1. `POST /auth/signup` or `POST /auth/login` returns `accessToken` and `refreshToken`.
2. Frontend sends the access token as `Authorization: Bearer <token>`.
3. When the access token expires, frontend calls `POST /auth/refresh` with the refresh token.
4. The API verifies the refresh token, revokes the old one, and rotates a fresh pair.
5. `POST /auth/logout` revokes the submitted refresh token.

## Error Shape

Both services use the same envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {}
  }
}
```

## API Contract

### Auth

| Method | Path | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| POST | `/auth/signup` | No | `{ email, password, name }` | `{ user, tokens }` |
| POST | `/auth/login` | No | `{ email, password }` | `{ user, tokens }` |
| POST | `/auth/refresh` | No | `{ refreshToken }` | `{ tokens }` |
| POST | `/auth/logout` | No | `{ refreshToken }` | `{ success: true }` |

### Accounts

| Method | Path | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/accounts` | Yes | None | `{ data: Account[] }` |
| POST | `/accounts` | Yes | `{ name, type, balance }` | `{ data: Account }` |
| PUT | `/accounts/:id` | Yes | `{ name, type, balance }` | `{ data: Account }` |
| DELETE | `/accounts/:id` | Yes | None | `{ success: true }` |

Account shape:

```json
{
  "id": "acct_123",
  "userId": "user_123",
  "name": "Main Checking",
  "type": "bank",
  "balance": 3818.4,
  "createdAt": "2026-08-11T10:00:00.000Z",
  "updatedAt": "2026-08-11T10:00:00.000Z"
}
```

### Categories

| Method | Path | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/categories` | Yes | None | `{ data: Category[] }` |
| POST | `/categories` | Yes | `{ name, type, isAiSuggested? }` | `{ data: Category }` |
| PUT | `/categories/:id` | Yes | `{ name, type, isAiSuggested? }` | `{ data: Category }` |
| DELETE | `/categories/:id` | Yes | None | `{ success: true }` |

Category shape:

```json
{
  "id": "cat_123",
  "userId": "user_123",
  "name": "Food & Dining",
  "type": "expense",
  "isAiSuggested": false,
  "createdAt": "2026-08-11T10:00:00.000Z",
  "updatedAt": "2026-08-11T10:00:00.000Z"
}
```

### Transactions

| Method | Path | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/transactions` | Yes | Query: `startDate`, `endDate`, `categoryId`, `accountId`, `page`, `pageSize` | `{ data, pagination }` |
| POST | `/transactions` | Yes | `{ accountId, categoryId?, amount, description, date, source? }` | `{ data: Transaction }` |
| PUT | `/transactions/:id` | Yes | `{ accountId, categoryId?, amount, description, date, source? }` | `{ data: Transaction }` |
| DELETE | `/transactions/:id` | Yes | None | `{ success: true, data: Transaction }` |
| POST | `/transactions/import` | Yes | `multipart/form-data` with `file`, `accountId`, optional `categoryId` | `{ imported, skipped, errors }` |
| POST | `/transactions/:id/categorize` | Yes | None | `{ data, categorization }` |
| POST | `/transactions/categorize-uncategorized` | Yes | `{ limit? }` | `{ processed, results }` |

Transaction shape:

```json
{
  "id": "txn_123",
  "userId": "user_123",
  "accountId": "acct_123",
  "categoryId": "cat_123",
  "amount": -42.5,
  "description": "Cafe lunch",
  "date": "2026-08-10T12:00:00.000Z",
  "source": "manual",
  "aiConfidence": 0.82,
  "createdAt": "2026-08-11T10:00:00.000Z",
  "updatedAt": "2026-08-11T10:00:00.000Z",
  "category": {
    "id": "cat_123",
    "name": "Food & Dining",
    "type": "expense"
  },
  "account": {
    "id": "acct_123",
    "name": "Rewards Card",
    "type": "card"
  }
}
```

CSV format:

```csv
date,description,amount
2026-08-01,Coffee,-4.50
2026-08-02,Salary,4000
```

### Insights

| Method | Path | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/insights` | Yes | Query: `period=weekly|monthly` | `{ period, dateRange, data, cached }` |

Insights response shape:

```json
{
  "period": "monthly",
  "dateRange": {
    "start": "2026-07-12T00:00:00.000Z",
    "end": "2026-08-11T10:00:00.000Z"
  },
  "data": {
    "summary": "Your spending stayed concentrated in groceries and rent...",
    "suggestions": [
      "Set a weekly food cap.",
      "Reduce recurring entertainment spend."
    ],
    "anomalies": [
      {
        "label": "Expense spike",
        "detail": "Week starting 2026-08-03 had higher than usual travel spend.",
        "severity": "medium"
      }
    ],
    "provider": "gemini"
  },
  "cached": false
}
```

### Natural Language Query

| Method | Path | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| POST | `/query` | Yes | `{ question }` | `{ answer, provider, groundedQuery, result }` |

Example request:

```json
{
  "question": "How much did I spend on food last month?"
}
```

Example response:

```json
{
  "answer": "For \"How much did I spend on food last month?\", the grounded total from your real transaction data is -191.35.",
  "provider": "gemini",
  "groundedQuery": {
    "aggregation": "sum",
    "metric": "amount",
    "filters": [
      {
        "field": "categoryName",
        "operator": "equals",
        "value": "Food & Dining"
      },
      {
        "field": "transactionType",
        "operator": "equals",
        "value": "expense"
      },
      {
        "field": "date",
        "operator": "between",
        "value": [
          "2026-07-01T00:00:00.000Z",
          "2026-07-31T23:59:59.999Z"
        ]
      }
    ],
    "answerLabel": "Food spend last month"
  },
  "result": {
    "value": -191.35,
    "records": []
  }
}
```

### Health

| Method | Path | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/health` | No | None | `{ status: "ok" }` |

## FastAPI Contract

The AI service is internal-only and meant to be called by the Node API.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/ai/categorize` | Suggest category name and confidence for a transaction |
| POST | `/ai/insights` | Convert aggregated finance summaries into insights |
| POST | `/ai/query` | Translate a natural-language question into a structured query spec |
| GET | `/health` | Service health |

## Node ↔ FastAPI Integration Walkthrough

### 1. Shared contract

The boundary between services is explicitly typed on both sides:

- TypeScript interfaces live in [apps/api/src/types/ai.ts](/C:/Projects/New%20folder/FinsightAI/apps/api/src/types/ai.ts)
- Pydantic models live in [apps/ai-service/app/models.py](/C:/Projects/New%20folder/FinsightAI/apps/ai-service/app/models.py)

This keeps the payloads aligned for:

- categorization
- insights
- structured query translation

### 2. Node owns orchestration

The Express API:

- authenticates the user
- fetches and aggregates real DB data
- calls FastAPI over internal HTTP
- validates the AI response
- applies the result back to PostgreSQL when appropriate

The AI service never talks to Postgres directly.

### 3. Timeout and retry behavior

Node calls FastAPI through [apps/api/src/services/aiClient.ts](/C:/Projects/New%20folder/FinsightAI/apps/api/src/services/aiClient.ts).

That client:

- uses `fetch`
- aborts slow requests with `AbortController`
- retries based on `AI_SERVICE_RETRY_COUNT`
- validates the returned JSON with `zod`

If FastAPI is down or slow:

- categorization falls back to local keyword rules
- insights fall back to deterministic summary generation
- natural-language query falls back to a regex/rule parser for common question patterns

### 4. Categorization flow

1. Frontend calls `POST /transactions/:id/categorize`.
2. Node loads the transaction and the user’s available categories.
3. Node sends `{ description, amount, existingCategories }` to FastAPI.
4. FastAPI calls Gemini using structured output mode and returns `{ suggestedCategoryName, confidence, provider }`.
5. Node finds or creates the target category.
6. Node updates the transaction’s `categoryId` and `aiConfidence`.
7. If AI fails, Node uses fallback keyword logic instead of failing the request.

### 5. Insights flow

1. Frontend calls `GET /insights?period=weekly|monthly`.
2. Node loads only the relevant date window.
3. Node aggregates the raw transaction rows into:
   - total income
   - total expense
   - net cash flow
   - category summaries
   - weekly summaries
4. Node caches the finished response for 1 hour.
5. Node sends the aggregated payload to FastAPI.
6. FastAPI asks Gemini for a narrative summary, suggestions, and anomalies.
7. Node returns the AI response plus cache metadata.

This matters in interviews because it shows the LLM is used for interpretation, not as the system of record.

## Grounded Natural-Language Query Logic

This is the most important anti-hallucination path in the system.

### Step 1: Translate question into a safe spec

Node sends FastAPI:

- the raw question
- the allowed data fields
- the allowed operators
- the user’s known category names

FastAPI returns a **structured query spec**, not SQL. Example:

```json
{
  "aggregation": "sum",
  "metric": "amount",
  "filters": [
    { "field": "categoryName", "operator": "equals", "value": "Food & Dining" },
    { "field": "transactionType", "operator": "equals", "value": "expense" },
    { "field": "date", "operator": "between", "value": ["2026-07-01T00:00:00.000Z", "2026-07-31T23:59:59.999Z"] }
  ],
  "answerLabel": "Food spend last month"
}
```

### Step 2: Validate the spec

Node validates the AI output with `zod` before using it. If it does not match the allowed structure, the request is rejected or handled by fallback parsing.

### Step 3: Execute against real Prisma data

Node converts the structured spec into a Prisma `where` object and then computes the answer using the database:

- `count` uses `prisma.transaction.count`
- `sum` uses `prisma.transaction.aggregate({ _sum })`
- `average` uses `prisma.transaction.aggregate({ _avg })`
- `list` uses `prisma.transaction.findMany`

The important detail: **the LLM never computes the final number**.

### Step 4: Return a grounded answer

After the real query runs, Node formats the answer using the real computed value and returns:

- the final answer
- the structured query used
- the raw computed result
- the provider (`gemini` or `fallback`)

That makes the feature interview-friendly because you can explain it as:

> "The model interprets intent into a constrained JSON plan, but the application computes the answer from the real database before responding."

## Key Implementation Files

- Prisma schema: [apps/api/prisma/schema.prisma](/C:/Projects/New%20folder/FinsightAI/apps/api/prisma/schema.prisma)
- Seed script: [apps/api/prisma/seed.ts](/C:/Projects/New%20folder/FinsightAI/apps/api/prisma/seed.ts)
- API app bootstrap: [apps/api/src/app.ts](/C:/Projects/New%20folder/FinsightAI/apps/api/src/app.ts)
- AI HTTP client: [apps/api/src/services/aiClient.ts](/C:/Projects/New%20folder/FinsightAI/apps/api/src/services/aiClient.ts)
- Query execution: [apps/api/src/services/queryService.ts](/C:/Projects/New%20folder/FinsightAI/apps/api/src/services/queryService.ts)
- FastAPI entry: [apps/ai-service/app/main.py](/C:/Projects/New%20folder/FinsightAI/apps/ai-service/app/main.py)
- Gemini integration: [apps/ai-service/app/gemini_client.py](/C:/Projects/New%20folder/FinsightAI/apps/ai-service/app/gemini_client.py)

## Verification Completed

- TypeScript build passed: `npm run build` in `apps/api`
- Python module compile passed: `python -m compileall apps/ai-service/app`
