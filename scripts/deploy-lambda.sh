#!/usr/bin/env bash
set -euo pipefail

export MSYS_NO_PATHCONV=1
export AWS_PROFILE="${AWS_PROFILE:-pyxis-api}"
REGION="${AWS_REGION:-sa-east-1}"
PROJECT=pyxis-api
API_HOST="${API_HOST:-api.pyxis.samuelsantana.dev}"

IMAGE_ONLY=false
case "${1:-}" in
  --image-only) IMAGE_ONLY=true ;;
  "") ;;
  *)
    echo "usage: $0 [--image-only]" >&2
    exit 2
    ;;
esac

log() { printf '\n==> %s\n' "$*"; }
die() {
  printf 'deploy-lambda: %s\n' "$*" >&2
  exit 1
}

cd "$(git rev-parse --show-toplevel)"

[ -z "$(git status --porcelain)" ] || die "the working tree has uncommitted changes"

git fetch --quiet origin main
if ! git merge-base --is-ancestor HEAD origin/main && [ "${ALLOW_UNMERGED:-0}" != 1 ]; then
  die "HEAD is not on origin/main; set ALLOW_UNMERGED=1 to deploy it anyway"
fi

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
TAG="$(git rev-parse --short HEAD)"
IMAGE="$REGISTRY/$PROJECT:$TAG"

log "Logging in to ECR"
aws ecr get-login-password --region "$REGION" |
  docker login --username AWS --password-stdin "$REGISTRY" > /dev/null

log "Building $IMAGE"
docker build --pull --platform linux/amd64 --provenance=false --sbom=false \
  -f Dockerfile.lambda -t "$IMAGE" .
log "Pushing $IMAGE"
docker push "$IMAGE"

if [ "$IMAGE_ONLY" = true ]; then
  log "Image pushed; functions untouched (--image-only)"
  exit 0
fi

update_function() {
  aws lambda update-function-code --region "$REGION" --function-name "$1" --image-uri "$IMAGE" \
    --query 'LastUpdateStatus' --output text > /dev/null
  aws lambda wait function-updated --region "$REGION" --function-name "$1"
}

log "Running the migrations ($PROJECT-migrate)"
update_function "$PROJECT-migrate"
RESPONSE="$(mktemp)"
trap 'rm -f "$RESPONSE"' EXIT
RESPONSE_PATH="$RESPONSE"
if command -v cygpath > /dev/null; then RESPONSE_PATH="$(cygpath -m "$RESPONSE")"; fi
INVOKE="$(aws lambda invoke --region "$REGION" --function-name "$PROJECT-migrate" \
  --cli-read-timeout 310 --output json "$RESPONSE_PATH")"
cat "$RESPONSE"
echo
if printf '%s' "$INVOKE" | grep -q '"FunctionError"' || ! grep -q '"ok":true' "$RESPONSE"; then
  die "the migrations failed; the HTTP function was not updated"
fi

log "Updating $PROJECT"
update_function "$PROJECT"

log "Updating $PROJECT-jobs"
update_function "$PROJECT-jobs"

log "Deployed $IMAGE"
for function in "$PROJECT-migrate" "$PROJECT" "$PROJECT-jobs"; do
  aws lambda get-function --region "$REGION" --function-name "$function" \
    --query '[Configuration.FunctionName, Code.ImageUri, Configuration.LastModified]' --output text
done

STATUS="$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "https://$API_HOST/health" || true)"
echo "https://$API_HOST/health -> $STATUS"
[ "$STATUS" = 200 ] || die "health check failed"
