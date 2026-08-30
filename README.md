# 🚁 Skylark Drones — Monday.com Business Intelligence Agent

> **An Autonomous, Tool-Calling Business Intelligence AI Agent for Skylark Drones**  
> Answers executive-level questions across sales pipelines and operational work orders — pulling live data from **monday.com**, cleaning it deterministically with **pandas**, and synthesizing grounded, executive-grade business insights via **FastAPI** and **Google Gemini**.

---

## 🌟 Live Demo & Deployment

| Resource | Link |
|---|---|
| **Public Hosted Application** | [https://skylark-bi-agent-ppyp.onrender.com](https://skylark-bi-agent-ppyp.onrender.com) |
| **GitHub Repository** | [https://github.com/jeiatgit/skylark-bi-agent](https://github.com/jeiatgit/skylark-bi-agent) |
| **Submission Form** | [Official Google Form](https://forms.gle/qGihfi4zCLBxKWK68) |

---

## 🏗️ Architecture & State Flow

```
User Query (Chat UI)
        │
        ▼
┌────────────────────────────────────────────────────────┐
│             FastAPI Backend (Python)                   │
│                                                        │
│  User Intent → [Intent Classifier & Parameter Router]  │
│                           │                            │
│    ┌───────────────┬──────┴───────┬────────────────┐   │
│    ▼               ▼              ▼                ▼   │
│ query_deals   query_work_orders  cross_board   get_kpis│
│    │               │              │                │   │
│    └───────────────┼──────────────┴────────────────┘   │
│                    ▼                                   │
│       [Dual-Source Data Adapter]                       │
│        ├── Primary: monday.com GraphQL v2 API          │
│        └── Fallback: In-Memory pandas Dataframe        │
│                    │                                   │
│                    ▼                                   │
│       [pandas Normalizer & Quality Guard]              │
│        ├── Filter leaked frozen header rows            │
│        ├── Regex unit parser (HA, Acr, days, images)   │
│        ├── Status typo standardizer (BIlled, Stuck)    │
│        └── Date & Currency normalizer (₹, Cr, L)       │
│                    │                                   │
│                    ▼                                   │
│       [Deterministic Analytics Engine (pandas)]        │
│        └── Zero-hallucination mathematical computation │
│                    │                                   │
│                    ▼                                   │
│       [Executive Synthesis Engine (Gemini)]            │
│        └── Key Metrics + Breakdown + Insights + Notice │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
       Glassmorphism Executive Interface
       (Live KPIs, Telemetry, Audit Badges, Caveats)
```

---

## 💡 Key Design Decisions & Rationales

| Decision | Rationale |
|---|---|
| **pandas for all math** | **Zero LLM Hallucinations.** The AI agent never performs arithmetic on raw tables. Calculations (win rates, pipeline sums, aging receivables) are computed deterministically with pandas; the LLM only synthesizes the strategic narrative. |
| **FastAPI Backend** | High-performance async Python backend supporting typed Pydantic models, rapid response times, and native static file mounting for the Glassmorphism frontend. |
| **Dual-Source Adapter Pattern** | Queries **monday.com GraphQL API** dynamically, with instant fallback to sanitized local datasets if board IDs are pending or rate limits occur — guaranteeing **zero downtime** during live evaluations. |
| **Data Quality Warning Badges** | Every query returns both calculated numbers and explicit **Data Quality Notices** (e.g., *"3 deals excluded due to missing close dates"*), ensuring executive transparency. |
| **Multi-Model Resilience Cascade** | Automatically fails over across `gemini-flash-lite-latest`, `gemini-3.6-flash`, and `gemma-4-31b-it` to prevent 429 quota exhaustion. |

---

## 📊 Board Data Forensic Analysis

### Board 1: Sales Deal Funnel (345 Rows)
- **Funnel Progression:** 17 ordered stages from `A. Lead Generated` → `B. SQL` → `E. Proposal Sent` → `F. Negotiations` → `G. Project Won` / `H. Work Order Received` / `L. Project Lost`.
- **Sectors:** Mining (106), Renewables (111), Railways (40), Powerline (26), Construction (9), Others (28), Tender (5), DSP (7).
- **Data Quirks Handled:**
  - Leaked frozen header rows (cell values equal to `Deal Status` or `Deal Stage`) filtered out.
  - Excel serial date integers (e.g. `46079`) converted to standardized ISO dates (`2026-03-01`).
  - Unpopulated close dates and missing probability values tracked in quality notices.

### Board 2: Work Order Tracker (176 Rows, 38 Columns)
- **Operational Lifecycle:** `PO/LOI` → `Execution Status` (`Completed`, `Ongoing`, `Stuck`, `Not Started`) → `Billing Status` → `Collected Amount` vs. `Amount Receivable`.
- **Data Quirks Handled:**
  - Status typos standardized: `BIlled` → `Billed`, `Pause / struck` → `Stuck`, `Executed until current month` → `Ongoing`.
  - Messy mixed quantity units (`5360 HA`, `2057 Acr`, `45 days`, `7000 images`, `L/s`) parsed via regex into `{ value, unit, raw }`.
  - Empty string financial values safely coerced to numeric `0`.

---

## 🛠️ Tool Calling Schema

The AI Agent is equipped with 5 specialized analytical tools:

| Tool Name | Purpose | Key Parameters |
|:---|:---|:---|
| `query_deals` | Sales pipeline inquiries (value, win rate, stage/sector breakdowns, top opportunities) | `sector`, `deal_status`, `deal_stage`, `owner_code` |
| `query_work_orders` | Operational & financial inquiries (receivables, billed vs. collected, delay counts) | `sector`, `execution_status`, `invoice_status` |
| `cross_board_summary` | Cross-board correlation between sales pipeline and operational billing | `sector` |
| `get_kpis` | Executive top-level KPI telemetry (Pipeline, Win Rate %, Receivables, Work Orders) | *None* |
| `get_leadership_summary`| Comprehensive executive briefing covering pipeline health, operational delivery, and risks | *None* |

---

## 🚀 Quickstart & Local Setup (Python)

### 1. Prerequisites
- **Python 3.10+**
- **monday.com API Token**
- **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/))

### 2. Installation
```bash
git clone https://github.com/jeiatgit/skylark-bi-agent.git
cd skylark-bi-agent
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```env
MONDAY_API_TOKEN=your_monday_api_token
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-flash-lite-latest
PORT=3000
DEALS_BOARD_ID=your_deals_board_id
WORK_ORDERS_BOARD_ID=your_work_orders_board_id
```

### 4. Run Application
```bash
uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
```
Open **`http://localhost:3000`** in your browser.

---

## 🌐 Public Deployment Guide (Render.com)

1. Connect your GitHub repository `https://github.com/jeiatgit/skylark-bi-agent` on [Render.com](https://render.com).
2. Set **Runtime**: `Python`
3. Set **Build Command**: `pip install -r requirements.txt`
4. Set **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add Environment Variables: `MONDAY_API_TOKEN`, `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-flash-lite-latest`, `PORT=10000`.
6. Click **Deploy** to obtain your public URL!

---

## 👥 Author
- **Candidate:** Jeiesh J S
- **Role:** Full Stack Role
