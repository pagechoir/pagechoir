"use client";

import { useEffect, useState } from "react";
import { useBook } from "@/components/book-provider";
import { bookWordCount, dayKey, now, uid } from "@/lib/model";
import { dailyTarget, frequentWords, readingMinutes, streak } from "@/lib/stats";
import { spineText as fullText } from "@/lib/spine";

export function GoalsView() {
  const { bundle, update, role, sessionStarted, wordCount } = useBook();
  const [note, setNote] = useState("");
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - sessionStarted) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [sessionStarted]);
  if (!bundle) return null;
  const editing = role === "owner" || role === "coauthor";
  const goal = bundle.goal;
  const text = fullText(bundle);
  const target = dailyTarget(goal, wordCount);
  const words = frequentWords(text);
  const days = bundle.activity.slice().sort((a, b) => a.day.localeCompare(b.day)).slice(-21);
  const max = Math.max(1, ...days.map((day) => day.words));
  const minutes = Math.floor(elapsed / 60);
  const seconds = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6 lg:grid-cols-2">
      <section className="page-sheet space-y-3 p-5">
        <h1 className="font-serif text-3xl">Goals</h1>
        <label className="block text-sm">
          Book target in words
          <input type="number" min={0} className="mt-1 w-full rounded border border-line bg-paper-2 px-2 py-1" disabled={!editing} value={goal?.targetWords ?? ""} placeholder="80000" onChange={(event) => update((book) => ({ ...book, goal: { targetWords: Number(event.target.value) || 0, deadline: book.goal?.deadline ?? "", weekdays: book.goal?.weekdays ?? [0, 1, 2, 3, 4, 5, 6], updatedAt: now() } }))} />
        </label>
        <label className="block text-sm">
          Deadline
          <input type="date" className="mt-1 w-full rounded border border-line bg-paper-2 px-2 py-1" disabled={!editing} value={goal?.deadline ?? ""} onChange={(event) => update((book) => ({ ...book, goal: { targetWords: book.goal?.targetWords ?? 0, deadline: event.target.value, weekdays: book.goal?.weekdays ?? [0, 1, 2, 3, 4, 5, 6], updatedAt: now() } }))} />
        </label>
        <fieldset className="text-sm">
          <legend>Writing days</legend>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, index) => (
            <label key={label} className="mr-3">
              <input type="checkbox" className="mr-1" disabled={!editing} checked={goal?.weekdays.includes(index) ?? true} onChange={(event) => {
                const current = new Set(goal?.weekdays ?? [0, 1, 2, 3, 4, 5, 6]);
                if (event.target.checked) current.add(index);
                else current.delete(index);
                update((book) => ({ ...book, goal: { targetWords: book.goal?.targetWords ?? 0, deadline: book.goal?.deadline ?? "", weekdays: [...current].sort(), updatedAt: now() } }));
              }} />
              {label}
            </label>
          ))}
        </fieldset>
        <p>{wordCount.toLocaleString()} words written.</p>
        <p>{target === null ? "Set a target and a deadline to see the daily number." : `${target.toLocaleString()} words a writing day to finish on time.`}</p>
        <div className="h-3 overflow-hidden rounded-full bg-sidebar">
          <div className="h-full bg-accent" style={{ width: `${goal?.targetWords ? Math.min(100, (wordCount / goal.targetWords) * 100) : 0}%` }} />
        </div>
      </section>
      <section className="page-sheet space-y-3 p-5">
        <h2 className="font-serif text-2xl">Today</h2>
        <p>This session: {minutes}:{seconds}</p>
        <p>Streak: {streak(bundle.activity)} day{streak(bundle.activity) === 1 ? "" : "s"}</p>
        <p>Reading time: {wordCount ? readingMinutes(wordCount) : 0} min</p>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!note.trim()) return;
          update((book) => ({
            ...book,
            checkIns: [...book.checkIns, { id: uid(), day: dayKey(), note: note.trim(), words: bookWordCount(book), updatedAt: now() }],
          }));
          setNote("");
        }}>
          <textarea className="w-full rounded border border-line bg-paper-2 p-2" rows={4} placeholder="How did the session go?" value={note} onChange={(event) => setNote(event.target.value)} />
          <button className="mt-2 rounded bg-accent px-3 py-1 text-[var(--accent-ink)]" type="submit">Save check-in</button>
        </form>
        <ul className="space-y-2 text-sm">
          {bundle.checkIns.slice().reverse().map((entry) => (
            <li key={entry.id}><strong>{entry.day}</strong> · {entry.words.toLocaleString()} words. {entry.note}</li>
          ))}
        </ul>
      </section>
      <section className="page-sheet p-5 lg:col-span-2">
        <h2 className="font-serif text-2xl">Words added</h2>
        <div className="mt-3 flex h-32 items-end gap-1">
          {days.map((day) => (
            <div key={day.id} className="flex-1 rounded-t bg-accent" style={{ height: `${(day.words / max) * 100}%` }} title={`${day.day}: ${day.words}`} />
          ))}
        </div>
        <h3 className="mt-4 font-semibold">Frequent words</h3>
        <p className="text-sm">{words.length ? words.map((entry) => `${entry.word} (${entry.count})`).join(", ") : "Write a little more to see this."}</p>
        <p className="sr-only">{text.slice(0, 1)}</p>
      </section>
    </div>
  );
}
