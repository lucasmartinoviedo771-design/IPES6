import os
import sys

# Define file extensions to check and directories to ignore
TEXT_EXTENSIONS = {'.py', '.tsx', '.ts', '.js', '.jsx', '.json', '.md', '.txt', '.html', '.css', '.csv', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.editorconfig', '.gitignore'}
IGNORE_DIRS = {'node_modules', '.venv', '.git', '__pycache__', 'dist', 'media', '.ruff_cache'}

def find_non_utf8_files(start_path='.'):
    non_utf8_files = []
    for root, dirs, files in os.walk(start_path):
        # Prune ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

        for filename in files:
            # Check files with no extension or with a text-like extension
            _, ext = os.path.splitext(filename)
            if ext.lower() in TEXT_EXTENSIONS or not ext:
                file_path = os.path.join(root, filename)
                try:
                    with open(file_path, 'rb') as f:
                        f.read().decode('utf-8')
                except UnicodeDecodeError:
                    non_utf8_files.append(file_path)
                except Exception as e:
                    # Could be a permission error or something else
                    print(f"No se pudo verificar {file_path}: {e}", file=sys.stderr)
    return non_utf8_files

if __name__ == "__main__":
    project_path = '.' # Run from the project root
    bad_files = find_non_utf8_files(project_path)
    if bad_files:
        print("Se encontraron los siguientes archivos que podrían no estar en formato UTF-8:")
        for f in bad_files:
            print(f)
    else:
        print("No se encontraron archivos con problemas de codificación UTF-8 en las extensiones de texto comunes.")
