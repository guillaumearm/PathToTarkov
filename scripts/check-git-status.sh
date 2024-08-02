#!/bin/bash -e

if [[ `git status --porcelain` ]]; then
    echo "Error from script 'check-git-status.sh' -> some changes are detected in this git repo"
    git status
    exit 1
else
    echo "OK: No changes detected."
fi
