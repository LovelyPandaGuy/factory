#!/usr/bin/env bash
# Run every Auto flow in USER-FLOWS.md on the iOS simulator.
#
#   bun run e2e                 # all flows
#   bun run e2e flows/B7_*.yaml # one flow (path relative to .maestro/)
#
# Needs: Xcode with an iOS simulator runtime, Maestro, the app's dev build
# (.app), test accounts on Supabase (node scripts/seed-test-accounts.mjs) and
# the dev server running:
#   npx expo start --dev-client
# Before each flow the test people are reset, so every flow starts the same.
# APP_SIM_APP points at the .app if it is not installed yet.
set -euo pipefail
cd "$(dirname "$0")/.."

DEVICE_NAME="${APP_SIM_DEVICE:-iPhone 17}"
udid=$(xcrun simctl list devices booted -j | python3 -c "import sys,json;d=json.load(sys.stdin)['devices'];print(next((x['udid'] for r in d.values() for x in r if x['state']=='Booted'),''))")
if [ -z "$udid" ]; then
  udid=$(xcrun simctl list devices available -j | python3 -c "
import sys,json
want='$DEVICE_NAME'
devs=[x for r in json.load(sys.stdin)['devices'].values() for x in r if 'iPhone' in x['name']]
pick=next((x for x in devs if x['name']==want), devs[0] if devs else None)
print(pick['udid'] if pick else '')")
  [ -n "$udid" ] || { echo "No iPhone simulator available. Install an iOS runtime: xcodebuild -downloadPlatform iOS"; exit 1; }
  xcrun simctl boot "$udid"
  # Show the simulator window (optional: the tests also run without it).
  open -a "$(xcode-select -p)/Applications/Simulator.app" 2>/dev/null || true
fi

if ! xcrun simctl get_app_container "$udid" com.example.app >/dev/null 2>&1; then
  [ -n "${APP_SIM_APP:-}" ] || { echo "The app is not installed on the simulator; set APP_SIM_APP=/path/to/App.app"; exit 1; }
  xcrun simctl install "$udid" "$APP_SIM_APP"
fi

# DEV_CLIENT=1: the dev build, which loads the app from the dev server.
# DEV_CLIENT=0: the self-contained e2e-test build (eas.json profile).
DEV_CLIENT="${DEV_CLIENT:-1}"
if [ "$DEV_CLIENT" = "1" ]; then
  curl -fs http://localhost:8081/status >/dev/null || { echo "Start the dev server first: npx expo start --dev-client"; exit 1; }
fi

mkdir -p .maestro/results
# First start of the iOS driver is slow on an 8 GB Mac.
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-300000}"
target="${1:-flows}"

# Test accounts on real Supabase (scripts/seed-test-accounts.mjs writes this).
ACCOUNTS=.maestro/.test-accounts.env
[ -f "$ACCOUNTS" ] || { echo "No test accounts. Run: node scripts/seed-test-accounts.mjs"; exit 1; }
set -a; . "$ACCOUNTS"; set +a

if [ -d ".maestro/$target" ]; then
  files=(".maestro/$target"/*.yaml)
else
  files=(.maestro/$target)
fi

summary=.maestro/results/summary.md
echo "| Flow | Result |" > "$summary"
echo "|---|---|" >> "$summary"
pass=0; fail=0
for flow in "${files[@]}"; do
  name=$(basename "$flow" .yaml)
  node scripts/seed-test-accounts.mjs >/dev/null
  responder=""
  case "$name" in
    *invite_accepted*)
      # The other person accepts, as a real person would.
      node scripts/test-responder.mjs > ".maestro/results/$name.responder.log" 2>&1 &
      responder=$!
      ;;
  esac
  if maestro --device "$udid" test -e DEV_CLIENT="$DEV_CLIENT" \
      -e EMAIL="$ME_EMAIL" -e PASSWORD="$ME_PASSWORD" \
      -e OTHER_EMAIL="$JORDAN_EMAIL" -e OTHER_PASSWORD="$JORDAN_PASSWORD" \
      -e TEST_LAT="$TEST_LAT" -e TEST_LNG="$TEST_LNG" \
      --test-output-dir ".maestro/results/$name" "$flow" > ".maestro/results/$name.log" 2>&1; then
    echo "| $name | pass |" >> "$summary"; pass=$((pass + 1))
  else
    reason=$(grep -m1 -E 'Assertion is false|Element not found|FAILED' ".maestro/results/$name.log" | tr '|' '/' | cut -c1-120)
    echo "| $name | FAIL: $reason |" >> "$summary"; fail=$((fail + 1))
  fi
  [ -n "$responder" ] && kill "$responder" 2>/dev/null || true
  echo "$name done ($pass passed, $fail failed)"
done
echo "" >> "$summary"
echo "Passed $pass, failed $fail." >> "$summary"
cat "$summary"
[ "$fail" -eq 0 ]
