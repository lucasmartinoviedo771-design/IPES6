import os
import re

def remove_console_logs():
    src_dir = '/home/admin486321/NuevoIPES/frontend/src'
    count = 0
    
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith('.ts') or file.endswith('.tsx'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = ""
                i = 0
                n = len(content)
                modified = False
                
                while i < n:
                    match = re.match(r'console\.(log|error|warn|info)\s*\(', content[i:])
                    if match:
                        start_idx = i
                        i += match.end()
                        paren_depth = 1
                        in_string = False
                        string_char = ''
                        escape = False
                        
                        while i < n and paren_depth > 0:
                            c = content[i]
                            if escape:
                                escape = False
                            elif c == '\\':
                                escape = True
                            elif c in ('"', "'", "`"):
                                if not in_string:
                                    in_string = True
                                    string_char = c
                                elif c == string_char:
                                    in_string = False
                            elif not in_string:
                                if c == '(':
                                    paren_depth += 1
                                elif c == ')':
                                    paren_depth -= 1
                            i += 1
                        
                        if paren_depth == 0:
                            if i < n and content[i] == ';':
                                i += 1
                            
                            # We replace the entire console.log(...) statement with `void 0`
                            # which is a safe no-op expression.
                            # Also handles `.catch(e => console.log(e))` -> `.catch(e => void 0)`
                            new_content += 'void 0'
                            
                            # If it was followed by a newline, let's keep it clean
                            if i < n and content[i] == '\n':
                                new_content += ';'  # safe termination
                            
                            modified = True
                            count += 1
                            continue
                        else:
                            new_content += content[start_idx]
                            i = start_idx + 1
                    else:
                        new_content += content[i]
                        i += 1
                        
                if modified:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
    print(f"Removed {count} console.logs")

if __name__ == '__main__':
    remove_console_logs()
