import { useRef } from "react";
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
import "./RecurringTransactions.css";

const CATEGORIES = {
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

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const todayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatDate = (dateString) => {
  if (!dateString) return "Not scheduled";
  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

const getNextDate = (dateString, frequency) => {
  const date = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  if (frequency === "weekly") {
    date.setDate(date.getDate() + 7);
  } else if (frequency === "monthly") {
    const originalDay = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + 1);
    const lastDay = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
    ).getDate();
    date.setDate(Math.min(originalDay, lastDay));
  } else if (frequency === "yearly") {
    const originalMonth = date.getMonth();
    const originalDay = date.getDate();
    date.setFullYear(date.getFullYear() + 1);
    if (date.getMonth() !== originalMonth) {
      date.setDate(0);
    } else {
      date.setDate(originalDay);
    }
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function RecurringTransactions() {
  const navigate = useNavigate();
  const processingRef = useRef(new Set());

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );

  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    category: "Food",
    description: "",
    frequency: "monthly",
    nextDate: todayString(),
  });

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

    setLoading(true);

    const schedulesRef = collection(
      db,
      "users",
      user.uid,
      "recurringTransactions",
    );

    const unsubscribe = onSnapshot(
      schedulesRef,
      (snapshot) => {
        setSchedules(
          snapshot.docs.map((scheduleDoc) => ({
            id: scheduleDoc.id,
            ...scheduleDoc.data(),
          })),
        );
        setLoading(false);
      },
      (err) => {
        console.error("Unable to load recurring schedules:", err);
        setError(
          "Could not load recurring schedules. Check your Firestore rules.",
        );
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user || loading) return undefined;

    let cancelled = false;

    const processDueSchedules = async () => {
      const today = todayString();

      for (const schedule of schedules) {
        if (cancelled) return;
        if (schedule.active === false) continue;
        if (!schedule.nextDate || schedule.nextDate > today) continue;
        if (processingRef.current.has(schedule.id)) continue;

        processingRef.current.add(schedule.id);

        try {
          const scheduleRef = doc(
            db,
            "users",
            user.uid,
            "recurringTransactions",
            schedule.id,
          );

          const transactionsRef = collection(
            db,
            "users",
            user.uid,
            "transactions",
          );

          // Limit catch-up work per schedule per effect run.
          // If more occurrences remain overdue, a later run can continue.
          for (let count = 0; count < 100; count += 1) {
            if (cancelled) break;

            const result = await runTransaction(db, async (transaction) => {
              const scheduleSnapshot = await transaction.get(scheduleRef);

              if (!scheduleSnapshot.exists()) {
                return { done: true };
              }

              const current = scheduleSnapshot.data();

              if (
                current.active === false ||
                !current.nextDate ||
                current.nextDate > today
              ) {
                return { done: true };
              }

              const dueDate = current.nextDate;
              const nextDate = getNextDate(dueDate, current.frequency);

              if (!nextDate || nextDate <= dueDate) {
                throw new Error(
                  `Invalid next date for schedule ${schedule.id}`,
                );
              }

              // Stable document ID: one occurrence per schedule and due date.
              const occurrenceId = `${schedule.id}_${dueDate}`;
              const occurrenceRef = doc(transactionsRef, occurrenceId);

              const occurrenceSnapshot = await transaction.get(occurrenceRef);

              // Create the transaction only if this occurrence does not exist.
              if (!occurrenceSnapshot.exists()) {
                transaction.set(occurrenceRef, {
                  type: current.type,
                  amount: Number(current.amount),
                  category: current.category,
                  description: current.description,
                  date: dueDate,
                  recurringScheduleId: schedule.id,
                  recurringDueDate: dueDate,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }

              // Advance the schedule atomically with the occurrence write.
              transaction.update(scheduleRef, {
                nextDate,
                updatedAt: serverTimestamp(),
              });

              return { done: false, nextDate };
            });

            if (result.done) break;
          }
        } catch (err) {
          console.error(
            `Failed to process recurring schedule ${schedule.id}:`,
            err,
          );

          if (!cancelled) {
            setError(
              `Could not process "${schedule.description}". Check your connection and Firestore rules.`,
            );
          }
        } finally {
          processingRef.current.delete(schedule.id);
        }
      }
    };

    processDueSchedules();

    return () => {
      cancelled = true;
    };
  }, [user, loading, schedules]);

  const upcomingSchedules = useMemo(() => {
    const today = todayString();
    const sevenDaysLater = getNextDate(today, "weekly");

    return schedules
      .filter(
        (schedule) =>
          schedule.active !== false &&
          schedule.nextDate >= today &&
          schedule.nextDate <= sevenDaysLater,
      )
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  }, [schedules]);

  useEffect(() => {
    if (notificationPermission !== "granted") return;

    upcomingSchedules.forEach((schedule) => {
      const notificationKey = `finance-reminder-${user?.uid}-${schedule.id}-${schedule.nextDate}`;

      if (localStorage.getItem(notificationKey)) return;

      const notification = new Notification("Upcoming payment reminder", {
        body: `${schedule.description || schedule.category}: ${
          schedule.type === "expense" ? "Expense" : "Income"
        } of ${formatCurrency(schedule.amount)} is due on ${formatDate(
          schedule.nextDate,
        )}.`,
        tag: notificationKey,
      });

      localStorage.setItem(notificationKey, "sent");
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    });
  }, [notificationPermission, upcomingSchedules, user]);

  const activeCount = schedules.filter(
    (schedule) => schedule.active !== false,
  ).length;

  const monthlyEstimate = schedules.reduce((total, schedule) => {
    if (schedule.active === false) return total;

    const amount = Number(schedule.amount) || 0;

    if (schedule.frequency === "weekly") return total + (amount * 52) / 12;
    if (schedule.frequency === "monthly") return total + amount;
    if (schedule.frequency === "yearly") return total + amount / 12;

    return total;
  }, 0);

  const handleTypeChange = (type) => {
    setForm((previous) => ({
      ...previous,
      type,
      category: CATEGORIES[type][0],
    }));
  };

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      setError("Your browser does not support notifications.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        setError("");
      } else if (permission === "denied") {
        setError(
          "Notifications are blocked. Enable them in your browser settings.",
        );
      }
    } catch (err) {
      console.error("Notification permission error:", err);
      setError("Could not enable browser notifications.");
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!user) {
      setError("Please log in to create a recurring schedule.");
      return;
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    if (!form.nextDate) {
      setError("Choose the first scheduled date.");
      return;
    }

    if (!form.description.trim()) {
      setError("Enter a description for this schedule.");
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "users", user.uid, "recurringTransactions"), {
        type: form.type,
        amount,
        category: form.category,
        description: form.description.trim(),
        frequency: form.frequency,
        nextDate: form.nextDate,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setForm((previous) => ({
        ...previous,
        amount: "",
        description: "",
        nextDate: todayString(),
      }));

      setSuccess("Recurring schedule created successfully.");
    } catch (err) {
      console.error("Unable to create recurring schedule:", err);
      setError("Could not save the schedule. Check your Firestore rules.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (schedule) => {
    setError("");
    setSuccess("");

    try {
      await updateDoc(
        doc(db, "users", user.uid, "recurringTransactions", schedule.id),
        {
          active: schedule.active === false,
          updatedAt: serverTimestamp(),
        },
      );

      setSuccess(
        schedule.active === false
          ? "Recurring schedule resumed."
          : "Recurring schedule paused.",
      );
    } catch (err) {
      console.error("Unable to update recurring schedule:", err);
      setError("Could not update the schedule.");
    }
  };

  const removeSchedule = async (schedule) => {
    const confirmed = window.confirm(
      `Delete the recurring schedule "${schedule.description}"?`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await deleteDoc(
        doc(db, "users", user.uid, "recurringTransactions", schedule.id),
      );
      setSuccess("Recurring schedule deleted.");
    } catch (err) {
      console.error("Unable to delete recurring schedule:", err);
      setError("Could not delete the schedule.");
    }
  };

  if (authLoading || !user) {
    return (
      <div className="recurring-loading">Loading recurring transactions...</div>
    );
  }

  return (
    <main className="recurring-page">
      <header className="recurring-header">
        <div>
          <p className="recurring-eyebrow">PERSONAL FINANCE</p>
          <h1>Recurring Transactions</h1>
          <p className="recurring-subtitle">
            Manage repeat income and expenses from one place.
          </p>
        </div>

        <div className="recurring-header-actions">
          <button
            type="button"
            className="recurring-secondary-button"
            onClick={() => navigate("/dashboard")}
          >
            ← Dashboard
          </button>
        </div>
      </header>

      {error && (
        <div className="recurring-message recurring-error">{error}</div>
      )}
      {success && (
        <div className="recurring-message recurring-success">{success}</div>
      )}

      <section className="recurring-summary-grid">
        <article className="recurring-summary-card">
          <span>Active schedules</span>
          <strong>{activeCount}</strong>
          <small>Schedules currently enabled</small>
        </article>

        <article className="recurring-summary-card">
          <span>Estimated monthly value</span>
          <strong>{formatCurrency(monthlyEstimate)}</strong>
          <small>Approximate total across active schedules</small>
        </article>

        <article className="recurring-summary-card">
          <span>Upcoming schedules</span>
          <strong>{upcomingSchedules.length}</strong>
          <small>Active schedules sorted by next date</small>
        </article>
      </section>

      <section className="recurring-panel">
        <div className="recurring-section-heading">
          <h2>Create a recurring schedule</h2>
          <p>
            Set the first due date and how often the transaction should repeat.
          </p>
        </div>

        <form className="recurring-form" onSubmit={handleCreate}>
          <div className="recurring-type-switch">
            <button
              type="button"
              className={form.type === "expense" ? "selected" : ""}
              onClick={() => handleTypeChange("expense")}
            >
              Expense
            </button>
            <button
              type="button"
              className={form.type === "income" ? "selected" : ""}
              onClick={() => handleTypeChange("income")}
            >
              Income
            </button>
          </div>

          <div className="recurring-form-grid">
            <label>
              Description
              <input
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="e.g. Monthly rent"
                maxLength={100}
                required
              />
            </label>

            <label>
              Amount (₹)
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={handleChange}
                placeholder="e.g. 12000"
                required
              />
            </label>

            <label>
              Category
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
              >
                {CATEGORIES[form.type].map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Frequency
              <select
                name="frequency"
                value={form.frequency}
                onChange={handleChange}
              >
                {FREQUENCIES.map((frequency) => (
                  <option key={frequency.value} value={frequency.value}>
                    {frequency.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              First due date
              <input
                name="nextDate"
                type="date"
                value={form.nextDate}
                onChange={handleChange}
                required
              />
            </label>
          </div>

          <button
            type="submit"
            className="recurring-primary-button"
            disabled={saving}
          >
            {saving ? "Saving schedule..." : "Create recurring schedule"}
          </button>
        </form>
      </section>

      <section className="upcoming-payments">
        <div className="upcoming-payments-header">
          <h2>Upcoming Payments</h2>

          <div className="upcoming-payments-actions">
            <span>{upcomingSchedules.length} due soon</span>

            <button
              type="button"
              className="notification-button"
              onClick={enableNotifications}
              disabled={
                notificationPermission === "granted" ||
                notificationPermission === "unsupported"
              }
            >
              {notificationPermission === "granted"
                ? "Notifications enabled"
                : notificationPermission === "denied"
                  ? "Notifications blocked"
                  : notificationPermission === "unsupported"
                    ? "Not supported"
                    : "Enable notifications"}
            </button>
          </div>
        </div>

        {upcomingSchedules.length === 0 ? (
          <p className="upcoming-empty">
            No recurring transactions due in the next 7 days.
          </p>
        ) : (
          <div className="upcoming-payments-list">
            {upcomingSchedules.map((schedule) => (
              <div className="upcoming-payment-item" key={schedule.id}>
                <div>
                  <strong>{schedule.description || schedule.category}</strong>
                  <p>
                    {schedule.category} · Due {formatDate(schedule.nextDate)}
                  </p>
                </div>

                <strong
                  className={
                    schedule.type === "expense"
                      ? "upcoming-expense"
                      : "upcoming-income"
                  }
                >
                  {schedule.type === "expense" ? "−" : "+"}
                  {formatCurrency(schedule.amount)}
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="recurring-panel">
        <div className="recurring-section-heading">
          <h2>Your schedules</h2>
          <p>Pause a schedule when needed, or delete one you no longer use.</p>
        </div>

        {loading ? (
          <div className="recurring-loading">Loading schedules...</div>
        ) : schedules.length === 0 ? (
          <div className="recurring-empty">
            <h3>No recurring schedules yet</h3>
            <p>Create your first schedule using the form above.</p>
          </div>
        ) : (
          <div className="recurring-list">
            {[...schedules]
              .sort((a, b) =>
                (a.nextDate || "").localeCompare(b.nextDate || ""),
              )
              .map((schedule) => {
                const active = schedule.active !== false;

                return (
                  <article
                    className={`recurring-item ${active ? "" : "paused"}`}
                    key={schedule.id}
                  >
                    <div className="recurring-item-main">
                      <div className="recurring-item-title">
                        <span
                          className={`recurring-type-badge ${schedule.type}`}
                        >
                          {schedule.type}
                        </span>
                        <h3>{schedule.description}</h3>
                      </div>

                      <p>
                        {schedule.category} ·{" "}
                        {schedule.frequency?.charAt(0).toUpperCase() +
                          schedule.frequency?.slice(1)}
                      </p>

                      <p className="recurring-next-date">
                        Next scheduled date: {formatDate(schedule.nextDate)}
                      </p>
                    </div>

                    <div className="recurring-item-actions">
                      <strong>{formatCurrency(schedule.amount)}</strong>
                      <span
                        className={`recurring-state ${active ? "active" : "inactive"}`}
                      >
                        {active ? "Active" : "Paused"}
                      </span>
                      <div>
                        <button
                          type="button"
                          className="recurring-pause-button"
                          onClick={() => toggleActive(schedule)}
                        >
                          {active ? "Pause" : "Resume"}
                        </button>
                        <button
                          type="button"
                          className="recurring-delete-button"
                          onClick={() => removeSchedule(schedule)}
                        >
                          Delete
                        </button>
                      </div>
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