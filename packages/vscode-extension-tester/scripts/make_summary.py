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

soft_fail_lines = re.findall(r".*\[SOFT FAIL\].*", text)
soft_count = len(soft_fail_lines)

pattern = r"==== Summary app:[\s\S]*?============"
matches = re.findall(pattern, text)

for match in matches:
    p_match = re.search(r"(\d+)\s+passing", match)
    f_match = re.search(r"(\d+)\s+failing", match)
    pen_match = re.search(r"(\d+)\s+pending", match)
    
    passing = int(p_match.group(1)) if p_match else 0
    failing = int(f_match.group(1)) if f_match else 0
    pending = int(pen_match.group(1)) if pen_match else 0
    
    total = passing + failing + pending
    actual_pending = pending - soft_count
    
    if total > 0:
        critical_rate = (passing / total) * 100
        soft_rate = ((passing + soft_count) / total) * 100
    else:
        critical_rate = 0.0
        soft_rate = 0.0

    info_line = f"Info: Critical Success Rate: {critical_rate:.2f}% | With Soft Fails: {soft_rate:.2f}%"

    lines = match.splitlines()
    clean_lines = []
    for line in lines:
        if "==========" not in line and "WebSocket server closed" not in line:
            clean_lines.append(line)

    if clean_lines:
        print(clean_lines[0])
        print(info_line)
        
        soft_printed = False
        for line in clean_lines[1:]:
            if "pending" in line:
                print(f"  {actual_pending} pending")
            elif "failing" in line:
                print(line)
                print(f"  {soft_count} soft failing")
                soft_printed = True
            else:
                print(line)
        
        if not soft_printed and soft_count > 0:
             print(f"  {soft_count} soft failing")

    print()

if soft_fail_lines:
    print("-" * 30)
    print("Soft Fails Details:")
    for i, fail_msg in enumerate(soft_fail_lines, 1):
        print(f"{i}) {fail_msg.strip()}")
    print("-" * 30)