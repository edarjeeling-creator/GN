import os
import re

pages_dir = os.path.join(os.path.dirname(__file__), 'src', 'pages')

for filename in os.listdir(pages_dir):
    if filename.endswith('.jsx'):
        filepath = os.path.join(pages_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if 'import Layout from' in content or '<Layout>' in content:
            print(f"Fixing {filename}...")
            # Remove import
            content = re.sub(r"import Layout from ['\"]\.\./components/Layout['\"];?\r?\n?", "", content)
            
            # Replace <Layout> tags
            content = content.replace('<Layout>', '<>')
            content = content.replace('</Layout>', '</>')
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)

print("Done!")
