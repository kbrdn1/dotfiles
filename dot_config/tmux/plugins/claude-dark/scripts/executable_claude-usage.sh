#!/bin/bash
codexbar usage --provider claude --json --no-color 2>/dev/null | jq -r '.[0].usage.primary.usedPercent // "?"'
