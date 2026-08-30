"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { InsightsResponse, Anomaly } from "@/types";
import {
  Lightbulb, RefreshCw, AlertTriangle, Sparkles,
  TrendingUp, CheckCircle, Clock, Wifi
} from "lucide-react";
import { format } from "date-fns";

const severityConfig = {
  low: { color: "border-warning/50 bg-warning/10 text-warning-foreground", icon: AlertTriangle },
  medium: { color: "border-orange-500/50 bg-orange-500/10 text-orange-500", icon: AlertTriangle },
  high: { color: "border-destructive/50 bg-destructive/10 text-destructive-foreground", icon: AlertTriangle },
};

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const cfg = severityConfig[anomaly.severity] || severityConfig.low;
  const Icon = cfg.icon;
  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${cfg.color}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium">{anomaly.label}</p>
        <p className="text-xs opacity-70 mt-0.5">{anomaly.detail}</p>
      </div>
      <span className="ml-auto text-xs opacity-50 capitalize shrink-0 font-medium">{anomaly.severity}</span>
    </div>
  );
}

export default function InsightsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly");
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, period]);

  const fetchInsights = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get(`/insights?period=${period}`);
      setInsights(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e?.response?.data?.error?.message || "Failed to load insights");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !isAuthenticated) return null;

  const providerLabel = insights?.data?.provider === "gemini" ? "Gemini AI" : "Rule-based";
  const isGemini = insights?.data?.provider === "gemini";

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Insights</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Intelligent analysis of your spending patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period toggle */}
          <div className="flex bg-muted rounded-md p-1">
            {(["monthly", "weekly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-sm text-sm font-medium transition-all ${
                  period === p
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                id={`period-${p}`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="md"
            onClick={fetchInsights}
            id="refresh-insights"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive font-medium">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-32 bg-muted rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : insights ? (
        <>
          {/* Meta bar */}
          <div className="flex flex-wrap items-center gap-3 mb-6 text-xs text-muted-foreground font-medium">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(insights.dateRange.start), "MMM d")} –{" "}
              {format(new Date(insights.dateRange.end), "MMM d, yyyy")}
            </div>
            <div className="flex items-center gap-1.5">
              {isGemini ? <Wifi className="h-3.5 w-3.5 text-primary" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span className={isGemini ? "text-primary" : ""}>
                {providerLabel}
              </span>
            </div>
            {insights.cached && (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-success" />
                <span className="text-success">Cached</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Summary */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <Lightbulb className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle>Summary</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-foreground/80 leading-relaxed text-[15px]">
                  {insights.data.summary}
                </p>
              </CardContent>
            </Card>

            {/* Suggestions */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-md bg-success/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-success" />
                  </div>
                  <CardTitle>Recommendations</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {insights.data.suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No suggestions at this time.</p>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {insights.data.suggestions.map((s, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex-shrink-0 h-6 w-6 rounded-full bg-success/10 border border-success/20 flex items-center justify-center text-xs text-success font-bold">
                          {i + 1}
                        </span>
                        <p className="text-sm text-foreground/80 leading-relaxed">{s}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            {/* Anomalies */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-md bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                  <CardTitle>Flagged Anomalies</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {insights.data.anomalies.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 text-success/50" />
                    <p className="text-sm">No anomalies detected — looking good!</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {insights.data.anomalies.map((a, i) => (
                      <AnomalyCard key={i} anomaly={a} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
          <Lightbulb className="h-12 w-12 opacity-20" />
          <p>No insights yet. Click Refresh to generate.</p>
        </div>
      )}
    </AppLayout>
  );
}
