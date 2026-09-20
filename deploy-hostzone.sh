#!/usr/bin/env bash
# Uploads the latest Hostzone build (artifact from the deploy workflow) to
# moodboard.sarkozypatrik.sk over SFTP. Shell access is disabled on the host, so
# everything goes through sftp batch commands. Usage: ./deploy-hostzone.sh [run-id]
set -euo pipefail
cd "$(dirname "$0")"
HOST=hkjdxbcf@x1.hostzone.eu
KEY=~/.ssh/hostzone_deploy
REMOTE=/home2/hkjdxbcf/moodboard
OUT=dist-hostzone

rm -rf "$OUT"
if [ -n "${1:-}" ]; then gh run download "$1" -n hostzone-dist -D "$OUT"; else gh run download -n hostzone-dist -D "$OUT"; fi
[ -f "$OUT/index.html" ] || { echo "no build in $OUT"; exit 1; }
find "$OUT" -type f -exec chmod 644 {} + ; find "$OUT" -type d -exec chmod 755 {} +

# hash routing needs no rewrite rule; the .htaccess only keeps assets cacheable
cat > "$OUT/.htaccess" <<'HT'
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} !=on
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\.(js|css|woff2?|png|svg)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "index\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
HT

# `put -r dir` nests when the target exists, so the tree is mirrored file by file
BATCH=$(mktemp)
{
  echo "-mkdir $REMOTE"
  (cd "$OUT" && find . -type d ! -name . | sort) | while read -r d; do echo "-mkdir $REMOTE/${d#./}"; done
  (cd "$OUT" && find . -type f) | while read -r f; do echo "put \"$OUT/${f#./}\" \"$REMOTE/${f#./}\""; done
  echo "chmod 755 $REMOTE"
} > "$BATCH"
sftp -i "$KEY" -o StrictHostKeyChecking=accept-new -o BatchMode=yes -b "$BATCH" "$HOST" > /dev/null
rm -f "$BATCH"
echo "uploaded $(find "$OUT" -type f | wc -l | tr -d ' ') files to $REMOTE"
