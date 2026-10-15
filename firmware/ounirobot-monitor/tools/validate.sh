#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${IDF_PATH:?Activate ESP-IDF 5.5.3 first}"
[[ "$(idf.py --version)" == "ESP-IDF v5.5.3" ]] || { echo "ESP-IDF 5.5.3 required" >&2; exit 1; }
mkdir -p build/host
"${CC:-cc}" -std=c11 -Wall -Wextra -Werror -Imain tests/test_monitor_model.c main/monitor_model.c -lm -o build/host/model
build/host/model
"${CC:-cc}" -std=c11 -Wall -Wextra -Werror -Imain -I"${IDF_PATH}/components/json/cJSON" tests/test_monitor_parse.c main/monitor_model.c main/monitor_parse.c "${IDF_PATH}/components/json/cJSON/cJSON.c" -lm -o build/host/parser
build/host/parser
idf.py -B build/idf -D "SDKCONFIG=$PWD/build/idf/sdkconfig" -D "SDKCONFIG_DEFAULTS=$PWD/sdkconfig.defaults" build
idf.py -B build/idf merge-bin -o "$PWD/build/idf/FoloToy-AI-Passport-full.bin"
python3 tools/verify_firmware.py build/idf
