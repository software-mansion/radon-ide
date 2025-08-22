#!/bin/bash

if [ "$#" -eq 0 ]; then
  TEST_FILES="./ui-tests/*.test.js"
else
  TEST_FILES=""
  for num in "$@"; do
    if (( num < 10 )); then
      num="0$num"
    fi
    TEST_FILES="$TEST_FILES ./ui-tests/${num}-*.test.js"
  done
fi

extest run-tests $TEST_FILES --extensions_dir ./data/vscode-extensions -r ./data/react-native-app
