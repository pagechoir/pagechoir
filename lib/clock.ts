import type { Clock } from "./model";

export function clockSort(clock: Clock) {
  const n = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return n(clock.year) * 1e10 + n(clock.month) * 1e8 + n(clock.day) * 1e6 + n(clock.hour) * 1e4 + n(clock.minute);
}

export function compareClocks(a: Clock, b: Clock) {
  const era = (a.era || "").localeCompare(b.era || "");
  if (era) return era;
  return clockSort(a) - clockSort(b);
}

export function decomposeSort(sort: number, era: string, label: string): Clock {
  const safe = Math.max(0, Math.round(sort));
  const minute = safe % 10000;
  const hour = Math.floor(safe / 1e4) % 100;
  const day = Math.floor(safe / 1e6) % 100;
  const month = Math.floor(safe / 1e8) % 100;
  const year = Math.floor(safe / 1e10);
  const clock: Clock = {
    era,
    year: String(year),
    month: String(month),
    day: String(day),
    hour: String(hour),
    minute: String(minute),
    label,
    placed: true,
  };
  return clock;
}

export function clockLabel(clock: Clock) {
  if (clock.label.trim()) return clock.label.trim();
  const parts = [clock.era, clock.year && `Year ${clock.year}`, clock.month && `Month ${clock.month}`, clock.day && `Day ${clock.day}`, (clock.hour || clock.minute) && `${clock.hour || "0"}:${String(clock.minute || "0").padStart(2, "0")}`].filter(Boolean);
  return parts.join(" · ") || "Undated";
}

export function sortAt(ratio: number, min: number, max: number) {
  if (max <= min) return min + Math.round(ratio * 1e8);
  return Math.round(min + (max - min) * ratio);
}
