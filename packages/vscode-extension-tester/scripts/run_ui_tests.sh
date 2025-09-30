#!/bin/bash

INCLUDE_ARGS=()
EXCLUDE_ARGS=()

EXCLUDE_MODE=false
for arg in "$@"; do
  if [ "$arg" == "--exclude" ]; then
    EXCLUDE_MODE=true
    continue
  fi
  if [ "$EXCLUDE_MODE" = true ]; then
    EXCLUDE_ARGS+=("$arg")
  else
    INCLUDE_ARGS+=("$arg")
  fi
done

make_patterns() {
  local arr=("$@")
  local patterns=""
  for num in "${arr[@]}"; do
    if (( num < 10 )); then
      num="0$num"
    fi
    patterns="$patterns ./ui-tests/${num}-*.test.js"
  done
  echo "$patterns"
}

if [ "${#INCLUDE_ARGS[@]}" -eq 0 ]; then
  TEST_FILES=$(ls ./ui-tests/*.test.js)
else
  TEST_FILES=$(make_patterns "${INCLUDE_ARGS[@]}")
fi

if [ "${#EXCLUDE_ARGS[@]}" -gt 0 ]; then
  EXCLUDE_PATTERNS=$(make_patterns "${EXCLUDE_ARGS[@]}")
  for exclude in $EXCLUDE_PATTERNS; do
    TEST_FILES=$(echo "$TEST_FILES" | tr ' ' '\n' | grep -v "$exclude" | tr '\n' ' ')
  done
fi

extest run-tests $TEST_FILES --extensions_dir ./data/vscode-extensions -r ./data/react-native-app --code_version 1.99.1
