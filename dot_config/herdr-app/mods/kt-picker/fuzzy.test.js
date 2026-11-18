// bun ~/.config/herdr-app/mods/kt-picker/fuzzy.test.js
import { fuzzy, search } from "./fuzzy.js";

const eq = (got, want, what) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what}: ${JSON.stringify(got)} !== ${JSON.stringify(want)}`);
};

eq(fuzzy("hub", "k-hub").at, [2, 3, 4], "substring");
eq(fuzzy("KH", "k-hub").at, [0, 2], "in order, any case");
eq(fuzzy("xz", "k-hub"), null, "no match");
eq(fuzzy("", "k-hub"), { score: 0, at: [] }, "empty term");
if (!(fuzzy("log", "login page").score > fuzzy("log", "the catalog").score)) throw new Error("a word start beats a middle");
if (!(fuzzy("fl", "fix login").score < fuzzy("fl", "flow").score)) throw new Error("a substring beats a spread");

// Two terms across two fields; one term nowhere: no row.
const r = search("khub main", ["Refonte du login", "k-hub", "main"]);
eq([...r.marks[1]], [0, 2, 3, 4], "first term in the project");
eq([...r.marks[2]], [0, 1, 2, 3], "second term in the branch");
eq(search("khub nope", ["k-hub"]), null, "every term must match");
eq(search("", ["x"]).score, 0, "empty query keeps the row");
console.log("fuzzy: ok");
