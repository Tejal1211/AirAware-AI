"""Development entry point: `python run.py`."""
import os
import sys

# Ensure backend directory is on sys.path regardless of execution directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=app.config["PORT"], debug=app.config["DEBUG"])
