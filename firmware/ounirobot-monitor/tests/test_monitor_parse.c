#include "monitor_model.h"
#include "cJSON.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
static cJSON *fixture(void) {
    cJSON *root=cJSON_CreateObject(),*results=cJSON_AddObjectToObject(root,"results");
    const char *refs[]={"cpu","mem","disk","up","rds","redis"};
    for(int i=0;i<6;i++) {
        cJSON *r=cJSON_AddObjectToObject(results,refs[i]);cJSON_AddNumberToObject(r,"status",200);
        cJSON *frames=cJSON_AddArrayToObject(r,"frames"),*f=cJSON_CreateObject();cJSON_AddItemToArray(frames,f);
        cJSON *schema=cJSON_AddObjectToObject(f,"schema"),*fields=cJSON_AddArrayToObject(schema,"fields");
        cJSON *tf=cJSON_CreateObject();cJSON_AddStringToObject(tf,"type","time");cJSON_AddItemToArray(fields,tf);
        cJSON *vf=cJSON_CreateObject();cJSON_AddStringToObject(vf,"type","number");cJSON_AddStringToObject(vf,"name",i>=3?"up":"Value");
        if(i<4) {cJSON_AddStringToObject(cJSON_AddObjectToObject(vf,"labels"),"node","ECS-PROD-02 (UAT)");}
        cJSON_AddItemToArray(fields,vf);
        cJSON *vals=cJSON_AddArrayToObject(cJSON_AddObjectToObject(f,"data"),"values");
        cJSON *t=cJSON_CreateArray(),*v=cJSON_CreateArray();cJSON_AddItemToArray(vals,t);cJSON_AddItemToArray(vals,v);
        cJSON_AddItemToArray(t,cJSON_CreateNumber(1800000000000.0));cJSON_AddItemToArray(v,cJSON_CreateNumber(i<3?90:1));
    }return root;
}
static bool parse(cJSON *j,int64_t now,mon_data_t *d) {char *s=cJSON_PrintUnformatted(j);bool ok=mon_parse(s,now,d);cJSON_free(s);return ok;}
int main(void) {
    mon_data_t d;mon_reset(&d);cJSON *j=fixture();
    assert(parse(j,1800000001000LL,&d));assert(d.count==1&&d.nodes[0].disk==90&&d.rds==1);
    assert(!parse(j,1800000061000LL,&d));assert(!parse(j,1799999969000LL,&d));
    cJSON *res=cJSON_GetObjectItem(cJSON_GetObjectItem(j,"results"),"cpu");cJSON_SetNumberValue(cJSON_GetObjectItem(res,"status"),403);assert(!parse(j,1800000001000LL,&d));cJSON_Delete(j);
    j=fixture();res=cJSON_GetObjectItem(cJSON_GetObjectItem(j,"results"),"up");cJSON_ReplaceItemInObject(res,"frames",cJSON_CreateArray());assert(!parse(j,1800000001000LL,&d));cJSON_Delete(j);
    j=fixture();res=cJSON_GetObjectItem(cJSON_GetObjectItem(j,"results"),"disk");cJSON *f=cJSON_GetArrayItem(cJSON_GetObjectItem(res,"frames"),0);cJSON *values=cJSON_GetObjectItem(cJSON_GetObjectItem(f,"data"),"values");cJSON_ReplaceItemInArray(cJSON_GetArrayItem(values,1),0,cJSON_CreateNull());assert(!parse(j,1800000001000LL,&d));cJSON_Delete(j);
    assert(!mon_parse("{broken",1800000001000LL,&d));assert(d.nodes[0].disk==90);puts("Monitor Grafana parser: PASS");return 0;
}
