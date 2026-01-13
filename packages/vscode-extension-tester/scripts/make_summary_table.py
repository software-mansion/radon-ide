import sys
import re
import os

def get_status_icon(percentage_str):
    try:
        val = float(percentage_str)
    except ValueError:
        return ""
    
    if val == 100:
        return "🟢"
    elif val > 90:
        return "🟡"
    elif val > 80:
        return "🟠"
    else:
        return "🔴"

def parse_and_generate_markdown(file_path):
    try:
        with open(file_path, 'r') as f:
            content = f.read()
    except FileNotFoundError:
        return "Error: Input file not found."

    blocks = content.split('==== Summary')
    
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

        crit_match = re.search(r'\[CRITICAL PASSING PERCENTAGE\]:\s*([\d\.]+)%', block)
        soft_perc_match = re.search(r'\[PASSING PERCENTAGE WITH SOFT FAILS\]:\s*([\d\.]+)%', block)
        pass_match = re.search(r'\[PASSING\]:\s*(\d+)', block)
        fail_match = re.search(r'\[FAILS\]:\s*(\d+)', block)
        soft_match = re.search(r'\[SOFT FAILS\]:\s*(\d+)', block)

        crit_perc = crit_match.group(1) if crit_match else '0'
        soft_perc = soft_perc_match.group(1) if soft_perc_match else '0'
        passing = pass_match.group(1) if pass_match else '0'
        failing = fail_match.group(1) if fail_match else '0'
        soft_fails = soft_match.group(1) if soft_match else '0'

        crit_icon = get_status_icon(crit_perc)
        soft_icon = get_status_icon(soft_perc)

        row = f"| {app_name} | {code_version} | {os_name} | {passing} | {failing} | {soft_fails} | {crit_icon} {crit_perc}% | {soft_icon} {soft_perc}% |"
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