#!/bin/sh
set -e
apk add -q unzip nodejs >/dev/null
rm -rf /tmp/z
mkdir /tmp/z
unzip -q /zip/hostinger-export.zip -d /tmp/z
echo "=== ls -la ==="
ls -la /tmp/z/src/app/api/ai
echo "=== stat mode ==="
stat -c '%a %n' /tmp/z/src/app/api/ai
find /tmp/z/src/app/api/ai -type d -exec stat -c '%a %n' {} \;
echo "=== node readdir ==="
node -e "const fs=require('fs'); const p='/tmp/z/src/app/api/ai'; try { console.log('OK', fs.readdirSync(p).join(',')); } catch(e) { console.log('FAIL', e.code, e.message); process.exit(1); }"
