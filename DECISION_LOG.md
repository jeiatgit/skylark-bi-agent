# Decision Log — Skylark Drones BI Agent

**Candidate:** Jeiesh J S  
**Role:** Full Stack Developer  
**Date:** August 30, 2026  
**Document Limit:** Maximum 2 Pages  

---

## 1. Key Assumptions

### A. Data Schema & Cross-Board Joins
* **Absence of Uniform Foreign Key:** While `Deal Funnel` utilizes `Deal Name` + `Client Code` (e.g. `COMPANY089`), `Work Order Tracker` uses `Deal name masked` + `Customer Name Code` (e.g. `WOCOMPANY_002`) and `Serial #` (`SDPLDEAL-xxx`). Masked deal names (such as "Sakura" or "Scooby-Doo") repeat across distinct clients.
* **Decision:** We assumed that cross-board correlation is best performed at the **Sector level** (e.g., Mining, Renewables, Powerline) and **Executive Account level** rather than attempting an ungrounded 1:1 join. This prevents false linkages between separate projects sharing the same fictional pseudonym.
* **Financial Accuracy Over Unit Homogenization:** The two datasets represent different sides of the business: Pipeline potential vs. Invoicing/Cash collected. We treated financial metrics (`Amount Incl GST`, `Billed Incl GST`, `Amount Receivable`) as the primary ground-truth indicators for business health.

### B. monday.com Integration Protocol
* **GraphQL REST API over MCP:** We elected to use monday.com's official GraphQL v2 API (`https://api.monday.com/v2`) with cursor-based pagination. This guarantees deterministic read-only access, low network latency, and simple environment-variable-based authentication on serverless and container runtimes (Render/Vercel) without external MCP server orchestration dependencies.

---

## 2. Architectural Trade-offs & Rationales

| Trade-off Dimension | Selected Approach | Alternative Considered | Rationale |
|:---|:---|:---|:---|
| **Calculation Engine** | **pandas DataFrame Aggregations** | Prompt-Stuffing (Raw Data to LLM) | Passing 500+ rows into prompt context causes hallucinated arithmetic, context truncation, and token wastage. Deterministic pandas analytics tools guarantee 100% calculation accuracy. |
| **Data Resiliency** | **Dual-Source Adapter Pattern** | Single Direct API Binding | The `analytics.py` adapter queries monday.com GraphQL API dynamically, but transparently falls back to parsed local data if board IDs are pending or rate limits are hit, ensuring 0% downtime during executive demos. |
| **Backend Framework** | **FastAPI (Python)** | Heavy Django / Flask Scaffolding | FastAPI provides asynchronous endpoint execution, native Pydantic typing, rapid serialization, and native static file serving for the Glassmorphism frontend. |
| **AI Model** | **Gemini with Multi-Model Fallback** | Single Fragile Endpoint | Automatically cascades between `gemini-flash-lite-latest`, `gemini-3.6-flash`, and `gemma-4-31b-it` to maintain uninterrupted service during free-tier rate limits. |

---

## 3. Interpretation of "Leadership Updates" (Optional Feature)

We interpreted "Leadership Updates" not as a static dashboard export, but as an **AI-driven strategic executive briefing**.

When invoked (via query chip or conversational request *"Prepare a leadership update"*), the agent:
1. **Aggregates Multi-Board Health:** Queries open pipeline value, win rate percentage, active work orders, and overall collection efficiency with pandas.
2. **Identifies Concentration Risks:** Pinpoints single accounts with large uncollected balances (e.g., Renewables key accounts carrying >₹1.6 Cr pending).
3. **Highlights Late-Stage Opportunities:** Surges top deals currently in Proposal or Negotiation stages requiring CXO sponsorship.
4. **Delivers Actionable Takeaways:** Formulates 3 prioritized action items for executive review rather than raw data dumps.

---

## 4. What We Would Do Differently With Additional Time

1. **Entity Resolution / Fuzzy Record Linkage:** Implement Jaro-Winkler or embedding-based semantic matching between `COMPANY_xxx` and `WOCOMPANY_xxx` codes to establish high-confidence entity resolution across historical boards.
2. **Interactive Charting Components:** Integrate lightweight Chart.js or Plotly modules within chat bubble responses for dynamic funnel visualization and aging receivables scatter plots.
3. **Bidirectional Write-Back & Task Automation:** Provide agent capabilities with explicit confirmation modals to update monday.com item status columns (e.g., flagging an overdue work order as "Escalated to Leadership").
4. **Multi-User RBAC & Saved Views:** Add authentication with role-based access control (e.g., Sales Rep view vs. CXO view) and persistent conversation session indexing via SQLite/PostgreSQL.
