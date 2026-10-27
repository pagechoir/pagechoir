import type { Node as ProseNode } from "@tiptap/pm/model";

export type ProofIssue = {
  from: number;
  to: number;
  word: string;
  kind: "spelling" | "grammar";
  message: string;
  suggestion?: string;
};

export type SpellChecker = {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
};

type Token = { word: string; from: number; to: number; start: number; end: number; sentence: boolean };

const WORD = /[A-Za-z]+(?:['’][A-Za-z]+)?/g;

let checker: SpellChecker | null = null;
let failed = false;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function proofChecker() {
  return checker;
}

export function proofStatus() {
  if (checker) return "ready" as const;
  if (failed) return "failed" as const;
  return "loading" as const;
}

export function onProofReady(listener: () => void) {
  listeners.add(listener);
  if (checker) listener();
  return () => {
    listeners.delete(listener);
  };
}

export function loadProof() {
  if (checker || pending) return pending ?? Promise.resolve();
  pending = (async () => {
    const [affResponse, dicResponse, mod] = await Promise.all([
      fetch("/proof/en.aff"),
      fetch("/proof/en.dic"),
      import("nspell"),
    ]);
    if (!affResponse.ok || !dicResponse.ok) throw new Error("The spelling dictionary could not be loaded.");
    const aff = await affResponse.text();
    const dic = await dicResponse.text();
    const create = (mod.default ?? mod) as (affix: string, dictionary: string) => SpellChecker;
    checker = create(aff, dic);
    listeners.forEach((listener) => listener());
  })().catch(() => {
    failed = true;
    pending = null;
  });
  return pending;
}

function blockPieces(block: ProseNode, blockPos: number) {
  let raw = "";
  const map: number[] = [];
  block.descendants((child, rel) => {
    if (!child.isText || !child.text) return;
    const base = blockPos + 1 + rel;
    for (let index = 0; index < child.text.length; index += 1) {
      raw += child.text[index];
      map.push(base + index);
    }
  });
  return { raw, map };
}

function articleFor(word: string) {
  const lower = word.toLowerCase();
  if (/^(hour|honest|honor|honour|heir|heiress)/.test(lower)) return "an";
  if (/^(uni(versity|que|on|ted|form)|use[drs]?|user|usual|useful|europe|european|one|once)/.test(lower)) return "a";
  if (/^u[^aeiou]/.test(lower)) return "a";
  if (/^[aeiou]/.test(lower)) return "an";
  return "a";
}

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + cost);
      diagonal = saved;
    }
  }
  return row[b.length];
}

function bestSuggestion(word: string, suggestions: string[]) {
  const folded = word.toLowerCase().replaceAll("’", "'");
  const contraction = suggestions.find((item) => item.replaceAll("'", "").toLowerCase() === folded.replaceAll("'", "") && item.includes("'"));
  if (contraction) return contraction;
  const rank = (item: string) => {
    const lower = item.toLowerCase();
    let prefix = 0;
    while (prefix < folded.length && prefix < lower.length && folded[prefix] === lower[prefix]) prefix += 1;
    return distance(folded, lower) * 10 - prefix;
  };
  return suggestions.slice().sort((a, b) => rank(a) - rank(b))[0];
}

function tokensIn(raw: string, map: number[]) {
  const tokens: Token[] = [];
  let cursor = 0;
  for (const match of raw.matchAll(WORD)) {
    const word = match[0];
    const start = match.index ?? 0;
    const gap = raw.slice(cursor, start);
    const sentence = cursor === 0 || /[.!?]["')\]]*\s*$/.test(gap);
    const from = map[start];
    const to = map[start + word.length - 1];
    if (from != null && to != null) tokens.push({ word, from, to: to + 1, start, end: start + word.length, sentence });
    cursor = start + word.length;
  }
  return tokens;
}

export function proofDocument(doc: ProseNode, spell: SpellChecker | null) {
  const issues: ProofIssue[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    const { raw, map } = blockPieces(node, pos);
    for (const match of raw.matchAll(/ {2,}/g)) {
      const at = match.index ?? 0;
      const from = map[at];
      const to = map[at + match[0].length - 1];
      if (from == null || to == null) continue;
      issues.push({ from, to: to + 1, word: "space", kind: "grammar", message: "Double space." });
    }
    const tokens = tokensIn(raw, map);
    tokens.forEach((token, index) => {
      const next = tokens[index + 1];
      if (next && /^(a|an)$/i.test(token.word) && /^\s+$/.test(raw.slice(token.end, next.start))) {
        const expect = articleFor(next.word);
        if (token.word.toLowerCase() !== expect) {
          issues.push({
            from: token.from,
            to: token.to,
            word: token.word,
            kind: "grammar",
            message: `Use “${expect}” before “${next.word}”.`,
            suggestion: expect,
          });
        }
      }
      const previous = tokens[index - 1];
      if (previous && previous.word.toLowerCase() === token.word.toLowerCase() && token.word.length > 1 && /^\s+$/.test(raw.slice(previous.end, token.start))) {
        issues.push({
          from: token.from,
          to: token.to,
          word: token.word,
          kind: "grammar",
          message: `“${token.word}” is repeated.`,
        });
      }
      if (!spell || token.word.length < 2) return;
      if (/^[A-Z]{2,5}$/.test(token.word)) return;
      if (!token.sentence && /^[A-Z]/.test(token.word)) return;
      if (spell.correct(token.word) || spell.correct(token.word.toLowerCase())) return;
      const suggestion = bestSuggestion(token.word, spell.suggest(token.word).slice(0, 8));
      issues.push({
        from: token.from,
        to: token.to,
        word: token.word,
        kind: "spelling",
        message: suggestion ? `Not in the dictionary. Suggestion: ${suggestion}` : "Not in the dictionary.",
        suggestion,
      });
    });
  });
  return issues.slice(0, 40);
}
