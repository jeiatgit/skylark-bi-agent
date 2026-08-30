"""
AI Agent Layer for Skylark BI Agent (Python)
Implements 2-stage Intent Routing + Grounded Executive Synthesis with Multi-Model Fallback.
"""

import json
import re
import requests
from typing import Dict, Any, List
from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.analytics import (
    query_deals,
    query_work_orders,
    cross_board_summary,
    get_kpis,
    get_leadership_summary,
)

MODELS = [GEMINI_MODEL, "gemini-3.6-flash", "gemma-4-31b-it"]

ROUTER_SYSTEM = """You are a query router for Skylark Drones Business Intelligence Agent.
Given a user's question, determine the single best analytical tool and arguments to execute.

Available Tools:
1. "query_deals": for sales pipeline, deals, stages (Lead, Proposal, Won, Lost), probability, sector pipeline, sales reps.
   Arguments: { "sector": string, "deal_status": "Open"|"Won"|"Dead"|"On Hold"|"all", "deal_stage": string, "owner_code": string }

2. "query_work_orders": for operations, project execution, contract values, billing, cash collected, outstanding receivables, delayed/stuck projects.
   Arguments: { "sector": string, "execution_status": "Completed"|"Ongoing"|"Stuck"|"Not Started"|"all", "invoice_status": string }

3. "cross_board_summary": for comparing sales pipeline vs. operational billing/execution across sectors or company-wide.
   Arguments: { "sector": string }

4. "get_kpis": for top-level executive snapshot numbers (total pipeline, win rate, total receivables, active work orders).
   Arguments: {}

5. "get_leadership_summary": for comprehensive executive leadership updates, briefings, risks, and strategic focus.
   Arguments: {}

Output ONLY a valid JSON object:
{
  "tool": "tool_name",
  "args": { ... }
}
If the user is simply saying hello or greeting, output:
{
  "directReply": "Hello! I am your Skylark Business Intelligence Agent. Ask me anything about your sales pipeline or operational work orders."
}"""

SYNTHESIZER_SYSTEM = """You are Skylark BI Agent, an executive AI Business Intelligence assistant for Skylark Drones founders.
You will be provided with the user question along with verified, computed ground-truth metrics from monday.com.

Formatting Guidelines:
- Highlight key currency figures in INR (e.g. ₹68.82 Cr, ₹3.63 Cr, ₹77.07 L, or formatted numbers).
- Use clear sections:
  1. **Key Metrics Summary** (bullet points with bold numbers)
  2. **Detailed Breakdown** (markdown table or concise list)
  3. **Strategic Insights & Recommendations** (actionable takeaways for leadership)
  4. **Data Quality Note** (if applicable)
- Maintain an authoritative, crisp, and executive tone."""


def call_gemini(prompt: str, system_instruction: str = "") -> str:
    """Execute Gemini request with multi-model fallback."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured.")

    last_err = None
    for model in MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
        body: Dict[str, Any] = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2048},
        }
        if system_instruction:
            body["system_instruction"] = {"parts": [{"text": system_instruction}]}

        try:
            resp = requests.post(url, json=body, timeout=25)
            data = resp.json()

            if "error" in data:
                err = data["error"]
                if err.get("code") in [429, 404] or "RESOURCE_EXHAUSTED" in str(err):
                    last_err = err
                    continue
                raise RuntimeError(err.get("message", str(err)))

            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "").strip()
        except Exception as e:
            last_err = e
            continue

    raise RuntimeError(f"All Gemini models busy ({last_err}). Please retry in a few seconds.")


def execute_tool(tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """Execute deterministic pandas calculation tool."""
    print(f"[Agent Tool Execution] {tool_name} with args: {args}")
    if tool_name == "query_deals":
        return query_deals(
            sector=args.get("sector"),
            deal_status=args.get("deal_status"),
            deal_stage=args.get("deal_stage"),
            owner_code=args.get("owner_code"),
        )
    elif tool_name == "query_work_orders":
        return query_work_orders(
            sector=args.get("sector"),
            execution_status=args.get("execution_status"),
            invoice_status=args.get("invoice_status"),
        )
    elif tool_name == "cross_board_summary":
        return cross_board_summary(sector=args.get("sector"))
    elif tool_name == "get_leadership_summary":
        return get_leadership_summary()
    else:
        return get_kpis()


def run_agent(user_message: str) -> Dict[str, Any]:
    """Process user message through 2-stage Intent + Grounded Synthesis engine."""
    # Stage 1: Router
    route_raw = call_gemini(f'User Query: "{user_message}"\n\nOutput tool JSON:', ROUTER_SYSTEM)
    route: Dict[str, Any] = {}
    
    try:
        match = re.search(r"\{[\s\S]*\}", route_raw)
        if match:
            route = json.loads(match.group(0))
    except Exception:
        pass

    if route.get("directReply"):
        return {"text": route["directReply"], "toolsUsed": [], "toolResults": None}

    tool_name = route.get("tool", "get_kpis")
    tool_args = route.get("args", {})
    tool_results = execute_tool(tool_name, tool_args)

    # Stage 2: Grounded Synthesis
    synthesis_prompt = (
        f'User Question: "{user_message}"\n\n'
        f"Verified Ground-Truth Business Data (computed directly from monday.com boards via pandas):\n"
        f"Tool Executed: {tool_name}\n"
        f"Computed Results:\n{json.dumps(tool_results, indent=2)}\n\n"
        f"Synthesize a complete executive response for leadership with Key Metrics, Breakdown, Insights, and Data Quality Notes."
    )

    final_text = call_gemini(synthesis_prompt, SYNTHESIZER_SYSTEM)

    return {
        "text": final_text,
        "toolsUsed": [{"name": tool_name, "args": tool_args}],
        "toolResults": tool_results,
    }
