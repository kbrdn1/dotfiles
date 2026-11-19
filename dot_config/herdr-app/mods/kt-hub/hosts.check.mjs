// bun ~/.config/herdr-app/mods/kt-hub/hosts.check.mjs: the hub's Machines (hosts.js) on outputs shaped like
// the real ones (made-up numbers, a made-up device): this Mac's sysctl (decimal comma), vm_stat and df, the
// VPS's command; a part unreadable; the reads only while the hub shows.
import assert from "node:assert/strict";
const H = await import("./hosts.js");

// df -kP: the data row's numbers, in bytes; the header alone, nothing.
assert.deepEqual(H.dfOf("Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/xyz1 1000 600 400 60% /\n"), { total: 1024000, used: 614400, free: 409600 });
assert.equal(H.dfOf("Filesystem 1024-blocks Used Available Capacity Mounted on\n"), null);

// This Mac: the load with a decimal comma, 8 cores, 16 GiB; 16 KiB pages; the data volume.
const sysctl = "{ 12,50 11,00 10,00 }\n8\n17179869184\n";
const vmstat = "Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free:                               5000.\nPages active:                           200000.\nPages inactive:                         150000.\nPages wired down:                       250000.\nPages occupied by compressor:            50000.\n";
const df = "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/xyz5 200000000 150000000 10000000 94% /System/Volumes/Data\n";
const mac = H.macFigures(sysctl, vmstat, df, 1000);
assert.deepEqual(mac.cpu, { load: 12.5, cores: 8, ratio: 12.5 / 8 }, "the load read with its comma; over 100 % kept as it is");
assert.equal(mac.mem.used, (200000 + 250000 + 50000) * 16384, "active, wired and compressed pages");
assert.equal(mac.mem.total, 17179869184);
assert.equal(Math.round(mac.disk.ratio * 100), 94, "df's part: used over used + free");
assert.equal(mac.at, 1000);
assert.equal(H.macFigures("{ 1.5 1 1 }\n4\n8\n", "", "", 0).cpu.load, 1.5, "a decimal point too");
assert.equal(H.macFigures("", "", "", 0), null, "nothing readable");
assert.deepEqual(Object.keys(H.macFigures(sysctl, "", "", 0)).filter((k) => H.macFigures(sysctl, "", "", 0)[k] === null), ["mem", "disk"], "a part unreadable: null, the rest kept");

// The VPS: /proc/loadavg, nproc, MemTotal and MemAvailable (kB), df's row.
const vps = "0.20 0.10 0.05 1/200 4321\n4\nMemTotal:       16000000 kB\nMemAvailable:   12000000 kB\nFilesystem     1024-blocks    Used Available Capacity Mounted on\n/dev/xyz1      200000000 20000000 180000000      10% /\n";
const v = H.linuxFigures(vps, 2000);
assert.deepEqual(v.cpu, { load: 0.2, cores: 4, ratio: 0.05 });
assert.deepEqual([v.mem.used, v.mem.total], [4000000 * 1024, 16000000 * 1024], "used: total less available");
assert.equal(Math.round(v.disk.ratio * 100), 10);
assert.ok(!JSON.stringify(v).includes("xyz"), "the device is never kept");
assert.equal(H.linuxFigures("", 0), null);
assert.ok(H.VPS_CMD.startsWith("cat /proc/loadavg; nproc;") && H.VPS_CMD.endsWith("df -kP /"), "the approved command, unchanged");

// Reads: only while the hub shows; then every `every` ms; none yet: at once.
assert.equal(H.readDue(false, 0, H.VPS_EVERY, 1e9), false, "hidden: never, even with no read yet");
assert.equal(H.readDue(false, 1, H.VPS_EVERY, 1e12), false, "hidden: never, however old the last");
assert.equal(H.readDue(true, 0, H.VPS_EVERY, 5), true, "shown, no read yet: at once");
assert.equal(H.readDue(true, 1000, H.VPS_EVERY, 1000 + 119e3), false, "shown: not before 2 min");
assert.equal(H.readDue(true, 1000, H.VPS_EVERY, 1000 + 120e3), true);
assert.equal(H.readDue(true, 1000, H.VPS_FLOOR, 1000 + 29e3), false, "shown again within 30 s: no new read");

console.log("hosts.check: ok");
