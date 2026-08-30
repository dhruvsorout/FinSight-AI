"use client";

import { useEffect, useState, useRef, FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { QueryResponse } from "@/types";
import { formatCurrency } from "@/lib/utils";
import {
  MessageSquare, Send, Sparkles, Wifi, Database,
  CornerDownLeft, Loader2
} from "lucide-react";
import { AxiosError } from "axios";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  result?: QueryResponse["result"];
  groundedQuery?: QueryResponse["groundedQuery"];
  isLoading?: boolean;
  error?: boolean;
}

const EXAMPLE_QUESTIONS = [
  "How much did I spend on food last month?",
  "What is my total income this month?",
  "How many transactions did I make last week?",
  "What's my average transaction amount?",
  "Which category did I spend the most on?",
];

export default function QueryPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || isSending) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: question,
    };
    const thinkingMsg: ChatMessage = {
      id: `${Date.now()}-thinking`,
      role: "assistant",
      content: "",
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setInput("");
    setIsSending(true);

    try {
      const res = await api.post("/query", { question });
      const data: QueryResponse = res.data;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingMsg.id
            ? {
                ...m,
                isLoading: false,
                content: data.answer,
                provider: data.provider,
                result: data.result,
                groundedQuery: data.groundedQuery,
              }
            : m
        )
      );
    } catch (err) {
      const e = err as AxiosError<{ error: { message: string } }>;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingMsg.id
            ? {
                ...m,
                isLoading: false,
                content: e.response?.data?.error?.message || "Something went wrong. Please try again.",
                error: true,
              }
            : m
        )
      );
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (authLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[800px]">
        {/* Header */}
        <div className="mb-4 shrink-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Ask AI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ask questions about your finances in plain English
          </p>
        </div>

        {/* Chat area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-6">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-foreground mb-2">
                    Ask anything about your finances
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Your questions are grounded in real transaction data — not AI hallucinations.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {EXAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="px-3 py-1.5 rounded-full text-xs text-muted-foreground border bg-card hover:border-primary/40 hover:text-foreground hover:bg-accent transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "user" ? (
                    <div className="max-w-[75%] px-4 py-3 rounded-2xl rounded-br-sm bg-primary text-primary-foreground text-sm">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[80%] flex flex-col gap-2">
                      <div className={`px-4 py-3 rounded-2xl rounded-bl-sm border text-sm ${
                        msg.error
                          ? "bg-destructive/10 border-destructive/20 text-destructive-foreground"
                          : "bg-muted/50 text-foreground/80"
                      }`}>
                        {msg.isLoading ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Analyzing your data…</span>
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>

                      {/* Grounded result card */}
                      {!msg.isLoading && msg.result && msg.result.value !== null && (
                        <div className="px-4 py-3 rounded-xl border bg-muted/30 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Database className="h-3.5 w-3.5" />
                            <span>Grounded result · {msg.groundedQuery?.answerLabel}</span>
                          </div>
                          <span className="text-sm font-bold text-foreground tabular-nums">
                            {typeof msg.result.value === "number"
                              ? msg.result.value < 0
                                ? `-${formatCurrency(msg.result.value)}`
                                : formatCurrency(msg.result.value)
                              : msg.result.value}
                          </span>
                        </div>
                      )}

                      {/* Provider badge */}
                      {!msg.isLoading && msg.provider && (
                        <div className="flex items-center gap-1.5">
                          {msg.provider === "gemini" ? (
                            <Wifi className="h-3 w-3 text-primary" />
                          ) : (
                            <Sparkles className="h-3 w-3 text-muted-foreground opacity-50" />
                          )}
                          <span className={`text-xs ${msg.provider === "gemini" ? "text-primary/80" : "text-muted-foreground/50"}`}>
                            {msg.provider === "gemini" ? "AI-powered" : "Rule-based"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t p-4">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                ref={inputRef}
                id="query-input"
                type="text"
                placeholder="Ask about your finances…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isSending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              />
              <Button
                type="submit"
                disabled={!input.trim() || isSending}
                isLoading={isSending}
                className="shrink-0 w-10 h-10 !px-0"
                id="query-submit"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <div className="flex items-center gap-1.5 mt-2 px-1">
              <CornerDownLeft className="h-3 w-3 text-muted-foreground opacity-50" />
              <span className="text-xs text-muted-foreground opacity-70">
                Press Enter to send · Answers are grounded in your real data
              </span>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
