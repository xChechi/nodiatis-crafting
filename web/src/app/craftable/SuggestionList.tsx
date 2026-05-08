"use client";

interface Props {
  suggestions: string[];
  activeIndex: number;
  onSelect(s: string): void;
}

export function SuggestionList({ suggestions, activeIndex, onSelect }: Props) {
  if (suggestions.length === 0) return null;
  return (
    <ul
      role="listbox"
      className="mt-1 max-h-40 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] shadow-lg"
    >
      {suggestions.map((s, i) => (
        <li key={s} role="option" aria-selected={i === activeIndex}>
          <button
            type="button"
            onClick={() => onSelect(s)}
            className={
              "block w-full text-left px-3 py-1.5 text-sm transition-colors " +
              (i === activeIndex
                ? "bg-[var(--color-bg-3)] text-[var(--color-fg-1)]"
                : "text-[var(--color-fg-2)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-fg-1)]")
            }
          >
            {s}
          </button>
        </li>
      ))}
    </ul>
  );
}
