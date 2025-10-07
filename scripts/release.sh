#!/usr/bin/env bash
set -euo pipefail

SVC="ZScd92c9d2783301613f07144d0ed947b1"          # citvan-clean
ENV_NAME="ui-environment"
ENV_SID="ZE400015407fe6344ee2b7603817c43ca9"      # citvan-clean-6447-ui.twil.io

# 1) Build a new Twilio Serverless release
twilio serverless:deploy --service-sid "$SVC" --environment "$ENV_NAME" --force >/dev/null

# 2) Attach newest build to live env
NEW_BUILD=$(twilio api:serverless:v1:services:builds:list --service-sid "$SVC" | awk 'NR==2{print $1}')
twilio api:serverless:v1:services:environments:deployments:create \
  --service-sid "$SVC" --environment-sid "$ENV_SID" --build-sid "$NEW_BUILD" >/dev/null

# 3) Tag the repo with the build id and push tag
TAG="release-$(date +%Y%m%d-%H%M%S)-$NEW_BUILD"
git tag -a "$TAG" -m "Deployed build $NEW_BUILD to $ENV_NAME"
git push origin "$TAG"

echo "✅ Released $TAG (build $NEW_BUILD) to citvan-clean-6447-ui.twil.io"
