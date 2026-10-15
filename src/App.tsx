import { useEffect, useRef, useState } from "react";
import {
  Alert,
  App as AntApp,
  Button,
  Checkbox,
  ConfigProvider,
  Input,
  Modal,
  Progress,
  Select,
  Switch,
  Tooltip,
  Upload,
} from "antd";
import zhCN from "antd/locale/zh_CN";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Cable,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Command,
  Cpu,
  FileCode2,
  Fingerprint,
  Code2,
  HardDrive,
  Layers,
  LoaderCircle,
  Plug,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Unplug,
  UploadCloud,
  Usb,
  Zap,
  RefreshCw,
} from "lucide-react";
import { formatBytes, importFirmware, validateFirmware } from "./firmware";
import type { Firmware } from "./firmware";
import { saveFile, useDevice } from "./useDevice";
import "./App.css";
const docs = "https://github.com/FoloToy/folo-ai-passport-xiaozhi";
type View = "flash" | "backup" | "logs";
function Studio() {
  const d = useDevice();
  const { device, busy, error, logs, baud, supported, progress, completed } = d;
  const [view, setView] = useState<View>("flash");
  const [files, setFiles] = useState<Firmware[]>([]);
  const [mode, setMode] = useState<"merged" | "segments">("merged");
  const [importing, setImporting] = useState(false);
  const [erase, setErase] = useState(false);
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [help, setHelp] = useState(false);
  const lock = useRef(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const total = files.reduce((sum, f) => sum + f.data.length, 0);
  useEffect(() => {
    terminalRef.current?.scrollTo({
      top: terminalRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [logs]);
  async function addFiles(selected: File[]) {
    if (busy || lock.current) return;
    lock.current = true;
    setImporting(true);
    d.setError("");
    d.setCompleted(false);
    try {
      const imported = await Promise.all(selected.map(importFirmware));
      if (mode === "merged" && imported.length !== 1)
        throw new Error("整包模式请选择一个合并固件；多个文件请切换分段模式");
      const result = imported.map((f) => ({
        ...f,
        address: mode === "merged" ? "0x0" : "",
      }));
      setFiles((prev) => (mode === "merged" ? result : [...prev, ...result]));
      imported.forEach((f) =>
        d.log(
          `已载入 ${f.name} · ${formatBytes(f.data.length)} · SHA-256 ${f.sha256}`,
          "success",
        ),
      );
    } catch (err) {
      d.fail(err);
    } finally {
      lock.current = false;
      setImporting(false);
    }
  }
  function prepare() {
    try {
      if (!device) throw new Error("请先连接 AI Passport");
      validateFirmware(files, device.size);
      setReview(true);
      setConfirmed(false);
      d.setError("");
    } catch (err) {
      d.fail(err);
    }
  }
  function changeMode(next: typeof mode) {
    if (mode !== next) {
      setMode(next);
      setFiles([]);
      d.setCompleted(false);
    }
  }
  const step = device ? (files.length ? 2 : 1) : 0;
  return (
    <div className="studio-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="FoloToy 首页">
          <span className="brand-mark">
            <Sparkles size={21} />
          </span>
          folo<span className="brand-light">toy</span>
          <span className="brand-dot">®</span>
        </a>
        <div className="workspace-label">
          DEVICE STUDIO <span>LOCAL</span>
        </div>
        <nav aria-label="主导航">
          <button
            aria-label="固件刷写"
            className={"nav-item " + (view === "flash" ? "active" : "")}
            onClick={() => setView("flash")}
          >
            <Zap size={18} />
            固件刷写
            <span className="nav-dot" />
          </button>
          <button
            aria-label="设备备份"
            className={"nav-item " + (view === "backup" ? "active" : "")}
            onClick={() => setView("backup")}
          >
            <HardDrive size={18} />
            设备备份
          </button>
          <button
            aria-label="运行日志"
            className={"nav-item " + (view === "logs" ? "active" : "")}
            onClick={() => setView("logs")}
          >
            <Terminal size={18} />
            运行日志{logs.length > 0 && <small>{logs.length}</small>}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={20} />
            <strong>你的设备，你来掌控</strong>
            <p>
              固件与备份留在本地
              <br />
              通过 USB 直接连接设备
            </p>
          </div>
          <a className="nav-item" href={docs} target="_blank" rel="noreferrer">
            <BookOpen size={17} />
            开发文档
            <ChevronRight size={14} />
          </a>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            连接帮助
          </button>
          <div className="sidebar-version">
            <span className="live-dot" />
            工作台 v1.0.0
            <Command size={13} />
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            设备工作台 <ChevronRight size={13} />
            <strong>AI Passport</strong>
          </div>
          <div className="topbar-right">
            <span className="browser-label">
              <span className={supported ? "live-dot" : "live-dot offline"} />
              {supported ? "Web Serial 可用" : "浏览器不支持"}
            </span>
            <a
              href="https://github.com/jik92/folotoy-ai-passport-tool"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub 仓库"
            >
              <Code2 size={19} />
            </a>
            <span className="avatar">F</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">FOLOTOY / AI PASSPORT</div>
              <h1>
                {view === "flash"
                  ? "给你的工牌，焕新一下。"
                  : view === "backup"
                    ? "留一份设备的完整记忆。"
                    : "每一步，都有迹可循。"}
              </h1>
              <p>
                {view === "flash"
                  ? "连接、选择固件、开始刷写。一切都在浏览器里完成。"
                  : view === "backup"
                    ? "通过 USB 读取完整 Flash，保存为电脑上的 .bin 文件。"
                    : "查看芯片识别、固件校验与刷写过程，随时导出。"}
              </p>
            </div>
            <Button
              icon={<CircleHelp size={15} />}
              onClick={() => setHelp(true)}
            >
              使用指南
            </Button>
          </div>
          {!supported && (
            <Alert
              type="warning"
              showIcon
              title="请使用桌面 Chrome 或 Edge 打开 localhost 或 HTTPS 页面，以连接 USB 串口。"
              className="mb-5"
            />
          )}
          {error && (
            <Alert
              type="error"
              showIcon
              closable
              onClose={() => d.setError("")}
              title={error}
              className="mb-5"
            />
          )}
          {view !== "logs" && (
            <>
              <section className="device-hero">
                <div className="hero-copy">
                  <div className="hero-pill">
                    <span className="hero-pill-dot" />
                    你的随身 AI 伙伴
                  </div>
                  <h2>
                    AI Passport<span>小小工牌，新的可能。</span>
                  </h2>
                  <p>
                    为 FoloToy AI Passport 准备的固件工作台。
                    <br />
                    让每一次更新，都简单一点。
                  </p>
                  <div className="hardware-chips">
                    <span>
                      <Cpu size={14} />
                      ESP32-C3
                    </span>
                    <span>
                      <Layers size={14} />8 MB Flash
                    </span>
                    <span>
                      <Usb size={14} />
                      USB 直连
                    </span>
                  </div>
                </div>
                <div
                  className="passport-scene"
                  aria-label="AI Passport 工牌示意图"
                >
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="passport-lanyard" />
                  <div className="passport">
                    <div className="passport-slot" />
                    <div className="passport-screen">
                      <div className="screen-star">✳</div>
                      <div className="screen-eyes">
                        <i />
                        <i />
                      </div>
                      <div className="screen-smile" />
                      <span>Hello, human.</span>
                      <small>LET’S MAKE SOMETHING.</small>
                    </div>
                    <div className="passport-brand">
                      folo<span>toy</span>
                      <span className="speaker">••••••</span>
                    </div>
                  </div>
                  <span className="scene-caption">AI PASSPORT / 001</span>
                  <span className="scene-spark">✳</span>
                </div>
              </section>
              <div className="work-grid">
                <div className="flow-column">
                  <section className="panel connection-panel">
                    <div className="panel-heading">
                      <div className="section-title">
                        <span
                          className={"step-number " + (device ? "done" : "")}
                        >
                          {device ? <Check size={16} /> : "01"}
                        </span>
                        <h3>连接你的设备</h3>
                      </div>
                      <span
                        className={"status-tag " + (device ? "connected" : "")}
                      >
                        <span />
                        {busy === "connect"
                          ? "连接中"
                          : device
                            ? "已连接"
                            : "等待连接"}
                      </span>
                    </div>
                    <div className="connection-body">
                      <div className="usb-box">
                        <Cable size={27} />
                      </div>
                      <div className="connection-text">
                        <strong>
                          {device
                            ? device.chip
                            : "用 USB 数据线连接 AI Passport"}
                        </strong>
                        <p>
                          {device
                            ? `USB ${device.usb} · ${formatBytes(device.size)} Flash`
                            : "连接后，在浏览器弹窗中选择对应的串口设备。"}
                        </p>
                      </div>
                      <Button
                        type={device ? "default" : "primary"}
                        icon={
                          device ? <Unplug size={15} /> : <Plug size={15} />
                        }
                        loading={busy === "connect"}
                        disabled={
                          !supported || (Boolean(busy) && busy !== "connect")
                        }
                        onClick={() =>
                          void (device ? d.disconnect() : d.connect())
                        }
                      >
                        {device ? "断开连接" : "连接设备"}
                      </Button>
                    </div>
                    <div className="connection-foot">
                      <span>
                        <ShieldCheck size={13} />
                        浏览器授权后才能访问设备
                      </span>
                      <button
                        onClick={() => void d.scan()}
                        disabled={Boolean(busy)}
                      >
                        <RefreshCw size={12} />
                        刷新授权设备{d.ports > 0 && ` (${d.ports})`}
                      </button>
                    </div>
                  </section>
                  {view === "flash" ? (
                    <section className="panel firmware-panel">
                      <div className="panel-heading">
                        <div className="section-title">
                          <span className="step-number">02</span>
                          <h3>选择固件</h3>
                        </div>
                        <span className="subtle-text">文件仅在本地处理</span>
                      </div>
                      <div className="firmware-inner">
                        <div
                          className="mode-tabs"
                          role="group"
                          aria-label="固件类型"
                        >
                          <button
                            disabled={Boolean(busy) || importing}
                            className={mode === "merged" ? "selected" : ""}
                            onClick={() => changeMode("merged")}
                          >
                            <FileCode2 size={15} />
                            整包固件<span>推荐</span>
                          </button>
                          <button
                            disabled={Boolean(busy) || importing}
                            className={mode === "segments" ? "selected" : ""}
                            onClick={() => changeMode("segments")}
                          >
                            <Layers size={15} />
                            分段固件
                          </button>
                        </div>
                        <Upload.Dragger
                          accept=".bin"
                          multiple={mode === "segments"}
                          disabled={Boolean(busy) || importing}
                          showUploadList={false}
                          beforeUpload={(file, list) => {
                            if (file === list[0]) void addFiles(list as File[]);
                            return false;
                          }}
                        >
                          <div className="upload-icon">
                            {importing ? (
                              <LoaderCircle size={25} className="spin" />
                            ) : (
                              <UploadCloud size={26} />
                            )}
                          </div>
                          <strong>
                            {importing
                              ? "正在计算 SHA-256…"
                              : "点击选择，或将固件拖到这里"}
                          </strong>
                          <p>
                            {mode === "merged"
                              ? "支持合并后的 .bin 文件，起始地址 0x0"
                              : "选择 .bin 文件，并按 flash_args 填写地址"}
                            <span>最大 8 MB / 文件</span>
                          </p>
                        </Upload.Dragger>
                        {files.map((file) => (
                          <div className="firmware-row" key={file.id}>
                            <FileCode2 size={20} />
                            <div className="firmware-name">
                              <strong title={file.name}>{file.name}</strong>
                              <Tooltip title={`SHA-256: ${file.sha256}`}>
                                <small>
                                  <Fingerprint size={11} />
                                  {file.sha256.slice(0, 12)}… ·{" "}
                                  {formatBytes(file.data.length)}
                                </small>
                              </Tooltip>
                            </div>
                            <Input
                              aria-label={`${file.name} 刷写地址`}
                              placeholder="0x10000"
                              value={file.address}
                              disabled={Boolean(busy) || mode === "merged"}
                              onChange={(e) => {
                                setFiles((prev) =>
                                  prev.map((f) =>
                                    f.id === file.id
                                      ? { ...f, address: e.target.value }
                                      : f,
                                  ),
                                );
                                d.setCompleted(false);
                              }}
                              className="address-input"
                            />
                            <Button
                              type="text"
                              aria-label={`移除 ${file.name}`}
                              icon={<Trash2 size={15} />}
                              disabled={Boolean(busy)}
                              onClick={() => {
                                setFiles((prev) =>
                                  prev.filter((f) => f.id !== file.id),
                                );
                                d.setCompleted(false);
                              }}
                            />
                          </div>
                        ))}
                        <div className="firmware-hint">
                          <CircleHelp size={14} />
                          <span>
                            {mode === "merged"
                              ? "使用 AI Passport 专用合并固件，整包可能覆盖原有配置。"
                              : "地址以该版本 flash_args 为准，分段刷写有助于保留配置。"}
                          </span>
                          <a
                            href={`${docs}/releases`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            查找固件
                            <ArrowRight size={12} />
                          </a>
                        </div>
                        <div className="flash-options">
                          <div>
                            <span>连接波特率</span>
                            <Select
                              aria-label="连接波特率"
                              value={baud}
                              disabled={Boolean(busy) || Boolean(device)}
                              onChange={d.setBaud}
                              options={[115200, 230400, 460800, 921600].map(
                                (value) => ({
                                  value,
                                  label: value.toLocaleString("en-US"),
                                }),
                              )}
                            />
                          </div>
                          <div>
                            <span>
                              全片擦除
                              <Tooltip title="开启后清除全部固件、身份信息与 Wi-Fi 配置。默认只擦除所写入的扇区。">
                                <CircleHelp size={13} />
                              </Tooltip>
                            </span>
                            <Switch
                              aria-label="全片擦除"
                              checked={erase}
                              disabled={Boolean(busy)}
                              onChange={setErase}
                            />
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <section className="panel backup-panel">
                      <div className="panel-heading">
                        <div className="section-title">
                          <span className="step-number">02</span>
                          <h3>完整 Flash 备份</h3>
                        </div>
                        <HardDrive size={18} />
                      </div>
                      <div className="backup-inner">
                        <HardDrive size={38} />
                        <h3>更新之前，存一份安心。</h3>
                        <p>
                          读取完整固件与配置，保存为 .bin 文件。
                          <br />
                          备份可能包含 Wi-Fi 密码和设备身份，请妥善保存。
                        </p>
                        <Button
                          type="primary"
                          size="large"
                          icon={<ArrowDownToLine size={16} />}
                          disabled={!device || Boolean(busy)}
                          loading={busy === "backup"}
                          onClick={() => void d.backup()}
                        >
                          备份并下载
                          {device ? ` ${formatBytes(device.size)}` : ""}
                        </Button>
                      </div>
                    </section>
                  )}
                </div>
                <aside className="right-column">
                  <section className="panel checklist-panel">
                    <div className="section-title">
                      <ShieldCheck size={19} />
                      <h3>
                        {view === "flash"
                          ? "刷写前，确认一下"
                          : "备份前，确认一下"}
                      </h3>
                    </div>
                    {[
                      ["一根能传数据的 USB 线", "仅充电的数据线无法识别设备"],
                      ["使用 Chrome 或 Edge", "在电脑上打开，支持 Web Serial"],
                      ["保持连接，等待完成", "刷写时请勿拔线或关闭页面"],
                      ["先备份，再更新", "完整保留一份当前固件与配置"],
                    ].map(([title, text]) => (
                      <div className="checklist-item" key={title}>
                        <span>
                          <Check size={13} />
                        </span>
                        <div>
                          <strong>{title}</strong>
                          <p>{text}</p>
                        </div>
                      </div>
                    ))}
                    <button className="text-link" onClick={() => setHelp(true)}>
                      设备没有出现在列表中？
                      <ArrowRight size={13} />
                    </button>
                  </section>
                  <section className="tip-card">
                    <div>
                      <Sparkles size={18} />
                      <strong>连接小贴士</strong>
                    </div>
                    <p>
                      如果连接失败，先关闭其他串口工具，再重新连接。仍无法识别时，可尝试按住
                      BOOT 后重新插入 USB。
                    </p>
                    <span>每个设备，都值得一次新开始。</span>
                  </section>
                  <div className="privacy-line">
                    <ShieldCheck size={16} />
                    <p>
                      无需安装刷机客户端
                      <br />
                      <span>本地处理 · USB 直连 · 开源</span>
                    </p>
                  </div>
                </aside>
              </div>
              {view === "flash" && (
                <section className="flash-bar">
                  <div className="flash-state-icon">
                    {completed ? <CheckCheck size={23} /> : <Zap size={23} />}
                  </div>
                  <div className="flash-bar-copy">
                    <strong>
                      {completed
                        ? "刷写完成，准备好再次出发。"
                        : busy === "flash"
                          ? "正在写入固件，请保持 USB 连接…"
                          : "准备好了，就开始吧。"}
                    </strong>
                    <p>
                      {completed
                        ? "MD5 校验通过，重启结果见运行日志。"
                        : device
                          ? files.length
                            ? `${files.length} 个文件 · ${formatBytes(total)} · 写入后自动校验`
                            : "设备已连接，下一步导入固件。"
                          : "连接设备并导入固件后，即可开始刷写。"}
                    </p>
                  </div>
                  <Button
                    type="primary"
                    size="large"
                    icon={<Zap size={16} />}
                    disabled={
                      !device || !files.length || Boolean(busy) || importing
                    }
                    loading={busy === "flash"}
                    onClick={prepare}
                  >
                    开始刷写
                    <ArrowRight size={15} />
                  </Button>
                </section>
              )}
              {(busy === "flash" || busy === "backup" || progress > 0) && (
                <Progress
                  percent={progress}
                  status={error ? "exception" : busy ? "active" : "normal"}
                  strokeColor="#7962dc"
                />
              )}
              <div className="workflow-steps">
                {[
                  "连接设备",
                  view === "backup" ? "读取 Flash" : "导入固件",
                  view === "backup" ? "保存备份" : "写入并校验",
                ].map((label, index) => (
                  <div key={label} className={index <= step ? "current" : ""}>
                    <span>
                      {index < step ? <Check size={11} /> : index + 1}
                    </span>
                    {label}
                    {index < 2 && <i />}
                  </div>
                ))}
              </div>
            </>
          )}
          <section
            className={
              "panel terminal-panel " +
              (view === "logs" ? "terminal-expanded" : "")
            }
          >
            <div className="terminal-header">
              <div>
                <Terminal size={16} />
                <strong>运行日志</strong>
                <span className="terminal-live">
                  <i />
                  LIVE
                </span>
              </div>
              <div>
                <button
                  aria-label="导出日志"
                  onClick={() =>
                    saveFile(
                      logs
                        .map((row) => `[${row.time}] [${row.type}] ${row.text}`)
                        .join("\n"),
                      "ai-passport-log.txt",
                    )
                  }
                  disabled={!logs.length}
                >
                  <ArrowDownToLine size={14} />
                  导出
                </button>
                <button
                  aria-label="清空日志"
                  disabled={Boolean(busy)}
                  onClick={() => d.setLogs([])}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div
              className="terminal-body"
              ref={terminalRef}
              role="log"
              aria-label="设备操作日志"
            >
              {logs.length ? (
                logs.map((row, index) => (
                  <div className={"log-line " + row.type} key={index}>
                    <time>{row.time}</time>
                    <span>
                      {row.type === "success"
                        ? "✓"
                        : row.type === "error"
                          ? "!"
                          : "›"}
                    </span>
                    <pre>{row.text}</pre>
                  </div>
                ))
              ) : (
                <div className="log-empty">
                  <span>›</span> 工作台已就绪，等待操作
                  <span className="terminal-cursor" />
                </div>
              )}
            </div>
            <div className="terminal-footer">
              <span>
                <span className={"live-dot " + (!device ? "offline" : "")} />
                {device ? "串口已连接" : "串口未连接"}
              </span>
              <span>ESPTOOL-JS · {baud.toLocaleString("en-US")} BAUD</span>
            </div>
          </section>
          <footer>
            <span>为 AI Passport 的每一次新可能。</span>
            <span>
              Built with <span className="footer-heart">♡</span> & Web Serial{" "}
              <span className="footer-divider">/</span> FoloToy 社区工具
            </span>
          </footer>
        </main>
      </div>
      <Modal
        title="确认刷写 AI Passport"
        open={review}
        onCancel={() => setReview(false)}
        okText="确认并写入设备"
        cancelText="返回检查"
        onOk={() => {
          if (confirmed) {
            setReview(false);
            void d.flash(files, erase);
          }
        }}
        okButtonProps={{ disabled: !confirmed }}
      >
        <p className="modal-copy">
          将向 <strong>{device?.chip}</strong> 写入以下文件：
        </p>
        <div className="review-files">
          {files.map((f) => (
            <div key={f.id}>
              <span>{f.name}</span>
              <code>{f.address}</code>
              <small>{formatBytes(f.data.length)}</small>
            </div>
          ))}
        </div>
        <Alert
          showIcon
          type="warning"
          title={
            erase
              ? "已开启全片擦除：所有固件、Wi-Fi 配置和设备身份都将被清除。"
              : mode === "merged"
                ? "整包会覆盖所占 Flash 区域，可能清除 Wi-Fi 配置和设备身份。建议先完整备份。"
                : "将擦写指定文件占用的扇区。确认地址与该版本 flash_args 一致。"
          }
        />
        <Checkbox
          className="confirm-checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        >
          我已确认固件适用于 AI Passport，并了解覆盖范围。
        </Checkbox>
      </Modal>
      <Modal
        title="连接与刷写指南"
        open={help}
        onCancel={() => setHelp(false)}
        footer={
          <Button type="primary" onClick={() => setHelp(false)}>
            知道了
          </Button>
        }
      >
        <ol className="help-list">
          <li>
            <strong>连接 USB 数据线</strong>
            <p>使用支持数据传输的 USB 线直连电脑，确认设备有电。</p>
          </li>
          <li>
            <strong>授权浏览器串口</strong>
            <p>
              点击「连接设备」，在 Chrome / Edge 的设备选择窗口中选择 USB
              串口。首次授权需要你操作。
            </p>
          </li>
          <li>
            <strong>设备没有出现？</strong>
            <p>
              尝试换线或换 USB 接口，关闭其他占用串口的程序。若设备有 BOOT
              按键，可按住 BOOT 后重新插入 USB，再松开。
            </p>
          </li>
          <li>
            <strong>选择 AI Passport 固件</strong>
            <p>
              整包使用 0x0；分段包按对应版本 flash_args
              填写地址。刷写前建议先进入「设备备份」。
            </p>
          </li>
        </ol>
        <a href={docs} target="_blank" rel="noreferrer" className="text-link">
          查看官方硬件与固件说明
          <ArrowRight size={13} />
        </a>
      </Modal>
    </div>
  );
}
export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#7760db",
          borderRadius: 8,
          fontFamily: '"DM Sans", "PingFang SC", "Microsoft YaHei", sans-serif',
          colorText: "#292735",
          colorBorder: "#e5e3ec",
          controlHeight: 36,
        },
        components: {
          Button: { primaryShadow: "0 3px 7px rgba(110,82,202,.15)" },
        },
      }}
    >
      <AntApp>
        <Studio />
      </AntApp>
    </ConfigProvider>
  );
}
