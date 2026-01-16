import sys
import re
import os

def extract_failures(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        return "Error: Input file not found."

    blocks = content.split('============')
    markdown_output = ""
    has_any_failure = False

    for block in blocks:
        if not block.strip():
            continue

        header_match = re.search(r"app:\s*(.*?)\s*\|\s*code version:\s*(.*?)\s*\|\s*os:\s*(.*?)\s*====", block)
        if not header_match:
            continue

        app_name = header_match.group(1).strip()
        code_version = header_match.group(2).strip()
        os_name = header_match.group(3).strip()

        critical_fails_text = ""
        soft_fails_text = ""

        lines = block.splitlines()
        capture_critical = False
        critical_buffer = []

        for line in lines:
            if re.match(r"\s+\d+\) ", line):
                capture_critical = True

            if "INFO: Screenshots" in line or "Test suit numbers" in line or "Soft Fails Details:" in line:
                capture_critical = False
            
            if capture_critical:
                critical_buffer.append(line)

        if critical_buffer:
            critical_fails_text = "\n".join(critical_buffer).strip()

        soft_fails_matches = re.findall(r"\d+\) \[SOFT FAIL\].*", block)
        if soft_fails_matches:
            soft_fails_text = "\n".join([f"- {sf.strip()}" for sf in soft_fails_matches])

        if critical_fails_text or soft_fails_text:
            has_any_failure = True
            markdown_output += f"### Failure Details: {app_name} ({os_name}) (VSCode {code_version})\n\n"
            
            if critical_fails_text:
                markdown_output += "**Critical Failures:**\n"
                markdown_output += "```text\n"
                markdown_output += critical_fails_text + "\n"
                markdown_output += "```\n\n"
            
            if soft_fails_text:
                markdown_output += "**Soft Fails:**\n"
                markdown_output += soft_fails_text + "\n\n"
            
            markdown_output += "---\n"

    if not has_any_failure:
        return "" 

    return "## Detailed Failure Logs\n" + markdown_output

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 failures_to_markdown.py <path_to_log_file>")
        sys.exit(1)

    input_file = sys.argv[1]
    markdown = extract_failures(input_file)

    step_summary_path = os.getenv('GITHUB_STEP_SUMMARY')
    if step_summary_path and markdown:
        with open(step_summary_path, 'a', encoding='utf-8') as f:
            f.write(markdown)
    elif markdown:
        print(markdown)
