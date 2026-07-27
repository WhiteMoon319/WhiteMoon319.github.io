# Fix admin.js catch blocks
with open('resource/js/admin.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 107 is the old body.innerHTML line in loadUsers catch (0-indexed)
# Let's find all catch blocks and fix them
target = "body.innerHTML = '<p style=\"color:var(--flame);\">\\u52A0\\u8F7D\\u5931\\u8D25</p>';"
replacement = "console.error('loadUsers error:', e);\n      body.innerHTML = '<p style=\"color:var(--flame);\">\\u52A0\\u8F7D\\u5931\\u8D25: ' + window.escapeHtml(e.message || '\\u672A\\u77E5\\u9519\\u8BEF') + '</p>';"

new_lines = []
replaced = False
for line in lines:
    if target in line and not replaced:
        new_lines.append(replacement + '\n')
        replaced = True
    else:
        new_lines.append(line)

with open('resource/js/admin.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f'Replaced: {replaced}')
