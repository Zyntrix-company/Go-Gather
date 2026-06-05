#!/usr/bin/env bash
# Run on the API EC2 host. Set BREVO_* in .env and recreate gathergo-container.
# Usage (do not commit the key):
#   export BREVO_API_KEY='your-brevo-key'
#   export BREVO_FROM_EMAIL='Hello@GatherrGo.com'
#   export BREVO_FROM_NAME='Gatherrgo'
#   bash ensure-brevo-env.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/home/ubuntu/Go-Gather/backend/.env}"
BREVO_FROM_EMAIL="${BREVO_FROM_EMAIL:-Hello@GatherrGo.com}"
BREVO_FROM_NAME="${BREVO_FROM_NAME:-Gatherrgo}"

if [ -z "${BREVO_API_KEY:-}" ]; then
  echo "ERROR: Set BREVO_API_KEY in the environment before running this script."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found"
  exit 1
fi

sed -i '/^BREVO_API_KEY=/d' "$ENV_FILE" || true
sed -i '/^BREVO_FROM_EMAIL=/d' "$ENV_FILE" || true
sed -i '/^BREVO_FROM_NAME=/d' "$ENV_FILE" || true
echo "BREVO_API_KEY=$BREVO_API_KEY" >> "$ENV_FILE"
echo "BREVO_FROM_EMAIL=$BREVO_FROM_EMAIL" >> "$ENV_FILE"
echo "BREVO_FROM_NAME=$BREVO_FROM_NAME" >> "$ENV_FILE"
echo "Brevo vars written (API key not printed)."

IMAGE="${IMAGE:-}"
if [ -z "$IMAGE" ] && docker ps -a --format '{{.Names}}' | grep -q '^gathergo-container$'; then
  IMAGE=$(docker inspect gathergo-container --format '{{.Config.Image}}')
fi
IMAGE="${IMAGE:-092201262561.dkr.ecr.ap-south-1.amazonaws.com/backend-api:latest}"

if docker ps -a --format '{{.Names}}' | grep -q '^gathergo-container$'; then
  docker update --restart=no gathergo-container || true
  CPID=$(docker inspect --format '{{.State.Pid}}' gathergo-container 2>/dev/null || echo "0")
  if [ -n "$CPID" ] && [ "$CPID" != "0" ]; then
    sudo kill -9 "$CPID" || true
    sleep 2
  fi
  docker rm gathergo-container 2>/dev/null || true
fi

cd "$(dirname "$ENV_FILE")"
docker run -d \
  --name gathergo-container \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  "$IMAGE"

sleep 2
docker exec gathergo-container printenv BREVO_FROM_EMAIL BREVO_FROM_NAME
docker exec gathergo-container sh -c 'test -n "$BREVO_API_KEY" && echo BREVO_API_KEY=is_set || echo BREVO_API_KEY=missing'
