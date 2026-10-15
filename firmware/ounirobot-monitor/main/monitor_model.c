#include "monitor_model.h"
#include <math.h>
#include <string.h>
void mon_reset(mon_data_t *d) { memset(d, 0, sizeof(*d)); d->rds = d->redis = NAN; }
bool mon_percent_valid(double v) { return isfinite(v) && v >= 0 && v <= 100; }
int mon_severity(float v) { return !mon_percent_valid(v) ? -1 : v >= 90 ? 2 : v >= 80 ? 1 : 0; }
bool mon_put(mon_data_t *d, const char *name, const char *metric, double v) {
    if (strcmp(metric,"cpu") && strcmp(metric,"mem") && strcmp(metric,"disk") && strcmp(metric,"up")) return false;
    if (!name || !*name || strlen(name) >= MON_NAME || !isfinite(v)) return false;
    if (strcmp(metric,"up") == 0 ? (v != 0 && v != 1) : !mon_percent_valid(v)) return false;
    size_t i = 0;
    while (i < d->count && strcmp(d->nodes[i].name, name)) i++;
    if (i == d->count) {
        if (i == MON_NODES) return false;
        mon_node_t *n = &d->nodes[d->count++];
        strcpy(n->name,name); n->cpu=n->mem=n->disk=n->up=NAN;
    }
    mon_node_t *n=&d->nodes[i];
    if (!strcmp(metric,"cpu")) n->cpu=v;
    else if (!strcmp(metric,"mem")) n->mem=v;
    else if (!strcmp(metric,"disk")) n->disk=v;
    else if (!strcmp(metric,"up")) n->up=v;
    else return false;
    return true;
}
