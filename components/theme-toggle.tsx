"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mode, setMode] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const stored = localStorage.getItem("pagechoir-theme");
    if (stored === "light" || stored === "dark") setMode(stored);
  }, []);

  function apply(next: "light" | "dark" | "system") {
    setMode(next);
    if (next === "system") localStorage.removeItem("pagechoir-theme");
    else localStorage.setItem("pagechoir-theme", next);
    const dark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }

  return (
    <label className="text-sm text-muted">
      <span className="sr-only">Theme</span>
      <select className="rounded-md border border-line bg-paper-2 px-2 py-1" value={mode} onChange={(event) => apply(event.target.value as "light" | "dark" | "system")}>
        <option value="system">System theme</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
