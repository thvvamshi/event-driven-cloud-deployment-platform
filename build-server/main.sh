#!/bin/sh

export GIT_REPO_URL="$GIT_REPO_URL"

# here clone of repo is done in output folder
git clone "$GIT_REPO_URL" /home/app/output

# execute the script file after clone is done 
exec node script.js
