import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/config";
import "./Budgets.css";

const EXPENSE_CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Education",
  "Health",
  "Entertainment",
  "Rent",
  "Other",
];

const getLocalMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);

const getMonthLabel = (monthKey) => {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
};

const getTransactionMonth = (dateValue) => {
  if (!dateValue) return "";
  return String(dateValue).slice(0, 7);
};

export default function Budgets() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getLocalMonth());
  const [transactions, setTransactions] = useState([]);
  const [savedLimits, setSavedLimits] = useState({});
  const [draftLimits, setDraftLimits] = useState({});
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    if (!user) return undefined;

    setTransactionsLoading(true);

    const transactionsRef = collection(db, "users", user.uid, "transactions");

    const unsubscribe = onSnapshot(
      transactionsRef,
      (snapshot) => {
        setTransactions(
          snapshot.docs.map((transactionDoc) => ({
            id: transactionDoc.id,
            ...transactionDoc.data(),
          })),
        );
        setTransactionsLoading(false);
      },
      (err) => {
        console.error("Unable to load transactions:", err);
        setError("Could not load transactions. Please refresh the page.");
        setTransactionsLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user || !selectedMonth) return undefined;

    setBudgetLoading(true);
    setError("");
    setSuccess("");

    const budgetRef = doc(db, "users", user.uid, "budgets", selectedMonth);

    const unsubscribe = onSnapshot(
      budgetRef,
      (snapshot) => {
        const limits = snapshot.exists() ? snapshot.data().limits || {} : {};

        setSavedLimits(limits);
        setDraftLimits(
          Object.fromEntries(
            EXPENSE_CATEGORIES.map((category) => [
              category,
              limits[category] == null ? "" : String(limits[category]),
            ]),
          ),
        );

        setBudgetLoading(false);
      },
      (err) => {
        console.error("Unable to load budgets:", err);
        setError("Could not load budgets. Check your Firestore rules.");
        setBudgetLoading(false);
      },
    );

    return unsubscribe;
  }, [user, selectedMonth]);

  const monthExpenses = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.type === "expense" &&
          getTransactionMonth(transaction.date) === selectedMonth,
      ),
    [transactions, selectedMonth],
  );

  const spentByCategory = useMemo(() => {
    const totals = {};

    monthExpenses.forEach((transaction) => {
      const category = transaction.category || "Other";
      const amount = Number(transaction.amount) || 0;
      totals[category] = (totals[category] || 0) + amount;
    });

    return totals;
  }, [monthExpenses]);

  const totalSpent = monthExpenses.reduce(
    (total, transaction) => total + (Number(transaction.amount) || 0),
    0,
  );

  const totalBudget = EXPENSE_CATEGORIES.reduce(
    (total, category) => total + (Number(savedLimits[category]) || 0),
    0,
  );

  const categoriesWithBudget = EXPENSE_CATEGORIES.filter(
    (category) => Number(savedLimits[category]) > 0,
  );

  const totalAllocatedSpent = categoriesWithBudget.reduce(
    (total, category) => total + (spentByCategory[category] || 0),
    0,
  );

  const remainingBudget = totalBudget - totalAllocatedSpent;
  const budgetUsage =
    totalBudget > 0 ? (totalAllocatedSpent / totalBudget) * 100 : 0;

  const handleLimitChange = (category, value) => {
    setDraftLimits((previous) => ({
      ...previous,
      [category]: value,
    }));
    setError("");
    setSuccess("");
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!user) {
      setError("Please log in to save your budgets.");
      return;
    }

    const limits = {};

    for (const category of EXPENSE_CATEGORIES) {
      const rawValue = draftLimits[category];

      if (rawValue === "" || rawValue == null) {
        limits[category] = 0;
        continue;
      }

      const amount = Number(rawValue);

      if (!Number.isFinite(amount) || amount < 0) {
        setError(`Enter a valid, non-negative budget for ${category}.`);
        return;
      }

      limits[category] = amount;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const budgetRef = doc(db, "users", user.uid, "budgets", selectedMonth);

      await setDoc(
        budgetRef,
        {
          month: selectedMonth,
          limits,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setSuccess(`Budgets saved for ${getMonthLabel(selectedMonth)}.`);
    } catch (err) {
      console.error("Unable to save budgets:", err);
      setError(
        "Could not save budgets. Check your connection and Firestore rules.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return <div className="budgets-loading">Loading your budgets...</div>;
  }

  const pageLoading = transactionsLoading || budgetLoading;

  return (
    <main className="budgets-page">
      <header className="budgets-header">
        <div>
          <p className="budgets-eyebrow">PERSONAL FINANCE</p>
          <h1>Budget Management</h1>
          <p className="budgets-subtitle">
            Set monthly spending limits and stay in control of your money.
          </p>
        </div>

        <div className="budgets-header-actions">
          <button
            type="button"
            className="budgets-secondary-button"
            onClick={() => navigate("/dashboard")}
          >
            ← Dashboard
          </button>
        </div>
      </header>

      <section className="budgets-month-panel">
        <label htmlFor="budget-month">Choose budget month</label>
        <input
          id="budget-month"
          type="month"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
        />
        <span>{getMonthLabel(selectedMonth)}</span>
      </section>

      {error && <div className="budgets-message budgets-error">{error}</div>}
      {success && (
        <div className="budgets-message budgets-success">{success}</div>
      )}

      {pageLoading ? (
        <div className="budgets-loading">
          Loading budget and spending data...
        </div>
      ) : (
        <>
          <section className="budgets-summary-grid">
            <article className="budget-summary-card">
              <span>Total allocated budget</span>
              <strong>{formatCurrency(totalBudget)}</strong>
              <small>For the selected month</small>
            </article>

            <article className="budget-summary-card">
              <span>Spent in budgeted categories</span>
              <strong>{formatCurrency(totalAllocatedSpent)}</strong>
              <small>Matched against category limits</small>
            </article>

            <article className="budget-summary-card">
              <span>Budget remaining</span>
              <strong className={remainingBudget < 0 ? "budget-negative" : ""}>
                {formatCurrency(remainingBudget)}
              </strong>
              <small>
                {remainingBudget < 0
                  ? "Over allocated budget"
                  : "Available to spend"}
              </small>
            </article>

            <article className="budget-summary-card">
              <span>Total expenses</span>
              <strong>{formatCurrency(totalSpent)}</strong>
              <small>All recorded expense categories</small>
            </article>
          </section>

          <section className="budget-overview-panel">
            <div className="budget-overview-heading">
              <div>
                <h2>Overall budget usage</h2>
                <p>Based on categories with a budget greater than zero.</p>
              </div>
              <strong>{Math.round(budgetUsage)}%</strong>
            </div>

            <div
              className="budget-progress-track overall-budget-track"
              role="progressbar"
              aria-label="Overall budget usage"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(
                100,
                Math.max(0, Math.round(budgetUsage)),
              )}
            >
              <div
                className={`budget-progress-fill ${
                  budgetUsage >= 100
                    ? "budget-progress-danger"
                    : budgetUsage >= 80
                      ? "budget-progress-warning"
                      : ""
                }`}
                style={{ width: `${Math.min(100, Math.max(0, budgetUsage))}%` }}
              />
            </div>

            {categoriesWithBudget.length === 0 ? (
              <p className="budget-neutral-note">
                Add one or more category budgets below to start tracking your
                spending.
              </p>
            ) : budgetUsage >= 100 ? (
              <p className="budget-alert budget-alert-danger">
                Your spending in budgeted categories has reached or exceeded
                your total allocated budget.
              </p>
            ) : budgetUsage >= 80 ? (
              <p className="budget-alert budget-alert-warning">
                You have used at least 80% of your total allocated budget.
              </p>
            ) : (
              <p className="budget-neutral-note">
                Your spending is currently below 80% of your allocated budget.
              </p>
            )}
          </section>

          <section className="budget-editor-panel">
            <div className="budget-section-heading">
              <div>
                <h2>Set category budgets</h2>
                <p>
                  Enter the maximum amount you plan to spend in each category.
                </p>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <div className="budget-input-grid">
                {EXPENSE_CATEGORIES.map((category) => (
                  <label className="budget-input-card" key={category}>
                    <span>{category}</span>
                    <div className="budget-input-wrapper">
                      <span>₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0"
                        value={draftLimits[category] ?? ""}
                        onChange={(event) =>
                          handleLimitChange(category, event.target.value)
                        }
                        aria-label={`${category} monthly budget`}
                      />
                    </div>
                    <small>Leave blank or enter 0 for no limit.</small>
                  </label>
                ))}
              </div>

              <button
                type="submit"
                className="budgets-save-button"
                disabled={saving}
              >
                {saving ? "Saving budgets..." : "Save monthly budgets"}
              </button>
            </form>
          </section>

          <section className="budget-tracking-panel">
            <div className="budget-section-heading">
              <div>
                <h2>Category spending progress</h2>
                <p>Live spending compared with each category's budget.</p>
              </div>
            </div>

            <div className="budget-progress-list">
              {EXPENSE_CATEGORIES.map((category) => {
                const limit = Number(savedLimits[category]) || 0;
                const spent = spentByCategory[category] || 0;
                const remaining = limit - spent;
                const percentage = limit > 0 ? (spent / limit) * 100 : 0;
                const isExceeded = limit > 0 && spent > limit;
                const isAtLimit = limit > 0 && spent >= limit;
                const isWarning = limit > 0 && percentage >= 80 && !isAtLimit;

                return (
                  <article className="budget-category-row" key={category}>
                    <div className="budget-category-top">
                      <div>
                        <h3>{category}</h3>
                        <p>
                          {formatCurrency(spent)} spent
                          {limit > 0 ? ` of ${formatCurrency(limit)}` : ""}
                        </p>
                      </div>

                      {limit > 0 ? (
                        <span
                          className={`budget-status ${
                            isExceeded
                              ? "budget-status-danger"
                              : isWarning || isAtLimit
                                ? "budget-status-warning"
                                : "budget-status-normal"
                          }`}
                        >
                          {isExceeded
                            ? "Over budget"
                            : isAtLimit
                              ? "Budget reached"
                              : isWarning
                                ? "Near limit"
                                : "On track"}
                        </span>
                      ) : (
                        <span className="budget-status budget-status-unset">
                          No budget
                        </span>
                      )}
                    </div>

                    {limit > 0 ? (
                      <>
                        <div className="budget-progress-track">
                          <div
                            className={`budget-progress-fill ${
                              isAtLimit
                                ? "budget-progress-danger"
                                : isWarning
                                  ? "budget-progress-warning"
                                  : ""
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(0, percentage))}%`,
                            }}
                          />
                        </div>

                        <div className="budget-category-bottom">
                          <span>{Math.round(percentage)}% used</span>
                          <span
                            className={remaining < 0 ? "budget-negative" : ""}
                          >
                            {remaining < 0
                              ? `${formatCurrency(Math.abs(remaining))} over budget`
                              : `${formatCurrency(remaining)} remaining`}
                          </span>
                        </div>

                        {isExceeded && (
                          <p className="budget-alert budget-alert-danger">
                            You have exceeded this category's budget by{" "}
                            {formatCurrency(Math.abs(remaining))}.
                          </p>
                        )}

                        {!isExceeded && isAtLimit && (
                          <p className="budget-alert budget-alert-danger">
                            You have reached this category's budget.
                          </p>
                        )}

                        {isWarning && (
                          <p className="budget-alert budget-alert-warning">
                            You have used at least 80% of this category's
                            budget.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="budget-neutral-note">
                        Set a budget above ₹0 to track this category. Current
                        spending: {formatCurrency(spent)}.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}