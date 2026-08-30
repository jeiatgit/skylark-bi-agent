# 🚁 Skylark Drones — Monday.com Business Intelligence Agent

> **An Autonomous, Tool-Calling Business Intelligence AI Agent for Skylark Drones**  
> Answers executive-level questions across sales pipelines and operational work orders — pulling live data from **monday.com**, cleaning it deterministically, and synthesizing grounded, executive-grade business insights via **Google Gemini**.

---

## 🌟 Live Demo & Deployment

| Resource | Link |
|---|---|
| **Public Hosted Application** | *[Provide your deployed Render / Vercel link here]* |
| **GitHub Repository** | *[Provide your public GitHub repository link here]* |
| **Submission Form** | [Official Google Form](https://forms.gle/qGihfi4zCLBxKWK68) |

---

## 🏗️ Architecture & State Flow

```
User Query (Chat UI)
        │
        ▼
┌────────────────────────────────────────────────────────┐
│             AI Agent Query Router & Intent Engine      │
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
│        └── Fallback: In-Memory Local Dataset           │
│                    │                                   │
│                    ▼                                   │
│       [Data Normalizer & Quality Guard]                │
│        ├── Filter leaked frozen header rows            │
│        ├── Regex unit parser (HA, Acr, days, images)   │
│        ├── Status typo standardizer (BIlled, Stuck)    │
│        └── Date & Currency normalizer (₹, Cr, L)       │
│                    │                                   │
│                    ▼                                   │
│       [Deterministic Analytics Engine]                 │
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
| **Deterministic Math Engine** | **Zero LLM Hallucinations.** The AI agent never performs arithmetic on raw tables. Calculations (win rates, pipeline sums, aging receivables) are computed deterministically in code; the LLM only synthesizes the strategic narrative. |
| **Dual-Source Adapter Pattern** | Queries **monday.com GraphQL API** dynamically, with instant fallback to sanitized local datasets if board IDs are pending or rate limits occur — guaranteeing **zero downtime** during live evaluations. |
| **Typed Function Calling (Tools)** | Replaces brittle prompt-stuffing. The agent dynamically picks from 5 specialized analytical tools based on user intent. |
| **Data Quality Warning Badges** | Every query returns both calculated numbers and explicit **Data Quality Notices** (e.g., *"3 deals excluded due to missing close dates"*), ensuring executive transparency. |
| **Multi-Model Resilience Cascade** | Automatically fails over across `gemini-flash-lite-latest`, `gemini-3.6-flash`, and `gemma-4-31b-it` to prevent 429 quota exhaustion. |
| **Glassmorphism Executive UI** | Custom dark-mode interface with live KPI telemetry formatted in Indian Crores (`₹68.82 Cr`) and Lakhs (`₹77.07 L`), suggested query chips, and collapsible tool audit trails. |

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
| `query_deals` | Sales pipeline inquiries (value, win rate, stage/sector breakdowns, top opportunities) | `sector`, `dealStatus`, `dealStage`, `ownerCode`, `groupBy` |
| `query_work_orders` | Operational & financial inquiries (receivables, billed vs. collected, delay counts) | `sector`, `executionStatus`, `invoiceStatus`, `billingStatus`, `groupBy` |
| `cross_board_summary` | Cross-board correlation between sales pipeline and operational billing | `sector` |
| `get_kpis` | Executive top-level KPI telemetry (Pipeline, Win Rate %, Receivables, Work Orders) | *None* |
| `get_leadership_summary`| Comprehensive executive briefing covering pipeline health, operational delivery, and risks | *None* |

---

## 📋 monday.com Board Setup & Recommended Schema

### Step 1: Import Excel Files to monday.com
1. In your monday.com workspace, click **+ Add** → **Import data** → **Excel**.
2. Upload **`Deal funnel Data.xlsx`** → name the board **Skylark - Deal Funnel**.
3. Upload **`Work_Order_Tracker Data.xlsx`** → name the board **Skylark - Work Orders**.

### Step 2: Recommended Column Types

#### Deal Funnel Board
| Excel Column | monday.com Column Type | Description |
|---|---|---|
| `Deal Name` | **Name** | Deal identifier / account name |
| `Owner code` | **Text** | Sales representative ID |
| `Client Code` | **Text** | Customer account identifier |
| `Deal Status` | **Status / Text** | Open / Won / Dead / On Hold |
| `Close Date (A)` | **Date** | Actual close date |
| `Closure Probability` | **Text / Status** | High / Medium / Low |
| `Masked Deal value` | **Numbers** | Deal amount in INR |
| `Tentative Close Date` | **Date** | Expected close date |
| `Deal Stage` | **Text / Dropdown** | Funnel progression (A. Lead → G. Won) |
| `Sector/service` | **Text / Dropdown** | Mining, Renewables, Powerline, etc. |

#### Work Order Tracker Board
| Excel Column | monday.com Column Type | Description |
|---|---|---|
| `Deal name masked` | **Name** | Project name |
| `Customer Name Code` | **Text** | Client ID |
| `Serial #` | **Text** | Deal reference (`SDPLDEAL-xxx`) |
| `Execution Status` | **Status / Text** | Completed / Ongoing / Stuck |
| `Sector` | **Text / Dropdown** | Industry vertical |
| `Amount Incl GST` | **Numbers** | Total contracted value |
| `Billed Value Incl GST`| **Numbers** | Invoiced value |
| `Collected Amount` | **Numbers** | Cash collected |
| `Amount Receivable` | **Numbers** | Outstanding balance |
| `Quantity by Ops` | **Text** | Operational volume (`5360 HA`, etc.) |

---

## 💬 Sample Questions Handled

| Category | Example Executive Questions |
|---|---|
| **Pipeline & Sales** | • *"How is our pipeline looking for the Renewables and Mining sectors this quarter?"*<br>• *"Show me all open deals in Proposal or Negotiation stage."*<br>• *"What is our historical win rate?"* |
| **Receivables & Billing** | • *"What is our total outstanding receivable, and which sector has the highest unpaid amount?"*<br>• *"What is our overall collection rate across all billed projects?"* |
| **Operational Delays** | • *"Which work orders are currently stuck or delayed, and what is their contract value?"*<br>• *"How many active projects are currently ongoing in the Powerline sector?"* |
| **Cross-Board Correlation** | • *"Compare our sales pipeline with actual billed revenue across all sectors."*<br>• *"Which sector has strong sales pipeline but low operational completion?"* |
| **Leadership Briefings** | • *"Prepare a comprehensive leadership update for executive review."*<br>• *"What are our top financial and operational risks this week?"* |
| **Ambiguity & Clarifications** | • *"How are we doing?"* → *Agent asks whether to focus on sales pipeline, operational delivery, or both.* |

---

## 📈 Leadership Update Feature (Optional Requirement)

When invoked (via query chip or asking *"Prepare a leadership update"*), the agent synthesizes an executive briefing structured into 4 pillars:

1. **Revenue & Pipeline Telemetry:** Total active pipeline (`₹68.82 Cr`), win rate (`51%`), and highest opportunity sectors.
2. **Operations & Billing Performance:** Total contract value (`₹24.97 Cr`), billed revenue (`₹12.67 Cr`), and cash collection efficiency (`71%`).
3. **Concentration & Operational Risks:** Identifies stalled work orders (e.g. 4 stuck projects with `₹35.21 L` at risk) and single-account collection bottlenecks (`WOCOMPANY_010` with `₹1.03 Cr` pending).
4. **Strategic Action Plan:** Provides 3 clear, prioritized recommendations for leadership focus.

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js LTS** (v18 or v20+)
- **monday.com API Token**
- **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/))

### 2. Installation
```bash
git clone https://github.com/your-username/skylark-bi-agent.git
cd skylark-bi-agent
npm install
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
npm start
```
Open **`http://localhost:3000`** in your browser.

---

## ⚙️ Environment Variables Reference

| Variable | Required | Description |
|---|:---:|---|
| `MONDAY_API_TOKEN` | ✅ | monday.com Personal API Token (v2) |
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `GEMINI_MODEL` | ⬜ | Primary Gemini model name (default: `gemini-flash-lite-latest`) |
| `DEALS_BOARD_ID` | ⬜ | Board ID for Deal Funnel on monday.com |
| `WORK_ORDERS_BOARD_ID` | ⬜ | Board ID for Work Order Tracker on monday.com |
| `PORT` | ⬜ | Server port (default: `3000` / `10000` on Render) |

---

## 👥 Author
- **Candidate:** Jeiesh J S
- **Role:** Full Stack Developer
