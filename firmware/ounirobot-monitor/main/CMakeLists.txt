idf_component_register(
    SRCS "monitor_main.c" "monitor_model.c" "monitor_parse.c" "monitor_net.c" "monitor_ui.c"
    INCLUDE_DIRS "."
    REQUIRES bsp esp_event esp_netif esp_timer esp_wifi nvs_flash esp_http_client esp_http_server mbedtls lwip json
)
