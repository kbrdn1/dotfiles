// Catppuccin file and folder icons (brand/icons/catppuccin, see its README):
// mocha in dark, latte in light. Lookup: the exact name, then lower-cased, then
// compound extensions longest first (`d.ts` before `ts`), else the defaults.
// Draw the path with `image()` (full color), never `svg()` (one tint).
// Source of truth: mods/kt-diff/icons.js; kt-files, kt-history and kt-inbox
// hold byte-identical copies (a mod can't import from another mod's folder).

export const ICON_MAP = "brand/icons/catppuccin/map.json";

/** `map`: map.json, parsed (null while loading). Answers a path relative to the app home. */
export function catIcon(map, name, { folder = false, open = false, dark = true } = {}) {
  const dir = `brand/icons/catppuccin/${dark ? "mocha" : "latte"}`;
  const d = map?.defaults ?? { file: "_file", folder: "_folder", folderOpen: "_folder_open" };
  let icon;
  if (folder) {
    const table = (open ? map?.folderNamesOpen : map?.folderNames) ?? {};
    icon = table[name] ?? table[name.toLowerCase()] ?? (open ? d.folderOpen : d.folder);
  } else {
    const names = map?.fileNames ?? {}, exts = map?.fileExtensions ?? {};
    icon = names[name] ?? names[name.toLowerCase()];
    const parts = name.toLowerCase().split(".");
    for (let i = 1; !icon && i < parts.length; i++) icon = exts[parts.slice(i).join(".")];
    icon ??= d.file;
  }
  return `${dir}/${icon}.svg`;
}
