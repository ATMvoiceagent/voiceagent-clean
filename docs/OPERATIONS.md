# Operations Guide

## 1) Environment & Secrets
Live env (ui-environment):
- `SMS_FROM=+16042003829`
- `WEBSITE_URL=https://cashintime.ca`
- `CLAIM_LINK=https://citvan-clean-6447-ui.twil.io/claim.html`
- `GEO_URL=https://citvan-clean-6447-ui.twil.io/assist.html?mode=geo`
- `SALES_NUMBER=+16043295286`
- `MESSAGING_SERVICE_SID` = (blank; do **not** use Messaging Service)
- Recording & SendGrid: deferred/off

Manage via CLI:
```bash
twilio serverless:env:list --service-sid ZScd92c9d2783301613f07144d0ed947b1 --environment ui-environment
twilio serverless:env:set --service-sid ZScd92c9d2783301613f07144d0ed947b1 --environment ui-environment --key KEY --value VALUE
2) Release Flow
Preferred:

bash
Copy code
./scripts/release.sh
Manual:

bash
Copy code
twilio serverless:deploy --service-sid ZScd92c9d2783301613f07144d0ed947b1 --environment ui-environment --force
NEW_BUILD=$(twilio api:serverless:v1:services:builds:list --service-sid ZScd92c9d2783301613f07144d0ed947b1 | awk 'NR==2{print $1}')
twilio api:serverless:v1:services:environments:deployments:create --service-sid ZScd92c9d2783301613f07144d0ed947b1 --environment-sid ZE400015407fe6344ee2b7603817c43ca9 --build-sid "$NEW_BUILD"
3) Verify & Logs
bash
Copy code
./scripts/verify.sh
twilio serverless:logs --service-sid ZScd92c9d2783301613f07144d0ed947b1 --environment ui-environment --tail
4) Phone Number Webhooks
Voice number +1-604-200-3829 should have:

bash
Copy code
twilio api:core:incoming-phone-numbers:fetch --sid PN5b50a643eac89a552790dbe27b50a2b4 --properties voiceUrl,voiceMethod
# voiceUrl: https://citvan-clean-6447-ui.twil.io/main-menu?step=menu
# voiceMethod: POST
5) Canonical Scripts
Public asset to bookmark: https://citvan-clean-6447-ui.twil.io/ivr-scripts.md

6) Smoke Tests
bash
Copy code
HOST="https://citvan-clean-6447-ui.twil.io"
curl -sS -X POST "$HOST/main-menu?step=menu" | xmllint --format -
curl -sS -X POST "$HOST/issues?step=handle" --data-urlencode From="+16043295286" --data-urlencode Digits=1 | xmllint --format -
curl -sS -X POST "$HOST/issues?step=handle" --data-urlencode From="+16043295286" --data-urlencode Digits=2 | xmllint --format -
curl -sS -X POST "$HOST/issues?step=handle" --data-urlencode From="+16043295286" --data-urlencode Digits=3 | xmllint --format -
7) Troubleshooting
Hearing old code on calls but new in cURL:

Number using URL (not Voice App SID)?

Absolute redirects to citvan-clean-6447-ui.twil.io?

Live build matches expected?
twilio api:serverless:v1:services:environments:fetch --service-sid ZS... --sid ZE... --properties buildSid

SMS failed: is SMS_FROM a Twilio SMS-capable number on the account?

Error codes: update assets/error_codes.min.json and redeploy.

8) Rollback
Pick a release-* tag:

bash
Copy code
git checkout <tag>
./scripts/release.sh
