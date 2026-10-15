import { useCallback, useEffect, useRef, useState } from "react";
import { ESPLoader, Transport } from "esptool-js";
import CryptoJS from "crypto-js";
import { formatBytes, validateFirmware } from "./firmware";
import type { Firmware } from "./firmware";
export type Log = {
  time: string;
  text: string;
  type: "info" | "success" | "error";
};
export function saveFile(data: BlobPart, name: string) {
  const url = URL.createObjectURL(
    new Blob([data], { type: "application/octet-stream" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function useDevice() {
  const [device, setDevice] = useState<{
    chip: string;
    usb: string;
    size: number;
  } | null>(null);
  const [busy, setBusy] = useState<
    "connect" | "flash" | "backup" | "disconnect" | null
  >(null);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [ports, setPorts] = useState(0);
  const [baud, setBaud] = useState(460800);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const loader = useRef<ESPLoader | null>(null);
  const transport = useRef<Transport | null>(null);
  const operation = useRef(false);
  const supported = "serial" in navigator && window.isSecureContext;
  const log = useCallback((text: string, type: Log["type"] = "info") => {
    // Strip terminal ANSI color escapes before rendering plain text.
    // eslint-disable-next-line no-control-regex
    const clean = text.replace(/\x1b\[[0-9;]*m/g, "").trim();
    if (clean)
      setLogs((prev) => [
        ...prev.slice(-499),
        {
          time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          text: clean,
          type,
        },
      ]);
  }, []);
  const fail = (err: unknown) => {
    const text = err instanceof Error ? err.message : String(err);
    setError(text);
    log(text, "error");
  };
  const scan = useCallback(async () => {
    if (!supported) return;
    try {
      const available = await navigator.serial.getPorts();
      setPorts(available.length);
      log(
        available.length
          ? `发现 ${available.length} 个已授权串口，请点击连接设备。`
          : "未发现已授权串口。点击「连接设备」，在浏览器中选择 USB 设备。",
      );
    } catch (err) {
      log(String(err), "error");
    }
  }, [supported, log]);
  useEffect(() => {
    if (!supported) return;
    const initialScan = setTimeout(() => void scan(), 0);
    const onConnect = () => {
      void scan();
    };
    const onDisconnect = (event: Event) => {
      if (event.target === transport.current?.device) {
        setDevice(null);
        loader.current = null;
        const old = transport.current;
        transport.current = null;
        void old?.disconnect().catch(() => {});
        setError("设备已断开，请重新插入 USB 并连接。");
        log("USB 连接断开", "error");
      }
      void scan();
    };
    navigator.serial.addEventListener("connect", onConnect);
    navigator.serial.addEventListener("disconnect", onDisconnect);
    return () => {
      clearTimeout(initialScan);
      navigator.serial.removeEventListener("connect", onConnect);
      navigator.serial.removeEventListener("disconnect", onDisconnect);
    };
  }, [supported, scan, log]);
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  async function release() {
    const old = transport.current;
    transport.current = null;
    loader.current = null;
    setDevice(null);
    if (old) await old.disconnect();
  }
  async function connect() {
    if (!supported || operation.current) return;
    operation.current = true;
    setBusy("connect");
    setError("");
    setCompleted(false);
    setProgress(0);
    try {
      const port = await navigator.serial.requestPort();
      transport.current = new Transport(port);
      const esp = new ESPLoader({
        transport: transport.current,
        baudrate: baud,
        terminal: {
          clean() {},
          write: (text) => log(text),
          writeLine: (text) => log(text),
        },
      });
      log("正在连接并识别芯片，设备可能会重启…");
      const chip = await esp.main();
      if (!chip.toUpperCase().includes("ESP32-C3"))
        throw new Error(
          `检测到 ${chip}；AI Passport 应为 ESP32-C3，请确认设备。`,
        );
      const flashId = await esp.readFlashId();
      const size = 2 ** ((flashId >>> 16) & 0xff);
      if (
        !Number.isFinite(size) ||
        size < 1024 * 1024 ||
        size > 128 * 1024 * 1024
      )
        throw new Error("无法可靠识别 Flash 容量，请重新连接");
      loader.current = esp;
      const info = port.getInfo();
      const hex = (n?: number) =>
        n === undefined
          ? "未知"
          : n.toString(16).padStart(4, "0").toUpperCase();
      setDevice({
        chip,
        size,
        usb: `${hex(info.usbVendorId)}:${hex(info.usbProductId)}`,
      });
      log(
        `已连接 ${chip} · Flash ${formatBytes(size)} · USB ${transport.current.getInfo()}`,
        "success",
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotFoundError")
        log("已取消选择串口，可以再次点击连接。");
      else fail(err);
      try {
        await release();
      } catch {
        log("串口已关闭");
      }
    } finally {
      operation.current = false;
      setBusy(null);
    }
  }
  async function disconnect() {
    if (operation.current) return;
    operation.current = true;
    setBusy("disconnect");
    try {
      await release();
      log("设备连接已释放");
    } catch (err) {
      fail(err);
    } finally {
      operation.current = false;
      setBusy(null);
    }
  }
  async function flash(files: Firmware[], eraseAll: boolean) {
    if (!loader.current || !device || operation.current) return;
    operation.current = true;
    setBusy("flash");
    setError("");
    setCompleted(false);
    setProgress(0);
    try {
      const fileArray = validateFirmware(files, device.size);
      const total = fileArray.reduce((sum, f) => sum + f.data.length, 0);
      let wake: WakeLockSentinel | undefined;
      try {
        wake = await navigator.wakeLock?.request("screen");
      } catch {
        /* optional */
      }
      try {
        await loader.current.writeFlash({
          fileArray,
          flashSize: "keep",
          flashMode: "keep",
          flashFreq: "keep",
          eraseAll,
          compress: true,
          calculateMD5Hash: (data) =>
            CryptoJS.MD5(CryptoJS.lib.WordArray.create(data)).toString(),
          reportProgress: (index, written, size) => {
            const before = fileArray
              .slice(0, index)
              .reduce((sum, f) => sum + f.data.length, 0);
            setProgress(
              Math.min(
                99,
                Math.floor(
                  ((before + (written / size) * fileArray[index].data.length) /
                    total) *
                    100,
                ),
              ),
            );
          },
        });
      } finally {
        await wake?.release();
      }
      setProgress(100);
      setCompleted(true);
      log("固件写入完成，MD5 校验通过。", "success");
      try {
        await loader.current.after("hard_reset");
        log("设备已重启。");
      } catch {
        log("写入成功；自动重启失败，请手动 RESET 或重新上电。");
      }
      try {
        await release();
      } catch {
        log("设备已完成刷写并断开连接。");
      }
    } catch (err) {
      fail(err);
      try {
        await release();
      } catch {
        /* device gone */
      }
    } finally {
      operation.current = false;
      setBusy(null);
    }
  }
  async function backup() {
    if (!loader.current || !device || operation.current) return;
    operation.current = true;
    setBusy("backup");
    setError("");
    setCompleted(false);
    setProgress(0);
    try {
      let read = 0;
      const data = await loader.current.readFlash(0, device.size, (packet) => {
        read += packet.length;
        setProgress(Math.min(99, Math.floor((read / device.size) * 100)));
      });
      if (data.length !== device.size)
        throw new Error("备份大小与 Flash 容量不符，请重试");
      saveFile(
        new Uint8Array(data).buffer,
        `ai-passport-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.bin`,
      );
      setProgress(100);
      log(`完整 Flash 备份已下载 · ${formatBytes(data.length)}`, "success");
    } catch (err) {
      fail(err);
      try {
        await release();
      } catch {
        /* device gone */
      }
    } finally {
      operation.current = false;
      setBusy(null);
    }
  }
  return {
    device,
    busy,
    error,
    setError,
    logs,
    setLogs,
    ports,
    baud,
    setBaud,
    progress,
    completed,
    setCompleted,
    supported,
    log,
    fail,
    scan,
    connect,
    disconnect,
    flash,
    backup,
  };
}
