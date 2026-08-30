"""
monday.com GraphQL API Client
Provides read-only access with cursor-based pagination.
"""

import requests
from typing import List, Dict, Any, Optional
from app.config import MONDAY_API_TOKEN

API_URL = "https://api.monday.com/v2"

def query_monday(query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Execute a GraphQL query against monday.com API v2."""
    if not MONDAY_API_TOKEN:
        raise ValueError("MONDAY_API_TOKEN is not configured.")

    headers = {
        "Authorization": MONDAY_API_TOKEN,
        "Content-Type": "application/json",
        "API-Version": "2024-01",
    }
    
    resp = requests.post(API_URL, json={"query": query, "variables": variables or {}}, headers=headers, timeout=20)
    data = resp.json()
    
    if "errors" in data:
        raise RuntimeError(f"monday.com API error: {data['errors']}")
    return data.get("data", {})


def fetch_all_board_items(board_id: str) -> List[Dict[str, Any]]:
    """Fetch all items and column values from a monday.com board with pagination."""
    items = []
    cursor = None

    while True:
        if cursor:
            query = """
            query($boardId: ID!, $cursor: String!) {
              next_items_page(limit: 200, cursor: $cursor) {
                cursor
                items { id name column_values { id text column { title } } }
              }
            }
            """
            vars_ = {"boardId": board_id, "cursor": cursor}
        else:
            query = """
            query($boardId: ID!) {
              boards(ids: [$boardId]) {
                items_page(limit: 200) {
                  cursor
                  items { id name column_values { id text column { title } } }
                }
              }
            }
            """
            vars_ = {"boardId": board_id}

        data = query_monday(query, vars_)
        page = data.get("next_items_page") if cursor else data.get("boards", [{}])[0].get("items_page", {})
        
        if not page:
            break

        cursor = page.get("cursor")
        for item in page.get("items", []):
            row = {"id": item["id"], "name": item.get("name", "Unnamed")}
            for cv in item.get("column_values", []):
                col_title = cv.get("column", {}).get("title")
                if col_title:
                    row[col_title] = cv.get("text", "") or ""
            items.append(row)

        if not cursor:
            break

    return items
