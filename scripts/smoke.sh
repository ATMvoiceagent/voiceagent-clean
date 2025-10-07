#!/usr/bin/env bash
set -euo pipefail
HOST=${HOST:-https://citvan-clean-6447-ui.twil.io}
echo "# Menu"
curl -sS -X POST "$HOST/main-menu?step=menu" | head
echo; echo "# Sales → confirm"
curl -sS -X POST "$HOST/sales?step=choice" --data-urlencode Digits=1 --data-urlencode From="+16043295286" | head
