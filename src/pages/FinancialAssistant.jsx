import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase/config";
import "./FinancialAssistant.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const MAX_HISTORY_MESSAGES = 8;

const suggestions = [
  "Show my monthly summary",
  "How much did I spend on food?",
  "Am I over budget?",
  "Show my savings goals",
  "What payments are upcoming?",
];

const welcomeMessage = {
  role: "assistant",
  text: "Hello! I can help you understand your recorded finances. Choose a suggested question or ask about your expenses, budgets, goals, or upcoming payments.",
};

export default function FinancialAssistant() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState({
    transactions: false,
    budgets: false,
    recurring: false,
    goals: false,
  });
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([welcomeMessage]);
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let unsubscribeData = [];

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      unsubscribeData.forEach((unsubscribe) => unsubscribe());
      unsubscribeData = [];

      setUser(currentUser);
      setLoaded({
        transactions: false,
        budgets: false,
        recurring: false,
        goals: false,
      });
      setMessages([welcomeMessage]);
      setQuestion("");
      setError("");

      if (!currentUser) return;

      const sources = [
        ["transactions", "transactions"],
        ["budgets", "budgets"],
        ["recurring", "recurringTransactions"],
        ["goals", "goals"],
      ];

      unsubscribeData = sources.map(([key, path]) =>
        onSnapshot(
          collection(db, "users", currentUser.uid, path),
          () => {
            setLoaded((previous) => ({ ...previous, [key]: true }));
            setError("");
          },
          () => {
            setError(
              "Some financial data could not be loaded. Check your connection and Firestore rules.",
            );
            setLoaded((previous) => ({ ...previous, [key]: true }));
          },
        ),
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeData.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const isReady = Object.values(loaded).every(Boolean);

  const askQuestion = async (value = question) => {
    const text = value.trim();

    if (!text || !user || !isReady || asking) return;

    setQuestion("");
    setError("");
    setAsking(true);

    // Send only recent conversation turns. The initial greeting is UI-only.
    const history = messages
      .filter((message) => message !== welcomeMessage)
      .slice(-MAX_HISTORY_MESSAGES)
      .map(({ role, text: messageText }) => ({ role, content: messageText }));

    setMessages((previous) => [...previous, { role: "user", text }]);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ question: text, history }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.detail || `Request failed (${response.status}).`,
        );
      }

      if (!result.answer) {
        throw new Error("The assistant returned an empty response.");
      }

      setMessages((previous) => [
        ...previous,
        { role: "assistant", text: result.answer },
      ]);
    } catch (requestError) {
      setError(
        requestError.message ||
          "Could not reach the assistant. Check that the backend is running.",
      );
    } finally {
      setAsking(false);
    }
  };

  const clearConversation = () => {
    if (asking) return;
    setMessages([welcomeMessage]);
    setError("");
  };

  return (
    <main className="assistant-page">
      <header className="assistant-header">
        <div>
          <p className="assistant-eyebrow">MONEYMate · PERSONAL FINANCE</p>
          <h1>Financial Assistant</h1>
          <p>Understand your recorded finances in one place.</p>
        </div>
        <button
          className="assistant-back-button"
          onClick={() => (window.location.href = "/dashboard")}
        >
          Back to Dashboard
        </button>
      </header>

      <section className="assistant-chat">
        <div className="assistant-chat-heading">
          <div className="assistant-avatar">M</div>
          <div>
            <h2>MoneyMate Assistant</h2>
            <p>
              {isReady
                ? "Your financial data is up to date"
                : "Loading your financial data..."}
            </p>
          </div>
          <button
            type="button"
            className="assistant-new-chat-button"
            onClick={clearConversation}
            disabled={asking || messages.length <= 1}
            aria-label="Clear conversation"
          >
            New chat
          </button>
        </div>

        {error && <p className="assistant-error" role="alert">{error}</p>}

        <div className="assistant-suggestions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              disabled={!isReady || asking}
              onClick={() => askQuestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="assistant-messages" aria-live="polite">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`assistant-message ${message.role}`}
            >
              <span>{message.role === "assistant" ? "MoneyMate" : "You"}</span>
              <p>{message.text}</p>
            </div>
          ))}
          {!isReady && (
            <p className="assistant-loading">Preparing your financial data…</p>
          )}
          {asking && (
            <p className="assistant-loading" role="status">
              MoneyMate is analyzing your financial data...
            </p>
          )}
        </div>

        <form
          className="assistant-input-form"
          onSubmit={(event) => {
            event.preventDefault();
            askQuestion();
          }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about your finances..."
            aria-label="Ask a financial question"
            disabled={!isReady || asking}
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={!isReady || asking || !question.trim()}
          >
            {asking ? "Thinking..." : "Ask"}
          </button>
        </form>
        <p className="assistant-disclaimer">
          Answers use your saved records and general budgeting information.
          Verify important financial decisions independently.
        </p>
      </section>
    </main>
  );
}