#include "monitor_model.h"
#include "cJSON.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>
static const cJSON *get(const cJSON *o,const char *k) { return cJSON_GetObjectItemCaseSensitive(o,k); }
static int cmp_node(const void *a,const void *b) { return strcmp(((const mon_node_t*)a)->name,((const mon_node_t*)b)->name); }
bool mon_parse(const char *json,int64_t now_ms,mon_data_t *out) {
    cJSON *root=cJSON_Parse(json); if(!root) return false;
    mon_data_t d; mon_reset(&d); bool ok=true; int64_t oldest=now_ms;
    const char *refs[]={"cpu","mem","disk","up","rds","redis"};
    const cJSON *results=get(root,"results");
    for(size_t r=0;r<6 && ok;r++) {
        const cJSON *res=get(results,refs[r]), *status=get(res,"status"), *frames=get(res,"frames");
        if(!cJSON_IsNumber(status)||status->valueint!=200||!cJSON_IsArray(frames)||cJSON_GetArraySize(frames)==0) {ok=false; break;}
        const cJSON *frame;
        cJSON_ArrayForEach(frame,frames) {
            const cJSON *fields=get(get(frame,"schema"),"fields"), *values=get(get(frame,"data"),"values");
            if(!cJSON_IsArray(fields)||!cJSON_IsArray(values)) {ok=false;break;}
            double ts=NAN; int found=0;
            for(int i=0;i<cJSON_GetArraySize(fields);i++) {
                const cJSON *f=cJSON_GetArrayItem(fields,i), *type=get(f,"type");
                const cJSON *v=cJSON_GetArrayItem(cJSON_GetArrayItem(values,i),0);
                if(cJSON_IsString(type)&&!strcmp(type->valuestring,"time")&&cJSON_IsNumber(v)) ts=v->valuedouble;
            }
            if(!isfinite(ts)||ts<now_ms-60000||ts>now_ms+30000) {ok=false;break;}
            if(ts<oldest) oldest=(int64_t)ts;
            for(int i=0;i<cJSON_GetArraySize(fields);i++) {
                const cJSON *f=cJSON_GetArrayItem(fields,i), *type=get(f,"type");
                if(!cJSON_IsString(type)||strcmp(type->valuestring,"number")) continue;
                const cJSON *v=cJSON_GetArrayItem(cJSON_GetArrayItem(values,i),0);
                if(!cJSON_IsNumber(v)) continue;
                if(r<4) {
                    const cJSON *name=get(get(f,"labels"),"node");
                    if(!cJSON_IsString(name)||!mon_put(&d,name->valuestring,refs[r],v->valuedouble)) {ok=false;break;}
                } else {
                    if(v->valuedouble!=0 && v->valuedouble!=1) {ok=false;break;}
                    float *service=r==4?&d.rds:&d.redis;
                    *service=isnan(*service)?v->valuedouble:fminf(*service,v->valuedouble);
                }
                found++;
            }
            if(!found) {ok=false;break;}
        }
    }
    if(!d.count) ok=false;
    if(ok) {d.source_ms=oldest;qsort(d.nodes,d.count,sizeof(d.nodes[0]),cmp_node);*out=d;}
    cJSON_Delete(root);return ok;
}
