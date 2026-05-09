"use client";

import { useState } from "react";
import { Send, Check } from "lucide-react";
import { useToast } from "@/lib/toast";

const MAX_MESSAGE = 4000;

export function FeedbackForm() {
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 4) {
      toast.push("error", "Message is too short");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("https://formspree.io/f/xjglajgg", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          email: email.trim(),
          _subject: "Nodiatis Wiki — feedback",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSent(true);
      setMessage("");
      setEmail("");
      toast.push("success", "Thanks — feedback received");
    } catch {
      toast.push("error", "Couldn't send — try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-lg p-5 lg:p-6"
    >
      <h3 className="font-[family-name:var(--font-display-loaded)] text-lg lg:text-xl text-[var(--color-fg-1)] mb-1">
        Found a bug? Got a feature idea?
      </h3>
      <p className="text-xs lg:text-sm text-[var(--color-fg-3)] mb-4 leading-relaxed">
        Drop a note — bugs, missing items, recipes that look wrong, anything
        you wish this site did. Email is optional but helps if you want a
        reply.
      </p>

      <label className="block mb-3">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-3)]">
          Email (optional)
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          maxLength={200}
          className="mt-1 w-full px-3 py-2 bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded text-sm text-[var(--color-fg-1)] placeholder:text-[var(--color-fg-3)] focus:outline-none focus:border-[var(--color-gold-soft)]"
        />
      </label>

      <label className="block mb-3">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-3)]">
          Your message
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What's broken or what would you like to see?"
          rows={5}
          maxLength={MAX_MESSAGE}
          required
          className="mt-1 w-full px-3 py-2 bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded text-sm text-[var(--color-fg-1)] placeholder:text-[var(--color-fg-3)] focus:outline-none focus:border-[var(--color-gold-soft)] resize-y min-h-[120px]"
        />
        <span className="block mt-1 text-[10px] font-mono text-[var(--color-fg-3)] text-right">
          {message.length} / {MAX_MESSAGE}
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting || message.trim().length < 4}
        className={`flex items-center gap-2 px-4 py-2 text-sm rounded transition-colors ${
          sent
            ? "bg-[var(--color-emerald)]/10 border border-[var(--color-emerald)]/40 text-[var(--color-emerald)]"
            : "bg-[var(--color-bg-3)] border border-[var(--color-gold-soft)] text-[var(--color-gold)] hover:bg-[var(--color-bg-2)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-bg-3)]"
        }`}
      >
        {sent ? <Check size={14} /> : <Send size={14} />}
        {submitting ? "Sending..." : sent ? "Sent" : "Send feedback"}
      </button>
    </form>
  );
}
