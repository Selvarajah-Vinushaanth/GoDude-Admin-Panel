#!/usr/bin/env bash
set -euo pipefail

LOCAL_PORT="${GODUDE_VM_DB_LOCAL_PORT:-15432}"
VM_NAME="${GODUDE_VM_NAME:-godude-prod-vm}"
VM_ZONE="${GODUDE_VM_ZONE:-asia-south1-a}"

echo "Opening encrypted SSH tunnel to ${VM_NAME} (${VM_ZONE}): 127.0.0.1:${LOCAL_PORT} -> VM 127.0.0.1:5432"
exec gcloud compute ssh "${VM_NAME}" \
  --zone="${VM_ZONE}" \
  -- -N -L "127.0.0.1:${LOCAL_PORT}:127.0.0.1:5432" \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3
