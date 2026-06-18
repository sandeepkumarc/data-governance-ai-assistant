import { useEffect, useRef, useState } from "react";
import { LifeBuoy, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button, Spinner } from "./ui";
import type { AssistantConfidence } from "../types";

const STARTERS = [
  "What does governance readiness measure?",
  "Why are DQ rules only suggested?",
  "How do I improve my readiness score?",
];

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  offerHelpDesk?: boolean;
  confidence?: AssistantConfidence;
  relatedQuestion?: string;
  helpDeskSubmitted?: boolean;
};

export function GovernanceChat() {
  const { governance, apiKey, usesOfflineData, user } = useApp();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useLlm, setUseLlm] = useState(!usesOfflineData);
  const [helpDeskNotes, setHelpDeskNotes] = useState("");
  const [submittingDesk, setSubmittingDesk] = useState(false);
  const [activeHelpIndex, setActiveHelpIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask about governance readiness, DQ rules, lineage, steward approvals, or policies. I answer only from your saved catalog — I won't guess. If I can't answer safely, you can send the question to our governance help desk.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, open, loading, activeHelpIndex]);

  useEffect(() => {
    if (usesOfflineData) setUseLlm(false);
  }, [usesOfflineData]);

  const lastUserQuestion = [...history]
    .reverse()
    .find((m) => m.role === "user")?.content;

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || loading) return;

    setActiveHelpIndex(null);
    const userTurn: ChatMessage = { role: "user", content: message };
    const prior = [...history, userTurn];
    setHistory(prior);
    setInput("");
    setLoading(true);

    try {
      const result = await governance.assistantChat(
        {
          message,
          history: prior
            .filter((t) => t.role === "user" || t.role === "assistant")
            .map((t) => ({ role: t.role, content: t.content }))
            .slice(-8),
          no_llm: !useLlm,
        },
        apiKey || undefined,
      );
      setHistory((h) => [
        ...h,
        {
          role: "assistant",
          content: result.answer,
          offerHelpDesk: Boolean(result.offer_help_desk),
          confidence: result.confidence,
          relatedQuestion: message,
        },
      ]);
      if (result.offer_help_desk) {
        setActiveHelpIndex(prior.length);
      }
    } catch (e) {
      setHistory((h) => [
        ...h,
        {
          role: "assistant",
          content:
            e instanceof Error
              ? `Sorry, I couldn't reach the assistant: ${e.message}`
              : "Sorry, something went wrong.",
          offerHelpDesk: true,
          confidence: "unknown",
          relatedQuestion: message,
        },
      ]);
      setActiveHelpIndex(prior.length);
    } finally {
      setLoading(false);
    }
  }

  async function submitHelpDesk(question: string, assistantPreview: string, confidence?: string) {
    if (!question.trim() || submittingDesk) return;
    setSubmittingDesk(true);
    try {
      const result = await governance.submitHelpDesk(
        {
          question,
          user_email: user?.email ?? "",
          user_name: user?.name ?? "",
          page_context: "assistant",
          assistant_confidence: confidence ?? "unknown",
          assistant_preview: assistantPreview.slice(0, 500),
        },
        apiKey || undefined,
      );
      setHistory((h) =>
        h.map((m) =>
          m.relatedQuestion === question && m.offerHelpDesk
            ? { ...m, helpDeskSubmitted: true }
            : m,
        ),
      );
      setHistory((h) => [
        ...h,
        {
          role: "assistant",
          content: result.message,
        },
      ]);
      setActiveHelpIndex(null);
      setHelpDeskNotes("");
    } catch (e) {
      setHistory((h) => [
        ...h,
        {
          role: "assistant",
          content:
            e instanceof Error
              ? `Help desk submission failed: ${e.message}`
              : "Help desk submission failed.",
        },
      ]);
    } finally {
      setSubmittingDesk(false);
    }
  }

  function HelpDeskPanel({
    question,
    assistantPreview,
    confidence,
  }: {
    question: string;
    assistantPreview: string;
    confidence?: AssistantConfidence;
  }) {
    return (
      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-950/40">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-900 dark:text-amber-200">
          <LifeBuoy className="h-3.5 w-3.5" />
          Governance help desk
        </div>
        <p className="mb-2 text-[11px] text-amber-800 dark:text-amber-300">
          A data governance expert will review your question. We typically respond within one business day.
        </p>
        <p className="mb-2 line-clamp-2 text-[10px] text-amber-700/80 dark:text-amber-400/80">
          <span className="font-medium">Your question:</span> {question}
        </p>
        <textarea
          value={helpDeskNotes}
          onChange={(e) => setHelpDeskNotes(e.target.value)}
          rows={2}
          placeholder="Add context for the expert (optional)..."
          className="mb-2 w-full rounded border border-amber-200/80 bg-white px-2 py-1.5 text-xs dark:border-amber-700 dark:bg-slate-900 dark:text-slate-200"
        />
        <Button
          className="w-full text-xs"
          disabled={submittingDesk}
          onClick={() =>
            submitHelpDesk(
              helpDeskNotes.trim()
                ? `${question}\n\nAdditional context: ${helpDeskNotes.trim()}`
                : question,
              assistantPreview,
              confidence,
            )
          }
        >
          {submittingDesk ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <>
              <LifeBuoy className="h-3.5 w-3.5" /> Submit to help desk
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-indigo-700"
          aria-label="Open governance assistant"
        >
          <MessageCircle className="h-5 w-5" />
          Ask assistant
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[min(560px,80vh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 bg-indigo-600 px-4 py-3 text-white dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <div>
                <p className="text-sm font-semibold">Governance assistant</p>
                <p className="text-[10px] text-indigo-200">Catalog-grounded · no guessing</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 hover:bg-indigo-500"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
            Answers use only your saved catalog. Unknown or out-of-scope questions can be escalated to experts.
          </p>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {history.map((turn, i) => (
              <div key={`${turn.role}-${i}`}>
                <div
                  className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      turn.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {turn.content}
                    {turn.role === "assistant" && turn.confidence && turn.confidence !== "high" && (
                      <p className="mt-1.5 text-[10px] opacity-70">
                        Confidence: {turn.confidence}
                      </p>
                    )}
                    {turn.helpDeskSubmitted && (
                      <p className="mt-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        Submitted to help desk
                      </p>
                    )}
                  </div>
                </div>
                {turn.role === "assistant" &&
                  turn.offerHelpDesk &&
                  !turn.helpDeskSubmitted &&
                  activeHelpIndex === i &&
                  turn.relatedQuestion && (
                    <HelpDeskPanel
                      question={turn.relatedQuestion}
                      assistantPreview={turn.content}
                      confidence={turn.confidence}
                    />
                  )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                  <Spinner className="h-4 w-4" />
                </div>
              </div>
            )}
          </div>

          {history.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2 dark:border-slate-700">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="rounded-full border border-slate-200 px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 p-3 dark:border-slate-700">
            {!usesOfflineData && (
              <label className="mb-2 flex items-center gap-2 text-[10px] text-slate-500">
                <input
                  type="checkbox"
                  checked={useLlm}
                  onChange={(e) => setUseLlm(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                Use local LLM (Ollama) — JSON guardrails enabled
              </label>
            )}
            {lastUserQuestion && (
              <button
                type="button"
                onClick={() => {
                  setHistory((h) => {
                    const next: ChatMessage[] = [
                      ...h,
                      {
                        role: "assistant",
                        content:
                          "You can submit your last question to the governance help desk for an expert answer.",
                        offerHelpDesk: true,
                        confidence: "unknown",
                        relatedQuestion: lastUserQuestion,
                      },
                    ];
                    setActiveHelpIndex(next.length - 1);
                    return next;
                  });
                }}
                className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-1.5 text-[10px] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <LifeBuoy className="h-3 w-3" />
                Escalate last question to help desk
              </button>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about readiness, DQ rules, lineage..."
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
