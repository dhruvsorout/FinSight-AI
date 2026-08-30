"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import api from "@/lib/api";
import { Account, Transaction } from "@/types";
import { formatCurrency, formatRelativeDate } from "@/lib/utils";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, ArrowLeftRight,
  Wallet, RefreshCw
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

// Chart color palette
const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8", "#4f46e5"];

interface DashboardStats {
  totalBalance: number;
  income: number;
  expenses: number;
  netFlow: number;
}

interface DailySpend { date: string; income: number; expenses: number }
interface CategorySpend { name: string; value: number }

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover text-popover-foreground p-3 shadow-md">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyData, setDailyData] = useState<DailySpend[]>([]);
  const [categoryData, setCategoryData] = useState<CategorySpend[]>([]);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchDashboardData();
  }, [isAuthenticated]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const start = startOfMonth(new Date()).toISOString();
      const end = endOfMonth(new Date()).toISOString();

      const [txRes, accountsRes] = await Promise.all([
        api.get(`/transactions?startDate=${start}&endDate=${end}&pageSize=100`),
        api.get("/accounts"),
      ]);

      const transactions: Transaction[] = txRes.data.data;
      const accts: Account[] = accountsRes.data.data;
      setAccounts(accts);
      setRecentTx(transactions.slice(0, 8));

      // Compute stats
      let income = 0, expenses = 0;
      transactions.forEach((t) => {
        if (t.amount > 0) income += t.amount;
        else expenses += Math.abs(t.amount);
      });
      const totalBalance = accts.reduce((sum, a) => sum + a.balance, 0);
      setStats({ totalBalance, income, expenses, netFlow: income - expenses });

      // Daily chart data (last 14 days)
      const daily: Record<string, DailySpend> = {};
      for (let i = 13; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "MMM d");
        daily[d] = { date: d, income: 0, expenses: 0 };
      }
      transactions.forEach((t) => {
        const d = format(new Date(t.date), "MMM d");
        if (daily[d]) {
          if (t.amount > 0) daily[d].income += t.amount;
          else daily[d].expenses += Math.abs(t.amount);
        }
      });
      setDailyData(Object.values(daily));

      // Category breakdown
      const catMap: Record<string, number> = {};
      transactions.filter((t) => t.amount < 0).forEach((t) => {
        const name = t.category?.name || "Uncategorized";
        catMap[name] = (catMap[name] || 0) + Math.abs(t.amount);
      });
      const sorted = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value]) => ({ name, value }));
      setCategoryData(sorted);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !isAuthenticated) return null;

  const statCards = stats
    ? [
        {
          label: "Total Balance",
          value: formatCurrency(stats.totalBalance),
          sub: `${accounts.length} accounts`,
          icon: Wallet,
          color: "text-primary",
          bg: "bg-primary/10",
        },
        {
          label: "Monthly Income",
          value: formatCurrency(stats.income),
          sub: "This month",
          icon: TrendingUp,
          color: "text-success",
          bg: "bg-success/10",
        },
        {
          label: "Monthly Expenses",
          value: formatCurrency(stats.expenses),
          sub: "This month",
          icon: TrendingDown,
          color: "text-destructive",
          bg: "bg-destructive/10",
        },
        {
          label: "Net Cash Flow",
          value: formatCurrency(Math.abs(stats.netFlow)),
          sub: stats.netFlow >= 0 ? "Surplus" : "Deficit",
          icon: DollarSign,
          color: stats.netFlow >= 0 ? "text-success" : "text-destructive",
          bg: stats.netFlow >= 0 ? "bg-success/10" : "bg-destructive/10",
          prefix: stats.netFlow >= 0 ? "+" : "-",
        },
      ]
    : [];

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(), "MMMM yyyy")} overview
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border"
          id="refresh-dashboard"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6">
                  <div className="h-16 bg-muted rounded-md" />
                </CardContent>
              </Card>
            ))
          : statCards.map(({ label, value, sub, icon: Icon, color, bg, prefix }) => (
              <Card key={label} className="group hover:border-border/80 transition-colors duration-300">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                        {label}
                      </p>
                      <p className="text-2xl font-bold text-foreground tabular-nums">
                        {prefix}{value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                    </div>
                    <div className={`${bg} p-2.5 rounded-lg`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Area chart – daily income vs expenses */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Spending Over Time</CardTitle>
            <p className="text-xs text-muted-foreground">Last 14 days</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 bg-muted rounded-md animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="income" name="Income" stroke="hsl(var(--success))" strokeWidth={2} fill="hsl(var(--success)/0.1)" dot={false} />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(var(--destructive))" strokeWidth={2} fill="hsl(var(--destructive)/0.1)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie chart – spending by category */}
        <Card>
          <CardHeader>
            <CardTitle>By Category</CardTitle>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardHeader>
          <CardContent>
            {isLoading || !categoryData.length ? (
              <div className="h-48 bg-muted rounded-md animate-pulse" />
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => formatCurrency(Number(val))}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1.5 mt-2">
                  {categoryData.slice(0, 4).map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">{c.name}</span>
                      </div>
                      <span className="text-xs font-medium text-foreground">{formatCurrency(c.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: recent transactions + accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent transactions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-4">
            <CardTitle>Recent Transactions</CardTitle>
            <button
              onClick={() => router.push("/transactions")}
              className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              View all →
            </button>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />
                ))}
              </div>
            ) : recentTx.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <ArrowLeftRight className="h-8 w-8 opacity-20" />
                <p className="text-sm">No transactions this month</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {recentTx.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-3 group">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-md flex items-center justify-center text-xs font-bold
                        ${tx.amount > 0 ? "bg-success/10 text-success" : "bg-secondary text-secondary-foreground"}`}>
                        {tx.description.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-foreground font-medium truncate max-w-[180px]">
                          {tx.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tx.category?.name || "Uncategorized"} · {formatRelativeDate(tx.date)}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${tx.amount > 0 ? "text-success" : "text-foreground"}`}>
                      {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded-md animate-pulse" />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No accounts yet</p>
            ) : (
              <div className="flex flex-col gap-3">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between p-3 rounded-md border bg-card transition-colors hover:bg-accent/50"
                  >
                    <div>
                      <p className="text-sm text-foreground font-medium">{acc.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{acc.type}</p>
                    </div>
                    <p className={`text-sm font-bold tabular-nums ${acc.balance >= 0 ? "text-foreground" : "text-destructive"}`}>
                      {formatCurrency(acc.balance)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
