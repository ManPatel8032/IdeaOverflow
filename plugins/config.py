import os
from dotenv import load_dotenv

# Load from project root .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
load_dotenv()

# Load API key from environment variable (recommended) or set directly
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
