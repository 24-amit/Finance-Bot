import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/config";
import "./Goals.css";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function Goals() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "0",
    targetDate: "",
    description: "",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (!currentUser) navigate("/login", { replace: true });
    });

    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!user) {
      setGoals([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const goalsRef = collection(db, "users", user.uid, "goals");

    const unsubscribe = onSnapshot(
      goalsRef,
      (snapshot) => {
        setGoals(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })),
        );
        setLoading(false);
      },
      (err) => {
        console.error("Goals loading error:", err);
        setError("Could not load goals. Check your Firestore rules.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  const totals = useMemo(() => {
    return goals.reduce(
      (result, goal) => {
        result.target += Number(goal.targetAmount) || 0;
        result.saved += Number(goal.currentAmount) || 0;
        return result;
      },
      { target: 0, saved: 0 },
    );
  }, [goals]);

  const setField = (event) => {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  };

  const createGoal = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!user) return;

    const targetAmount = Number(form.targetAmount);
    const currentAmount = Number(form.currentAmount);

    if (!form.name.trim()) {
      setError("Enter a name for your goal.");
      return;
    }

    if (
      !Number.isFinite(targetAmount) ||
      targetAmount <= 0 ||
      !Number.isFinite(currentAmount) ||
      currentAmount < 0 ||
      currentAmount > targetAmount
    ) {
      setError(
        "Enter a valid target and savings amount. Savings cannot exceed the target.",
      );
      return;
    }

    if (!form.targetDate || form.targetDate < today()) {
      setError("Choose today or a future target date.");
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "users", user.uid, "goals"), {
        name: form.name.trim(),
        description: form.description.trim(),
        targetAmount,
        currentAmount,
        targetDate: form.targetDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setForm({
        name: "",
        targetAmount: "",
        currentAmount: "0",
        targetDate: "",
        description: "",
      });

      setNotice("Financial goal created successfully.");
    } catch (err) {
      console.error("Create goal error:", err);
      setError(
        "Could not create goal. Check your connection and Firestore rules.",
      );
    } finally {
      setSaving(false);
    }
  };

  const addContribution = async (goal) => {
    if (!user) return;

    const input = window.prompt(
      `Remaining: ${money(
        Number(goal.targetAmount) - Number(goal.currentAmount),
      )}\nEnter contribution amount (₹):`,
    );

    if (input === null) return;

    const amount = Number(input);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid contribution greater than zero.");
      return;
    }

    setError("");
    setNotice("");

    // Generate the ID once so Firestore retries reuse the same ID.
    const contributionId = `goal-contribution-${crypto.randomUUID()}`;

    const goalRef = doc(db, "users", user.uid, "goals", goal.id);
    const transactionRef = doc(
      db,
      "users",
      user.uid,
      "transactions",
      contributionId,
    );

    try {
      await runTransaction(db, async (transaction) => {
        const goalSnapshot = await transaction.get(goalRef);

        if (!goalSnapshot.exists()) {
          throw new Error("GOAL_NOT_FOUND");
        }

        const currentGoal = goalSnapshot.data();
        const target = Number(currentGoal.targetAmount);
        const saved = Number(currentGoal.currentAmount);
        const remaining = target - saved;

        if (
          !Number.isFinite(target) ||
          !Number.isFinite(saved) ||
          amount <= 0 ||
          amount > remaining
        ) {
          throw new Error("INVALID_CONTRIBUTION");
        }

        const transactionSnapshot = await transaction.get(transactionRef);

        if (transactionSnapshot.exists()) {
          throw new Error("CONTRIBUTION_ALREADY_RECORDED");
        }

        const contributionDate = today();

        transaction.update(goalRef, {
          currentAmount: saved + amount,
          updatedAt: serverTimestamp(),
        });

        transaction.set(transactionRef, {
          type: "expense",
          amount,
          category: "Savings",
          description: `Savings contribution: ${currentGoal.name}`,
          date: contributionDate,
          goalId: goal.id,
          goalName: currentGoal.name,
          transactionKind: "goal_contribution",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      setNotice(
        `Added ${money(amount)} to "${goal.name}" and recorded the contribution.`,
      );
    } catch (err) {
      console.error("Contribution error:", err);

      if (err.message === "GOAL_NOT_FOUND") {
        setError("This goal no longer exists. Refresh and try again.");
      } else if (err.message === "INVALID_CONTRIBUTION") {
        setError("Contribution exceeds the remaining target or is invalid.");
      } else if (err.message === "CONTRIBUTION_ALREADY_RECORDED") {
        setError("This contribution has already been recorded.");
      } else {
        setError("Could not record the contribution. Please try again.");
      }
    }
  };

  const deleteGoal = async (goal) => {
    if (!window.confirm(`Delete the goal "${goal.name}"?`)) return;

    setError("");
    setNotice("");

    try {
      await deleteDoc(doc(db, "users", user.uid, "goals", goal.id));
      setNotice("Goal deleted.");
    } catch (err) {
      console.error("Delete goal error:", err);
      setError("Could not delete this goal.");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="goals-page">
        <p>Loading financial goals...</p>
      </div>
    );
  }

  const completedCount = goals.filter(
    (goal) => Number(goal.currentAmount) >= Number(goal.targetAmount),
  ).length;

  return (
    <main className="goals-page">
      <header className="goals-header">
        <div>
          <p className="goals-eyebrow">FINANCIAL PLANNING</p>
          <h1>Financial Goals</h1>
          <p>Turn your savings plans into measurable progress.</p>
        </div>

        <div className="goals-header-actions">
          <button
            type="button"
            className="goals-secondary-button"
            onClick={() => navigate("/dashboard")}
          >
            ← Dashboard
          </button>
        </div>
      </header>

      {error && <div className="goals-message goals-error">{error}</div>}
      {notice && <div className="goals-message goals-success">{notice}</div>}

      <section className="goals-summary">
        <article className="goals-summary-card">
          <span>Total goals</span>
          <strong>{goals.length}</strong>
        </article>
        <article className="goals-summary-card">
          <span>Total target</span>
          <strong>{money(totals.target)}</strong>
        </article>
        <article className="goals-summary-card">
          <span>Total saved</span>
          <strong>{money(totals.saved)}</strong>
        </article>
        <article className="goals-summary-card">
          <span>Goals completed</span>
          <strong>{completedCount}</strong>
        </article>
      </section>

      <section className="goals-panel">
        <h2>Create a goal</h2>
        <p className="goals-muted">
          Set a target amount and the date you want to reach it.
        </p>

        <form className="goals-form" onSubmit={createGoal}>
          <label>
            Goal name
            <input
              name="name"
              value={form.name}
              onChange={setField}
              placeholder="e.g. Emergency fund"
              maxLength={80}
              required
            />
          </label>

          <label>
            Target amount (₹)
            <input
              name="targetAmount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.targetAmount}
              onChange={setField}
              placeholder="50000"
              required
            />
          </label>

          <label>
            Already saved (₹)
            <input
              name="currentAmount"
              type="number"
              min="0"
              step="0.01"
              value={form.currentAmount}
              onChange={setField}
              required
            />
          </label>

          <label>
            Target date
            <input
              name="targetDate"
              type="date"
              min={today()}
              value={form.targetDate}
              onChange={setField}
              required
            />
          </label>

          <label className="goals-description-field">
            Description (optional)
            <input
              name="description"
              value={form.description}
              onChange={setField}
              maxLength={250}
              placeholder="What are you saving for?"
            />
          </label>

          <button
            type="submit"
            className="goals-primary-button"
            disabled={saving}
          >
            {saving ? "Creating..." : "Create financial goal"}
          </button>
        </form>
      </section>

      <section className="goals-panel">
        <h2>Your goals</h2>

        {goals.length === 0 ? (
          <p className="goals-muted">
            No goals yet. Create your first savings goal above.
          </p>
        ) : (
          <div className="goals-list">
            {goals.map((goal) => {
              const target = Number(goal.targetAmount) || 0;
              const saved = Number(goal.currentAmount) || 0;
              const remaining = Math.max(0, target - saved);
              const progress =
                target > 0 ? Math.min(100, (saved / target) * 100) : 0;
              const completed = target > 0 && saved >= target;

              return (
                <article className="goal-card" key={goal.id}>
                  <div className="goal-card-top">
                    <div>
                      <h3>{goal.name}</h3>
                      {goal.description && <p>{goal.description}</p>}
                    </div>
                    <span
                      className={`goal-status ${completed ? "goal-complete" : ""}`}
                    >
                      {completed ? "Completed" : "In progress"}
                    </span>
                  </div>

                  <div className="goal-amount-row">
                    <strong>{money(saved)}</strong>
                    <span>of {money(target)}</span>
                  </div>

                  <div
                    className="goal-progress-track"
                    role="progressbar"
                    aria-label={`${goal.name} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress)}
                  >
                    <div
                      className="goal-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="goal-details-row">
                    <span>{progress.toFixed(1)}% saved</span>
                    <span>
                      {completed
                        ? "Target achieved"
                        : `${money(remaining)} remaining`}
                    </span>
                  </div>

                  <p className="goal-target-date">
                    Target date:{" "}
                    {new Date(`${goal.targetDate}T00:00:00`).toLocaleDateString(
                      "en-IN",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      },
                    )}
                  </p>

                  <div className="goal-actions">
                    {!completed && (
                      <button
                        type="button"
                        className="goals-primary-button"
                        onClick={() => addContribution(goal)}
                      >
                        Add savings
                      </button>
                    )}
                    <button
                      type="button"
                      className="goals-delete-button"
                      onClick={() => deleteGoal(goal)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}