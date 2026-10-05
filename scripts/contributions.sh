#!/usr/bin/env bash
set -euo pipefail
gh api graphql -f query='{user(login:"PeterVanPercson"){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}' \
  --jq '[.data.user.contributionsCollection.contributionCalendar.weeks[].contributionDays[] | {date, count: .contributionCount}]' > contributions.json
