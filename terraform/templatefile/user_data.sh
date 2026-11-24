#!/bin/bash
set -euo pipefail

APP_NAME="select-ai-analyzer"
SOURCE_REPO_URL="${source_repo_url}"
SOURCE_REF="${source_ref}"
SOURCE_COMMIT_SHA="${source_commit_sha}"
SOURCE_DIR="/opt/cloudtechnext/select-ai-analyzer"
RUNTIME_DIR="/opt/cloudtechnext/select-ai-analyzer/runtime"
LOCAL_IMAGE="select-ai-analyzer:cloudtechnext"

retry() {
  local attempts="$1"
  shift
  local delay=10
  local attempt
  for attempt in $(seq 1 "$attempts"); do
    if "$@"; then
      return 0
    fi
    if [ "$attempt" -eq "$attempts" ]; then
      return 1
    fi
    echo "Command failed on attempt $attempt/$attempts: $*"
    echo "Retrying in $delay seconds..."
    sleep "$delay"
    if [ "$delay" -lt 60 ]; then
      delay=$((delay * 2))
    fi
  done
}

use_reachable_base_images() {
  sed -i \
    -e 's#^FROM node:#FROM public.ecr.aws/docker/library/node:#' \
    -e 's#^FROM python:#FROM public.ecr.aws/docker/library/python:#' \
    "$SOURCE_DIR/Dockerfile"
}

dnf -y makecache
dnf -y install dnf-plugins-core firewalld curl git
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker
usermod -aG docker opc
systemctl enable --now firewalld
firewall-cmd --add-service=http --permanent
firewall-cmd --add-service=ssh --permanent
firewall-cmd --reload

rm -rf "$SOURCE_DIR"
mkdir -p "$(dirname "$SOURCE_DIR")"
if [ -n "$SOURCE_COMMIT_SHA" ]; then
  git init --quiet "$SOURCE_DIR"
  git -C "$SOURCE_DIR" remote add origin "$SOURCE_REPO_URL"
  retry 3 git -C "$SOURCE_DIR" fetch --depth=1 origin "$SOURCE_COMMIT_SHA"
  git -C "$SOURCE_DIR" checkout --detach FETCH_HEAD
  test "$(git -C "$SOURCE_DIR" rev-parse HEAD)" = "$SOURCE_COMMIT_SHA"
else
  retry 3 git clone --depth=1 --branch "$SOURCE_REF" "$SOURCE_REPO_URL" "$SOURCE_DIR"
fi
use_reachable_base_images
mkdir -p "$RUNTIME_DIR/data" "$RUNTIME_DIR/wallet" "$RUNTIME_DIR/keys" "$RUNTIME_DIR/logs"
chown -R opc:opc "$RUNTIME_DIR"

retry 5 docker build -t "$LOCAL_IMAGE" "$SOURCE_DIR"
docker rm -f "$APP_NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$APP_NAME" \
  --restart unless-stopped \
  -e ANALYZER_MANAGED_SETUP=1 \
  -p 80:80 \
  -v "$RUNTIME_DIR/data:/app/apps/backend/data" \
  -v "$RUNTIME_DIR/wallet:/app/apps/backend/wallet" \
  -v "$RUNTIME_DIR/keys:/app/apps/backend/keys" \
  -v "$RUNTIME_DIR/logs:/app/apps/backend/logs" \
  "$LOCAL_IMAGE"

for attempt in $(seq 1 60); do
  if curl --fail --silent http://127.0.0.1/api/health >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 60 ]; then
    docker logs "$APP_NAME" >/home/opc/select-ai-analyzer-container.log 2>&1 || true
    exit 1
  fi
  sleep 5
done

cat >/home/opc/startup_info.txt <<'INFO'
Select AI Analyzer container is responding. Application setup is pending.

Application URL: http://[PUBLIC-IP]
SSH user: opc
Container: select-ai-analyzer
Source: https://github.com/jgangini/select-ai-analyzer

Setup flow: waiting for CloudTechNext automation to configure APP_AGENT, wallet, Object Storage, Generative AI and SQL installation.
Persistent runtime: /opt/cloudtechnext/select-ai-analyzer/runtime

Useful commands:
  docker ps
  docker logs select-ai-analyzer
  sudo journalctl -u docker --no-pager
INFO

chown opc:opc /home/opc/startup_info.txt

install -d -m 0700 -o opc -g opc /home/opc/ctn-bootstrap
cat >/etc/systemd/system/select-ai-analyzer-bootstrap.service <<'UNIT'
[Unit]
Description=Configure Select AI Analyzer
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
User=opc
Group=opc
UMask=0077
ExecStart=/bin/bash /opt/cloudtechnext/select-ai-analyzer/terraform/templatefile/configure_app.sh
TimeoutStartSec=30min
UNIT
cat >/etc/systemd/system/select-ai-analyzer-bootstrap.path <<'UNIT'
[Unit]
Description=Watch for the private Select AI Analyzer setup payload

[Path]
PathExists=/home/opc/ctn-bootstrap/payload.json
Unit=select-ai-analyzer-bootstrap.service

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now select-ai-analyzer-bootstrap.path

# The hook reads these public keys from OCI's authenticated serial console.
host_keys=$(sshd -T | awk '$1 == "hostkey" {print $2}')
published_keys=0
printf '\n' >/dev/ttyS0
while IFS= read -r host_key; do
  if [ ! -f "$host_key" ]; then
    continue
  fi
  public_key=$(ssh-keygen -y -f "$host_key" | awk '{print $2}')
  test -n "$public_key"
  printf 'CTN_ANALYZER_HOST_KEY %s\n' "$public_key" >/dev/ttyS0
  published_keys=$((published_keys + 1))
done <<<"$host_keys"
test "$published_keys" -gt 0

mkdir -p /var/local
touch /var/local/userdata.done
cat /home/opc/startup_info.txt
