// La mise en page des bannières, d'après les fiches de disarto.co (« Deployment ») : le champ
// de pixels du site en fond, deux lignes de construction verticales en pointillés qui prolongent
// les côtés du composant, et au centre un panneau — un en-tête (titre, icônes), une carte (grand
// titre et boutons, une vignette et une liste clé/valeur, des sections séparées par des tirets),
// un pied (icônes, statut en mono, bouton). Rien d'autre hors du composant. Le design d'abord :
// la hauteur suit le contenu, le panneau ne se tasse jamais pour tenir.
import { readFileSync } from "node:fs";
import { dither, type Theme } from "./kit.ts";

const b64 = (p: string) => readFileSync(p).toString("base64");
const AVATAR = `data:image/png;base64,${b64(`${import.meta.dir}/assets/avatar.png`)}`;

export type Tone = {
  page: string; construct: string;
  panel: string; panelBorder: string; shadow: string;
  card: string; cardBorder: string; text: string; muted: string; faint: string; dash: string;
  accent: string; onAccent: string; outline: string; outlineBorder: string;
  okBg: string; okBorder: string; okText: string; pillBorder: string; pillText: string;
  thumb: string;
};

export const TONES: Record<"dark" | "light", Tone> = {
  light: {
    page: "#f4f4f6", construct: "rgba(17,17,26,0.16)",
    panel: "#f1f1f4", panelBorder: "rgba(17,17,26,0.08)", shadow: "0 40px 80px -40px rgba(17,17,26,0.28)",
    card: "#ffffff", cardBorder: "rgba(17,17,26,0.07)", text: "#111114", muted: "#7a7a83", faint: "#a3a3ab", dash: "#dcdce2",
    accent: "#d4825d", onAccent: "#111114", outline: "#ffffff", outlineBorder: "rgba(17,17,26,0.15)",
    okBg: "#ecfdf3", okBorder: "#bbf7d0", okText: "#15803d", pillBorder: "rgba(17,17,26,0.13)", pillText: "#33333a",
    thumb: "#0f0f12",
  },
  dark: {
    page: "#0c0c0e", construct: "rgba(255,255,255,0.14)",
    panel: "#141417", panelBorder: "rgba(255,255,255,0.07)", shadow: "0 40px 80px -40px rgba(0,0,0,0.85)",
    card: "#1b1b1f", cardBorder: "rgba(255,255,255,0.07)", text: "#ececf0", muted: "#9a9aa3", faint: "#6e6e77", dash: "#303036",
    accent: "#d4825d", onAccent: "#111114", outline: "#1b1b1f", outlineBorder: "rgba(255,255,255,0.15)",
    okBg: "rgba(34,197,94,0.12)", okBorder: "rgba(34,197,94,0.3)", okText: "#4ade80", pillBorder: "rgba(255,255,255,0.14)", pillText: "#d4d4d8",
    thumb: "#0f0f12",
  },
};
export const tone = (t: Theme) => TONES[t.name];

// Icônes au trait (24x24, après lucide), dans la couleur du texte qui les porte
const PATHS: Record<string, string> = {
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>',
  visit: '<path d="M7 17 17 7M7 7h10v10"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  scale: '<path d="m16 16 3-8 3 8c-.9.7-1.9 1-3 1s-2.1-.3-3-1ZM2 16l3-8 3 8c-.9.7-1.9 1-3 1s-2.1-.3-3-1ZM7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  status: '<path d="M10.1 2.2a10 10 0 0 1 3.8 0M17.6 3.7a10 10 0 0 1 2.7 2.7M21.8 10.1a10 10 0 0 1 0 3.8M20.3 17.6a10 10 0 0 1-2.7 2.7M13.9 21.8a10 10 0 0 1-3.8 0M6.4 20.3a10 10 0 0 1-2.7-2.7M2.2 13.9a10 10 0 0 1 0-3.8M3.7 6.4a10 10 0 0 1 2.7-2.7"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  branch: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M6 8v8M18 8a6 6 0 0 1-6 6H8"/>',
  pin: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
};
export function icon(name: string, size = 20, extra = ""): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;${extra}">${PATHS[name] ?? ""}</svg>`;
}

