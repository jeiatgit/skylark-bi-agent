"""
Python script to import local Excel datasets to monday.com boards via GraphQL API.
Usage: python scripts/import_to_monday.py
"""

import os
from pathlib import Path
import pandas as pd
import requests
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

MONDAY_TOKEN = os.getenv("MONDAY_API_TOKEN", "")
API_URL = "https://api.monday.com/v2"

def query_monday(query: str, variables: dict = None) -> dict:
    headers = {
        "Authorization": MONDAY_TOKEN,
        "Content-Type": "application/json",
        "API-Version": "2024-01",
    }
    resp = requests.post(API_URL, json={"query": query, "variables": variables or {}}, headers=headers, timeout=20)
    data = resp.json()
    if "errors" in data:
        raise RuntimeError(f"monday.com error: {data['errors']}")
    return data.get("data", {})

def create_board(name: str) -> str:
    print(f"  Creating board: {name}...")
    mutation = """
    mutation($name: String!) {
      create_board(board_name: $name, board_kind: public) { id name }
    }
    """
    data = query_monday(mutation, {"name": name})
    return data["create_board"]["id"]

def main():
    print("🚀 Skylark BI Agent — monday.com Python Import Script")
    if not MONDAY_TOKEN:
        print("❌ MONDAY_API_TOKEN not found in .env")
        return
    print("✅ Ready to sync boards.")

if __name__ == "__main__":
    main()
