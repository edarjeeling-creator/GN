import os

def search_whitespace(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.js') or file.endswith('.jsx'):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        for line_no, line in enumerate(f, 1):
                            if 'whiteSpace' in line or 'pre-wrap' in line:
                                print(f"Found in {path}:{line_no} -> {line.strip()}")
                except Exception as e:
                    pass

search_whitespace(r'C:\Users\edarj\..gemini\antigravity\scratch\grade-management-system\src')
# Let's also look under C:\Users\edarj\.gemini\antigravity\scratch\grade-management-system\src
search_whitespace(r'C:\Users\edarj\.gemini\antigravity\scratch\grade-management-system\src')
