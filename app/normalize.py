"""
Data Normalization & Cleaning Layer using pandas
Handles messy real-world data, typos, mixed units, serial dates, and null values.
"""

import re
import pandas as pd
from typing import Tuple, List, Dict, Any

STAGE_ORDER = {
    "A. Lead Generated": 1,
    "B. Sales Qualified Leads": 2,
    "C. Demo Done": 3,
    "D. Feasibility": 4,
    "E. Proposal/Commercials Sent": 5,
    "F. Negotiations": 6,
    "G. Project Won": 7,
    "H. Work Order Received": 8,
    "I. POC": 9,
    "J. Invoice sent": 10,
    "K. Amount Accrued": 11,
    "L. Project Lost": 12,
    "M. Projects On Hold": 13,
    "N. Not relevant at the moment": 14,
    "O. Not Relevant at all": 15,
    "Project Completed": 16,
}


def normalize_status(val: Any) -> str:
    """Standardize execution and billing statuses with typos."""
    if pd.isna(val) or not str(val).strip():
        return "Unknown"
    s = str(val).strip()
    s_lower = s.lower()
    if s_lower.startswith("billed"):
        return "Billed"
    if "pause" in s_lower or "struck" in s_lower or "stuck" in s_lower:
        return "Stuck"
    if "executed until current month" in s_lower:
        return "Ongoing"
    return s


def parse_quantity(val: Any) -> Dict[str, Any]:
    """Parse messy quantity strings (e.g. '5360 HA', '2057 Acr', '45 days', '7000 images')."""
    if pd.isna(val) or not str(val).strip():
        return {"value": None, "unit": None, "raw": ""}
    s = str(val).strip()
    match = re.match(r"^([\d,\.]+)\s*(.*)$", s)
    if match:
        num_str = match.group(1).replace(",", "")
        try:
            num = float(num_str)
            unit = match.group(2).strip() or "units"
            return {"value": num, "unit": unit, "raw": s}
        except ValueError:
            pass
    return {"value": None, "unit": None, "raw": s}


