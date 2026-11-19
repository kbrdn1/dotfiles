// badges.js: the badges a skill row keeps in a list `listW` px wide (#74). The name keeps NAME_MIN px
// first; past that, the badges go, the last first (the full facts stay in the detail). Pure: its check
// is mods/kt-skills/badges.check.mjs.

const CH = 6; // Monaspace Krypton's advance at 10 px: a tag's text
const tagW = (text) => 16 + CH * String(text).length; // px 7 and border 1 on each side
export const NAME_MIN = 120; // ~15 characters of the name (mono 13)
// A row's fixed parts: the list card (border, padding 4) 10, the row (border, pl 10, pr 14) 26, the
// check and its gap 26; on the name's line, the three gaps around the spacer 24 and the harness 46.
const FIXED = 10 + 26 + 26 + 24 + 46;

export function rowBadges(listW, badges, source) {
  let room = listW - FIXED - tagW(source) - NAME_MIN;
  const kept = [];
  for (const b of badges) {
    room -= 8 + tagW(b);
    if (room < 0) break;
    kept.push(b);
  }
  return kept;
}
