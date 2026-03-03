#!/bin/bash

# Hook appele par svim a chaque changement de mode ou de commandline
# Variables disponibles: $MODE et $CMDLINE

sketchybar --trigger svim_update MODE="$MODE" CMDLINE="$CMDLINE"
