#include "monitor_app.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "cJSON.h"
#include "esp_crt_bundle.h"
#include "esp_event.h"
#include "esp_http_client.h"
#include "esp_http_server.h"
#include "esp_netif.h"
#include "esp_random.h"
#include "esp_sntp.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "nvs.h"
#define URL "https://monitor.ounirobot.com/api/ds/query"
#define RESPONSE_CAP 32768
static char ssid[33], password[65], token[2049];
static char response[RESPONSE_CAP];
static size_t received;
static bool overflow;
atomic_bool mon_setup;
char mon_ap_name[33], mon_ap_pass[17];
static void state(const char *s,int status) {xSemaphoreTake(mon_mutex,portMAX_DELAY);snprintf(mon_state.state,sizeof(mon_state.state),"%s",s);mon_state.http_status=status;xSemaphoreGive(mon_mutex);}
static bool load_config(void) {
    nvs_handle_t n; if(nvs_open("ounimon",NVS_READONLY,&n)!=ESP_OK)return false;
    size_t a=sizeof(ssid),b=sizeof(password),c=sizeof(token);uint8_t setup=0;
    bool ok=nvs_get_str(n,"ssid",ssid,&a)==ESP_OK&&nvs_get_str(n,"password",password,&b)==ESP_OK&&nvs_get_str(n,"token",token,&c)==ESP_OK;
    nvs_get_u8(n,"setup",&setup);nvs_close(n);return ok&&!setup&&ssid[0]&&token[0];
}
void mon_request_setup(void) {
    nvs_handle_t n;
    if(nvs_open("ounimon",NVS_READWRITE,&n)!=ESP_OK)return;
    esp_err_t e=nvs_set_u8(n,"setup",1);if(e==ESP_OK)e=nvs_commit(n);nvs_close(n);
    if(e==ESP_OK)esp_restart();
}
static const char form[]=
"<!doctype html><html lang=zh-CN><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>AI Passport 配网</title>"
"<style>body{font:16px system-ui;max-width:460px;margin:40px auto;padding:20px;background:#101b25;color:#e8eef5}input,button{box-sizing:border-box;width:100%;padding:13px;margin:8px 0 20px;border-radius:8px;border:1px solid #547080}button{background:#6de6c3;color:#10231f;font-weight:bold}small{color:#b6c4d1}</style>"
"<h1>AI Passport</h1><p>OUNIROBOT 监控 · 独立 Wi-Fi</p><form id=f>"
"<label>2.4 GHz Wi-Fi 名称<input id=s required maxlength=32 autocomplete=off></label>"
"<label>Wi-Fi 密码<input id=p type=password maxlength=64 autocomplete=new-password></label>"
"<label>Grafana 只读服务账户令牌<input id=t type=password required maxlength=2048 autocomplete=new-password></label>"
"<small>地址固定为 https://monitor.ounirobot.com。凭证保存在工牌本机；请勿填写管理员密码。此配网页面仅在工牌的加密热点内使用。</small>"
"<button>保存并连接</button></form><p id=m></p><script>f.onsubmit=async e=>{e.preventDefault();m.textContent='正在保存…';try{let r=await fetch('/configure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ssid:s.value,password:p.value,token:t.value})});m.textContent=await r.text();if(r.ok)f.remove()}catch(e){m.textContent='连接断开，请查看工牌屏幕。'}}</script></html>";
static esp_err_t get_form(httpd_req_t *r) {httpd_resp_set_type(r,"text/html; charset=utf-8");httpd_resp_set_hdr(r,"Cache-Control","no-store");return httpd_resp_send(r,form,HTTPD_RESP_USE_STRLEN);}
static void restart_task(void *p) {(void)p;vTaskDelay(pdMS_TO_TICKS(1500));esp_restart();}
static esp_err_t configure(httpd_req_t *r) {
    char origin[96];
    if(httpd_req_get_hdr_value_len(r,"Origin") && (httpd_req_get_hdr_value_str(r,"Origin",origin,sizeof(origin))!=ESP_OK || strcmp(origin,"http://192.168.4.1"))) return httpd_resp_send_err(r,HTTPD_403_FORBIDDEN,"Invalid origin");
    if(r->content_len<=0||r->content_len>3500)return httpd_resp_send_err(r,HTTPD_400_BAD_REQUEST,"Invalid request size");
    char *body=calloc(1,r->content_len+1);if(!body)return ESP_ERR_NO_MEM;
    size_t pos=0;
    while(pos<r->content_len) {int n=httpd_req_recv(r,body+pos,r->content_len-pos);if(n<=0){free(body);return ESP_FAIL;}pos+=n;}
    cJSON *j=cJSON_Parse(body);free(body);
    const cJSON *s=cJSON_GetObjectItemCaseSensitive(j,"ssid"),*p=cJSON_GetObjectItemCaseSensitive(j,"password"),*t=cJSON_GetObjectItemCaseSensitive(j,"token");
    bool valid=cJSON_IsString(s)&&strlen(s->valuestring)>0&&strlen(s->valuestring)<=32&&cJSON_IsString(p)&&strlen(p->valuestring)<=64&&cJSON_IsString(t)&&strlen(t->valuestring)>0&&strlen(t->valuestring)<=2048;
    if(valid) for(const char *c=t->valuestring;*c;c++) if((unsigned char)*c<=32||(unsigned char)*c>=127)valid=false;
    if(!valid) {cJSON_Delete(j);return httpd_resp_send_err(r,HTTPD_400_BAD_REQUEST,"Invalid Wi-Fi or token");}
    nvs_handle_t n;esp_err_t e=nvs_open("ounimon",NVS_READWRITE,&n);
    if(e==ESP_OK) {
        e=nvs_set_str(n,"ssid",s->valuestring);
        if(e==ESP_OK)e=nvs_set_str(n,"password",p->valuestring);
        if(e==ESP_OK)e=nvs_set_str(n,"token",t->valuestring);
        if(e==ESP_OK)e=nvs_set_u8(n,"setup",0);
        if(e==ESP_OK)e=nvs_commit(n);
        nvs_close(n);
    }
    cJSON_Delete(j);
    if(e!=ESP_OK)return httpd_resp_send_err(r,HTTPD_500_INTERNAL_SERVER_ERROR,"Save failed; retry");
    httpd_resp_set_type(r,"text/plain; charset=utf-8");httpd_resp_set_hdr(r,"Cache-Control","no-store");
    esp_err_t sent=httpd_resp_sendstr(r,"已保存。工牌即将连接 Wi-Fi，可以关闭此页面。");
    xTaskCreate(restart_task,"restart",2048,NULL,3,NULL);return sent;
}
static void start_ap(void) {
    uint32_t a=esp_random(),b=esp_random();
    snprintf(mon_ap_name,sizeof(mon_ap_name),"Passport-%04lX",(unsigned long)(a&0xffff));
    snprintf(mon_ap_pass,sizeof(mon_ap_pass),"%08lx%04lx",(unsigned long)b,(unsigned long)(a>>16));
    esp_netif_create_default_wifi_ap();
    wifi_config_t c={0};memcpy(c.ap.ssid,mon_ap_name,strlen(mon_ap_name));c.ap.ssid_len=strlen(mon_ap_name);
    snprintf((char*)c.ap.password,sizeof(c.ap.password),"%s",mon_ap_pass);c.ap.channel=6;c.ap.max_connection=1;c.ap.authmode=WIFI_AUTH_WPA2_PSK;
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP,&c));ESP_ERROR_CHECK(esp_wifi_start());
    httpd_config_t hc=HTTPD_DEFAULT_CONFIG();hc.stack_size=6144;hc.max_uri_handlers=3;
    httpd_handle_t server=NULL;ESP_ERROR_CHECK(httpd_start(&server,&hc));
    httpd_uri_t get={.uri="/",.method=HTTP_GET,.handler=get_form},post={.uri="/configure",.method=HTTP_POST,.handler=configure};
    ESP_ERROR_CHECK(httpd_register_uri_handler(server,&get));ESP_ERROR_CHECK(httpd_register_uri_handler(server,&post));
    mon_setup=true;state("Wi-Fi setup",0);
}
static void wifi_event(void *arg,esp_event_base_t base,int32_t id,void *data) {
    (void)arg;(void)data;
    if(base==WIFI_EVENT && (id==WIFI_EVENT_STA_START||id==WIFI_EVENT_STA_DISCONNECTED)) {
        xSemaphoreTake(mon_mutex,portMAX_DELAY);mon_state.wifi=false;xSemaphoreGive(mon_mutex);esp_wifi_connect();
    } else if(base==IP_EVENT&&id==IP_EVENT_STA_GOT_IP) {
        xSemaphoreTake(mon_mutex,portMAX_DELAY);mon_state.wifi=true;xSemaphoreGive(mon_mutex);
    }
}
static esp_err_t http_event(esp_http_client_event_t *e) {
    if(e->event_id==HTTP_EVENT_ON_DATA && e->data_len>0) {
        if(received+(size_t)e->data_len>=RESPONSE_CAP) {overflow=true;return ESP_FAIL;}
        memcpy(response+received,e->data,e->data_len);received+=e->data_len;response[received]=0;
    }return ESP_OK;
}
static char *make_query(void) {
    const char *refs[]={"cpu","mem","disk","up","rds","redis"};
    const char *expr[]={
        "100 - (avg by (node) (rate(node_cpu_seconds_total{job=\"node-exporter\",mode=\"idle\"}[5m])) * 100)",
        "(1 - node_memory_MemAvailable_bytes{job=\"node-exporter\"} / node_memory_MemTotal_bytes{job=\"node-exporter\"}) * 100",
        "(1 - node_filesystem_avail_bytes{job=\"node-exporter\",mountpoint=\"/\",fstype!~\"tmpfs|overlay|squashfs\"} / node_filesystem_size_bytes{job=\"node-exporter\",mountpoint=\"/\",fstype!~\"tmpfs|overlay|squashfs\"}) * 100",
        "up{job=\"node-exporter\"}","up{job=\"postgres-exporter-primary\"}","up{job=\"redis-exporter-shared\"}"};
    cJSON *j=cJSON_CreateObject(),*qs=cJSON_AddArrayToObject(j,"queries");if(!j||!qs){cJSON_Delete(j);return NULL;}
    cJSON_AddStringToObject(j,"from","now-5m");cJSON_AddStringToObject(j,"to","now");
    for(int i=0;i<6;i++) {
        cJSON *q=cJSON_CreateObject();cJSON_AddItemToArray(qs,q);
        cJSON_AddStringToObject(q,"refId",refs[i]);cJSON_AddStringToObject(q,"expr",expr[i]);
        cJSON *ds=cJSON_AddObjectToObject(q,"datasource");cJSON_AddStringToObject(ds,"type","prometheus");cJSON_AddStringToObject(ds,"uid","prometheus");
        cJSON_AddBoolToObject(q,"instant",true);cJSON_AddBoolToObject(q,"range",false);cJSON_AddStringToObject(q,"format","table");cJSON_AddNumberToObject(q,"intervalMs",15000);cJSON_AddNumberToObject(q,"maxDataPoints",1);
    }
    char *s=cJSON_PrintUnformatted(j);cJSON_Delete(j);return s;
}
static void network_task(void *arg) {
    (void)arg;char *query=make_query();char *auth=malloc(strlen(token)+8);
    if(!query||!auth){free(query);free(auth);state("Out of memory",0);vTaskDelete(NULL);return;}
    sprintf(auth,"Bearer %s",token);memset(token,0,sizeof(token));
    for(;;) {
        bool wifi;xSemaphoreTake(mon_mutex,portMAX_DELAY);wifi=mon_state.wifi;xSemaphoreGive(mon_mutex);
        if(!wifi) state("Wi-Fi reconnecting",0);
        else if(time(NULL)<1767225600) state("Syncing clock / TLS",0);
        else {
            state("Refreshing",0);received=0;overflow=false;response[0]=0;
            esp_http_client_config_t cfg={.url=URL,.crt_bundle_attach=esp_crt_bundle_attach,.timeout_ms=12000,.event_handler=http_event,.buffer_size=2048,.disable_auto_redirect=true};
            esp_http_client_handle_t h=esp_http_client_init(&cfg);
            if(!h){state("HTTP init failed",0);vTaskDelay(pdMS_TO_TICKS(15000));continue;}
            esp_http_client_set_method(h,HTTP_METHOD_POST);esp_http_client_set_header(h,"Authorization",auth);esp_http_client_set_header(h,"Content-Type","application/json");esp_http_client_set_header(h,"X-Grafana-Org-Id","1");
            esp_http_client_set_post_field(h,query,strlen(query));esp_err_t e=esp_http_client_perform(h);int status=esp_http_client_get_status_code(h);
            mon_data_t next;bool ok=e==ESP_OK&&status==200&&!overflow&&mon_parse(response,(int64_t)time(NULL)*1000,&next);
            esp_http_client_cleanup(h);
            if(ok) {xSemaphoreTake(mon_mutex,portMAX_DELAY);mon_state.data=next;mon_state.source_age=((int64_t)time(NULL)*1000-next.source_ms)/1000;mon_state.received_us=esp_timer_get_time();xSemaphoreGive(mon_mutex);state("Live / 15s",200);}
            else state(status==401||status==403?"Token denied: hold OK":overflow?"Response too large":e!=ESP_OK?"Network / TLS error":status!=200?"Grafana HTTP error":"Missing / stale metrics",status);
        }
        vTaskDelay(pdMS_TO_TICKS(wifi?15000:3000));
    }
}
void mon_network_start(void) {
    ESP_ERROR_CHECK(esp_netif_init());ESP_ERROR_CHECK(esp_event_loop_create_default());wifi_init_config_t init=WIFI_INIT_CONFIG_DEFAULT();ESP_ERROR_CHECK(esp_wifi_init(&init));ESP_ERROR_CHECK(esp_wifi_set_storage(WIFI_STORAGE_RAM));
    if(!load_config()){start_ap();return;}
    esp_netif_create_default_wifi_sta();
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT,ESP_EVENT_ANY_ID,wifi_event,NULL));ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT,IP_EVENT_STA_GOT_IP,wifi_event,NULL));
    wifi_config_t c={0};memcpy(c.sta.ssid,ssid,strlen(ssid));memcpy(c.sta.password,password,strlen(password));
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA,&c));ESP_ERROR_CHECK(esp_wifi_start());memset(password,0,sizeof(password));
    esp_sntp_setoperatingmode(SNTP_OPMODE_POLL);esp_sntp_setservername(0,"pool.ntp.org");esp_sntp_setservername(1,"time.cloudflare.com");esp_sntp_init();
    BaseType_t ok=xTaskCreate(network_task,"monitor_net",12288,NULL,4,NULL);assert(ok==pdPASS);
}