def normalize_deals(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """Clean and normalize Deals dataframe, returning (clean_df, warnings)."""
    warnings = []
    
    # Filter header-leak rows (where cell text matches header name)
    if "Deal Status" in df.columns:
        df = df[df["Deal Status"].astype(str).str.strip() != "Deal Status"].copy()
    if "Deal Stage" in df.columns:
        df = df[df["Deal Stage"].astype(str).str.strip() != "Deal Stage"].copy()

    # Column mapping & defaults
    df["Deal Name"] = df.get("Deal Name", df.get("name", "Unknown Deal")).fillna("Unknown Deal").astype(str).str.strip()
    df["Owner Code"] = df.get("Owner Code", df.get("Owner code", "")).fillna("").astype(str).str.strip()
    df["Client Code"] = df.get("Client Code", "").fillna("").astype(str).str.strip()
    df["Deal Status"] = df.get("Deal Status", "Open").fillna("Open").astype(str).str.strip()
    df["Sector"] = df.get("Sector", df.get("Sector/service", "Unknown")).fillna("Unknown").astype(str).str.strip()
    df["Deal Stage"] = df.get("Deal Stage", "Unknown").fillna("Unknown").astype(str).str.strip()
    df["Closure Probability"] = df.get("Closure Probability", "Unknown").fillna("Unknown").astype(str).str.strip()

    # Deal value conversion
    val_col = "Deal Value" if "Deal Value" in df.columns else "Masked Deal value"
    df["Deal Value"] = pd.to_numeric(df.get(val_col, 0).astype(str).str.replace(",", ""), errors="coerce").fillna(0)

    # Dates
    for d_col in ["Close Date", "Close Date (A)", "Tentative Close Date", "Created Date"]:
        if d_col in df.columns:
            # Handle Excel serial numbers or ISO dates
            df[d_col] = pd.to_datetime(df[d_col], errors="coerce").dt.strftime("%Y-%m-%d")

    df["Stage Order"] = df["Deal Stage"].map(STAGE_ORDER).fillna(99).astype(int)
    
    # Derived flags
    df["isOpen"] = df["Deal Status"].str.lower() == "open"
    df["isWon"] = (df["Deal Status"].str.lower() == "won") | df["Deal Stage"].isin([
        "G. Project Won", "H. Work Order Received", "I. POC", "J. Invoice sent", "K. Amount Accrued", "Project Completed"
    ])
    df["isLost"] = (df["Deal Status"].str.lower() == "dead") | (df["Deal Stage"] == "L. Project Lost")

    # Quality warnings
    missing_dates = df[df["isOpen"] & df.get("Tentative Close Date", pd.Series([None]*len(df))).isna()]
    if len(missing_dates) > 0:
        warnings.append(f"{len(missing_dates)} open deals have unpopulated tentative close dates.")

    zero_val = df[df["Deal Value"] == 0]
    if len(zero_val) > 0:
        warnings.append(f"{len(zero_val)} deals have zero or unrecorded contract value.")

    return df, warnings


def normalize_work_orders(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """Clean and normalize Work Orders dataframe, returning (clean_df, warnings)."""
    warnings = []

    # Filter invalid empty header rows
    name_col = "Deal name masked" if "Deal name masked" in df.columns else "name"
    df = df[df[name_col].notna() & (df[name_col].astype(str).str.strip() != "")].copy()

    df["Deal Name"] = df[name_col].fillna("Unknown WO").astype(str).str.strip()
    df["Customer Code"] = df.get("Customer Name Code", df.get("Customer Code", "")).fillna("").astype(str).str.strip()
    df["Serial Number"] = df.get("Serial #", df.get("Serial Number", "")).fillna("").astype(str).str.strip()
    df["Sector"] = df.get("Sector", "Unknown").fillna("Unknown").astype(str).str.strip()
    df["Execution Status"] = df.get("Execution Status", "Unknown").apply(normalize_status)
    df["Billing Status"] = df.get("Billing Status", "Unknown").apply(normalize_status)
    df["Invoice Status"] = df.get("Invoice Status", "Unknown").fillna("Unknown").astype(str).str.strip()

    # Numeric financial conversions
    def to_num(col_name: str) -> pd.Series:
        if col_name in df.columns:
            return pd.to_numeric(df[col_name].astype(str).str.replace(",", ""), errors="coerce").fillna(0)
        return pd.Series(0, index=df.index)

    df["Amount Excl GST"] = to_num("Amount in Rupees (Excl of GST) (Masked)") if "Amount in Rupees (Excl of GST) (Masked)" in df.columns else to_num("Amount Excl GST")
    df["Amount Incl GST"] = to_num("Amount in Rupees (Incl of GST) (Masked)") if "Amount in Rupees (Incl of GST) (Masked)" in df.columns else to_num("Amount Incl GST")
    df["Billed Incl GST"] = to_num("Billed Value in Rupees (Incl of GST.) (Masked)") if "Billed Value in Rupees (Incl of GST.) (Masked)" in df.columns else to_num("Billed Incl GST")
    df["Collected Amount"] = to_num("Collected Amount in Rupees (Incl of GST.) (Masked)") if "Collected Amount in Rupees (Incl of GST.) (Masked)" in df.columns else to_num("Collected Amount")
    df["Amount Receivable"] = to_num("Amount Receivable (Masked)") if "Amount Receivable (Masked)" in df.columns else to_num("Amount Receivable")

    # Derived flags
    df["isCompleted"] = df["Execution Status"] == "Completed"
    df["isStuck"] = df["Execution Status"] == "Stuck"
    df["isOngoing"] = df["Execution Status"].isin(["Ongoing", "Executed until current month"])

    # Quality warnings
    zero_contract = df[df["Amount Incl GST"] == 0]
    if len(zero_contract) > 0:
        warnings.append(f"{len(zero_contract)} work orders have unrecorded/zero total contract value.")

    return df, warnings
