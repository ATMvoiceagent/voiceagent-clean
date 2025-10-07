# ATM VoiceAgent (Twilio Serverless)

Production IVR for ATM Support (Voice + SMS). This README is the **quick start** and day-to-day runbook. Deep details live in [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

---

## Quick Start
```bash
# prerequisites
node -v                     # 18+ (22 OK)
twilio -v                   # Twilio CLI + serverless plugin
twilio profiles:use         # ensure you're on the correct account

# smoke locally against live env
HOST="https://citvan-clean-6447-ui.twil.io"
curl -sS -X POST "$HOST/main-menu?step=menu" | xmllint --format -
Environments
Service SID: ZScd92c9d2783301613f07144d0ed947b1 (citvan-clean)

Live env (UI): ui-environment → https://citvan-clean-6447-ui.twil.io

Env SID: ZE400015407fe6344ee2b7603817c43ca9

Voice # (Voice/SMS): +1-604-200-3829 → POST https://citvan-clean-6447-ui.twil.io/main-menu?step=menu

Release (Deploy + Attach + Tag + Verify)
bash
Copy code
./scripts/release.sh
Builds a new Twilio ZB… build, attaches to ui-environment, creates tag release-YYYYMMDD-HHMMSS-<ZB…>, verifies live build and a smoke test.

Verify Anytime
bash
Copy code
./scripts/verify.sh
Outputs live Build SID and spot-checks TwiML.

Rollback
Choose a previous release-* tag → git checkout <tag> → optional patch → ./scripts/release.sh.

Common URLs
Main menu (POST): https://citvan-clean-6447-ui.twil.io/main-menu?step=menu

Issues (POST): https://citvan-clean-6447-ui.twil.io/issues

IVR Scripts (canonical): https://citvan-clean-6447-ui.twil.io/ivr-scripts.md

Contributing
Branch from main → PR → Squash & merge.

main is protected; all releases come from main.

