voiceagent-clean

Clean Twilio Serverless project for the ATM Voice Agent (IVR + SMS/MMS helpers + DPL reboot helpers).
This README documents a full reinstall flow in Twilio, environment variables, assets, and verification tests.

1) Prerequisites

Node.js 18+ (22 OK)

Twilio CLI and Serverless plugin:

npm i -g twilio-cli
twilio plugins:install @twilio-labs/plugin-serverless


Twilio account with:

A phone number (Voice + SMS capable)

SendGrid (for claim emails) or another mail channel

Git (optional but recommended)

DPL API access (optional; only for remote reboot features)

Log in (or ensure the correct profile is active):

twilio login   # or twilio profiles:list; twilio profiles:use <name>

2) Repo Layout
voiceagent-clean/
  assets/
    assist.html
    claim.html
    error_codes.min.json
    dpl_map.json              # optional; can be private asset or env JSON
  functions/
    main-menu.js
    sales.js
    atm-error-lookup.js
    issues-mini.js
    tech-callback.js
    assist-submit.js
    mms-email-v2.js
    claim-submit-v2.js
    dpl-remote-reboot.js
    dpl-reboot.js
    lib/
      errorLoader.js          # if used by lookup
  package.json
  .twilioserverlessrc         # optional convenience
  README.md


Keep only the functions/assets you actually need to avoid Console clutter.

3) One-Time: Create a New Twilio Serverless Service

You can deploy directly (Twilio will create the service), or create one explicitly.

Option A — Deploy directly (simplest):

twilio serverless:deploy \
  --service-name voiceagent-clean \
  --environment ui-environment \
  --force


The command prints:

Service SID: looks like ZSxxxxxxxx...

Environment: ui-environment with Domain like https://voiceagent-clean-ui-environment-XXXX.twil.io

Option B — Create service first (optional):

twilio serverless:services:create \
  --friendly-name voiceagent-clean
# Note the Service SID returned

4) Configure Environment Variables

Set these on the ui-environment:

SERVICE_SID="ZSxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"   # replace
ENV="ui-environment"

# Voice & SMS
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key POLLY_VOICE --value "Polly.Joanna-Neural"
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key SMS_FROM --value "+1XXXXXXXXXX"
# or Messaging Service:
# twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key MESSAGING_SERVICE_SID --value "MGXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

# Website links
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key WEBSITE_URL --value "https://cashintime.ca"
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key CLAIM_LINK   --value "https://<your-domain>.twil.io/claim.html"
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key GEO_URL     --value "https://<your-domain>.twil.io/assist.html?mode=geo"

# SendGrid (for claim email + MMS relay)
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key SENDGRID_API_KEY --value "SG.xxxxxx"
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key SENDGRID_FROM    --value "noreply@yourdomain.com"
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key SENDGRID_TO      --value "info@cashintime.ca"
# Optional alternate direct claim recipient (some functions use CLAIM_TO_EMAIL)
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key CLAIM_TO_EMAIL   --value "info@cashintime.ca"

# DPL (if using remote reboot)
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key DPL_API_BASE     --value "https://api.dplwireless.com/v1"
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key DPL_RESTART_URL  --value "https://api.dplwireless.com/v1/devices/restart"
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key DPL_STATUS_URL   --value "https://api.dplwireless.com/v1/devices/workactions"
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key DPL_RESTART_TYPE --value "restart1"

# Auth style for DPL — choose one that works with your account:
# 1) Basic Auth (recommended per your working tests)
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key DPL_BASIC_USER   --value "<your-dpl-username-or-key>"
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key DPL_BASIC_PASS   --value "<your-dpl-password-or-key>"

# 2) API Key in query (if DPL account requires it)
# twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key DPL_API_KEY      --value "<your-dpl-api-key>"

# Optional assist and sales routing
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key ASSIST_BASE_URL  --value "https://<your-domain>.twil.io"
twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" --key SALES_NUMBER     --value "+1YYYYYYYYYY"


Optional (map seed via env instead of asset):

