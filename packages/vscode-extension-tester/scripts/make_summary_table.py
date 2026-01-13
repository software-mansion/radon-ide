import sys
import re
import os

def get_status_icon(percentage_val):
    if percentage_val == 100:
        return "🟢"
    elif percentage_val > 90:
        return "🟡"
    elif percentage_val > 80:
        return "🟠"
    else:
        return "🔴"

def parse_and_generate_markdown(file_path):
    try:
        with open(file_path, 'r') as f:
            content = f.read()
    except FileNotFoundError:
        return "Error: Input file not found."

    blocks = content.split('============')
    
    markdown = "### Test Results Overview\n\n"
    markdown += "| App | Version | OS | Passing | Failing | Soft Fails | Critical % | Soft % |\n"
    markdown += "| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |\n"

    rows_count = 0

    for block in blocks:
        if not block.strip():
            continue

        header_pattern = r"app:\s*(.*?)\s*\|\s*code version:\s*(.*?)\s*\|\s*os:\s*(.*?)\s*===="
        header_match = re.search(header_pattern, block)

        if not header_match:
            continue

        app_name = header_match.group(1).strip()
        code_version = header_match.group(2).strip()
        os_name = header_match.group(3).strip()

        soft_fails = block.count("[SOFT FAIL]")

        pass_match = re.search(r'\s(\d+)\s+passing', block)
        fail_match = re.search(r'\s(\d+)\s+failing', block)

        passing = int(pass_match.group(1)) if pass_match else 0
        failing = int(fail_match.group(1)) if fail_match else 0
        
        total = passing + failing
        crit_perc = 0.0
        soft_perc = 0.0

        if total > 0:
            crit_perc = (passing / total) * 100
            
            safe_passing = passing - soft_fails
            if safe_passing < 0: safe_passing = 0
            soft_perc = (safe_passing / total) * 100

        crit_perc_str = "{:.2f}".format(crit_perc)
        soft_perc_str = "{:.2f}".format(soft_perc)

        crit_icon = get_status_icon(crit_perc)
        soft_icon = get_status_icon(soft_perc)

        fail_display = f"🔴 {failing}" if failing > 0 else str(failing)
        soft_display = f"🟡 {soft_fails}" if soft_fails > 0 else str(soft_fails)

        row = f"| {app_name} | {code_version} | {os_name} | {passing} | {fail_display} | {soft_display} | {crit_icon} {crit_perc_str}% | {soft_icon} {soft_perc_str}% |"
        markdown += row + "\n"
        rows_count += 1

    if rows_count == 0:
        return "No test summaries found in the log."

    return markdown

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 results_to_markdown.py <path_to_log_file>")
        sys.exit(1)

    input_file = sys.argv[1]
    summary_markdown = parse_and_generate_markdown(input_file)

    step_summary_path = os.getenv('GITHUB_STEP_SUMMARY')
    if step_summary_path:
        with open(step_summary_path, 'a', encoding='utf-8') as f:
            f.write(summary_markdown)
    else:
        print(summary_markdown)