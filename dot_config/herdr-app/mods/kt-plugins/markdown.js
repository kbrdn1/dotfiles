// A Markdown body cut where kt-skills draws its own blocks: fenced code (``` or ~~~, at any indent,
// e.g. inside a list item), for its own background, radius and font. The rest stays Markdown for
// TextView.markdown, which draws headings, lists, emphasis, inline code, quotes and tables itself.
// [{ kind: "md", text } | { kind: "code", lang, text }]. Pure (no imports): node runs it too
// (frontmatter.test.mjs).

const FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/;

export function blocks(md) {
  const lines = String(md ?? "").replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  const out = [];
  let prose = [];
  const flush = () => {
    const text = prose.join("\n").replace(/^\n+|\n+$/g, "");
    if (text) out.push({ kind: "md", text });
    prose = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].match(FENCE);
    // A backtick fence's info string has no backtick (```a``` is inline code).
    if (!f || (f[2][0] === "`" && f[3].includes("`"))) {
      prose.push(lines[i]);
      continue;
    }
    const [, indent, fence, info] = f;
    const code = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const m = lines[j].trim();
      if (m[0] === fence[0] && /^(`+|~+)$/.test(m) && m.length >= fence.length) break;
      code.push(lines[j].startsWith(indent) ? lines[j].slice(indent.length) : lines[j].trimStart());
    }
    flush();
    out.push({ kind: "code", lang: info.trim().split(/\s+/)[0] || "", text: code.join("\n").replace(/\n+$/, "") });
    i = j; // past the closing fence (an unclosed one runs to the end, as in CommonMark)
  }
  flush();
  return out;
}
