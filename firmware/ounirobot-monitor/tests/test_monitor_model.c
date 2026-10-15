#include "monitor_model.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
int main(void) {
    mon_data_t d; mon_reset(&d);assert(d.count==0 && isnan(d.rds));
    assert(!mon_percent_valid(NAN));assert(!mon_percent_valid(INFINITY));
    assert(mon_severity(79.9f)==0 && mon_severity(80)==1 && mon_severity(90)==2 && mon_severity(NAN)==-1);
    assert(!mon_put(&d,"node","bad",20));assert(d.count==0);
    assert(mon_put(&d,"node","cpu",15));assert(isnan(d.nodes[0].disk));
    assert(!mon_put(&d,"node","cpu",101));assert(d.nodes[0].cpu==15);
    assert(!mon_put(&d,"node","up",2));assert(mon_put(&d,"node","up",0));assert(d.nodes[0].up==0);
    for(int i=1;i<MON_NODES;i++){char name[20];snprintf(name,sizeof(name),"node-%d",i);assert(mon_put(&d,name,"disk",90));}
    assert(!mon_put(&d,"overflow","cpu",10));assert(d.count==MON_NODES);
    char long_name[MON_NAME+1];memset(long_name,'x',MON_NAME);long_name[MON_NAME]=0;assert(!mon_put(&d,long_name,"cpu",10));
    puts("Monitor model: PASS");return 0;
}
