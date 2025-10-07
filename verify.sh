#!/usr/bin/env bash
HOST="https://citvan-clean-6447-ui.twil.io"
set -e

echo "# Option 1 – Sales"
curl -sS -X POST "$HOST/sales?step=menu" | head
curl -sS -X POST "$HOST/sales?step=choice" --data-urlencode Digits=1 --data-urlencode From="+16043295286" | head
curl -sS -X POST "$HOST/sales?step=sms_confirm&from=%2B16043295286" --data-urlencode Digits=1 | head

echo "# Option 2 – Error lookup"
curl -sS -X POST "$HOST/atm-error-lookup?step=collect" | head
curl -sS -X POST "$HOST/atm-error-lookup?step=match" --data-urlencode Digits=31700 | head
curl -sS -X POST "$HOST/atm-error-lookup?step=match" --data-urlencode Digits=1700  | head

echo "# Option 3 – Issues mini"
curl -sS -X POST "$HOST/issues-mini?step=start" | head
curl -sS -X POST "$HOST/issues-mini?step=first" --data-urlencode "SpeechResult=my card is stuck" | head
curl -sS -X POST "$HOST/issues-mini?step=first" --data-urlencode "SpeechResult=the screen is frozen" | head
curl -sS -X POST "$HOST/issues-mini?step=first" --data-urlencode "SpeechResult=I didn't get my money" | head

echo "# Option 4 – Tech callback (entry)"
curl -sS -X POST "$HOST/tech-callback?step=start" | head
