#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#define MON_NODES 8
#define MON_NAME 40
typedef struct { char name[MON_NAME]; float cpu, mem, disk, up; } mon_node_t;
typedef struct { mon_node_t nodes[MON_NODES]; size_t count; float rds, redis; int64_t source_ms; } mon_data_t;
void mon_reset(mon_data_t *d);
bool mon_put(mon_data_t *d, const char *name, const char *metric, double value);
bool mon_percent_valid(double value);
int mon_severity(float value);
bool mon_parse(const char *json, int64_t now_ms, mon_data_t *out);
