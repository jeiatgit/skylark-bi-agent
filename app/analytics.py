"""
Deterministic Business Intelligence Analytics Engine using pandas
Guarantees 100% calculation accuracy with zero AI arithmetic hallucination.
"""

from pathlib import Path
from typing import Dict, Any, Optional
import pandas as pd
from app.normalize import normalize_deals, normalize_work_orders
from app.monday import fetch_all_board_items
from app.config import DEALS_BOARD_ID, WORK_ORDERS_BOARD_ID

# In-memory session cache
_CACHE = {
    "deals_df": pd.DataFrame(),
    "work_orders_df": pd.DataFrame(),
    "deal_warnings": [],
    "wo_warnings": [],
    "source": "None",
    "last_sync": None,
}


def load_local_excel() -> Dict[str, Any]:
    """Fallback: Load and normalize datasets from local Excel files."""
    base_dir = Path(__file__).resolve().parent.parent.parent
    
    deal_file = base_dir / "Deal funnel Data.xlsx"
    wo_file = base_dir / "Work_Order_Tracker Data.xlsx"
    
    # Read sheets
    deals_raw = pd.read_excel(deal_file, sheet_name=0)
    wo_raw = pd.read_excel(wo_file, sheet_name=0, header=1)

    clean_deals, d_warn = normalize_deals(deals_raw)
    clean_wos, wo_warn = normalize_work_orders(wo_raw)

    _CACHE["deals_df"] = clean_deals
    _CACHE["work_orders_df"] = clean_wos
    _CACHE["deal_warnings"] = d_warn
    _CACHE["wo_warnings"] = wo_warn
    _CACHE["source"] = "Excel (Fast Boot / Fallback)"
    _CACHE["last_sync"] = pd.Timestamp.now().isoformat()

    return _CACHE


def refresh_data() -> Dict[str, Any]:
    """Fetch live from monday.com API or fall back to Excel."""
    if not DEALS_BOARD_ID or not WORK_ORDERS_BOARD_ID:
        return load_local_excel()

    try:
        raw_deals = fetch_all_board_items(DEALS_BOARD_ID)
        raw_wos = fetch_all_board_items(WORK_ORDERS_BOARD_ID)

        df_deals = pd.DataFrame(raw_deals)
        df_wos = pd.DataFrame(raw_wos)

        clean_deals, d_warn = normalize_deals(df_deals)
        clean_wos, wo_warn = normalize_work_orders(df_wos)

        _CACHE["deals_df"] = clean_deals
        _CACHE["work_orders_df"] = clean_wos
        _CACHE["deal_warnings"] = d_warn
        _CACHE["wo_warnings"] = wo_warn
        _CACHE["source"] = "monday.com (Live GraphQL API)"
        _CACHE["last_sync"] = pd.Timestamp.now().isoformat()

        return _CACHE
    except Exception as e:
        print(f"[Analytics] monday.com fetch warning ({e}). Falling back to local Excel.")
        return load_local_excel()


def get_data() -> Dict[str, Any]:
    """Ensure data is loaded in memory."""
    if _CACHE["deals_df"].empty or _CACHE["work_orders_df"].empty:
        load_local_excel()
    return _CACHE


# ══════════════════════════════════════════════════════════════════════════
# ANALYTICS FUNCTIONS (PANDAS CALCULATIONS)
# ══════════════════════════════════════════════════════════════════════════