const inter = (size: number, extra = "") => `font-family:'Inter',system-ui,sans-serif;font-size:${size}px;${extra}`;
const mono = (size: number, extra = "") => `font-family:'Krypton',monospace;font-size:${size}px;${extra}`;

// Boutons : contour (Share) et plein dans l'accent (Visit)
export function button(t: Theme, label: string, iconName?: string, filled = false): string {
  const c = tone(t);
  const colors = filled
    ? `background:${c.accent};color:${c.onAccent};border:1px solid ${c.accent};`
    : `background:${c.outline};color:${c.text};border:1px solid ${c.outlineBorder};`;
  return `<span style="display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 22px;border-radius:9999px;${colors}${inter(18, "font-weight:500;white-space:nowrap;")}">${iconName ? icon(iconName, 19) : ""}${label}</span>`;
}

// Pastilles : neutre (domaines, features), verte avec un point (Ready)
export function tag(t: Theme, label: string, iconName?: string): string {
  const c = tone(t);
  return `<span style="display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 16px;border-radius:9999px;border:1px solid ${c.pillBorder};color:${c.pillText};${inter(17, "white-space:nowrap;")}">${iconName ? `<span style="color:${c.muted};display:flex;">${icon(iconName, 17)}</span>` : ""}${label}</span>`;
}
export function ok(t: Theme, label: string): string {
  const c = tone(t);
  return `<span style="display:inline-flex;align-items:center;gap:10px;height:36px;padding:0 16px;border-radius:9999px;background:${c.okBg};border:1px solid ${c.okBorder};color:${c.okText};${inter(17, "font-weight:500;white-space:nowrap;")}"><span style="width:7px;height:7px;border-radius:9999px;background:currentColor;"></span>${label}</span>`;
}
export function person(t: Theme, name: string): string {
  const c = tone(t);
  return `<span style="display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px 0 4px;border-radius:9999px;border:1px solid ${c.pillBorder};color:${c.text};${inter(17, "white-space:nowrap;")}"><img src="${AVATAR}" style="width:28px;height:28px;border-radius:9999px;" />${name}</span>`;
}

// Liste clé/valeur : icône et libellé en gris, valeur à droite (texte ou pastille)
export function facts(t: Theme, rows: { icon: string; label: string; value: string }[]): string {
  const c = tone(t);
  return `<div style="display:flex;flex-direction:column;gap:14px;">${rows
    .map(
      (r) => `<div style="display:flex;align-items:center;min-height:38px;">
        <span style="width:220px;flex-shrink:0;display:flex;align-items:center;gap:14px;color:${c.muted};${inter(19)}">${icon(r.icon, 22)}${r.label}</span>
        <span style="display:flex;align-items:center;gap:10px;color:${c.text};${inter(19)}">${r.value}</span>
      </div>`,
    )
    .join("")}</div>`;
}

// Une section de la carte : un libellé gris, puis son contenu ; un filet en tirets avant
export function section(t: Theme, label: string, content: string, rule = true): string {
  const c = tone(t);
  return `${rule ? `<div style="height:1px;margin:30px 0 26px;background-image:repeating-linear-gradient(90deg,${c.dash} 0 8px,transparent 8px 14px);"></div>` : ""}
    <p style="margin-bottom:12px;color:${c.muted};${inter(18)}">${label}</p>${content}`;
}

// Une ligne en mono capitales, comme la source d'un déploiement
export function monoLine(t: Theme, iconName: string, text: string): string {
  const c = tone(t);
  return `<div style="display:flex;align-items:center;gap:14px;color:${c.text};${mono(19, "letter-spacing:0.06em;")}"><span style="color:${c.muted};display:flex;">${icon(iconName, 20)}</span>${text}</div>`;
}

// La vignette sombre (capture, motif), le contenu mis à l'échelle pour tenir
export function thumb(t: Theme, content: string, w = 440, h = 280): string {
  const c = tone(t);
  return `<div style="flex-shrink:0;width:${w}px;height:${h}px;border-radius:14px;overflow:hidden;background:${c.thumb};border:1px solid ${c.cardBorder};display:flex;align-items:center;justify-content:center;padding:18px;"><div data-fit style="display:flex;">${content}</div></div>`;
}

