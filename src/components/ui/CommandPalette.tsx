import { useEffect, useMemo, useState } from "react";

export interface CommandOption {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: CommandOption[];
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) =>
      command.label.toLowerCase().includes(q) || command.description?.toLowerCase().includes(q)
    );
  }, [query, commands]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, Math.max(filtered.length - 1, 0)));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const cmd = filtered[activeIndex];
        if (cmd) {
          onClose();
          requestAnimationFrame(() => cmd.onSelect());
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, activeIndex, filtered, onClose]);

  useEffect(() => {
    if (!open) return;
    const timer = requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(".command-palette__input");
      input?.focus();
    });
    return () => cancelAnimationFrame(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div className="command-palette" role="dialog" aria-modal>
      <div className="command-palette__backdrop" onClick={onClose} />
      <div className="command-palette__panel">
        <input
          className="command-palette__input"
          placeholder="Search commands…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
        />
        <ul className="command-palette__list">
          {filtered.length === 0 ? (
            <li className="command-palette__empty">No matches. Try "studio" or "library".</li>
          ) : (
            filtered.map((command, index) => (
              <li key={command.id}>
                <button
                  type="button"
                  className={index === activeIndex ? "command-option command-option--active" : "command-option"}
                  onClick={() => {
                    onClose();
                    command.onSelect();
                  }}
                >
                  <div>
                    <span>{command.label}</span>
                    {command.description && <small>{command.description}</small>}
                  </div>
                  {command.shortcut && <kbd>{command.shortcut}</kbd>}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
