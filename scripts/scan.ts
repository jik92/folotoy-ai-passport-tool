// macOS read-only scan. The browser separately requires a user-granted Web Serial port.
import { readdir } from "node:fs/promises";
if (process.platform !== "darwin") {
  console.error(
    "This CLI scan supports macOS. On other systems use the browser device chooser.",
  );
  process.exit(1);
}
const names = (await readdir("/dev")).filter((name) => name.startsWith("cu."));
const usb = names.filter((name) => /^cu\.(usb|wch|SLAB_|ttyACM)/i.test(name));
console.log(
  JSON.stringify(
    {
      scannedAt: new Date().toISOString(),
      ports: names.map((name) => `/dev/${name}`),
      usbCandidates: usb.map((name) => `/dev/${name}`),
      note: usb.length
        ? "USB serial candidates found; chip type is confirmed after browser connection."
        : "No common USB serial ports found. Check data cable, power, USB port, and boot mode.",
    },
    null,
    2,
  ),
);
