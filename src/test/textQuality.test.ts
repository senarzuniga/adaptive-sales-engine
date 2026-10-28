import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Permanent guard: user-facing Spanish text must keep its diacritics (a with acute, e with acute,
// i with acute, o with acute, u with acute, enye, inverted marks) and never contain mojibake.
// If this test fails, a string lost its special characters.

const SRC_ROOT = join(__dirname, "..");

const collectSourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === "dist") return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return collectSourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });

// Tokens that can never be legitimate: Spanish words missing letters/diacritics.
const MALFORMED_TOKENS = [
  "Descripcin", "descripcin", "Poltica", "poltica", "Politicas", "politicas",
  "Anlisis", "anlisis", "Ttulo", "ttulo", "Nmero", "nmero", "Instalacin", "instalacin",
  "edicin", "Edicin", "Catlogo", "catlogo", "Aadir", "aadir", "aaden", "cargarn",
  "garanta", "Garanta", "Garantia", "GARANTIA", "Gestin", "gestin",
  "Financiacin", "financiacin", "Logstica", "logstica", "Negociacin",
  "Validacin", "Desviacin", "Categoras", "categora", "Mnimo", "Hipotesis", "hipotesis",
  "viticos", "segn", "senales", "Econmico", "Ambito", "lneas", "Lnea",
  "aadirlo", "respondi", "quedaran", "cerraran", "cerrara", "debera", "facilitara",
  "acordaran", "confirmaran", "todavia", "exito",
];

// Classic mojibake sequences (UTF-8 read as Latin-1) plus the U+FFFD replacement char.
const MOJIBAKE = /[\u00C3\u00C2][\u00A9\u00AE\u00B3\u00B1\u00AA\u00B0\u00B2\u00B3]|\u00E2\u20AC|\uFFFD/;

// Lines that intentionally use unaccented variants: keyword/alias matchers, NFD-normalized lookups,
// and spreadsheet column aliases. Display strings are still fully checked.
const MATCHER_LINE = /_KEYWORDS|aliases|findCol\(|includes\(|\.test\(|normalizeText|normalize\(|fields\./;

const files = collectSourceFiles(SRC_ROOT);

const offendingLines = (file: string, re: RegExp) =>
  readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((text, index) => ({ text, line: index + 1 }))
    .filter(({ text }) => !MATCHER_LINE.test(text) && re.test(text))
    .map(({ text, line }) => `${file}:${line} :: ${text.trim().slice(0, 120)}`);

describe("text quality guard (Spanish diacritics and encoding)", () => {
  it("scans a non-trivial amount of source files", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("contains no mojibake or replacement characters", () => {
    const offenders = files.filter((file) => MOJIBAKE.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it.each(MALFORMED_TOKENS)("has no malformed token %s", (token) => {
    // Accent-aware boundaries: "respondi" must still match inside the corrupted "respondi;"
    // but never inside the correct "respondió".
    const re = new RegExp("(?<![A-Za-z0-9_\u00C0-\u024F])" + token + "(?![A-Za-z0-9_\u00C0-\u024F])");
    expect(files.flatMap((file) => offendingLines(file, re))).toEqual([]);
  });
});
