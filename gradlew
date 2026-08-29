#!/bin/sh
set -e
if command -v gradle >/dev/null 2>&1; then
  exec gradle "$@"
fi
echo "Gradle executable not found. Install Gradle or generate the official Gradle wrapper."
exit 1
