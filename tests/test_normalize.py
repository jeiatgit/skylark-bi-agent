"""
Test suite for pandas data normalization and cleaning.
Run: pytest
"""

import pandas as pd
from app.normalize import normalize_deals, normalize_work_orders, normalize_status, parse_quantity

def test_normalize_status():
    assert normalize_status("BIlled") == "Billed"
    assert normalize_status("Pause / struck") == "Stuck"
    assert normalize_status("Executed until current month") == "Ongoing"
    assert normalize_status("") == "Unknown"

def test_parse_quantity():
    q1 = parse_quantity("5360 HA")
    assert q1["value"] == 5360.0
    assert q1["unit"] == "HA"

    q2 = parse_quantity("45 days")
    assert q2["value"] == 45.0
    assert q2["unit"] == "days"

def test_normalize_deals_filters_headers():
    raw_df = pd.DataFrame([
        {"Deal Name": "Deal Status", "Deal Status": "Deal Status", "Deal Stage": "Deal Stage"},
        {"Deal Name": "Project Alpha", "Deal Status": "Open", "Deal Stage": "E. Proposal/Commercials Sent", "Deal Value": "1000000"}
    ])
    clean_df, warnings = normalize_deals(raw_df)
    assert len(clean_df) == 1
    assert clean_df.iloc[0]["Deal Name"] == "Project Alpha"
    assert clean_df.iloc[0]["Deal Value"] == 1000000.0

def test_normalize_work_orders_numeric_conversion():
    raw_df = pd.DataFrame([
        {"Deal name masked": "WO_01", "Execution Status": "Completed", "Amount in Rupees (Incl of GST) (Masked)": "500,000", "Collected Amount in Rupees (Incl of GST.) (Masked)": "400,000", "Amount Receivable (Masked)": "100,000"}
    ])
    clean_df, warnings = normalize_work_orders(raw_df)
    assert len(clean_df) == 1
    assert clean_df.iloc[0]["Amount Incl GST"] == 500000.0
    assert clean_df.iloc[0]["Amount Receivable"] == 100000.0
