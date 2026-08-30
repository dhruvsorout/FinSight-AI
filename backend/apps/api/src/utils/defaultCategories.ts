type CategoryKind = "income" | "expense";

export const DEFAULT_CATEGORIES: Array<{ name: string; type: CategoryKind }> = [
  { name: "Salary", type: "income" },
  { name: "Freelance", type: "income" },
  { name: "Investments", type: "income" },
  { name: "Food & Dining", type: "expense" },
  { name: "Groceries", type: "expense" },
  { name: "Transportation", type: "expense" },
  { name: "Rent", type: "expense" },
  { name: "Utilities", type: "expense" },
  { name: "Entertainment", type: "expense" },
  { name: "Healthcare", type: "expense" },
  { name: "Shopping", type: "expense" },
  { name: "Travel", type: "expense" }
];
