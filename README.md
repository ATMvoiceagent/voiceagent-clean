# VoiceAgent (citvan-clean) — Runbook

Production service on Twilio Functions (Node 22).

## Overview
- **Service SID:** ZScd92c9d2783301613f07144d0ed947b1
- **Environment SID (ui):** ZE400015407fe6344ee2b7603817c43ca9
- **Domain:** https://citvan-clean-6447-ui.twil.io
- Functions: `/main-menu`, `/sales`, `/atm-error-lookup`, `/issues-mini`, `/tech-callback`, helpers (`/assist-submit`, `/geo-reboot`, …)
- Assets: `assist.html`, `claim.html`, private JSON maps

## Prerequisites
- Twilio CLI (logged in)
- Access to the project with the SIDs above
- Node 18+ (local dev), git, curl, xmllint (optional for pretty TwiML)
- GitHub remote: `git@github.com:ATMvoiceagent/voiceagent-clean.git`

## Environment Variables (Twilio Runtime)
See `.env.example` in this repo. Set these on the **ui** environment:
- `CALLER_ID`, `SMS_FROM`, `MESSAGING_SERVICE_SID`
- `WEBSITE_URL`, `CLAIM_LINK`
- `GEO_URL`, `DPL_MAP_JSON`
- (Email) `SENDGRID_API_KEY`, `SENDGRID_FROM`, `SENDGRID_TO` *(optional — can use SMTP later)*

## One-time Twilio wiring
Point your **phone number** to the proxy entry:
twilio api:core:incoming-phone-numbers:update
--sid PN5b50a643eac89a552790dbe27b50a2b4
--voice-url "https://citvan-clean-6447-ui.twil.io/main-menu-proxy"
--voice-method POST

shell
Copy code

## Deploy
npm run deploy

bash
Copy code
This uses the Twilio Serverless deploy (already set to service/env). It prints your build SID and live URLs.

## Logs & Alerts
- Tail logs:
npm run logs

diff
Copy code
- Recent error alerts:
twilio api:monitor:v1:alerts:list --log-level error --limit 10
--properties sid,errorCode,alertText,requestUrl,requestMethod,dateCreated

shell
Copy code

## Quick smoke tests (curl)
> Replace `HOST` if your domain changes.
HOST="https://citvan-clean-6447-ui.twil.io"

Menu
curl -sS -X POST "$HOST/main-menu?step=menu" | xmllint --format -

Option 1 (Sales) happy path
curl -sS -X POST "$HOST/sales?step=menu"
curl -sS -X POST "$HOST/sales?step=choice" --data-urlencode Digits=1 --data-urlencode From="+16043295286"
curl -sS -X POST "$HOST/sales?step=sms_confirm&from=%2B16043295286" --data-urlencode Digits=1

Option 2 (Error lookup)
curl -sS -X POST "$HOST/atm-error-lookup?step=collect"
curl -sS -X POST "$HOST/atm-error-lookup?step=match" --data-urlencode Digits=31701
curl -sS -X POST "$HOST/atm-error-lookup?step=match" --data-urlencode Digits=4
curl -sS -X POST "$HOST/atm-error-lookup?step=match" --data-urlencode Digits=20002

Option 3 (Issues mini)
curl -sS -X POST "$HOST/issues-mini?step=start"
curl -sS -X POST "$HOST/issues-mini?step=first" --data-urlencode "SpeechResult=my card is stuck"
curl -sS -X POST "$HOST/issues-mini?step=first" --data-urlencode "SpeechResult=I didn't get my money"

Option 4 (Tech callback)
curl -sS -X POST "$HOST/tech-callback?step=start"

shell
Copy code

## Rollback
List recent builds
twilio api:serverless:v1:services:builds:list --service-sid ZScd92c9d2783301613f07144d0ed947b1 --properties sid,dateCreated

Promote a previous build to the 'ui' environment
twilio api:serverless:v1:services:environments:deployments:create
--service-sid ZScd92c9d2783301613f07144d0ed947b1
--environment-sid ZE400015407fe6344ee2b7603817c43ca9
--build-sid ZBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

markdown
Copy code

## Git workflow
- Work in a branch (e.g., `feature/foo`), open PR → merge to `main`.
- Tag releases: `git tag -a deploy-YYYYMMDD-HHMM -m "snapshot"` → `git push --tags`
- Optional prod pointer: `git tag -f prod-citvan-clean && git push -f origin prod-citvan-clean`

## Notes
- If you see “application error” on voice: tail logs with `npm run logs`.
- If email bounces, prefer SMTP relay from your provider (no SDK required) or fix DMARC/DNS first.
