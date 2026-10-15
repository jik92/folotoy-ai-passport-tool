import { useEffect, useRef, useState } from "react";
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  Card,
  Checkbox,
  Collapse,
  ConfigProvider,
  Descriptions,
  Flex,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Progress,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  theme,
} from "antd";
import zhCN from "antd/locale/zh_CN";
import {
  ApiOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  DownloadOutlined,
  FileOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { formatBytes, importFirmware, validateFirmware } from "./firmware";
import type { Firmware } from "./firmware";
import { DEFAULT_FIRMWARE, loadDefaultFirmware } from "./defaultFirmware";
import { saveFile, useDevice } from "./useDevice";
import "./App.css";
const { Header, Sider, Content } = Layout;
const { Text, Title, Link } = Typography;
function Studio() {
  const d = useDevice();
  const { device, busy, logs, error, completed, progress, supported } = d;
  const [files, setFiles] = useState<Firmware[]>([]);
  const [source, setSource] = useState<"default" | "local">("default");
  const [mode, setMode] = useState<"merged" | "segments">("merged");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [erase, setErase] = useState(false);
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [help, setHelp] = useState(false);
  const importLock = useRef(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const log = d.log;
  useEffect(() => {
    if (source !== "default") return;
    const controller = new AbortController();
    void loadDefaultFirmware(controller.signal)
      .then((firmware) => {
        if (controller.signal.aborted) return;
        setFiles([firmware]);
        setLoading(false);
        log(
          `默认固件已就绪：${DEFAULT_FIRMWARE.version} · SHA-256 校验通过`,
          "success",
        );
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setLoading(false);
        const text = err instanceof Error ? err.message : String(err);
        d.setError(text);
        log(text, "error");
      });
    return () => controller.abort();
    // setError is a stable React state setter; log is memoized by useDevice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, retry, log]);
  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight });
  }, [logs]);
  const disabled = Boolean(busy) || loading;
  function changeSource(next: typeof source) {
    setSource(next);
    setFiles([]);
    setLoading(next === "default");
    d.setError("");
    d.setCompleted(false);
  }
  async function addFiles(selected: File[]) {
    if (busy || importLock.current) return;
    importLock.current = true;
    setLoading(true);
    d.setError("");
    d.setCompleted(false);
    try {
      const imported = await Promise.all(selected.map(importFirmware));
      if (mode === "merged" && imported.length !== 1)
        throw new Error("整包模式只允许一个合并固件");
      const next = imported.map((file) => ({
        ...file,
        address: mode === "merged" ? "0x0" : "",
      }));
      setFiles((prev) => (mode === "merged" ? next : [...prev, ...next]));
      imported.forEach((file) =>
        log(
          `已导入 ${file.name} · ${formatBytes(file.data.length)} · SHA-256 ${file.sha256}`,
          "success",
        ),
      );
    } catch (err) {
      d.fail(err);
    } finally {
      setLoading(false);
      importLock.current = false;
    }
  }
  function prepare() {
    try {
      if (!device) throw new Error("请先连接设备");
      validateFirmware(files, device.size);
      d.setError("");
      setConfirmed(false);
      setReview(true);
    } catch (err) {
      d.fail(err);
    }
  }
  const columns = [
    {
      title: "固件文件",
      key: "file",
      render: (_: unknown, file: Firmware) => (
        <Space align="start">
          <FileOutlined className="file-icon" />
          <div className="file-info">
            <Text ellipsis={{ tooltip: file.name }}>{file.name}</Text>
            <Tooltip title={`SHA-256: ${file.sha256}`}>
              <Text type="secondary" className="hash">
                SHA-256 {file.sha256.slice(0, 16)}…
              </Text>
            </Tooltip>
          </div>
        </Space>
      ),
    },
    {
      title: "大小",
      width: 90,
      key: "size",
      render: (_: unknown, file: Firmware) => (
        <Text className="mono">{formatBytes(file.data.length)}</Text>
      ),
    },
    {
      title: "写入地址",
      width: 116,
      key: "address",
      render: (_: unknown, file: Firmware) =>
        source === "default" || mode === "merged" ? (
          <Text code>0x0</Text>
        ) : (
          <Input
            size="small"
            aria-label={`${file.name} 写入地址`}
            placeholder="0x10000"
            value={file.address}
            disabled={disabled}
            onChange={(e) => {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === file.id ? { ...f, address: e.target.value } : f,
                ),
              );
              d.setCompleted(false);
            }}
          />
        ),
    },
    ...(source === "local"
      ? [
          {
            title: "",
            width: 36,
            key: "remove",
            render: (_: unknown, file: Firmware) => (
              <Button
                aria-label={`移除 ${file.name}`}
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                disabled={disabled}
                onClick={() => {
                  setFiles((prev) => prev.filter((f) => f.id !== file.id));
                  d.setCompleted(false);
                }}
              />
            ),
          },
        ]
      : []),
  ];
  return (
    <Layout className="app-layout">
      <Sider
        width={168}
        theme="light"
        breakpoint="lg"
        collapsedWidth={56}
        className="app-sider"
      >
        <div className="brand">
          <ThunderboltOutlined />
          <span>
            FoloToy <Text type="secondary">Tool</Text>
          </span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={["flash"]}
          items={[
            { key: "flash", icon: <ThunderboltOutlined />, label: "固件刷写" },
          ]}
        />
        <div className="sider-caption">AI Passport · v1.0</div>
      </Sider>
      <Layout>
        <Header className="app-header">
          <Space size={8}>
            <Text type="secondary">设备工具</Text>
            <Text type="secondary">/</Text>
            <Text>固件刷写</Text>
          </Space>
          <Space size={18}>
            <Badge
              status={supported ? "success" : "warning"}
              text={supported ? "Web Serial 可用" : "不支持串口"}
            />
            <Button
              type="text"
              icon={<QuestionCircleOutlined />}
              onClick={() => setHelp(true)}
            >
              帮助
            </Button>
            <a
              href="https://github.com/jik92/folotoy-ai-passport-tool"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub 仓库"
            >
              <CodeOutlined />
            </a>
          </Space>
        </Header>
        <Content className="app-content">
          <Flex justify="space-between" align="center" className="page-title">
            <div>
              <Title level={4}>固件刷写</Title>
              <Text type="secondary">
                FoloToy AI Passport · ESP32-C3 · 8 MB Flash
              </Text>
            </div>
            <Tag color="blue">USB 串口</Tag>
          </Flex>
          {!supported && (
            <Alert
              type="warning"
              showIcon
              title="请使用桌面 Chrome / Edge，通过 localhost 或 HTTPS 打开本页。"
            />
          )}
          {error && (
            <Alert
              type="error"
              showIcon
              title={error}
              closable
              onClose={() => d.setError("")}
            />
          )}
          <Card
            size="small"
            title="设备连接"
            extra={
              <Badge
                status={
                  device
                    ? "success"
                    : busy === "connect"
                      ? "processing"
                      : "default"
                }
                text={
                  device ? "已连接" : busy === "connect" ? "连接中" : "未连接"
                }
              />
            }
          >
            <Flex gap={16} align="center" wrap className="connection-row">
              <div className="device-icon">
                <ApiOutlined />
              </div>
              <div className="device-description">
                <Text strong>{device?.chip ?? "AI Passport"}</Text>
                <Text type="secondary">
                  {device
                    ? `USB ${device.usb} · ${formatBytes(device.size)} Flash`
                    : "用 USB 数据线连接，点击连接设备并选择串口。"}
                </Text>
              </div>
              <Space wrap>
                <Select
                  aria-label="连接波特率"
                  size="small"
                  value={d.baud}
                  disabled={Boolean(busy) || Boolean(device)}
                  onChange={d.setBaud}
                  options={[115200, 230400, 460800, 921600].map((value) => ({
                    value,
                    label: `${value.toLocaleString("en-US")} baud`,
                  }))}
                />
                <Tooltip title="刷新此站点已授权的串口">
                  <Button
                    aria-label="刷新授权串口"
                    icon={<ReloadOutlined />}
                    disabled={!supported || Boolean(busy)}
                    onClick={() => void d.scan()}
                  />
                </Tooltip>
                <Button
                  type={device ? "default" : "primary"}
                  icon={device ? <DisconnectOutlined /> : <ApiOutlined />}
                  loading={busy === "connect"}
                  disabled={!supported || (Boolean(busy) && busy !== "connect")}
                  onClick={() => void (device ? d.disconnect() : d.connect())}
                >
                  {device ? "断开连接" : "连接设备"}
                </Button>
              </Space>
            </Flex>
          </Card>
          <Card
            size="small"
            title="固件"
            extra={
              <Radio.Group
                size="small"
                optionType="button"
                buttonStyle="solid"
                value={source}
                disabled={disabled}
                onChange={(e) => changeSource(e.target.value)}
                options={[
                  { label: "默认固件", value: "default" },
                  { label: "本地固件", value: "local" },
                ]}
              />
            }
          >
            {source === "default" ? (
              <Flex
                align="center"
                justify="space-between"
                gap={12}
                wrap
                className="firmware-summary"
              >
                <Space wrap>
                  <Text strong>小智 AI · AI Passport</Text>
                  <Tag color="blue">{DEFAULT_FIRMWARE.version}</Tag>
                  <Tag
                    icon={files.length ? <CheckCircleOutlined /> : undefined}
                    color={files.length ? "success" : "default"}
                  >
                    {loading
                      ? "加载并校验中"
                      : files.length
                        ? "SHA-256 已校验"
                        : "未载入"}
                  </Tag>
                </Space>
                <Space>
                  <Link href={DEFAULT_FIRMWARE.release} target="_blank">
                    发布说明
                  </Link>
                  <Button
                    type="text"
                    size="small"
                    icon={<DownloadOutlined />}
                    href={DEFAULT_FIRMWARE.url}
                    download={DEFAULT_FIRMWARE.name}
                  >
                    下载
                  </Button>
                  {!loading && !files.length && (
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={() => {
                        setLoading(true);
                        d.setError("");
                        setRetry((n) => n + 1);
                      }}
                    >
                      重试
                    </Button>
                  )}
                </Space>
              </Flex>
            ) : (
              <Flex
                align="center"
                justify="space-between"
                gap={12}
                wrap
                className="firmware-summary"
              >
                <Radio.Group
                  size="small"
                  value={mode}
                  disabled={disabled}
                  onChange={(e) => {
                    setMode(e.target.value);
                    setFiles([]);
                    d.setCompleted(false);
                  }}
                  options={[
                    { label: "合并镜像 · 0x0", value: "merged" },
                    { label: "分段镜像", value: "segments" },
                  ]}
                />
                <Upload
                  accept=".bin"
                  multiple={mode === "segments"}
                  showUploadList={false}
                  disabled={disabled}
                  beforeUpload={(file, list) => {
                    if (file === list[0]) void addFiles(list as File[]);
                    return false;
                  }}
                >
                  <Button
                    size="small"
                    icon={<UploadOutlined />}
                    loading={loading}
                    disabled={disabled}
                  >
                    导入 .bin
                  </Button>
                </Upload>
              </Flex>
            )}
            <Table
              size="small"
              columns={columns}
              dataSource={files}
              rowKey="id"
              pagination={false}
              loading={loading}
              scroll={{ x: 540 }}
              locale={{
                emptyText:
                  source === "default"
                    ? "默认固件暂未载入"
                    : "请选择 AI Passport 专用 .bin 固件",
              }}
            />
            <Alert
              className="firmware-notice"
              type="warning"
              showIcon
              title={
                source === "default" || mode === "merged"
                  ? "合并固件写入 0x0，可能覆盖 Wi-Fi、NVS 和设备身份。建议先备份。"
                  : "请按对应版本 flash_args 填写地址，写入前会检查区域重叠与容量。"
              }
            />
            <Collapse
              size="small"
              ghost
              items={[
                {
                  key: "advanced",
                  label: "高级选项",
                  children: (
                    <Flex gap={24} align="center" wrap>
                      <Form layout="inline" size="small">
                        <Form.Item label="全片擦除">
                          <Switch
                            size="small"
                            aria-label="全片擦除"
                            checked={erase}
                            disabled={disabled}
                            onChange={setErase}
                          />
                        </Form.Item>
                      </Form>
                      <Tooltip title="读取完整 Flash；备份可能含 Wi-Fi 密码和身份信息，请妥善保存。">
                        <Button
                          size="small"
                          icon={<DownloadOutlined />}
                          disabled={!device || Boolean(busy)}
                          loading={busy === "backup"}
                          onClick={() => void d.backup()}
                        >
                          备份当前设备
                        </Button>
                      </Tooltip>
                      <Text type="secondary">
                        {erase
                          ? "将清除全部固件、身份与配置"
                          : "仅擦除写入文件占用的扇区"}
                      </Text>
                    </Flex>
                  ),
                },
              ]}
            />
            <div className="flash-actions">
              <Space>
                <Badge
                  status={
                    completed
                      ? "success"
                      : busy === "flash"
                        ? "processing"
                        : "default"
                  }
                />
                <Text>
                  {completed
                    ? "刷写完成，MD5 校验通过"
                    : busy === "flash"
                      ? "正在写入，请保持连接…"
                      : device
                        ? files.length
                          ? "设备与固件已就绪"
                          : "请选择固件"
                        : "等待连接设备"}
                </Text>
                {files.length > 0 && (
                  <Text type="secondary">
                    {formatBytes(files.reduce((s, f) => s + f.data.length, 0))}
                  </Text>
                )}
              </Space>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                disabled={!device || !files.length || disabled}
                loading={busy === "flash"}
                onClick={prepare}
              >
                开始刷写
              </Button>
            </div>
            {(progress > 0 || busy === "flash" || busy === "backup") && (
              <Progress
                size="small"
                percent={progress}
                status={error ? "exception" : busy ? "active" : "normal"}
              />
            )}
          </Card>
          <Card
            size="small"
            title={
              <Space>
                <CodeOutlined />
                运行日志<Tag>{logs.length}</Tag>
              </Space>
            }
            extra={
              <Space size={4}>
                <Button
                  size="small"
                  type="text"
                  icon={<DownloadOutlined />}
                  disabled={!logs.length}
                  onClick={() =>
                    saveFile(
                      logs
                        .map((l) => `[${l.time}] [${l.type}] ${l.text}`)
                        .join("\n"),
                      "ai-passport-log.txt",
                    )
                  }
                >
                  导出
                </Button>
                <Button
                  size="small"
                  type="text"
                  icon={<DeleteOutlined />}
                  disabled={Boolean(busy)}
                  onClick={() => d.setLogs([])}
                >
                  清空
                </Button>
              </Space>
            }
          >
            <div
              className="log-content"
              ref={terminalRef}
              role="log"
              aria-label="设备操作日志"
            >
              {logs.length ? (
                logs.map((row, index) => (
                  <div className={`log-row ${row.type}`} key={index}>
                    <time>{row.time}</time>
                    <span>{row.text}</span>
                  </div>
                ))
              ) : (
                <Text type="secondary">等待操作…</Text>
              )}
            </div>
          </Card>
          <div className="page-footer">
            <Text type="secondary">固件和备份在本地处理 · 社区工具</Text>
            <Link
              href="https://github.com/FoloToy/folo-ai-passport-xiaozhi"
              target="_blank"
            >
              AI Passport 官方项目
            </Link>
          </div>
        </Content>
      </Layout>
      <Modal
        title="确认刷写"
        open={review}
        onCancel={() => setReview(false)}
        okText="确认写入设备"
        cancelText="返回"
        okButtonProps={{ disabled: !confirmed || !device || Boolean(busy) }}
        onOk={() => {
          if (confirmed && device && !busy) {
            setReview(false);
            void d.flash(files, erase);
          }
        }}
      >
        <Descriptions
          size="small"
          column={1}
          items={[
            { key: "chip", label: "设备", children: device?.chip },
            {
              key: "firmware",
              label: "固件",
              children: files.map((f) => (
                <div key={f.id}>
                  {f.name} → <Text code>{f.address}</Text>
                </div>
              )),
            },
            {
              key: "erase",
              label: "全片擦除",
              children: erase ? "开启" : "关闭",
            },
          ]}
        />
        <Alert
          type="warning"
          showIcon
          title={
            erase
              ? "全部固件、配置与设备身份将被清除。"
              : source === "default" || mode === "merged"
                ? "合并镜像可能覆盖 Wi-Fi、NVS 与设备身份，请确认已备份。"
                : "将擦写指定地址的扇区，请确认固件和地址正确。"
          }
        />
        <Checkbox
          className="confirm-checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        >
          确认固件适用于 AI Passport，并了解覆盖范围。
        </Checkbox>
      </Modal>
      <Modal
        title="连接帮助"
        open={help}
        onCancel={() => setHelp(false)}
        footer={
          <Button type="primary" onClick={() => setHelp(false)}>
            知道了
          </Button>
        }
      >
        <Typography.Paragraph>
          使用支持数据传输的 USB 线直连电脑，在桌面 Chrome / Edge
          中点击「连接设备」，亲自选择串口并授权。
        </Typography.Paragraph>
        <Typography.Paragraph>
          未发现设备时，请换线或换 USB 接口，关闭占用串口的程序；设备有 BOOT
          键时，可按住 BOOT 重新插入 USB 后松开。
        </Typography.Paragraph>
        <Typography.Paragraph>
          默认提供 FoloToy 官方小智 AI
          固件。已有设备建议先在「高级选项」中备份；分段固件地址以该版本
          flash_args 为准。
        </Typography.Paragraph>
      </Modal>
    </Layout>
  );
}
export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      componentSize="small"
      theme={{
        algorithm: [theme.defaultAlgorithm, theme.compactAlgorithm],
        token: { colorPrimary: "#1677ff", borderRadius: 6, fontSize: 13 },
        components: {
          Card: { headerHeight: 40 },
          Layout: { headerBg: "#fff", bodyBg: "#f5f6f8", siderBg: "#fff" },
        },
      }}
    >
      <AntApp>
        <Studio />
      </AntApp>
    </ConfigProvider>
  );
}
