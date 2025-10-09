import re
import sys
from pathlib import Path

if len(sys.argv) < 2:
    print("Usage: python3 make_summary.py <logfile>")
    sys.exit(1)

log_path = Path(sys.argv[1])

if not log_path.exists():
    print(f"Error: file '{log_path}' not found.")
    sys.exit(1)

with open(log_path, "r", encoding="utf-8") as f:
    text = f.read()

pattern = r"`==== Summary app:[\s\S]*?============"

matches = re.findall(pattern, text)

for match in matches:
    print(match)

