import { useMemo } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useLibrary } from "../../context/LibraryContext";

export function OnboardingChecklist() {
  const { drafts } = useWorkspace();
  const { stories } = useLibrary();

  const checklist = useMemo(() => {
    const hasDraft = drafts.length > 0;
    const hasPublished = stories.length > 0;
    const hasFeedback = drafts.some((draft) => (draft.feedbackThreads ?? []).length > 0);
    return [
      { id: "draft", label: "Create your first draft", done: hasDraft, hint: hasDraft ? undefined : "Generate or save a story in the Studio" },
      { id: "publish", label: "Publish a story", done: hasPublished, hint: hasPublished ? undefined : "Share a draft to see it in your Library" },
      { id: "feedback", label: "Request AI feedback", done: hasFeedback, hint: hasFeedback ? undefined : "Ask the editors for notes on a draft" },
    ];
  }, [drafts, stories]);

  const remaining = checklist.filter((item) => !item.done).length;

  return (
    <section className="onboarding-card">
      <header>
        <h4>Get rolling</h4>
        <p>{remaining === 0 ? "You’re all set!" : `${remaining} step${remaining === 1 ? '' : 's'} to explore`}</p>
      </header>
      <ul>
        {checklist.map((item) => (
          <li key={item.id} className={item.done ? "onboarding-item onboarding-item--done" : "onboarding-item"}>
            {item.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            <div>
              <span>{item.label}</span>
              {!item.done && item.hint && <small>{item.hint}</small>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
