#!/bin/sh
set -e

echo "Starting API server..."
exec node dist/index.js
