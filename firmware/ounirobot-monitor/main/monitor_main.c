#include "monitor_app.h"
#include "bsp_display.h"
#include "bsp_battery.h"
#include "esp_check.h"
#include "nvs_flash.h"
mon_state_t mon_state;
SemaphoreHandle_t mon_mutex;
void app_main(void) {
    esp_err_t e=nvs_flash_init();
    // Preserve existing credentials if NVS cannot be read; never erase automatically.
    ESP_ERROR_CHECK(e);
    mon_mutex=xSemaphoreCreateMutex(); assert(mon_mutex);
    mon_reset(&mon_state.data);
    ESP_ERROR_CHECK(bsp_display_init()); assert(bsp_lvgl_init());
    bsp_display_backlight(65);
    (void)bsp_battery_init();
    mon_ui_start(); mon_network_start();
}
