// hosts.js: the hub's Machines (Kylian's request of 2026-11-19): each machine's CPU, memory and disk, read
// from a few read-only commands' outputs. Pure, no import: hosts.check.mjs runs it under bun. Numbers only:
// df's device column is never kept, nor anything else the outputs say of the machine.
//
// This Mac, locally, no network: `sysctl -n vm.loadavg hw.ncpu hw.memsize` (the load in the locale's
// decimals: « { 13,92 11,55 10,28 } »), `vm_stat` (pages; their size in its first line), `df -kP
// /System/Volumes/Data` (APFS' data volume: `/` is the sealed system snapshot).
// main-vps, with Kylian's go for this exact command, when the hub shows and every 2 min while it does:
// `sh -c 'cat /proc/loadavg; nproc; grep -E "^(MemTotal|MemAvailable):" /proc/meminfo; df -kP /'`.

export const VPS = "main-vps";
// The command as Kylian approved it, run on main-vps by Herdr's exec (its core's link, as hc exec --on).
export const VPS_CMD = 'cat /proc/loadavg; nproc; grep -E "^(MemTotal|MemAvailable):" /proc/meminfo; df -kP /'; // i18n: tech
export const MAC_EVERY = 10e3;
export const VPS_EVERY = 120e3;
// The hub shown again: the VPS read at once, unless the last one is this recent (a page switched back and
// forth calls it once).
export const VPS_FLOOR = 30e3;

const decimal = (s) => Number(String(s ?? "").replace(",", "."));

/** df -kP's data row: total, used and free, in bytes; null when there is none. */
export function dfOf(text) {
  const m = /(\d+)\s+(\d+)\s+(\d+)\s+\d+%/.exec(String(text ?? ""));
  if (!m) return null;
  const [total, used, free] = [m[1], m[2], m[3]].map((x) => Number(x) * 1024);
  return total > 0 ? { total, used, free } : null;
}

// A machine's figures, each null when unreadable; null when none is. The disk's part as df counts it
// (used over used + free: the blocks kept for root left out).
function figures({ load, cores, memTotal, memUsed, disk, at }) {
  const cpu = Number.isFinite(load) && load >= 0 && cores > 0 ? { load, cores, ratio: load / cores } : null;
  const mem = memTotal > 0 && Number.isFinite(memUsed) && memUsed >= 0 ? { used: memUsed, total: memTotal, ratio: memUsed / memTotal } : null;
  const dsk = disk && disk.used + disk.free > 0 ? { used: disk.used, total: disk.total, ratio: disk.used / (disk.used + disk.free) } : null;
  return cpu || mem || dsk ? { cpu, mem, disk: dsk, at } : null;
}

/** This Mac from `sysctl -n vm.loadavg hw.ncpu hw.memsize`, `vm_stat` and `df -kP` (texts). Memory used as
 *  Activity Monitor counts it, about: active, wired and compressed pages. */
export function macFigures(sysctl, vmstat, df, at) {
  const lines = String(sysctl ?? "").trim().split("\n");
  const page = Number(/page size of (\d+) bytes/.exec(vmstat ?? "")?.[1]) || 4096;
  const pages = (label) => Number(new RegExp(`${label}:\\s+(\\d+)`).exec(vmstat ?? "")?.[1]) || 0;
  return figures({
    load: decimal(/\{\s*([\d.,]+)/.exec(lines[0] ?? "")?.[1]),
    cores: Number(lines[1]),
    memTotal: Number(lines[2]),
    // i18n: tech
    memUsed: vmstat ? (pages("Pages active") + pages("Pages wired down") + pages("Pages occupied by compressor")) * page : NaN,
    disk: dfOf(df),
    at,
  });
}

/** main-vps from VPS_CMD's output: its load, cores, MemTotal and MemAvailable (kB), df's row. */
export function linuxFigures(text, at) {
  const s = String(text ?? "");
  const lines = s.trim().split("\n");
  const kb = (k) => Number(new RegExp(`^${k}:\\s+(\\d+)\\s*kB`, "m").exec(s)?.[1]) * 1024;
  const memTotal = kb("MemTotal");
  return figures({ load: decimal(lines[0]?.trim().split(/\s+/)[0]), cores: Number(lines[1]), memTotal, memUsed: memTotal - kb("MemAvailable"), disk: dfOf(s), at });
}

/** A read is due: only while the hub shows, and `every` ms after the last one (none yet: at once). */
export const readDue = (shown, last, every, now) => Boolean(shown) && (!(last > 0) || now - last >= every);
