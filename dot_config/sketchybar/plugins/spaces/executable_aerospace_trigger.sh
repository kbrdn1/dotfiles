#!/bin/bash
# Called by AeroSpace on workspace change (exec-on-workspace-change)
# Note: exec-on-workspace-change is broken in AeroSpace v0.20-Beta
# Workaround: triggers are injected directly in keybindings (aerospace.toml)
sketchybar --trigger aerospace_workspace_change
