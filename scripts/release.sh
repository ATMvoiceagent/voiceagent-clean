#!/usr/bin/env bash
set -euo pipefail

SVC="ZScd92c9d2783301613f07144d0ed947b1"          # citvan-clean
ENV_NAME="ui-environment"
ENV_SID="ZE400015407fe6344ee2b7603817c43ca9"      # citvan-clean-6447-ui.twil.io
HOST="https://citvan-clean-6447-ui.twil.io"

echo "== Deploying to $ENV_NAME =="
twilio serverless:deploy --service-sid "$SVC" --environment "$ENV_NAME" --force >/dev/null

NEW_BUILD=$(twilio api:serverless:v1:services:builds:list --service-sid "$SVC" | awk 'NR==2{print $1}')
twilio api:serverless:v1:services:environments:deployments:create \
  --service-sid "$SVC" --environment-sid "$ENV_SID" --build-sid "$NEW_BUILD" >/dev/null

# Tag repo
TAG="release-$(date +%Y%m%d-%H%M%S)-$NEW_BUILD"
git tag -a "$TAG" -m "Deployed build $NEW_BUILD to $ENV_NAME"
git push origin "$TAG" >/dev/null

echo "== Verifying live build =="
LIVE_BUILD=$(twilio api:serverless:v1:services:environments:fetch \
  --service-sid "$SVC" --sid "$ENV_SID" --properties buildSid | awk 'NR==2{print $1}')

if [[ "$LIVE_BUILD" != "$NEW_BUILD" ]]; then
  echo "❌ Mismatch: live=$LIVE_BUILD vs new=$NEW_BUILD"; exit 1
fi

# Quick smoke: confirm_number appears on card-stuck path
if ! curl -sS -X POST "$HOST/issues?step=handle" --data-urlencode From="+16043295286" --data-urlencode Digits=1 \
  | xmllint --format - 2>/dev/null | grep -q "step=confirm_number"; then
  echo "❌ Smoke check failed: confirm_number not found"; exit 1
fi

echo "✅ Released $TAG (build $NEW_BUILD) and verified on $HOST"
# Optional: run the detailed verifier
if [[ -x scripts/verify.sh ]]; then
  echo; ./scripts/verify.sh
fi
