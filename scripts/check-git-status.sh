#!/bin/bash -e

if [[ `git status --porcelain` ]]; then
    git status
    echo "Error from script 'check-git-status.sh' -> some changes are detected in this git repo"
    exit 1
else
    echo "OK: No changes detected."
fi