// Une image du repo (capture, illustration) en data URI, le chemin relatif à la racine du repo
export const dataUri = (p: string) =>
  `data:image/${/\.svg$/i.test(p) ? "svg+xml" : /\.jpe?g$/i.test(p) ? "jpeg" : /\.webp$/i.test(p) ? "webp" : "png"};base64,${b64(p)}`;

// La vignette d'une image : une capture la remplit (`size` cover, ou un zoom en % calé sur
// `position`) ; une illustration détourée (`contain`) se pose sur le ton du panneau, pas sur le noir
export function picture(t: Theme, src: string, o: { w?: number; h?: number; size?: string; position?: string } = {}): string {
  const c = tone(t);
  const size = o.size ?? "cover";
  const contain = size === "contain";
  return `<div style="flex-shrink:0;width:${o.w ?? 440}px;height:${o.h ?? 280}px;border-radius:14px;border:1px solid ${c.cardBorder};background:${contain ? c.panel : c.thumb} url('${src}') ${o.position ?? "center"} / ${size} no-repeat;background-origin:content-box;padding:${contain ? 16 : 0}px;"></div>`;
}

// La page et le panneau. `top` place le panneau ; les lignes de construction suivent ses côtés
// une fois la page posée (script).
export function page(
  t: Theme,
  o: { title: string; card: string; footerStatus?: string; footerAction?: string; width?: number; top?: number; actions?: string },
): string {
  const c = tone(t);
  const dashedV = `background-image:repeating-linear-gradient(to bottom,${c.construct} 0 8px,transparent 8px 14px);`;
  const actions = o.actions ?? `<span style="display:flex;gap:22px;color:${c.muted};">${icon("expand", 24)}${icon("close", 24)}</span>`;
  return `
    <div style="position:absolute;inset:0;background:${c.page};"></div>
    ${dither(t)}
    <div data-construct="left" style="position:absolute;top:0;bottom:0;width:1px;${dashedV}"></div>
    <div data-construct="right" style="position:absolute;top:0;bottom:0;width:1px;${dashedV}"></div>

    <div data-panel style="position:absolute;top:${o.top ?? 56}px;left:50%;transform:translateX(-50%);width:${o.width ?? 1180}px;padding:0 8px 8px;background:${c.panel};border:1px solid ${c.panelBorder};border-radius:30px;box-shadow:${c.shadow};">
      <div style="height:84px;padding:0 22px 0 24px;display:flex;align-items:center;justify-content:space-between;">
        <span style="color:${c.text};${inter(26, "font-weight:500;letter-spacing:-0.01em;")}">${o.title}</span>${actions}
      </div>
      <div style="padding:40px 40px 42px;background:${c.card};border:1px solid ${c.cardBorder};border-radius:24px;">${o.card}</div>
      ${o.footerStatus || o.footerAction ? `
      <div style="height:84px;padding:0 10px 0 24px;display:flex;align-items:center;justify-content:space-between;gap:24px;">
        <span style="display:flex;align-items:center;gap:22px;color:${c.muted};">${icon("more", 22)}<span style="width:1px;height:28px;background:${c.dash};"></span>${icon("sparkles", 22)}${icon("terminal", 22)}</span>
        <span style="display:flex;align-items:center;gap:22px;">
          ${o.footerStatus ? `<span style="color:${c.muted};${mono(17, "letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;")}">${o.footerStatus}</span>` : ""}
          ${o.footerAction ?? ""}
        </span>
      </div>` : `<div style="height:0;"></div>`}
    </div>

    <script>
      document.fonts.ready.then(() => {
        const r = document.querySelector("[data-panel]").getBoundingClientRect();
        const set = (k, prop, v) => (document.querySelector('[data-construct="' + k + '"]').style[prop] = v + "px");
        set("left", "left", r.left); set("right", "left", r.right - 1);
        // Read by render.sh: the page's height follows the panel (same margin below as above)
        document.body.dataset.panelBottom = String(Math.ceil(r.bottom));
      });
    </script>`;
}
