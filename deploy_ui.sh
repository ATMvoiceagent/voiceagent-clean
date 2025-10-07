#!/usr/bin/env bash
set -euo pipefail
SVC="ZScd92c9d2783301613f07144d0ed947b1"
ENV="ZE400015407fe6344ee2b7603817c43ca9"
twilio serverless:deploy --service-sid "$SVC" --env ui --force
BUILD=$(twilio api:serverless:v1:services:builds:list --service-sid "$SVC" --limit 1 --properties sid | tail -n1 | awk '{print $1}')
twilio api:serverless:v1:services:environments:deployments:create --service-sid "$SVC" --environment-sid "$ENV" --build-sid "$BUILD"
echo "Activated build $BUILD on UI."
