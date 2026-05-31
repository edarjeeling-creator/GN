import re

with open(r'C:\Users\edarj\.gemini\antigravity\scratch\grade-management-system\src\components\WebsiteCMS.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'site_settings' in line or 'our_divisions' in line or 'hero_styling' in line:
        print(f"Line {i+1}: {line.strip()}")
