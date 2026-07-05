import os
import re

def main():
    src_dir = 'src'
    for root, _, files in os.walk(src_dir):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Regex to remove `// eslint-disable-next-line react-doctor/...` completely
                content = re.sub(r'//\s*eslint-disable-next-line\s+react-doctor/[^\n]+\n', '', content)
                # Regex to remove `/* eslint-disable react-doctor/... */` completely
                content = re.sub(r'/\*\s*eslint-disable\s+react-doctor/[^*]+\*/\s*\n?', '', content)
                
                # Some might just be inline `// eslint-disable-line react-doctor/...`
                content = re.sub(r'//\s*eslint-disable-line\s+react-doctor/[^\n]+', '', content)
                
                # Also remove unused @typescript-eslint/no-explicit-any
                content = re.sub(r'//\s*eslint-disable-next-line\s+@typescript-eslint/no-explicit-any\n', '', content)
                content = re.sub(r'//\s*eslint-disable-next-line\s+@typescript-eslint/no-unused-vars\n', '', content)
                content = re.sub(r'//\s*eslint-disable-next-line\s+react-hooks/exhaustive-deps\n', '', content)
                
                # Same for inline block comments
                content = re.sub(r'/\*\s*eslint-disable\s+@typescript-eslint/no-explicit-any\s*\*/\s*\n?', '', content)
                content = re.sub(r'/\*\s*eslint-disable\s+@typescript-eslint/no-unused-vars\s*\*/\s*\n?', '', content)
                content = re.sub(r'/\*\s*eslint-disable\s+react-hooks/exhaustive-deps\s*\*/\s*\n?', '', content)

                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)

if __name__ == '__main__':
    main()
