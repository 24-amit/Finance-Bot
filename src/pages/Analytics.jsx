
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { auth, db } from "../firebase/config";
import "./Analytics.css";

const COLORS = [
  "#377DFF",
  "#18A572",
  "#FF9F43",
  "#EA526F",
  "#8B5CF6",
  "#14B8A6",
  "#EAB308",
  "#64748B",
  "#EC4899",
];

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const getMonthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (key) => {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
};

function getDateRange(filter) {
  const now = new Date();
  const startOfThisMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );
  const startOfNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  );

  if (filter === "month") {
    return {
      start: getMonthKey(startOfThisMonth) + "-01",
      end: getMonthKey(startOfNextMonth) + "-01",
    };
  }

  if (filter === "lastMonth") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      start: getMonthKey(start) + "-01",
      end: getMonthKey(startOfThisMonth) + "-01",
    };
  }

  if (filter === "year") {
    return {
      start: `${now.getFullYear()}-01-01`,
      end: `${now.getFullYear() + 1}-01-01`,
    };
  }

  return { start: "", end: "" };
}

export default function Analytics() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("month");

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

    const ref = collection(db, "users", user.uid, "transactions");
    const q = query(ref, orderBy("date", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setTransactions(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
        setLoading(false);
        setError("");
      },
      (err) => {
        console.error("Analytics loading error:", err);
        setError("Could not load analytics. Check your Firestore rules.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const filteredTransactions = useMemo(() => {
    const range = getDateRange(filter);

    return transactions.filter((item) => {
      if (!item.date) return false;
      if (range.start && item.date < range.start) return false;
      if (range.end && item.date >= range.end) return false;
      return true;
    });
  }, [transactions, filter]);

  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const expenses = filteredTransactions
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      income,
      expenses,
      balance: income - expenses,
      savingsRate:
        income > 0 ? ((income - expenses) / income) * 100 : null,
    };
  }, [filteredTransactions]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    let months = [];

    if (filter === "month" || filter === "lastMonth") {
      const base = filter === "month" ? 0 : -1;
      const date = new Date(
        now.getFullYear(),
        now.getMonth() + base,
        1
      );
      months = [getMonthKey(date)];
    } else if (filter === "year") {
      months = Array.from({ length: 12 }, (_, index) =>
        getMonthKey(new Date(now.getFullYear(), index, 1))
      );
    } else {
      months = Array.from({ length: 6 }, (_, index) =>
        getMonthKey(
          new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
        )
      );
    }

    return months.map((key) => {
      const monthTransactions = filteredTransactions.filter(
        (item) => item.date?.slice(0, 7) === key
      );

      return {
        month: monthLabel(key),
        income: monthTransactions
          .filter((item) => item.type === "income")
          .reduce((sum, item) => sum + Number(item.amount || 0), 0),
        expenses: monthTransactions
          .filter((item) => item.type === "expense")
          .reduce((sum, item) => sum + Number(item.amount || 0), 0),
      };
    });
  }, [filteredTransactions, filter]);

  const categoryData = useMemo(() => {
    const totals = {};

    filteredTransactions
      .filter((item) => item.type === "expense")
      .forEach((item) => {
        const category = item.category || "Other";
        totals[category] =
          (totals[category] || 0) + Number(item.amount || 0);
      });

    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  if (authLoading || !user) {
    return <div className="analytics-loading">Loading analytics...</div>;
  }

  return (
    <main className="analytics-page">
      <header className="analytics-header">
        <div>
          <p className="analytics-eyebrow">FINANCIAL INSIGHTS</p>
          <h1>Analytics Dashboard</h1>
          <p>Understand your income and spending patterns.</p>
        </div>

        <button
          className="analytics-back-button"
          onClick={() => navigate("/dashboard")}
        >
          ← Back to Dashboard
        </button>
      </header>

      <section className="analytics-content">
        <div className="analytics-toolbar">
          <div>
            <h2>Financial overview</h2>
            <p>Choose a period to explore your transactions.</p>
          </div>

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Analytics date range"
          >
            <option value="month">This month</option>
            <option value="lastMonth">Last month</option>
            <option value="year">This year</option>
            <option value="all">All time</option>
          </select>
        </div>

        {error && <div className="analytics-error">{error}</div>}

        {loading ? (
          <div className="analytics-empty">Loading your financial data...</div>
        ) : (
          <>
            <section className="analytics-summary">
              <article className="analytics-stat">
                <span>Total income</span>
                <strong className="stat-income">
                  {formatMoney(summary.income)}
                </strong>
              </article>
              <article className="analytics-stat">
                <span>Total expenses</span>
                <strong className="stat-expense">
                  {formatMoney(summary.expenses)}
                </strong>
              </article>
              <article className="analytics-stat">
                <span>Net balance</span>
                <strong>{formatMoney(summary.balance)}</strong>
              </article>
              <article className="analytics-stat">
                <span>Savings rate</span>
                <strong>
                  {summary.savingsRate === null
                    ? "—"
                    : `${summary.savingsRate.toFixed(1)}%`}
                </strong>
              </article>
            </section>

            <section className="analytics-charts">
              <article className="analytics-panel">
                <div className="analytics-panel-heading">
                  <h3>Income vs. expenses</h3>
                  <p>
                    {filter === "all"
                      ? "Last 6 months shown"
                      : "Monthly comparison"}
                  </p>
                </div>

                <div className="analytics-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthlyData}
                      margin={{ top: 12, right: 8, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e8edf4"
                      />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis
                        tickFormatter={(value) =>
                          value >= 1000
                            ? `₹${Math.round(value / 1000)}k`
                            : `₹${value}`
                        }
                        tick={{ fontSize: 11 }}
                        width={60}
                      />
                      <Tooltip
                        formatter={(value) => formatMoney(value)}
                      />
                      <Legend />
                      <Bar
                        dataKey="income"
                        name="Income"
                        fill="#18A572"
                        radius={[5, 5, 0, 0]}
                      />
                      <Bar
                        dataKey="expenses"
                        name="Expenses"
                        fill="#EA526F"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="analytics-panel">
                <div className="analytics-panel-heading">
                  <h3>Expense breakdown</h3>
                  <p>Spending by category</p>
                </div>

                {categoryData.length === 0 ? (
                  <div className="analytics-empty">
                    No expenses found for this period.
                  </div>
                ) : (
                  <>
                    <div className="analytics-chart donut-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius="53%"
                            outerRadius="78%"
                            paddingAngle={3}
                          >
                            {categoryData.map((item, index) => (
                              <Cell
                                key={item.name}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => formatMoney(value)}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="category-list">
                      {categoryData.map((item, index) => {
                        const percentage =
                          summary.expenses > 0
                            ? (item.value / summary.expenses) * 100
                            : 0;

                        return (
                          <div className="category-item" key={item.name}>
                            <span
                              className="category-dot"
                              style={{
                                backgroundColor:
                                  COLORS[index % COLORS.length],
                              }}
                            />
                            <span className="category-name">{item.name}</span>
                            <span className="category-percent">
                              {percentage.toFixed(1)}%
                            </span>
                            <strong>{formatMoney(item.value)}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </article>
            </section>

            <p className="analytics-note">
              Analytics are based on saved transactions. All-time totals
              include every transaction; the all-time trend chart shows the
              most recent six months.
            </p>
          </>
        )}
      </section>
    </main>
  );
}