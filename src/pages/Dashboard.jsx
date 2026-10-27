import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase/config";
import "./Dashboard.css";

const categories = {
  income: ["Salary", "Freelance", "Business", "Investment", "Other"],
  expense: [
    "Food",
    "Transport",
    "Shopping",
    "Bills",
    "Education",
    "Health",
    "Entertainment",
    "Rent",
    "Other",
  ],
};

const monthYearLabel = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
};

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const emptyForm = () => ({
  type: "expense",
  amount: "",
  category: "Food",
  description: "",
  date: today(),
});

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

export default function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [budgetDoc, setBudgetDoc] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => today().slice(0, 7));
  const selectedMonthLabel = monthYearLabel(selectedMonth);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (!currentUser) {
        navigate("/login", { replace: true });
      }
    });

    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError("");

    const transactionsRef = collection(db, "users", user.uid, "transactions");

    const transactionsQuery = query(transactionsRef, orderBy("date", "desc"));

    const unsubscribe = onSnapshot(
      transactionsQuery,
      (snapshot) => {
        setTransactions(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })),
        );
        setLoading(false);
      },
      (err) => {
        console.error("Transaction loading error:", err);
        setError("Could not load transactions. Check your Firestore rules.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBudgetDoc(null);
      return undefined;
    }

    const budgetRef = doc(db, "users", user.uid, "budgets", selectedMonth);

    const unsubscribe = onSnapshot(
      budgetRef,
      (snapshot) => {
        setBudgetDoc(snapshot.exists() ? snapshot.data() : null);
      },
      (err) => {
        console.error("Budget loading error:", err);
        setError("Could not load monthly budget insights.");
      },
    );

    return unsubscribe;
  }, [user, selectedMonth]);

  const summary = useMemo(() => {
    const monthly = transactions.filter(
      (item) => item.date?.slice(0, 7) === selectedMonth,
    );

    const income = monthly
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const expenses = monthly
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      income,
      expenses,
      balance: income - expenses,
      savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
    };
  }, [transactions, selectedMonth]);

  const budgetInsights = useMemo(() => {
    const limits = budgetDoc?.limits || {};

    const budgetCategories = Object.entries(limits)
      .map(([category, value]) => ({
        category,
        limit: Number(value),
      }))
      .filter((item) => Number.isFinite(item.limit) && item.limit > 0);

    const spendingByCategory = {};

    transactions.forEach((transaction) => {
      if (
        transaction.type !== "expense" ||
        transaction.date?.slice(0, 7) !== selectedMonth
      ) {
        return;
      }

      const category = transaction.category || "Other";

      spendingByCategory[category] =
        (spendingByCategory[category] || 0) + Number(transaction.amount || 0);
    });

    const categories = budgetCategories
      .map(({ category, limit }) => {
        const spent = spendingByCategory[category] || 0;
        const percentage = (spent / limit) * 100;

        let status = "On track";

        if (percentage > 100) {
          status = "Over budget";
        } else if (percentage >= 100) {
          status = "Budget reached";
        } else if (percentage >= 80) {
          status = "Approaching limit";
        }

        return {
          category,
          limit,
          spent,
          percentage,
          status,
          remaining: limit - spent,
        };
      })
      .sort((a, b) => b.percentage - a.percentage);

    const totalBudget = categories.reduce((sum, item) => sum + item.limit, 0);

    const totalSpent = categories.reduce((sum, item) => sum + item.spent, 0);

    return {
      categories,
      totalBudget,
      totalSpent,
      remaining: totalBudget - totalSpent,
      overBudgetCount: categories.filter((item) => item.percentage > 100)
        .length,
      nearingCount: categories.filter(
        (item) => item.percentage >= 80 && item.percentage < 100,
      ).length,
      reachedCount: categories.filter((item) => item.percentage === 100).length,
    };
  }, [budgetDoc, transactions, selectedMonth]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setError("");
    setSuccess("");
  };

  const handleTypeChange = (type) => {
    setForm({
      ...form,
      type,
      category: categories[type][0],
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user || saving) return;

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    if (!form.date || !form.category) {
      setError("Please complete all required fields.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const data = {
      type: form.type,
      amount,
      category: form.category,
      description: form.description.trim(),
      date: form.date,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(
          doc(db, "users", user.uid, "transactions", editingId),
          data,
        );
        setSuccess("Transaction updated successfully.");
      } else {
        await addDoc(collection(db, "users", user.uid, "transactions"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        setSuccess("Transaction added successfully.");
      }

      setForm(emptyForm());
      setEditingId(null);
    } catch (err) {
      console.error("Transaction save error:", err);
      setError("Unable to save the transaction. Check Firestore rules.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (transaction) => {
    setEditingId(transaction.id);
    setForm({
      type: transaction.type,
      amount: String(transaction.amount),
      category: transaction.category,
      description: transaction.description || "",
      date: transaction.date,
    });
    setError("");
    setSuccess("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!user) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this transaction?",
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await deleteDoc(doc(db, "users", user.uid, "transactions", id));

      if (editingId === id) resetForm();
      setSuccess("Transaction deleted successfully.");
    } catch (err) {
      console.error("Transaction delete error:", err);
      setError("Unable to delete this transaction.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout error:", err);
      setError("Unable to log out. Please try again.");
    }
  };

  if (authLoading || !user) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div className="brand">
          <div className="brand-icon">₹</div>
          <div>
            <h1>MoneyMate</h1>
            <p>Personal Finance Dashboard</p>
          </div>
        </div>

        <div className="header-user">
          <div className="user-details">
            <strong>{user.displayName || "Welcome"}</strong>
            <span>{user.email}</span>
          </div>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="dashboard-content">
        <div className="welcome-section">
          <div>
            <p className="eyebrow">YOUR FINANCES AT A GLANCE</p>
            <h2>Welcome back!</h2>
            <p>Here is your financial overview for {selectedMonthLabel}.</p>
          </div>
          <input
            id="dashboard-month"
            className="month-label"
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            aria-label="Choose dashboard month and year"
          />
          <div className="dashboard-action-buttons">
            <button
              className="analytics-link-button"
              onClick={() => navigate("/analytics")}
            >
              View Analytics →
            </button>

            <button
              className="analytics-link-button"
              onClick={() => navigate("/budgets")}
            >
              Manage Budgets →
            </button>
            <button
              className="analytics-link-button"
              onClick={() => navigate("/recurring-transactions")}
            >
              Recurring Transactions →
            </button>
            <button
              type="button"
              className="analytics-link-button"
              onClick={() => navigate("/goals")}
            >
              Financial Goals →
            </button>
          </div>
        </div>

        <section className="summary-grid">
          <article className="summary-card income-card">
            <span className="summary-icon">↗</span>
            <p>Total Income</p>
            <h3>{money(summary.income)}</h3>
            <span>{selectedMonthLabel}</span>
          </article>

          <article className="summary-card expense-card">
            <span className="summary-icon">↘</span>
            <p>Total Expenses</p>
            <h3>{money(summary.expenses)}</h3>
            <span>{selectedMonthLabel}</span>
          </article>

          <article className="summary-card balance-card">
            <span className="summary-icon">₹</span>
            <p>Net Balance</p>
            <h3>{money(summary.balance)}</h3>
            <span>Income minus expenses</span>
          </article>

          <article className="summary-card savings-card">
            <span className="summary-icon">%</span>
            <p>Savings Rate</p>
            <h3>
              {summary.income > 0 ? `${summary.savingsRate.toFixed(1)}%` : "—"}
            </h3>
            <span>Based on monthly income</span>
          </article>
        </section>

        <section className="budget-insights-panel">
          <div className="budget-insights-header">
            <div>
              <p className="eyebrow">MONTHLY SPENDING MONITOR</p>
              <h3>Budget Insights</h3>
              <p className="budget-insights-description">
                Monitor your spending against your monthly limits.
              </p>
            </div>

            <button
              type="button"
              className="analytics-link-button"
              onClick={() => navigate("/budgets")}
            >
              View Budgets →
            </button>
          </div>

          {!budgetDoc || budgetInsights.categories.length === 0 ? (
            <div className="budget-insights-empty">
              <div className="empty-icon">₹</div>
              <h4>No monthly budgets found</h4>
              <p>
                Create category budgets to monitor spending and receive budget
                alerts here.
              </p>
              <button
                type="button"
                className="budget-outline-button"
                onClick={() => navigate("/budgets")}
              >
                Create a Budget
              </button>
            </div>
          ) : (
            <>
              <div className="budget-metrics-grid">
                <article className="budget-metric">
                  <span>Total Budget</span>
                  <strong>{money(budgetInsights.totalBudget)}</strong>
                </article>

                <article className="budget-metric">
                  <span>Budgeted Spending</span>
                  <strong>{money(budgetInsights.totalSpent)}</strong>
                </article>

                <article className="budget-metric">
                  <span>Remaining Budget</span>
                  <strong
                    className={
                      budgetInsights.remaining < 0
                        ? "budget-negative"
                        : "budget-positive"
                    }
                  >
                    {money(budgetInsights.remaining)}
                  </strong>
                </article>
              </div>

              <div className="budget-alert-counts">
                <span className="budget-alert-pill budget-alert-warning">
                  {budgetInsights.nearingCount} nearing limit
                </span>
                <span className="budget-alert-pill budget-alert-reached">
                  {budgetInsights.reachedCount} reached limit
                </span>
                <span className="budget-alert-pill budget-alert-danger">
                  {budgetInsights.overBudgetCount} over budget
                </span>
              </div>

              <div className="budget-category-list">
                {budgetInsights.categories.map((item) => {
                  const progress = Math.min(item.percentage, 100);

                  const statusClass =
                    item.status === "Over budget"
                      ? "over"
                      : item.status === "Budget reached"
                        ? "reached"
                        : item.status === "Approaching limit"
                          ? "warning"
                          : "normal";

                  return (
                    <article
                      className="budget-category-item"
                      key={item.category}
                    >
                      <div className="budget-category-top">
                        <div>
                          <strong>{item.category}</strong>
                          <p>
                            {money(item.spent)} of {money(item.limit)}
                          </p>
                        </div>

                        <span className={`budget-status ${statusClass}`}>
                          {item.status}
                        </span>
                      </div>

                      <div
                        className="budget-progress-track"
                        role="progressbar"
                        aria-label={`${item.category} budget usage`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(
                          Math.round(item.percentage),
                          100,
                        )}
                      >
                        <div
                          className={`budget-progress-fill ${statusClass}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="budget-category-bottom">
                        <span>{item.percentage.toFixed(1)}% used</span>
                        <span>
                          {item.remaining >= 0
                            ? `${money(item.remaining)} remaining`
                            : `${money(Math.abs(item.remaining))} over`}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {error && <div className="message error-message">{error}</div>}
        {success && <div className="message success-message">{success}</div>}

        <section className="dashboard-main-grid">
          <article className="panel transaction-form-panel">
            <div className="panel-heading">
              <div>
                <h3>{editingId ? "Edit Transaction" : "Add Transaction"}</h3>
                <p>Record your income or expenses.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="transaction-form">
              <label>Transaction Type</label>
              <div className="type-selector">
                <button
                  type="button"
                  className={
                    form.type === "income" ? "type-active income-active" : ""
                  }
                  onClick={() => handleTypeChange("income")}
                >
                  + Income
                </button>
                <button
                  type="button"
                  className={
                    form.type === "expense" ? "type-active expense-active" : ""
                  }
                  onClick={() => handleTypeChange("expense")}
                >
                  − Expense
                </button>
              </div>

              <label htmlFor="amount">Amount (₹)</label>
              <input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Enter amount"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />

              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
              >
                {categories[form.type].map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <label htmlFor="date">Date</label>
              <input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />

              <label htmlFor="description">Description (optional)</label>
              <input
                id="description"
                type="text"
                maxLength="120"
                placeholder="e.g. Monthly groceries"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />

              <button className="submit-button" type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Transaction"
                    : "Add Transaction"}
              </button>

              {editingId && (
                <button
                  className="cancel-button"
                  type="button"
                  onClick={resetForm}
                >
                  Cancel Editing
                </button>
              )}
            </form>
          </article>

          <article className="panel transactions-panel">
            <div className="panel-heading">
              <div>
                <h3>Recent Transactions</h3>
                <p>Your latest recorded transactions.</p>
              </div>
              <span className="transaction-count">{transactions.length}</span>
            </div>

            {loading ? (
              <div className="empty-state">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">₹</div>
                <h4>No transactions yet</h4>
                <p>Add your first income or expense using the form.</p>
              </div>
            ) : (
              <div className="transaction-list">
                {transactions.map((transaction) => (
                  <div className="transaction-row" key={transaction.id}>
                    <div className={`transaction-icon ${transaction.type}`}>
                      {transaction.type === "income" ? "↗" : "↘"}
                    </div>

                    <div className="transaction-info">
                      <strong>
                        {transaction.description || transaction.category}
                      </strong>
                      <span>
                        {transaction.category} · {transaction.date}
                      </span>
                    </div>

                    <div className="transaction-actions">
                      <strong
                        className={
                          transaction.type === "income"
                            ? "amount-income"
                            : "amount-expense"
                        }
                      >
                        {transaction.type === "income" ? "+" : "−"}
                        {money(Number(transaction.amount))}
                      </strong>
                      <div>
                        <button
                          type="button"
                          className="small-action"
                          onClick={() => handleEdit(transaction)}
                          aria-label="Edit transaction"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="small-action delete-action"
                          onClick={() => handleDelete(transaction.id)}
                          aria-label="Delete transaction"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        <footer className="dashboard-footer">
          MoneyMate · Your finances, organized.
        </footer>
      </section>

      <button
        type="button"
        className="dashboard-assistant-fab"
        onClick={() => navigate("/assistant")}
        aria-label="Open MoneyMate AI Assistant"
        title="Ask MoneyMate AI"
      >
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M10 7.5h12a5 5 0 0 1 5 5v7a5 5 0 0 1-5 5h-5l-5 3v-3h-2a5 5 0 0 1-5-5v-7a5 5 0 0 1 5-5Z" />
          <path d="M12 15v.1M20 15v.1M12 19c2.3 2 5.7 2 8 0" />
          <path d="M16 3.5v4M14 3.5h4" />
        </svg>
      </button>
    </main>
  );
}