def query_deals(
    sector: Optional[str] = None,
    deal_status: Optional[str] = None,
    deal_stage: Optional[str] = None,
    owner_code: Optional[str] = None,
    group_by: Optional[str] = None,
    limit: int = 10,
) -> Dict[str, Any]:
    """Filter and aggregate sales pipeline deals with pandas."""
    data = get_data()
    df: pd.DataFrame = data["deals_df"].copy()

    if sector and sector.lower() != "all":
        df = df[df["Sector"].str.contains(sector, case=False, na=False)]
    if deal_status and deal_status.lower() != "all":
        df = df[df["Deal Status"].str.lower() == deal_status.lower()]
    if deal_stage and deal_stage.lower() != "all":
        df = df[df["Deal Stage"].str.contains(deal_stage, case=False, na=False)]
    if owner_code and owner_code.lower() != "all":
        df = df[df["Owner Code"] == owner_code]

    total_deals = len(df)
    total_val = float(df["Deal Value"].sum())
    won_df = df[df["isWon"]]
    open_df = df[df["isOpen"]]
    lost_df = df[df["isLost"]]
    win_rate = round((len(won_df) / total_deals * 100)) if total_deals > 0 else 0

    # Sector breakdown
    sector_agg = (
        df.groupby("Sector")["Deal Value"]
        .agg(["count", "sum"])
        .reset_index()
        .sort_values(by="sum", ascending=False)
    )
    sector_breakdown = [
        {"sector": r["Sector"], "count": int(r["count"]), "value": round(float(r["sum"]))}
        for _, r in sector_agg.iterrows()
    ]

    # Stage breakdown
    stage_agg = (
        df.groupby("Deal Stage")["Deal Value"]
        .agg(["count", "sum"])
        .reset_index()
        .sort_values(by="sum", ascending=False)
    )
    stage_breakdown = [
        {"stage": r["Deal Stage"], "count": int(r["count"]), "value": round(float(r["sum"]))}
        for _, r in stage_agg.iterrows()
    ]

    # Top deals
    top_deals = (
        df.sort_values(by="Deal Value", ascending=False)
        .head(limit)[["Deal Name", "Client Code", "Sector", "Deal Stage", "Deal Status", "Deal Value", "Closure Probability"]]
        .to_dict(orient="records")
    )
    for d in top_deals:
        d["Deal Value"] = round(float(d["Deal Value"]))

    return {
        "summary": {
            "totalDeals": total_deals,
            "totalPipelineValue": round(total_val),
            "wonDealsCount": len(won_df),
            "wonValue": round(float(won_df["Deal Value"].sum())),
            "openDealsCount": len(open_df),
            "openValue": round(float(open_df["Deal Value"].sum())),
            "lostDealsCount": len(lost_df),
            "winRate": win_rate,
        },
        "stageBreakdown": stage_breakdown,
        "sectorBreakdown": sector_breakdown,
        "topDeals": top_deals,
        "dataWarnings": data["deal_warnings"][:3],
    }


def query_work_orders(
    sector: Optional[str] = None,
    execution_status: Optional[str] = None,
    invoice_status: Optional[str] = None,
    group_by: Optional[str] = None,
    limit: int = 10,
) -> Dict[str, Any]:
    """Filter and aggregate operational work orders and billing metrics."""
    data = get_data()
    df: pd.DataFrame = data["work_orders_df"].copy()

    if sector and sector.lower() != "all":
        df = df[df["Sector"].str.contains(sector, case=False, na=False)]
    if execution_status and execution_status.lower() != "all":
        df = df[df["Execution Status"].str.contains(execution_status, case=False, na=False)]
    if invoice_status and invoice_status.lower() != "all":
        df = df[df["Invoice Status"].str.contains(invoice_status, case=False, na=False)]

    total_contract = float(df["Amount Incl GST"].sum())
    total_billed = float(df["Billed Incl GST"].sum())
    total_collected = float(df["Collected Amount"].sum())
    total_receivable = float(df["Amount Receivable"].sum())

    completed = len(df[df["isCompleted"]])
    ongoing = len(df[df["isOngoing"]])
    stuck = len(df[df["isStuck"]])

    # Sector breakdown with pandas
    sec_agg = (
        df.groupby("Sector")
        .agg({
            "Amount Incl GST": ["count", "sum"],
            "Billed Incl GST": "sum",
            "Collected Amount": "sum",
            "Amount Receivable": "sum",
        })
        .reset_index()
    )
    sec_agg.columns = ["Sector", "count", "contract", "billed", "collected", "receivable"]
    sector_breakdown = [
        {
            "sector": r["Sector"],
            "count": int(r["count"]),
            "contractValue": round(float(r["contract"])),
            "billedValue": round(float(r["billed"])),
            "collectedValue": round(float(r["collected"])),
            "receivableValue": round(float(r["receivable"])),
            "collectionRate": round(float(r["collected"]) / float(r["billed"]) * 100) if float(r["billed"]) > 0 else 0,
        }
        for _, r in sec_agg.sort_values(by="contract", ascending=False).iterrows()
    ]

    # Top outstanding receivables
    top_receivables = (
        df[df["Amount Receivable"] > 0]
        .sort_values(by="Amount Receivable", ascending=False)
        .head(limit)[["Deal Name", "Customer Code", "Sector", "Execution Status", "Amount Incl GST", "Billed Incl GST", "Collected Amount", "Amount Receivable"]]
        .to_dict(orient="records")
    )
    for w in top_receivables:
        for k in ["Amount Incl GST", "Billed Incl GST", "Collected Amount", "Amount Receivable"]:
            w[k] = round(float(w[k]))

    return {
        "summary": {
            "totalWorkOrders": len(df),
            "totalContractValue": round(total_contract),
            "totalBilled": round(total_billed),
            "totalCollected": round(total_collected),
            "totalReceivable": round(total_receivable),
            "completedCount": completed,
            "ongoingCount": ongoing,
            "stuckCount": stuck,
            "billingRate": round(total_billed / total_contract * 100) if total_contract > 0 else 0,
            "collectionRate": round(total_collected / total_billed * 100) if total_billed > 0 else 0,
        },
        "sectorBreakdown": sector_breakdown,
        "topReceivables": top_receivables,
        "dataWarnings": data["wo_warnings"][:3],
    }


