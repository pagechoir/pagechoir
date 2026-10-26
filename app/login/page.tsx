"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (mode === "up") {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "The account could not be created.");
        return;
      }
    }
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError(mode === "up" ? "The account was created, but sign-in failed." : "That email and password did not match.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-sm uppercase tracking-[0.2em] text-accent">Pagechoir</p>
      <h1 className="mt-2 font-serif text-4xl">{mode === "in" ? "Welcome back" : "Create an account"}</h1>
      <form className="mt-6 space-y-3" onSubmit={submit}>
        {mode === "up" ? (
          <input className="w-full rounded border border-line bg-paper-2 px-3 py-2" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
        ) : null}
        <input className="w-full rounded border border-line bg-paper-2 px-3 py-2" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <input className="w-full rounded border border-line bg-paper-2 px-3 py-2" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
        {error ? <p className="text-sm text-coral">{error}</p> : null}
        <button className="w-full rounded bg-accent px-4 py-2 text-[var(--accent-ink)]" type="submit">{mode === "in" ? "Sign in" : "Create account"}</button>
      </form>
      <button type="button" className="mt-4 text-sm underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "Need an account?" : "Already have an account?"}
      </button>
    </main>
  );
}
