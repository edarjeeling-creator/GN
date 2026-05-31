import os
import re

def search_rpc(directory):
    pattern = re.compile(r'\.rpc\s*\(\s*[\'"`](.*?)[\'"`]')
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.js') or file.endswith('.jsx'):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        matches = pattern.findall(content)
                        for m in matches:
                            print(f"Found RPC call '{m}' in {path}")
                except Exception as e:
                    pass

search_rpc(r'C:\Users\edarj\.gemini\antigravity\scratch\grade-management-system\src')
