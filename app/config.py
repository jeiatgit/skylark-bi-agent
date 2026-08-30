import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

MONDAY_API_TOKEN = os.getenv("MONDAY_API_TOKEN", "")
DEALS_BOARD_ID = os.getenv("DEALS_BOARD_ID", "")
WORK_ORDERS_BOARD_ID = os.getenv("WORK_ORDERS_BOARD_ID", "")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")

PORT = int(os.getenv("PORT", 3000))
