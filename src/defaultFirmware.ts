import { importFirmware, validateFirmware } from "./firmware";
export const DEFAULT_FIRMWARE = {
  version: "v2.5.0-folo.1",
  name: "folo-ai-passport-xiaozhi-v2.5.0.bin",
  size: 7616468,
  sha256: "b51eb892c702debef613b9705e617db155aeeb7ea0e20331d44c55d2c4e21518",
  url: `${import.meta.env?.BASE_URL ?? "/"}firmware/folo-ai-passport-xiaozhi-v2.5.0.bin`,
  release:
    "https://github.com/FoloToy/folo-ai-passport-xiaozhi/releases/tag/v2.5.0-folo.1",
} as const;
export async function loadDefaultFirmware(signal?: AbortSignal) {
  const response = await fetch(DEFAULT_FIRMWARE.url, { signal });
  if (!response.ok)
    throw new Error(
      `默认固件加载失败（HTTP ${response.status}），请重试或导入本地固件`,
    );
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== DEFAULT_FIRMWARE.size)
    throw new Error("默认固件大小不符，请重新获取官方文件");
  const firmware = await importFirmware(
    new File([bytes], DEFAULT_FIRMWARE.name),
  );
  if (firmware.sha256 !== DEFAULT_FIRMWARE.sha256)
    throw new Error("默认固件 SHA-256 不匹配，已阻止使用");
  firmware.address = "0x0";
  validateFirmware([firmware]);
  return firmware;
}
