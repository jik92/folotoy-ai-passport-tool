import { describe, expect, test } from "bun:test";
import {
  FLASH_SIZE,
  importFirmware,
  parseAddress,
  validateFirmware,
} from "../src/firmware";
import type { Firmware } from "../src/firmware";
function segment(address = "0x0", length = 4096, chip = 5): Firmware {
  const data = new Uint8Array(length);
  data[0] = 0xe9;
  data[12] = chip;
  return { id: "test", name: "test.bin", address, data, sha256: "" };
}
describe("firmware write boundaries", () => {
  test("accepts hexadecimal and decimal aligned addresses", () => {
    expect(parseAddress("0x10000")).toBe(65536);
    expect(parseAddress("4096")).toBe(4096);
  });
  test("rejects empty, negative, unaligned, fractional, and malformed addresses", () => {
    for (const value of [
      "",
      " ",
      "-4096",
      "0x1",
      "1.5",
      "12garbage",
      "Infinity",
      "0x",
    ])
      expect(() => parseAddress(value)).toThrow();
  });
  test("rejects missing and empty files", () => {
    expect(() => validateFirmware([])).toThrow();
    expect(() => validateFirmware([segment("0x0", 0)])).toThrow();
  });
  test("rejects firmware targeting another ESP chip", () => {
    expect(() => validateFirmware([segment("0x0", 4096, 9)])).toThrow(
      "ESP32-C3",
    );
  });
  test("rejects segments beyond physical flash", () => {
    expect(() => validateFirmware([segment("0x800000")])).toThrow("容量");
    expect(() =>
      validateFirmware([segment("0x400000")], 4 * 1024 * 1024),
    ).toThrow("容量");
    expect(validateFirmware([segment("0x7ff000")])[0].address).toBe(
      FLASH_SIZE - 4096,
    );
  });
  test("rejects overlap after sector alignment, regardless of selection order", () => {
    expect(() =>
      validateFirmware([segment("0x1000"), segment("0x0", 4097)]),
    ).toThrow("重叠");
    expect(() => validateFirmware([segment("0x0"), segment("0x0")])).toThrow(
      "重叠",
    );
  });
  test("sorts valid segments and accepts exact sector boundaries", () => {
    const result = validateFirmware([
      segment("0x10000"),
      segment("0x0"),
      segment("0x8000"),
    ]);
    expect(result.map((s) => s.address)).toEqual([0, 32768, 65536]);
    expect(validateFirmware([segment("0x0"), segment("0x1000")])).toHaveLength(
      2,
    );
  });
  test("allows partition data without an ESP executable header", () => {
    const partition = segment("0x8000");
    partition.data.fill(0);
    expect(validateFirmware([partition])).toHaveLength(1);
  });
});
describe("firmware import", () => {
  test("rejects archives, zero bytes, and oversized images", async () => {
    await expect(
      importFirmware(new File(["zip"], "firmware.zip")),
    ).rejects.toThrow(".bin");
    await expect(importFirmware(new File([], "empty.bin"))).rejects.toThrow(
      "大小",
    );
    await expect(
      importFirmware(new File([new Uint8Array(FLASH_SIZE + 1)], "large.bin")),
    ).rejects.toThrow("大小");
  });
  test("computes the SHA-256 of actual bytes", async () => {
    const firmware = await importFirmware(new File(["abc"], "firmware.bin"));
    expect(firmware.sha256).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect([...firmware.data]).toEqual([97, 98, 99]);
  });
});
