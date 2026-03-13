#!/bin/bash
set -e

cd part64/frontend && npm install --prefer-offline --no-audit 2>/dev/null || npm install
