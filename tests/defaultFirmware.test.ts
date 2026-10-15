import { expect, test } from "bun:test";
import { DEFAULT_FIRMWARE, loadDefaultFirmware } from "../src/defaultFirmware";
import { importFirmware, validateFirmware } from "../src/firmware";

test("bundled default firmware matches the official release hash and C3 target", async () => {
  const file = Bun.file(
    new URL(`../public/firmware/${DEFAULT_FIRMWARE.name}`, import.meta.url),
  );
  expect(file.size).toBe(DEFAULT_FIRMWARE.size);
  const firmware = await importFirmware(
    new File([await file.arrayBuffer()], DEFAULT_FIRMWARE.name),
  );
  expect(firmware.sha256).toBe(DEFAULT_FIRMWARE.sha256);
  firmware.address = "0x0";
  expect(firmware.data[0]).toBe(0xe9);
  expect(validateFirmware([firmware])[0].address).toBe(0);
});

test("default loader rejects damaged content, failed downloads and mismatched hashes", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(null, { status: 404 })) as typeof fetch;
    await expect(loadDefaultFirmware()).rejects.toThrow("HTTP 404");
    globalThis.fetch = (async () =>
      new Response(new Uint8Array(100))) as typeof fetch;
    await expect(loadDefaultFirmware()).rejects.toThrow("大小不符");
    globalThis.fetch = (async () =>
      new Response(new Uint8Array(DEFAULT_FIRMWARE.size))) as typeof fetch;
    await expect(loadDefaultFirmware()).rejects.toThrow("SHA-256 不匹配");
    const data = await Bun.file(
      new URL(`../public/firmware/${DEFAULT_FIRMWARE.name}`, import.meta.url),
    ).arrayBuffer();
    globalThis.fetch = (async () => new Response(data)) as typeof fetch;
    expect((await loadDefaultFirmware()).sha256).toBe(DEFAULT_FIRMWARE.sha256);
  } finally {
    globalThis.fetch = original;
  }
});