def cross_board_summary(sector: Optional[str] = None) -> Dict[str, Any]:
    """Correlate sales pipeline against operational billing performance."""
    deals = query_deals(sector=sector)
    wos = query_work_orders(sector=sector)

    return {
        "sector": sector or "All Sectors",
        "pipeline": deals["summary"],
        "operations": wos["summary"],
        "sectorPipeline": deals["sectorBreakdown"],
        "sectorOperations": wos["sectorBreakdown"],
        "note": "Cross-board correlation performed by industry sector vertical.",
    }


def get_kpis() -> Dict[str, Any]:
    """Return top-level telemetry metrics."""
    data = get_data()
    d_df = data["deals_df"]
    w_df = data["work_orders_df"]

    open_deals = d_df[d_df["isOpen"]]
    won_deals = d_df[d_df["isWon"]]
    total_pipeline = float(open_deals["Deal Value"].sum())
    won_val = float(won_deals["Deal Value"].sum())
    win_rate = round(len(won_deals) / len(d_df) * 100) if len(d_df) > 0 else 0

    contract_val = float(w_df["Amount Incl GST"].sum())
    billed_val = float(w_df["Billed Incl GST"].sum())
    collected_val = float(w_df["Collected Amount"].sum())
    receivable_val = float(w_df["Amount Receivable"].sum())
    stuck_wos = len(w_df[w_df["isStuck"]])
    active_wos = len(w_df[w_df["isOngoing"] | ~w_df["isCompleted"]])

    return {
        "pipeline": {
            "totalOpenDeals": len(open_deals),
            "totalPipelineValue": round(total_pipeline),
            "wonDealsCount": len(won_deals),
            "wonValue": round(won_val),
            "winRate": win_rate,
        },
        "operations": {
            "totalWorkOrders": len(w_df),
            "totalContractValue": round(contract_val),
            "totalBilled": round(billed_val),
            "totalCollected": round(collected_val),
            "totalReceivable": round(receivable_val),
            "ongoingWorkOrders": active_wos,
            "stuckWorkOrders": stuck_wos,
            "billingRate": round(billed_val / contract_val * 100) if contract_val > 0 else 0,
            "collectionRate": round(collected_val / billed_val * 100) if billed_val > 0 else 0,
        },
        "source": data["source"],
        "lastSync": data["last_sync"],
    }


def get_leadership_summary() -> Dict[str, Any]:
    """Prepare comprehensive executive leadership briefing."""
    kpis = get_kpis()
    data = get_data()
    d_df = data["deals_df"]
    w_df = data["work_orders_df"]

    # Top pipeline sector
    open_df = d_df[d_df["isOpen"]]
    top_sec_pipeline = open_df.groupby("Sector")["Deal Value"].sum().sort_values(ascending=False).head(1)
    top_pipeline_sec = {"sector": top_sec_pipeline.index[0], "value": round(float(top_sec_pipeline.iloc[0]))} if len(top_sec_pipeline) > 0 else None

    # Top receivable sector
    top_sec_recv = w_df.groupby("Sector")["Amount Receivable"].sum().sort_values(ascending=False).head(1)
    top_recv_sec = {"sector": top_sec_recv.index[0], "value": round(float(top_sec_recv.iloc[0]))} if len(top_sec_recv) > 0 else None

    # Key risks
    risks = []
    stuck_count = len(w_df[w_df["isStuck"]])
    if stuck_count > 0:
        risks.append(f"{stuck_count} work order projects are currently stalled/stuck.")
    
    high_recv = w_df[w_df["Amount Receivable"] > 1000000]
    if len(high_recv) > 0:
        risks.append(f"{len(high_recv)} client accounts have overdue balances exceeding ₹10 Lakhs.")

    # High value late-stage deals
    late_stage = (
        open_df[open_df["Stage Order"].between(5, 8)]
        .sort_values(by="Deal Value", ascending=False)
        .head(5)[["Deal Name", "Sector", "Deal Stage", "Deal Value"]]
        .to_dict(orient="records")
    )
    for d in late_stage:
        d["Deal Value"] = round(float(d["Deal Value"]))

    return {
        "pipeline": kpis["pipeline"],
        "operations": kpis["operations"],
        "topPipelineSector": top_pipeline_sec,
        "topReceivableSector": top_recv_sec,
        "lateStageOpportunities": late_stage,
        "risks": risks,
    }
