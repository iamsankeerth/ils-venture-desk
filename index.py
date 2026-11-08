import os

os.environ.setdefault("ILS_DB", "/tmp/ils.db")

from backend.app import app
