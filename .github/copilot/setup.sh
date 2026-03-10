#!/bin/bash
# Disable Prisma telemetry to avoid checkpoint.prisma.io firewall blocks
# See: https://www.prisma.io/docs/orm/tools/prisma-cli#opting-out-of-data-collection
if [ -n "$GITHUB_ENV" ]; then
  echo "CHECKPOINT_DISABLE=1" >> "$GITHUB_ENV"
fi
