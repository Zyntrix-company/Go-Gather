#!/usr/bin/env bash
# Run on the API EC2 host (ubuntu@...) to set GOOGLE_DRIVE_REDIRECT_URI and reload the API container.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/home/ubuntu/Go-Gather/backend/.env}"
DRIVE_REDIRECT='https://api.gatherrgo.com/auth/drive/callback'
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found"
  exit 1
fi

if grep -q '^GOOGLE_DRIVE_REDIRECT_URI=' "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^GOOGLE_DRIVE_REDIRECT_URI=.*|GOOGLE_DRIVE_REDIRECT_URI=${DRIVE_REDIRECT}|" "$ENV_FILE"
  echo "Updated GOOGLE_DRIVE_REDIRECT_URI in $ENV_FILE"
else
  echo "GOOGLE_DRIVE_REDIRECT_URI=${DRIVE_REDIRECT}" >> "$ENV_FILE"
  echo "Appended GOOGLE_DRIVE_REDIRECT_URI to $ENV_FILE"
fi

grep '^GOOGLE_DRIVE_REDIRECT_URI=' "$ENV_FILE"

# Docker does not reload --env-file on restart; recreate the container.
IMAGE="${IMAGE:-}"
if [ -z "$IMAGE" ] && docker ps -a --format '{{.Names}}' | grep -q '^gathergo-container$'; then
  IMAGE=$(docker inspect gathergo-container --format '{{.Config.Image}}')
fi
IMAGE="${IMAGE:-092201262561.dkr.ecr.ap-south-1.amazonaws.com/backend-api:latest}"
echo "Using image: $IMAGE"

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
docker ps --filter name=gathergo-container --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
docker exec gathergo-container printenv GOOGLE_DRIVE_REDIRECT_URI
