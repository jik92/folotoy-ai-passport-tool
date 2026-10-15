#include "monitor_app.h"
#include <math.h>
#include <stdio.h>
#include <string.h>
#include "bsp_display.h"
#include "bsp_button.h"
#include "bsp_battery.h"
#include "esp_timer.h"
#include "lvgl.h"
#include "freertos/queue.h"
static QueueHandle_t buttons;
typedef struct {bsp_btn_t btn;bsp_btn_ev_t ev;} key_t;
static lv_obj_t *battery,*status,*heading,*rows[8],*services,*footer;
static lv_obj_t *cells[5][4],*columns[3];
static const uint32_t FG=0xe7eff5,MUTED=0x8da6b8,GREEN=0x6de6c3,RED=0xff7875,AMBER=0xffc36b;
static lv_obj_t *label(int x,int y,int width,const lv_font_t *font,uint32_t color) {
    lv_obj_t *o=lv_label_create(lv_screen_active());lv_obj_set_pos(o,x,y);lv_obj_set_width(o,width);lv_obj_set_style_text_font(o,font,0);lv_obj_set_style_text_color(o,lv_color_hex(color),0);lv_label_set_long_mode(o,LV_LABEL_LONG_MODE_CLIP);lv_label_set_text(o,"");return o;
}
static void button(bsp_btn_t b,bsp_btn_ev_t e,void *u) {(void)u;key_t k={b,e};if(e==BSP_BTN_CLICK||e==BSP_BTN_LONG)xQueueSend(buttons,&k,0);}
static void pct(char *buf,size_t cap,float v) {if(mon_percent_valid(v))snprintf(buf,cap,"%3.0f",v);else snprintf(buf,cap," --");}
static void ui_task(void *p) {
    (void)p;size_t selected=0;bool detail=false;int battery_value=-1,cycles=0;
    for(;;) {
        key_t k;
        while(xQueueReceive(buttons,&k,0)==pdTRUE) {
            if(k.btn==BSP_BTN_OK&&k.ev==BSP_BTN_LONG&&!mon_setup)mon_request_setup();
            if(k.ev!=BSP_BTN_CLICK)continue;
            if(k.btn==BSP_BTN_UP) {xSemaphoreTake(mon_mutex,portMAX_DELAY);size_t count=mon_state.data.count;xSemaphoreGive(mon_mutex);selected=count?(selected+count-1)%count:0;}
            if(k.btn==BSP_BTN_DOWN)selected=(selected+1)%MON_NODES;
            if(k.btn==BSP_BTN_OK)detail=!detail;
        }
        mon_state_t s;xSemaphoreTake(mon_mutex,portMAX_DELAY);s=mon_state;xSemaphoreGive(mon_mutex);
        if(++cycles>=40){battery_value=bsp_battery_soc();cycles=0;}
        if(bsp_lvgl_lock(100)) {
            char text[180];snprintf(text,sizeof(text),battery_value>=0?"%d%%":"--%%",battery_value);lv_label_set_text(battery,text);
            for(int i=0;i<8;i++)lv_label_set_text(rows[i],"");
            bool table=!mon_setup&&!detail;
            for(int i=0;i<3;i++)lv_obj_set_flag(columns[i],LV_OBJ_FLAG_HIDDEN,!table);
            for(int i=0;i<5;i++)for(int j=0;j<4;j++){lv_obj_set_flag(cells[i][j],LV_OBJ_FLAG_HIDDEN,!table);lv_label_set_text(cells[i][j],"");}
            if(mon_setup) {
                lv_label_set_text(status,"SETUP / WPA2 HOTSPOT");lv_label_set_text(heading,"Connect your phone or Mac");
                lv_label_set_text(rows[0],mon_ap_name);lv_label_set_text(rows[1],"Hotspot password:");lv_label_set_text(rows[2],mon_ap_pass);
                lv_label_set_text(rows[4],"Open in your browser:");lv_label_set_text(rows[5],"http://192.168.4.1");lv_label_set_text(services,"2.4 GHz Wi-Fi + Grafana token");lv_label_set_text(footer,"Save to connect automatically");
                for(int i=0;i<8;i++)lv_obj_set_style_text_color(rows[i],lv_color_hex(i==0||i==2||i==5?GREEN:FG),0);
            } else {
                int64_t age=s.received_us?(esp_timer_get_time()-s.received_us)/1000000+s.source_age:0;
                bool stale=!s.received_us||age>60||!s.wifi;
                snprintf(text,sizeof(text),"%s%s%s",s.wifi?"":"OFFLINE / ",s.state,stale&&s.received_us?" / STALE":"");lv_label_set_text(status,text);lv_obj_set_style_text_color(status,lv_color_hex(stale?AMBER:GREEN),0);
                if(s.data.count)selected%=s.data.count;
                if(!detail) {
                    lv_label_set_text(heading,"NODE");
                    size_t first=(selected/5)*5;
                    for(size_t i=first;i<s.data.count&&i<first+5;i++) {
                        const mon_node_t *n=&s.data.nodes[i];char cpu[8],mem[8],disk[8];pct(cpu,sizeof(cpu),n->cpu);pct(mem,sizeof(mem),n->mem);pct(disk,sizeof(disk),n->disk);
                        const char *name=n->name;if(!strncmp(name,"ECS-PROD-",9))name+=9;
                        snprintf(text,sizeof(text),"%c%s",i==selected?'>':' ',name);
                        lv_label_set_text(cells[i-first][0],text);
                        lv_label_set_text(cells[i-first][1],cpu);lv_label_set_text(cells[i-first][2],mem);lv_label_set_text(cells[i-first][3],disk);
                        float vals[]={n->cpu,n->mem,n->disk};
                        lv_obj_set_style_text_color(cells[i-first][0],lv_color_hex(n->up==0?RED:i==selected?GREEN:FG),0);
                        for(int j=1;j<4;j++){int sev=mon_severity(vals[j-1]);lv_obj_set_style_text_color(cells[i-first][j],lv_color_hex(sev==2?RED:sev==1?AMBER:i==selected?GREEN:FG),0);}
                    }
                    if(!s.data.count){lv_label_set_text(rows[1],"Waiting for first live sample");lv_label_set_text(rows[3],"Hold OK to change Wi-Fi/token");}
                } else if(s.data.count) {
                    const mon_node_t *n=&s.data.nodes[selected];lv_label_set_text(heading,n->name);
                    const char *names[]={"CPU (5 min)","RAM","ROOT DISK"};float vals[]={n->cpu,n->mem,n->disk};
                    for(int i=0;i<3;i++){char v[8];pct(v,sizeof(v),vals[i]);snprintf(text,sizeof(text),"%-14s  %s %%",names[i],v);lv_label_set_text(rows[i*2],text);int sev=mon_severity(vals[i]);lv_obj_set_style_text_color(rows[i*2],lv_color_hex(sev==2?RED:sev==1?AMBER:FG),0);}
                    lv_label_set_text(rows[6],n->up==1?"NODE EXPORTER: UP":n->up==0?"NODE EXPORTER: DOWN":"NODE EXPORTER: UNKNOWN");
                }
                snprintf(text,sizeof(text),"RDS %s     REDIS %s",s.data.rds==1?"UP":s.data.rds==0?"DOWN":"--",s.data.redis==1?"UP":s.data.redis==0?"DOWN":"--");lv_label_set_text(services,text);lv_obj_set_style_text_color(services,lv_color_hex(s.data.rds==0||s.data.redis==0?RED:FG),0);
                snprintf(text,sizeof(text),"%s  %llds ago | OK: %s",stale?"STALE":"LIVE",(long long)age,detail?"list":"detail");lv_label_set_text(footer,s.received_us?text:"Hold OK: Wi-Fi setup");
            }
            bsp_lvgl_unlock();
        }
        vTaskDelay(pdMS_TO_TICKS(250));
    }
}
void mon_ui_start(void) {
    buttons=xQueueCreate(8,sizeof(key_t));assert(buttons);
    if(bsp_lvgl_lock(-1)) {
        lv_obj_set_style_bg_color(lv_screen_active(),lv_color_hex(0x101b25),0);
        lv_obj_t *title=label(18,16,158,&lv_font_montserrat_20,FG);lv_label_set_text(title,"OUNIROBOT");
        battery=label(184,20,42,&lv_font_montserrat_12,MUTED);
        status=label(18,46,208,&lv_font_montserrat_10,GREEN);
        heading=label(18,74,210,&lv_font_montserrat_12,MUTED);
        for(int i=0;i<8;i++)rows[i]=label(18,99+i*19,210,&lv_font_montserrat_12,FG);
        const int x[]={18,103,145,187};const int widths[]={80,36,36,36};
        const char *names[]={"CPU","RAM","DISK"};
        for(int i=0;i<3;i++){columns[i]=label(x[i+1],74,widths[i+1],&lv_font_montserrat_10,MUTED);lv_label_set_text(columns[i],names[i]);}
        for(int i=0;i<5;i++)for(int j=0;j<4;j++)cells[i][j]=label(x[j],104+i*28,widths[j],j==0?&lv_font_montserrat_10:&lv_font_montserrat_14,FG);
        services=label(18,263,210,&lv_font_montserrat_12,FG);
        footer=label(18,292,208,&lv_font_montserrat_10,MUTED);
        bsp_lvgl_unlock();
    }
    ESP_ERROR_CHECK(bsp_button_init(button,NULL));
    BaseType_t ok=xTaskCreate(ui_task,"monitor_ui",6144,NULL,3,NULL);assert(ok==pdPASS);
}
