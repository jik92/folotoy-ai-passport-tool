# FoloToy AI Passport Tool

AI Passport 浏览器刷写工作台，使用 **Bun + React + TypeScript + Tailwind CSS 4 + Ant Design 6**。串口通信与刷写由 Espressif `esptool-js` 实现。

## 本地运行

```sh
bun install
bun run dev
```

在桌面 **Chrome / Edge** 打开 <http://127.0.0.1:5178>。无需刷机客户端；操作系统仍需正确识别 USB 串口。

```sh
bun run scan     # macOS：只读扫描系统串口
bun test         # 地址、芯片、容量、重叠、文件和哈希校验
bun run lint
bun run build
bun run preview # 预览构建产物
```

## 使用

1. 用支持数据传输的 USB 线连接 AI Passport，关闭其他占用串口的工具。
2. 点击「连接设备」，亲自在浏览器窗口选择 USB 串口。首次授权不能静默完成；「刷新授权设备」只读取此站点已经获准访问的端口。
3. 程序连接引导加载器（会重启设备）、识别 ESP32-C3 与物理 Flash 容量。错误芯片会拒绝连接。
4. 建议先展开「高级选项」，点击「备份当前设备」，读取完整 Flash 并保存 `.bin`。备份可能包含设备身份与 Wi-Fi 密码，请勿提交到仓库。
5. 页面默认载入已校验的官方小智 AI `v2.5.0-folo.1` 固件，也可切换「本地固件」。**整包模式**仅用于合并镜像，地址固定 `0x0`；**分段模式**按该固件版本的 `flash_args` 填写地址，不推测分区地址。ZIP 需要先解压。
6. 点击「开始刷写」，检查文件与地址，并确认覆盖范围。程序写入、校验 MD5，再尝试自动重启。自动重启失败时按 RESET 或重新上电。

固件在浏览器内计算 SHA-256；写入前检查地址格式、4 KB 对齐、区域重叠、物理 Flash 容量和可识别 ESP 镜像头中的 C3 chip ID。**这些检查不能证明固件对整块电路板兼容或可信**，请自行确认来源及硬件型号。

默认关闭全片擦除，但写入扇区仍会被擦除；合并镜像中的填充区域可能覆盖 NVS、Wi-Fi 和设备身份。需要保留配置时，优先使用官方提供的分段镜像与准确地址。

## 硬件与固件

[FoloToy 官方 AI Passport 项目](https://github.com/FoloToy/folo-ai-passport-xiaozhi) 描述的硬件为 ESP32-C3、8 MB Flash、240×320 ST7789 屏幕。其合并固件写入地址为 `0x0`。本工具内置官方发布的 `v2.5.0-folo.1` 小智 AI 合并固件（7,616,468 bytes），从同源静态资源加载，并在浏览器校验官方 SHA-256；不会自动刷写。

默认固件 SHA-256：`b51eb892c702debef613b9705e617db155aeeb7ea0e20331d44c55d2c4e21518`。发布来源：<https://github.com/FoloToy/folo-ai-passport-xiaozhi/releases/tag/v2.5.0-folo.1>。原项目 LICENSE / NOTICE 随固件保留在 `public/firmware/`。默认固件为小智 AI 版本，非 FoloToy 原厂商业服务固件。

- [AI Passport 固件发布](https://github.com/FoloToy/folo-ai-passport-xiaozhi/releases)
- [Espressif esptool-js](https://github.com/espressif/esptool-js)
- [FoloToy 固件升级文档](https://docs.folotoy.com/zh/docs/web-tool/)

页面使用 Ant Design 紧凑主题，只保留「固件刷写」菜单；备份、高级选项和日志集中在同页。此项目为社区工具。

## 部署

`bun run build` 生成 `dist/`，可部署到支持 HTTPS 的静态站点。Web Serial 要求安全上下文；本地 `localhost` / `127.0.0.1` 可用，普通 HTTP 局域网地址不可用。设备许可按来源分别授予。

## 验证范围

已完成生产构建、代码检查、固件校验单元测试及浏览器交互验证。开发时 macOS 未枚举出 USB 串口，因此真实设备连接、完整备份和写入仍需接上可识别设备后验证。日志展示真实调用结果，不使用模拟刷写进度。
