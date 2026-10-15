[English](README.md) | [简体中文](README.zh_CN.md)

# OUNIROBOT monitor firmware

This application replaces the demo entry point with an independent Wi-Fi Grafana monitor for the 240 x 320 AI Passport. This directory contains the standalone application and BSP, without upstream demos.

## First use

1. Power on and join the WPA2 hotspot named on the display. Use its randomly generated password.
2. Open `http://192.168.4.1`. Enter a 2.4 GHz Wi-Fi SSID, Wi-Fi password, and a dedicated Grafana service-account token with Viewer/read-only access in organization 1. Do not enter an administrator password.
3. Save. The device restarts, stops the setup hotspot, synchronizes time over NTP, and queries `https://monitor.ounirobot.com/api/ds/query` using the `prometheus` datasource every 15 seconds. TLS validates the server certificate using the ESP-IDF certificate bundle. Redirects are rejected.
4. Up/down selects a node. OK switches between overview and detail. Hold OK to restart in setup mode and replace credentials.

The screen shows CPU (five-minute average), memory, root disk, node-exporter availability, and RDS/Redis exporter availability. Exporter availability is not a database transaction health check. Values at 80% are amber and at 90% are red; these are local display thresholds, not Grafana alert rules. Missing data remains unknown. Failed queries retain the last successful snapshot; the footer shows sample age, and offline or samples older than 60 seconds are marked stale. No historical charts, container list, or network throughput are included in this version. Up to eight nodes are supported; extra nodes fail the snapshot instead of silently disappearing.

## Credentials and recovery

Wi-Fi and the token are stored in local NVS. Flash encryption is not enabled: someone with physical flash access can recover them. Use a dedicated read-only token, revoke it when retiring the device, and never commit credentials. The form does not expose saved credentials. Setup uses WPA2, one client, a random password, no external assets, no-store responses, and checks browser Origin. There is no Internet-facing provisioning endpoint. A setup failure leaves the device in setup mode. NVS errors do not trigger automatic erasure.

The user must supply a valid read-only token and Wi-Fi settings to complete the live device test. A browser login session is never copied into firmware.

## Build and validation

Use ESP-IDF 5.5.3 and run `./tools/validate.sh`. This includes monitor value/threshold/capacity tests, Grafana JSON frame/status/timestamp/null tests, an ESP32-C3 build and merged-image verification. Host parser tests link the IDF cJSON source, so IDF_PATH must be set. Device checks must additionally cover hotspot provisioning, TLS, valid/invalid tokens, live refresh, disconnected Wi-Fi, keys, and battery status. Build success alone does not establish device success.

## Attribution and device validation

The BSP, build configuration, and image verifier derive from [FoloToy/ai-passport](https://github.com/FoloToy/ai-passport), upstream baseline `3d685a9`, under the included MIT license. The monitor application is added by this project. No Wi-Fi password or Grafana token is embedded.

The complete upstream validation gate passed. Flashing, write verification, and bounded startup-log observation passed on an ESP32-C3 v1.1 / 8 MB AI Passport. Display, battery, button drivers and setup AP initialized successfully. Actual network refresh, visual rendering, and key interaction remain unverified until the user provisions the device.
