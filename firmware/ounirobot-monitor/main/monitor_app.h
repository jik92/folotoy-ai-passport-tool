#pragma once
#include "monitor_model.h"
#include <stdatomic.h>
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
typedef struct { mon_data_t data; int64_t received_us; bool wifi; int http_status; int source_age; char state[48]; } mon_state_t;
extern mon_state_t mon_state;
extern SemaphoreHandle_t mon_mutex;
extern atomic_bool mon_setup;
extern char mon_ap_name[33], mon_ap_pass[17];
void mon_network_start(void);
void mon_request_setup(void);
void mon_ui_start(void);
