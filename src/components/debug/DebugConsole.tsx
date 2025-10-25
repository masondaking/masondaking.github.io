import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDebug, DebugLogLevel } from "../../context/DebugContext";
import { clsx } from "clsx";
import { ClipboardCopy, Trash2, X } from "lucide-react";

const levelLabels: Record<DebugLogLevel, string> = {
  info: "Info",
  request: "Request",
  response: "Response",
  error: "Error",
};

export function DebugConsole() {
  const { logs, clear, isConsoleOpen, toggleConsole } = useDebug();
  const [activeLevel, setActiveLevel] = useState<DebugLogLevel | "all">("all");
  const filteredLogs = useMemo(() => {
    if (activeLevel === "all") return logs;
    return logs.filter((log) => log.level === activeLevel);
  }, [logs, activeLevel]);

  const handleCopy = (payload: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).catch((error) => {
      console.error("Failed to copy payload", error);
    });
  };

  return (
    <AnimatePresence>
      {isConsoleOpen && (
        <motion.div
          className="debug-console"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
        >
          <header className="debug-console__header">
            <div>
              <span className="debug-console__title">Debug Console</span>
              <span className="debug-console__meta">Inspect AI requests, responses, and errors</span>
            </div>
            <div className="debug-console__actions">
              <button type="button" className="ghost-button" onClick={clear}>
                <Trash2 size={16} /> Clear
              </button>
              <button type="button" className="ghost-button" onClick={toggleConsole}>
                <X size={16} /> Close
              </button>
            </div>
          </header>
          <div className="debug-console__filters">
            <button
              type="button"
              className={clsx("chip", activeLevel === "all" && "chip--active")}
              onClick={() => setActiveLevel("all")}
            >
              All ({logs.length})
            </button>
            {(Object.keys(levelLabels) as DebugLogLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                className={clsx("chip", activeLevel === level && "chip--active")}
                onClick={() => setActiveLevel(level)}
              >
                {levelLabels[level]}
              </button>
            ))}
          </div>
          <div className="debug-console__list">
            {filteredLogs.length === 0 ? (
              <p className="debug-console__empty">No events captured yet. Trigger a generation or feedback request to populate logs.</p>
            ) : (
              filteredLogs.map((log) => (
                <article key={log.id} className={`debug-entry debug-entry--${log.level}`}>
                  <header className="debug-entry__header">
                    <span className="debug-entry__level">{levelLabels[log.level]}</span>
                    <time>{new Date(log.timestamp).toLocaleTimeString()}</time>
                  </header>
                  <p className="debug-entry__summary">{log.summary}</p>
                  {log.payload != null && (
                    <pre className="debug-entry__payload">
                      {JSON.stringify(log.payload, null, 2)}
                      <button type="button" onClick={() => handleCopy(log.payload)} aria-label="Copy payload">
                        <ClipboardCopy size={16} />
                      </button>
                    </pre>
                  )}
                </article>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

