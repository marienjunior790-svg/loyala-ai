#!/bin/bash
set -euo pipefail
ZIP="/mnt/c/Users/HP/Projects/loyala-ai/hostinger-export.zip"
DEST="/tmp/hostinger-audit-$$"
rm -rf "$DEST"
mkdir -p "$DEST"
unzip -q "$ZIP" -d "$DEST"
echo "=== ls -la src/app/api/ai ==="
ls -la "$DEST/src/app/api/ai"
echo "=== scandir via node ==="
node -e "const fs=require('fs'); const p='$DEST/src/app/api/ai'; const x=fs.readdirSync(p); console.log('OK', x.length, 'entries:', x.join(', '));"
echo "=== bracket paths ==="
find "$DEST/src/app/api/ai" -name '*[*]*' || true
echo "=== stat api/ai dir mode ==="
stat -c '%a %n' "$DEST/src/app/api/ai"
find "$DEST/src/app/api/ai" -type d -exec stat -c '%a %n' {} \;
rm -rf "$DEST"