twilio serverless:env:set --service-sid "$SERVICE_SID" --environment "$ENV" \
  --key DPL_MAP_JSON \
  --value '[{"terminal":"CIT00173","lat":49.2827,"lng":-123.1207,"deviceId":680879,"address":"Downtown Vancouver"}]'

5) Assets

Place public assets under assets/:

assist.html — geo link landing

claim.html — web claim form (with file upload)

error_codes.min.json — combined vendor lookups (Triton/Hyosung/Genmega/Hantle)

dpl_map.json — (optional) if you prefer as a public asset; otherwise keep in /assets/private.

Private assets: create assets/private/ for restricted files:

dpl_map.json (preferred location)

error_codes.min.json (if you want to restrict)

In functions, we read private assets via Runtime.getAssets()['/private/<name>'].

Deploy after adding assets:

twilio serverless:deploy --service-sid "$SERVICE_SID" --environment "$ENV" --force

6) Phone Number Configuration
Voice

Set your number’s Voice webhook to:

POST  https://<your-domain>.twil.io/main-menu?step=menu

Messaging

Set your number’s Messaging webhook to the MMS→email bridge:

POST  https://<your-domain>.twil.io/mms-email-v2


(Or configure via Service: voiceagent-clean → Environment: ui-environment → Function: /mms-email-v2 in Console.)

7) Quick Verification (cURL tests)

Replace HOST="https://<your-domain>.twil.io" first.

Main menu:

curl -sS -X POST "$HOST/main-menu?step=menu" | xmllint --format -


Sales (Option 1):

# menu
curl -sS -X POST "$HOST/sales?step=menu" | xmllint --format -
# choose text flow (Digits=1)
curl -sS -X POST "$HOST/sales?step=choice" \
  --data-urlencode Digits=1 --data-urlencode From="+16045550123" | xmllint --format -


Error Lookup (Option 2):

# D1701 example => press 3 1 7 0 1 then '#'
curl -sS -X POST "$HOST/atm-error-lookup?step=match" \
  --data-urlencode Digits=31701 | xmllint --format -


Issues (Option 3):

# Say “screen frozen”
curl -sS -X POST "$HOST/issues-mini?step=match" \
  --data-urlencode "SpeechResult=screen frozen" | xmllint --format -


Tech callback (Option 4):

curl -sS -X POST "$HOST/tech-callback?step=start" | xmllint --format -


DPL reboot direct probe:

curl -sS -X POST "$HOST/dpl-remote-reboot" --data-urlencode serial="680879" | jq .

8) Logs & Debugging

Tail logs:

twilio serverless:logs --service-sid "$SERVICE_SID" --environment "$ENV" --tail


Common messages to look for:

[assist-submit] map via env|asset|http|embedded

[dpl-remote-reboot basic-probe] ...

[atm-error-lookup] map source: ...

9) Common Pitfalls

Multiple functions with similar names: keep a single copy (e.g., only /issues-mini.js). Delete or move extras to functions/_trash/.

Private assets not readable: ensure you reference with /private/<filename> and deploy after adding.

Messaging webhook not using Function: in Console, set to Function and choose /mms-email-v2, or use a full URL.

DPL 401 Unauthorized: ensure your Basic creds or API key style matches your account. Your working combo (per tests) was Basic user=key with serialnum=<id>.

10) Release & Rollback

Tag stable deploys:

git tag -a stable-<YYYYMMDD>-<HHMM> -m "Stable: all 4 options working"
git push --tags


If a deploy misbehaves:

Re-deploy previous commit:

git checkout <good-sha>
twilio serverless:deploy --service-sid "$SERVICE_SID" --environment "$ENV" --force


Or switch number webhooks back to a previous service/environment.

11) Maintenance Tips

Keep error codes JSON centralized (error_codes.min.json) and versioned.

Use env vars for all phone numbers, URLs, and DPL settings so you can reuse this project for other brands with minimal code changes.

Run small cURL smoke tests after each deploy (the ones above).

12) Support Contacts (fill in)

Twilio Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Primary Number: +1XXXXXXXXXX

SendGrid Account / API Key owner: ...

DPL Account / Contact: ...
