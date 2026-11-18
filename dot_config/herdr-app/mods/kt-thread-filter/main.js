// The threads' filter menu (kt-threads' filter icon opens it as a popup, Monocode's): Archivés,
// STATUT (several, none = all), PÉRIODE, PROGRAMME (the programs running now, several, none = all).
// It writes shared "kt.threadFilter" { archived, status, period, programs }; kt-threads reads it.
import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, shared, setShared, panes } from "herdr";

const MONO = "Monaspace Krypton";
const STATUS = [["working", "Working"], ["blocked", "Needs approval"], ["done", "Done"]];
const PERIOD = [["all", "Tout"], ["today", "Aujourd'hui"], ["7d", "7 derniers jours"], ["30d", "30 derniers jours"]];

function filterOf(s) {
  const f = s && typeof s === "object" ? s : {};
  return {
    archived: f.archived === true,
    status: Array.isArray(f.status) ? f.status : [],
    period: ["all", "today", "7d", "30d"].includes(f.period) ? f.period : "all",
    programs: Array.isArray(f.programs) ? f.programs : [],
  };
}
const flip = (list, x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

export default class ThreadFilter extends View {
  render() {
    const t = theme();
    const f = filterOf(shared("kt.threadFilter"));
    const set = (patch) => setShared("kt.threadFilter", { ...f, ...patch });
    const programs = [...new Map(panes().filter((p) => p.program?.agent).map((p) => [p.program.key, p.program])).values()];
    const line = (id, label, on, click, lead) => h_flex().id(id).h(32).px(10).gap(9).items_center().rounded(12)
      .text_size(13).text_color(on ? t.foreground : t.muted).cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { click(); cx.notify(); })
      .when(Boolean(lead), (el) => el.child(lead))
      .child(div().flex_1().min_w(0).truncate().child(label))
      .when(on, (el) => el.child(svg("mods/kt-thread-filter/check.svg").size(13).flex_none().text_color(t.accent)));
    const eyebrow = (s) => div().px(10).pt(6).pb(2).font_family(MONO).text_size(10.5).text_color(t.dim).child(s);
    const sep = () => div().mx(10).my(4).h(1).bg(t.border);
    // The program's tile, as the cards draw it (Herdr's own icon on its own color).
    const tile = (p) => div().w(18).h(15).flex_none().rounded(4).bg(p.tile ?? t.raised).flex().items_center().justify_center()
      .child(p.icon ? (p.tint ? svg(p.icon).size(10).text_color(p.color ?? "#ffffff") : image(p.icon).w(10).h(10)) : div());
    return v_flex().id("kt-thread-filter").w_full().p(4).gap(0).rounded(16).bg(t.popover).border(1).border_color(t.border)
      .child(line("tf-archived", "Archivés", f.archived, () => set({ archived: !f.archived }),
        svg("mods/kt-thread-filter/archive.svg").size(14).flex_none()))
      .child(sep())
      .child(eyebrow("STATUT"))
      .children(STATUS.map(([k, label]) => line(`tf-s-${k}`, label, f.status.includes(k), () => set({ status: flip(f.status, k) }))))
      .child(sep())
      .child(eyebrow("PÉRIODE"))
      .children(PERIOD.map(([k, label]) => line(`tf-p-${k}`, label, f.period === k, () => set({ period: k }))))
      .when(programs.length > 0, (el) => el.child(sep()).child(eyebrow("PROGRAMME"))
        .children(programs.map((p) => line(`tf-g-${p.key}`, p.name, f.programs.includes(p.key), () => set({ programs: flip(f.programs, p.key) }), tile(p)))));
  }
}
