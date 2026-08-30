"""
Test suite for deterministic pandas calculations and BI queries.
Run: pytest
"""

from app.analytics import get_kpis, query_deals, query_work_orders

def test_get_kpis_structure():
    kpis = get_kpis()
    assert "pipeline" in kpis
    assert "operations" in kpis
    assert "totalPipelineValue" in kpis["pipeline"]
    assert "winRate" in kpis["pipeline"]
    assert "totalReceivable" in kpis["operations"]

def test_query_deals_sector_filter():
    res = query_deals(sector="Mining")
    assert "summary" in res
    assert "sectorBreakdown" in res
    assert "topDeals" in res
    assert isinstance(res["summary"]["totalPipelineValue"], (int, float))

def test_query_work_orders_status_filter():
    res = query_work_orders(execution_status="Stuck")
    assert "summary" in res
    assert "topReceivables" in res
    assert res["summary"]["stuckCount"] >= 0
