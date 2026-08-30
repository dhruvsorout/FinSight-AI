"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import api from "@/lib/api";
import { Transaction, Account, Category, Pagination } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Plus, Pencil, Trash2, Upload, Sparkles, ChevronLeft,
  ChevronRight, Filter, X, Tag, Loader2
} from "lucide-react";
import { AxiosError } from "axios";

interface TxFormData {
  accountId: string;
  categoryId: string;
  amount: string;
  description: string;
  date: string;
}

const emptyForm: TxFormData = {
  accountId: "",
  categoryId: "",
  amount: "",
  description: "",
  date: new Date().toISOString().split("T")[0],
};

export default function TransactionsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [page, setPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  // Modals
  const [showTxDialog, setShowTxDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [form, setForm] = useState<TxFormData>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);

  // Import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importAccountId, setImportAccountId] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number; skipped: number; errors: Array<{ row: number; error: string }>;
  } | null>(null);

  // AI categorize
  const [categorizingId, setCategorizingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([
      api.get("/accounts").then((r) => setAccounts(r.data.data)),
      api.get("/categories").then((r) => setCategories(r.data.data)),
    ]);
  }, [isAuthenticated]);

  const fetchTransactions = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "15" });
      if (filterCategory && filterCategory !== "all") params.set("categoryId", filterCategory);
      if (filterAccount && filterAccount !== "all") params.set("accountId", filterAccount);
      if (filterStart) params.set("startDate", new Date(filterStart).toISOString());
      if (filterEnd) {
        const end = new Date(filterEnd);
        end.setHours(23, 59, 59, 999);
        params.set("endDate", end.toISOString());
      }
      const res = await api.get(`/transactions?${params}`);
      setTransactions(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast("Failed to load transactions", "error");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, page, filterCategory, filterAccount, filterStart, filterEnd, toast]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const openCreate = () => {
    setEditingTx(null);
    setForm({ ...emptyForm, accountId: accounts[0]?.id || "" });
    setShowTxDialog(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setForm({
      accountId: tx.accountId,
      categoryId: tx.categoryId || "",
      amount: String(tx.amount),
      description: tx.description,
      date: tx.date.split("T")[0],
    });
    setShowTxDialog(true);
  };

  const handleSave = async () => {
    if (!form.accountId || !form.amount || !form.description || !form.date) {
      toast("Please fill in all required fields", "error");
      return;
    }
    setFormLoading(true);
    try {
      const body = {
        accountId: form.accountId,
        categoryId: form.categoryId || undefined,
        amount: parseFloat(form.amount),
        description: form.description,
        date: new Date(form.date).toISOString(),
      };
      if (editingTx) {
        await api.put(`/transactions/${editingTx.id}`, body);
        toast("Transaction updated", "success");
      } else {
        await api.post("/transactions", body);
        toast("Transaction created", "success");
      }
      setShowTxDialog(false);
      fetchTransactions();
    } catch (err) {
      const e = err as AxiosError<{ error: { message: string } }>;
      toast(e.response?.data?.error?.message || "Save failed", "error");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    try {
      await api.delete(`/transactions/${id}`);
      toast("Transaction deleted", "success");
      fetchTransactions();
    } catch {
      toast("Delete failed", "error");
    }
  };

  const handleCategorize = async (txId: string) => {
    setCategorizingId(txId);
    try {
      const res = await api.post(`/transactions/${txId}/categorize`);
      const { categorization } = res.data;
      toast(
        `AI suggested: ${categorization.suggestedCategoryName} (${Math.round(categorization.confidence * 100)}% confident)`,
        "success"
      );
      fetchTransactions();
    } catch {
      toast("AI categorization failed", "error");
    } finally {
      setCategorizingId(null);
    }
  };

  const handleImport = async () => {
    if (!importFile || !importAccountId) {
      toast("Select a file and account", "error");
      return;
    }
    setImportLoading(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      fd.append("accountId", importAccountId);
      const res = await api.post("/transactions/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult(res.data);
      toast(`Imported ${res.data.imported} transactions`, "success");
      fetchTransactions();
    } catch {
      toast("Import failed", "error");
    } finally {
      setImportLoading(false);
    }
  };

  if (authLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pagination ? `${pagination.total} total` : "Loading…"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="md" onClick={() => setShowImportDialog(true)} id="import-csv-btn">
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button size="md" onClick={openCreate} id="add-transaction-btn">
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm">Filters</span>
            </div>
            <div className="w-40">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger id="filter-category" className="h-9 text-xs">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Account</label>
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger id="filter-account" className="h-9 text-xs">
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">From</label>
              <input
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                id="filter-start-date"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">To</label>
              <input
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                id="filter-end-date"
              />
            </div>
            {(filterCategory !== "all" || filterAccount !== "all" || filterStart || filterEnd) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterCategory("all");
                  setFilterAccount("all");
                  setFilterStart("");
                  setFilterEnd("");
                  setPage(1);
                }}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col divide-y divide-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 mx-6 my-2 bg-muted rounded-md animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Tag className="h-10 w-10 opacity-20" />
              <p>No transactions found</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-border text-xs text-muted-foreground uppercase tracking-wider font-medium">
                <span>Date</span>
                <span>Description</span>
                <span>Category</span>
                <span className="text-right">Amount</span>
                <span className="w-24 text-right">Actions</span>
              </div>
              <div className="divide-y divide-border">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-accent/50 transition-colors group"
                  >
                    <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                    <div>
                      <p className="text-sm text-foreground font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.account?.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {tx.category ? (
                        <span className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs border">
                          {tx.category.name}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCategorize(tx.id)}
                          disabled={categorizingId === tx.id}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent text-accent-foreground text-xs border hover:bg-accent/80 transition-colors disabled:opacity-50"
                          id={`categorize-${tx.id}`}
                        >
                          {categorizingId === tx.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                          AI categorize
                        </button>
                      )}
                      {tx.aiConfidence && (
                        <span className="text-xs text-muted-foreground" title={`AI confidence: ${Math.round(tx.aiConfidence * 100)}%`}>
                          {Math.round(tx.aiConfidence * 100)}%
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-semibold text-right tabular-nums ${tx.amount > 0 ? "text-success" : "text-foreground"}`}>
                      {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                    </span>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity w-24">
                      <button
                        onClick={() => openEdit(tx)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        id={`edit-${tx.id}`}
                        aria-label="Edit transaction"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        id={`delete-${tx.id}`}
                        aria-label="Delete transaction"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} id="prev-page">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages} id="next-page">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add/Edit Transaction Dialog */}
      <Dialog
        open={showTxDialog}
        onClose={() => setShowTxDialog(false)}
        title={editingTx ? "Edit Transaction" : "New Transaction"}
        description="Fill in the details below"
      >
        <div className="flex flex-col gap-4 mt-4">
          <Input
            label="Description *"
            id="tx-description"
            placeholder="e.g. Coffee at Starbucks"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            label="Amount *"
            id="tx-amount"
            type="number"
            placeholder="Use negative for expenses (e.g. -42.50)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">Account *</label>
            <Select value={form.accountId} onValueChange={(v) => setForm({ ...form, accountId: v })}>
              <SelectTrigger id="tx-account">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">Category</label>
            <Select value={form.categoryId || "none"} onValueChange={(v) => setForm({ ...form, categoryId: v === "none" ? "" : v })}>
              <SelectTrigger id="tx-category">
                <SelectValue placeholder="Select category (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            label="Date *"
            id="tx-date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowTxDialog(false)}>
              Cancel
            </Button>
            <Button className="flex-1" isLoading={formLoading} onClick={handleSave} id="save-transaction">
              {editingTx ? "Save Changes" : "Add Transaction"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog
        open={showImportDialog}
        onClose={() => { setShowImportDialog(false); setImportResult(null); setImportFile(null); }}
        title="Import from CSV"
        description="Upload a CSV with columns: date, description, amount"
        className="max-w-lg"
      >
        <div className="flex flex-col gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">Account *</label>
            <Select value={importAccountId} onValueChange={setImportAccountId}>
              <SelectTrigger id="import-account">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            className="relative flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-border p-8 cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
            onClick={() => document.getElementById("csv-file-input")?.click()}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            />
            <Upload className="h-8 w-8 text-muted-foreground opacity-50" />
            {importFile ? (
              <p className="text-sm text-primary font-medium">{importFile.name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Click to select CSV file</p>
            )}
            <p className="text-xs text-muted-foreground/70">date, description, amount</p>
          </div>

          {importResult && (
            <div className="rounded-md bg-muted/50 border p-4">
              <div className="flex gap-4 text-sm">
                <div className="flex flex-col items-center flex-1">
                  <span className="text-2xl font-bold text-success tabular-nums">{importResult.imported}</span>
                  <span className="text-xs text-muted-foreground">Imported</span>
                </div>
                <div className="flex flex-col items-center flex-1">
                  <span className="text-2xl font-bold text-amber-500 tabular-nums">{importResult.skipped}</span>
                  <span className="text-xs text-muted-foreground">Skipped</span>
                </div>
                <div className="flex flex-col items-center flex-1">
                  <span className="text-2xl font-bold text-destructive tabular-nums">{importResult.errors.length}</span>
                  <span className="text-xs text-muted-foreground">Errors</span>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-3 max-h-24 overflow-y-auto">
                  {importResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-400">Row {e.row}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button className="flex-1" isLoading={importLoading} onClick={handleImport} id="import-submit">
              <Upload className="h-4 w-4" />
              Import
            </Button>
          </div>
        </div>
      </Dialog>
    </AppLayout>
  );
}
