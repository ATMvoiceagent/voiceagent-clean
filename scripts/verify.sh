#!/usr/bin/env bash
set -euo pipefail

SVC="ZScd92c9d2783301613f07144d0ed947b1"          # citvan-clean
ENV_SID="ZE400015407fe6344ee2b7603817c43ca9"      # ui-environment
HOST="https://citvan-clean-6447-ui.twil.io"

echo "== Current live build on ui-environment =="
twilio api:serverless:v1:services:environments:fetch \
  --service-sid "$SVC" --sid "$ENV_SID" \
  --properties buildSid,domainName,uniqueName

echo
echo "== Smoke: main menu (first 15 lines) =="
curl -sS -X POST "$HOST/main-menu?step=menu" | xmllint --format - | sed -n '1,15p'

echo
echo "== Smoke: issues → card stuck (confirm_number present?) =="
curl -sS -X POST "$HOST/issues?step=handle" \
  --data-urlencode From="+16043295286" \
  --data-urlencode Digits=1 | xmllint --format - | grep -E "confirm_number|Pause|Say" -n | sed -n '1,8p'
