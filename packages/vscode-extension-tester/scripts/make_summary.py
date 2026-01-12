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

pattern = r"==== Summary app:[\s\S]*?============"
matches = re.findall(pattern, text)

for match in matches:
    p_match = re.search(r"(\d+)\s+passing", match)
    f_match = re.search(r"(\d+)\s+failing", match)
    pe_match = re.search(r"(\d+)\s+pending", match)

    passing = int(p_match.group(1)) if p_match else 0
    failing = int(f_match.group(1)) if f_match else 0
    pending = int(pe_match.group(1)) if pe_match else 0
    
    total = passing + failing
    
    info_line = "Info: 0 tests found"
    if total > 0:
        rate = (passing / total) * 100
        info_line = f"Info: {passing}/{total} tests passed ({rate:.2f}%)"

    lines = match.splitlines()
    clean_lines = []
    for line in lines:
        if "==========" not in line and "WebSocket server closed" not in line:
            clean_lines.append(line)

    if clean_lines:
        print(clean_lines[0])
        print(info_line)
        for line in clean_lines[1:]:
            print(line)
    
    print()
    