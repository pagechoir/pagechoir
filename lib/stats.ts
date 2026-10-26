import { wordCountText, type ActivityDay, type Goal } from "./model";

const STOP = new Set(
  "a an the and or but if then of to in on for with from at by as is are was were be been being it this that these those i you he she we they me him her us them my your his their our not no yes so than too very just into over after before about up down out off than can will would could should".split(
    " ",
  ),
);

export function readingMinutes(words: number) {
  return Math.max(1, Math.round(words / 230)) || 0;
}

export function frequentWords(text: string, limit = 12) {
  const counts = new Map<string, number>();
  for (const match of text.toLowerCase().match(/[\p{L}\p{N}’']+/gu) ?? []) {
    if (match.length < 3 || STOP.has(match)) continue;
    counts.set(match, (counts.get(match) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

export function writingIssues(text: string) {
  const doubles = text.match(/ {2,}/g)?.length ?? 0;
  const tokens = text.match(/[\p{L}\p{N}’']+/gu) ?? [];
  const repeats: string[] = [];
  for (let index = 1; index < tokens.length; index += 1) {
    if (tokens[index].length > 1 && tokens[index].toLowerCase() === tokens[index - 1].toLowerCase()) {
      repeats.push(tokens[index].toLowerCase());
    }
  }
  return { doubles, repeats: [...new Set(repeats)].slice(0, 12) };
}

export function streak(activity: ActivityDay[], today = new Date()) {
  const days = new Set(activity.filter((item) => item.words > 0).map((item) => item.day));
  const cursor = new Date(today);
  cursor.setHours(12, 0, 0, 0);
  const key = (date: Date) => date.toISOString().slice(0, 10);
  if (!days.has(key(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(key(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function dailyTarget(goal: Goal | null, written: number, today = new Date()) {
  if (!goal || goal.targetWords <= 0) return null;
  const remaining = Math.max(0, goal.targetWords - written);
  if (!goal.deadline) return null;
  const end = new Date(`${goal.deadline}T12:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const cursor = new Date(today);
  cursor.setHours(12, 0, 0, 0);
  const allowed = new Set(goal.weekdays);
  let days = 0;
  while (cursor <= end && days < 3660) {
    if (allowed.has(cursor.getDay())) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  if (days <= 0) return remaining;
  return Math.ceil(remaining / days);
}

export function wordsAdded(activity: ActivityDay[]) {
  return activity.reduce((sum, item) => sum + item.words, 0);
}

export function totalWordsFromText(text: string) {
  return wordCountText(text);
}
