export type Firmware = {
  id: string;
  name: string;
  data: Uint8Array;
  address: string;
  sha256: string;
};
export const FLASH_SIZE = 8 * 1024 * 1024;
export function parseAddress(value: string): number {
  if (!/^(0x[0-9a-f]+|\d+)$/i.test(value.trim()))
    throw new Error("请输入有效地址，例如 0x0 或 0x10000");
  const address = Number(value);
  if (!Number.isSafeInteger(address) || address < 0 || address % 4096 !== 0)
    throw new Error("刷写地址必须按 4 KB 对齐");
  return address;
}
export function validateFirmware(files: Firmware[], flashSize = FLASH_SIZE) {
  if (!files.length) throw new Error("请先导入 .bin 固件");
  const segments = files
    .map((file) => ({ ...file, start: parseAddress(file.address) }))
    .sort((a, b) => a.start - b.start);
  for (let i = 0; i < segments.length; i++) {
    const file = segments[i];
    if (!file.data.length) throw new Error(`${file.name} 是空文件`);
    if (file.start + file.data.length > flashSize)
      throw new Error(`${file.name} 超出 Flash 容量`);
    if (file.data[0] === 0xe9 && file.data.length >= 24) {
      const chip = file.data[12] | (file.data[13] << 8);
      if (chip !== 5)
        throw new Error(`${file.name} 目标不是 ESP32-C3（chip ID ${chip}）`);
    }
    if (
      i &&
      file.start <
        Math.ceil(
          (segments[i - 1].start + segments[i - 1].data.length) / 4096,
        ) *
          4096
    )
      throw new Error(`${file.name} 与前一文件的擦写区域重叠`);
  }
  return segments.map((file) => ({ data: file.data, address: file.start }));
}
export function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
}
export async function importFirmware(file: File): Promise<Firmware> {
  if (!file.name.toLowerCase().endsWith(".bin"))
    throw new Error("仅支持 .bin 文件；请先解压 ZIP 固件包");
  if (!file.size || file.size > FLASH_SIZE)
    throw new Error("固件大小应在 1 byte 到 8 MB 之间");
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return {
    id: crypto.randomUUID(),
    name: file.name,
    data: new Uint8Array(buffer),
    address: "",
    sha256: Array.from(new Uint8Array(hash), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
