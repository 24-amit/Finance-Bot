# MoneyMate — Personal Finance Budgeting & Cash Flow Bot

**An AI-powered personal finance management application for budgeting, expense tracking, financial planning, and intelligent cash-flow insights.**

<p align="center">

  **Live Application:** https://finance-bot-t34l.onrender.com

  **GitHub Repository:** https://github.com/24-amit/Finance-Bot

</p>

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Project Objectives](#3-project-objectives)
4. [Features](#4-features)
5. [Technology Stack](#5-technology-stack)
6. [System Architecture](#6-system-architecture)
7. [Project Structure](#7-project-structure)
8. [Application Modules](#8-application-modules)
9. [AI Financial Assistant](#9-ai-financial-assistant)
10. [Firebase and Database Design](#10-firebase-and-database-design)
11. [API Documentation](#11-api-documentation)
12. [Local Installation and Setup](#12-local-installation-and-setup)
13. [Environment Configuration](#13-environment-configuration)
14. [Running the Application](#14-running-the-application)
15. [Deployment on Render](#15-deployment-on-render)
16. [Security Considerations](#16-security-considerations)
17. [Testing and Verification](#17-testing-and-verification)
18. [Troubleshooting](#18-troubleshooting)
19. [Future Enhancements](#19-future-enhancements)
20. [Limitations](#20-limitations)
21. [Disclaimer](#21-disclaimer)
22. [Author and Links](#22-author-and-links)

---

## 1. Overview

MoneyMate is a web-based personal finance management application designed to help users organize their income, expenses, budgets, recurring transactions, and financial goals in one place.

The application combines a React-based user interface with Firebase authentication and cloud data storage. Its AI-powered financial assistant uses a Python FastAPI backend and the Groq API to answer questions using the financial context available to the authenticated user.

Unlike a basic expense tracker, MoneyMate brings financial record management and conversational AI together in a single application.

**Live Demo:** https://finance-bot-t34l.onrender.com

The frontend and backend are deployed together on Render, allowing users to access the application through a single public URL.

## 2. Problem Statement

Managing personal finances manually can make it difficult to understand spending patterns, maintain budgets, remember recurring payments, and monitor progress toward financial goals.

Traditional expense trackers primarily focus on recording transactions and displaying summaries. Users may still need to analyze their financial information independently.

MoneyMate addresses these challenges by combining structured financial management with an AI assistant that can interpret relevant financial records and provide contextual explanations.

## 3. Project Objectives

- Provide a centralized platform for recording and managing personal income and expenses.
- Help users organize their finances by transaction category and date.
- Support monthly budgeting and budget monitoring.
- Maintain recurring transaction schedules.
- Allow users to create and monitor financial goals.
- Present financial information through dashboards and analytics.
- Provide conversational assistance using relevant financial data.
- Securely associate financial records with the authenticated user.
- Deploy the frontend and backend through a single public application URL.

## 4. Features

### 4.1 User Authentication

- Firebase Authentication integration.
- User-specific access to financial information.
- Authenticated requests to the FastAPI backend.
- Firebase ID token verification for protected API operations.

The available sign-in methods depend on the authentication providers enabled in the Firebase project.

### 4.2 Dashboard

The dashboard provides an overview of the user's financial activity, including relevant income, expenses, and budget information.

It serves as the central navigation point for the application's finance management modules.

### 4.3 Transaction Management

- Record income and expense transactions.
- Store transaction amounts, categories, descriptions, and dates.
- Organize financial activity for analysis.
- Maintain records associated with the authenticated user's account.

### 4.4 Budget Management

- Organize budget information by month.
- Store budget-related information in Firestore.
- Support monitoring spending against the configured budget.

The exact calculations and visual indicators depend on the implemented budget interface.

### 4.5 Recurring Transactions

- Maintain recurring transaction schedules.
- Store recurring transaction information separately from ordinary transaction records.
- Support the organization of repeated financial obligations.

A saved recurring schedule should not be interpreted as an automatically executed bank payment unless a separate payment integration has been implemented.

### 4.6 Financial Goals

- Create and maintain financial goals.
- Store goal information in the user's Firestore records.
- Provide a dedicated area for monitoring financial objectives.

### 4.7 Financial Analytics

The analytics module is intended to help users understand their financial activity through summaries and visual representations of relevant records.

Its usefulness depends on the availability and quality of the user's transaction data.

### 4.8 AI Financial Assistant

- Conversational financial questions and answers.
- Financial context assembled from the authenticated user's records.
- Groq API integration through FastAPI.
- Bearer-token authentication for protected assistant requests.
- Context-aware follow-up conversations, subject to the configured conversation-history implementation.
- Loading and error handling in the assistant interface.

The assistant provides informational guidance and calculations based on the information available to it. It does not replace a qualified financial professional.

### 4.9 Single-URL Deployment

The frontend and backend are served from one Render service.

- React production files are built into the frontend distribution directory.
- FastAPI serves the generated frontend assets.
- `/api/chat` handles AI assistant requests.
- `/health` provides a backend health-check endpoint.
- `/docs` exposes the FastAPI interactive API documentation.

This deployment avoids the need for separate public frontend and backend URLs.

---

## 5. Technology Stack

| Technology | Purpose |
|---|---|
| React.js | Component-based user interface |
| Vite | Frontend development and production build |
| JavaScript | Frontend application logic |
| HTML5 | Application structure |
| CSS3 | Styling and responsive interface |
| Python | Backend programming |
| FastAPI | Backend API and request handling |
| Uvicorn | ASGI application server |
| Firebase Authentication | User authentication |
| Cloud Firestore | Cloud-hosted financial data |
| Firebase Admin SDK | Server-side Firebase token verification and authorized access |
| Groq API | AI-generated financial responses |
| `python-dotenv` | Local environment variable loading |
| `tzdata` | Time-zone database support where needed |
| Docker | Combined frontend/backend packaging |
| Render | Application hosting and deployment |
| Git and GitHub | Version control and source-code hosting |

The exact installed package versions are defined by the project's dependency files.

## 6. System Architecture

MoneyMate uses a combined frontend and backend deployment.

```mermaid
flowchart TD
    A[User / Web Browser] --> B[React + Vite Frontend]
    B --> C[Firebase Authentication]
    B --> D[Cloud Firestore]

    B --> E[FastAPI Backend]
    E --> F[Firebase Admin SDK]
    F --> G[Verify Firebase ID Token]
    G --> H{Token Valid?}

    H -- No --> I[Return Authentication Error]
    H -- Yes --> J[Build User-Specific Financial Context]

    J --> K[Groq API]
    K --> L[AI-Generated Response]
    L --> E
    E --> B

    M[Docker Build] --> N[Render Service]
    N --> B
    N --> E
```

### Request flow

1. The user opens the MoneyMate application.
2. Firebase Authentication identifies the signed-in user.
3. The frontend reads the financial records permitted by the application's Firestore rules.
4. When the user asks the financial assistant a question, the frontend sends the question and Firebase ID token to FastAPI.
5. FastAPI verifies the token using the Firebase Admin SDK.
6. The backend prepares the relevant financial context for the authenticated user.
7. The backend sends the contextual prompt to the configured Groq model.
8. The generated response is returned to the frontend and displayed in the conversation.

**Important:** The backend must verify authentication before retrieving private financial records or processing protected assistant requests.

## 7. Project Structure

The following represents the intended combined deployment structure. Exact filenames may vary according to the current repository.

```text
Finance-Bot/
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│
├── src/
│   ├── firebase/
│   │   └── config.js
│   │
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Analytics.jsx
│   │   ├── Budgets.jsx
│   │   ├── RecurringTransactions.jsx
│   │   ├── Goals.jsx
│   │   └── FinancialAssistant.jsx
│   │
│   └── ...
│
├── public/
│   └── ...
│
├── Dockerfile
├── .dockerignore
├── .gitignore
├── package.json
├── package-lock.json
├── render.yaml
└── README.md
```

Some files, such as `render.yaml`, `.env.example`, or a separate backend requirements file, should only be listed as implemented files if they are present in the repository.

**Never commit Firebase service-account JSON files, private API keys, or local environment files.**

## 8. Application Modules

### Authentication Module

Manages user authentication through Firebase and establishes the identity used to associate financial records with the correct account.

### Transaction Module

Stores and retrieves income and expense information, including transaction type, amount, category, description, and date.

### Budget Module

Maintains monthly budget information and supports budget-related financial summaries.

### Recurring Transaction Module

Stores recurring financial schedules separately from individual transactions.

### Financial Goals Module

Organizes the user's financial goals and their associated information.

### Analytics Module

Uses available financial records to help users interpret spending and income patterns.

### AI Assistant Module

Connects the React interface to the FastAPI backend, validates authentication, prepares relevant financial context, and requests a response from the configured Groq model.

---

## 9. AI Financial Assistant

The AI assistant is a core component of MoneyMate.

### How it works

The frontend sends an authenticated request to the backend. The backend verifies the Firebase ID token, obtains the appropriate financial context, and uses the Groq API to generate a response.

The financial context can include applicable transaction, budget, recurring transaction, and goal information, depending on the backend implementation.

### Example questions

Users may ask questions such as:

- How much did I spend this month?
- Which expense categories account for most of my spending?
- How much money remains in my budget?
- Summarize my recent financial activity.
- What should I review to improve my monthly savings?
- Explain my current financial position using my available records.

These are examples of intended use cases. The accuracy of an answer depends on the data available, the backend's context-building logic, and the model's response.

### Conversation handling

Where conversation history is enabled, previous messages can be included within a configured limit to help the assistant answer follow-up questions.

Conversation history should be bounded to control token usage and avoid unnecessarily transmitting sensitive information.

### AI model configuration

The model is selected through the `GROQ_MODEL` environment variable. Configure it to a model identifier currently supported by the Groq API and available to your account.

The model name is configuration, not a guarantee that a particular model identifier will remain available indefinitely.

### Financial accuracy

AI-generated responses should be treated as informational assistance. Financial totals that can be computed directly from stored records should ideally be calculated deterministically in the backend rather than estimated by a language model.

---

## 10. Firebase and Database Design

MoneyMate uses Firebase Authentication and Cloud Firestore.

### Data organization

The logical Firestore structure is organized by user:

```text
users/
└── {uid}/
    ├── transactions/
    │   └── {transactionId}
    │
    ├── budgets/
    │   └── {YYYY-MM}
    │
    ├── recurringTransactions/
    │   └── {scheduleId}
    │
    └── goals/
        └── {goalId}
```

### User profile

`users/{uid}`

Stores profile information associated with the authenticated user, according to the fields implemented by the application.

### Transactions

`users/{uid}/transactions/{transactionId}`

Typical fields include:

| Field | Description |
|---|---|
| `type` | Income or expense |
| `amount` | Transaction amount |
| `category` | Financial category |
| `description` | Transaction details |
| `date` | Transaction date |
| Timestamp fields | Creation or update metadata, where implemented |

### Budgets

`users/{uid}/budgets/{YYYY-MM}`

Stores budget information organized by month. The document's exact field structure is determined by the implemented budget module.

### Recurring transactions

`users/{uid}/recurringTransactions/{scheduleId}`

Stores information about recurring financial schedules, including whichever schedule and transaction fields the application supports.

### Financial goals

`users/{uid}/goals/{goalId}`

Stores the user's financial goal information, according to the current implementation.

### Data security

Firestore Security Rules should restrict users to the records they are authorized to access. The backend must also ensure that a user's token determines which private financial data is retrieved.

The structure above documents the logical collection organization; it does not replace the actual Firestore schema or deployed security rules.

---

## 11. API Documentation

The FastAPI backend provides HTTP endpoints for health checking and AI-assisted financial queries.

### Base URL

The production application is hosted at:

`https://finance-bot-t34l.onrender.com`

### Health check

**Endpoint:** `GET /health`

Use this endpoint to check whether the backend is responding.

Example:

```bash
curl https://finance-bot-t34l.onrender.com/health
```

The exact JSON response is determined by the implementation in `backend/main.py`.

### AI assistant

**Endpoint:** `POST /api/chat`

This endpoint processes a user's financial question.

The request uses a Firebase ID token in the HTTP Authorization header.

Example request:

```http
POST /api/chat HTTP/1.1
Host: finance-bot-t34l.onrender.com
Authorization: Bearer YOUR_FIREBASE_ID_TOKEN
Content-Type: application/json
```

Example JSON body:

```json
{
  "message": "Summarize my spending this month"
}
```

The precise request schema must match the current FastAPI request model. If the implementation expects additional fields, those fields must be supplied accordingly.

### Interactive API documentation

FastAPI's Swagger UI is normally available at:

https://finance-bot-t34l.onrender.com/docs

The OpenAPI schema can normally be accessed at:

https://finance-bot-t34l.onrender.com/openapi.json

These endpoints are available when the corresponding FastAPI documentation routes have not been disabled or overridden.

### Frontend routes and static assets

The combined deployment serves the built React frontend and its static assets from the same origin.

For a single-page application, the server should return the frontend entry point for supported client-side routes that are not API or static-asset requests. This allows browser refreshes on frontend routes to work correctly.

---

## 12. Local Installation and Setup

### Prerequisites

Install the following software before running the project:

- Git
- Node.js and npm
- Python 3.12, or the version specified by the project's Docker configuration
- A Firebase project with the required authentication providers and Firestore enabled
- A Groq API key
- Docker, if you want to test the combined container locally

### Step 1: Clone the repository

```bash
git clone https://github.com/24-amit/Finance-Bot.git
cd Finance-Bot
```

### Step 2: Install frontend dependencies

```bash
npm install
```

### Step 3: Install backend dependencies

If the backend dependency file is located at `backend/requirements.txt`, run:

```bash
python -m venv .venv
```

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the dependencies:

```bash
pip install -r backend/requirements.txt
```

If your repository stores `requirements.txt` at the root, use that path instead.

### Step 4: Configure Firebase

1. Open the Firebase Console.
2. Select your Firebase project.
3. Enable the authentication methods required by the application.
4. Enable Cloud Firestore.
5. Configure the Firebase web application settings used by `src/firebase/config.js`.
6. Configure Firestore Security Rules to protect user-specific records.
7. Generate a Firebase Admin SDK service-account key for local backend development, if required.

Store the service-account file securely. Do not commit it to GitHub.

### Step 5: Configure the Groq API

Create or obtain an API key from the Groq developer platform.

Configure the key in the backend environment. The backend must read the key from its environment rather than exposing it in frontend code.

---

## 13. Environment Configuration

The backend uses environment variables to configure its AI provider, Firebase Admin SDK, and other runtime settings.

### Backend environment variables

Create a local `.env` file in the directory expected by `backend/main.py`.

Example:

```dotenv
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=your_supported_groq_model
FIREBASE_SERVICE_ACCOUNT=service-account.json
FRONTEND_ORIGIN=http://localhost:5173
```

Replace the example values with your actual local configuration.

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Secret API key for the Groq service |
| `GROQ_MODEL` | Supported Groq model identifier |
| `FIREBASE_SERVICE_ACCOUNT` | Path to the Firebase Admin SDK service-account JSON file |
| `FRONTEND_ORIGIN` | Allowed frontend origin for CORS, if used by the backend |

**Configuration note:** Environment variable names must match those read by the current `backend/main.py`. If your code uses `FRONTEND_ORIGINS` or another CORS variable, configure that exact name instead of assuming the singular version.

The service-account path must point to an existing file in local development.

### Frontend environment variables

If `src/firebase/config.js` reads Firebase settings from Vite environment variables, configure those variables in a local `.env.local` file.

Use the exact names referenced in your code. A typical configuration might look like:

```dotenv
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

These names are examples; they must match the variables actually referenced by `src/firebase/config.js`.

For a same-origin deployment, the frontend can call `/api/chat` using a relative URL, provided the current frontend code supports that configuration. If the frontend instead uses `VITE_API_BASE_URL`, set it to the production application origin or configure the code to use a relative API path.

Vite variables prefixed with `VITE_` are embedded into the frontend build. **Never place private API keys or Firebase Admin service-account credentials in Vite variables.**

---

## 14. Running the Application

The frontend and backend can be run separately during development.

### Start the backend

From the repository root, activate the virtual environment and start FastAPI:

```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

This command assumes `backend/main.py` exposes the FastAPI application as `app`.

Open:

- API health check: `http://127.0.0.1:8000/health`
- Interactive API documentation: `http://127.0.0.1:8000/docs`

If the backend file is configured to be imported from a different module path, adjust the command to match the project structure.

### Start the frontend

Open a second terminal in the repository root:

```bash
npm run dev
```

Vite normally starts the development server at:

`http://localhost:5173`

Ensure that the frontend API configuration and backend CORS settings are consistent with the local development URLs.

### Create a production frontend build

```bash
npm run build
```

Vite generates the production files in `dist/` by default.

For the combined deployment, the Docker build copies these generated files into the backend container so FastAPI can serve the frontend.

---

## 15. Deployment on Render

MoneyMate is designed to run as **one combined Render web service**, using one public URL for both the frontend and backend.

**Production URL:** https://finance-bot-t34l.onrender.com

### Deployment architecture

The root `Dockerfile` uses a multi-stage build:

1. A Node.js build stage installs frontend dependencies and creates the production Vite build.
2. A Python runtime stage installs backend dependencies.
3. The built frontend files are copied into the runtime image.
4. FastAPI serves the frontend and handles the backend endpoints.
5. Render runs the container as a single web service.

### Docker configuration

The root `Dockerfile` should follow the same general structure as this example. Adjust the file paths if your current repository differs.

```dockerfile
# Frontend build stage
FROM node:22 AS frontend-build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# Backend runtime stage
FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

COPY --from=frontend-build /app/dist ./dist

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
```

This is a reference configuration. The actual Dockerfile must be consistent with the import paths, static-file directory, and dependency-file location used in the project.

A `.dockerignore` file should exclude unnecessary files and secrets from the Docker build context, including `.git`, `node_modules`, virtual environments, local `.env` files, and Firebase service-account JSON files.

### Render service settings

In Render, create or configure one Web Service using the repository's Dockerfile.

| Setting | Value |
|---|---|
| Repository | `24-amit/Finance-Bot` |
| Service type | Web Service |
| Runtime | Docker |
| Dockerfile path | `./Dockerfile` |
| Public application URL | `https://finance-bot-t34l.onrender.com` |
| Health-check path | `/health` |

Render should build and run the container using the root Dockerfile.

### Render environment variables

Configure the following in the Render service's environment settings:

| Variable | Value |
|---|---|
| `GROQ_API_KEY` | Your actual Groq API key |
| `GROQ_MODEL` | A model identifier currently supported by your Groq account |
| `FIREBASE_SERVICE_ACCOUNT` | `/etc/secrets/service-account.json` |
| `FRONTEND_ORIGIN` | `https://finance-bot-t34l.onrender.com` |

These names must match the backend's actual configuration. If `backend/main.py` uses different names, use the names expected by that file.

Set the Firebase service-account JSON as a **Render Secret File** named `service-account.json`. Its mounted path should match the configured `FIREBASE_SERVICE_ACCOUNT` value.

Do not upload the Firebase service-account JSON as a normal source-code file or paste its contents into this README.

### CORS and same-origin requests

Because the frontend and backend use the same origin, frontend API requests can use relative paths such as:

```javascript
fetch("/api/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${firebaseIdToken}`
  },
  body: JSON.stringify({
    message: "Summarize my spending this month"
  })
});
```

This is an example request pattern. Keep the request body consistent with the current FastAPI request model.

If the frontend still points to `http://127.0.0.1:8000`, update the production API configuration so deployed requests do not target the user's local computer.

When using an environment variable such as `FRONTEND_ORIGIN`, configure the exact deployed frontend origin with no trailing slash if that is what the backend expects.

### Verify the deployment

After Render completes the deployment:

1. Open https://finance-bot-t34l.onrender.com.
2. Check that the frontend loads.
3. Sign in using a configured Firebase Authentication provider.
4. Test adding and reading financial records.
5. Test the AI assistant.
6. Open `/health` to verify backend health.
7. Open `/docs` to inspect the available API endpoints.
8. Review Render logs if any request fails.

The frontend and backend should continue to use the same public application URL.

---

## 16. Security Considerations

MoneyMate handles personal financial information, so authentication and data isolation are important.

- Keep the Groq API key on the backend.
- Keep Firebase Admin SDK credentials out of the frontend and source control.
- Use Render Secret Files for private service-account credentials.
- Verify Firebase ID tokens on protected backend endpoints.
- Derive the authenticated user's identity from the verified token.
- Restrict Firestore reads and writes using appropriate Security Rules.
- Ensure that AI context retrieval is limited to the authenticated user's records.
- Avoid logging API keys, access tokens, or unnecessary personal financial information.
- Exclude local `.env` files, service-account files, dependency folders, and other secrets from Git commits and Docker build contexts.
- Validate incoming API data and handle malformed requests.
- Apply appropriate limits to conversation history and API usage.
- Rotate credentials immediately if a private key or secret has been exposed.

A `.gitignore` file helps prevent accidental commits but does not remove files that were already committed. If a secret was previously pushed, revoke or rotate it and remove it from repository history as appropriate.

Firebase web configuration is distinct from Firebase Admin credentials. The web configuration is used by the frontend; privileged service-account credentials must remain private.

---

## 17. Testing and Verification

Use the following checklist when verifying a local build or production deployment.

### Application checks

- [ ] The frontend builds successfully.
- [ ] The application loads from the production URL.
- [ ] Firebase Authentication works with the configured provider.
- [ ] Transactions can be created and retrieved.
- [ ] Budget information is saved and displayed correctly.
- [ ] Recurring transaction schedules can be managed.
- [ ] Financial goals can be managed.
- [ ] Analytics displays the expected information for available records.
- [ ] The AI assistant handles a valid question.
- [ ] Missing or invalid authentication is handled safely.
- [ ] Backend errors are presented without exposing secrets.
- [ ] The application works when refreshing supported frontend routes.
- [ ] The backend health endpoint responds successfully.
- [ ] One user's financial data is not returned to another user.

### AI assistant checks

Test with a range of questions:

1. A general question that does not require private financial information.
2. A question about the authenticated user's recorded expenses.
3. A budget-related question.
4. A follow-up question that relies on the previous conversation.
5. A request made with an expired or invalid Firebase token.
6. A request where the AI provider returns an error.

Verify that financial answers reflect the stored records and that unauthorized requests cannot retrieve another user's information.

---

## 18. Troubleshooting

| Problem | What to check |
|---|---|
| Frontend does not load | Check Render deployment status, Docker build logs, and static-file configuration |
| Page refresh returns 404 | Check the FastAPI single-page application fallback for frontend routes |
| `/health` fails | Inspect the FastAPI startup logs and Render health-check configuration |
| `/docs` is unavailable | Confirm that FastAPI documentation routes are enabled |
| AI assistant returns an error | Check the backend logs, Groq API key, model identifier, quota, and provider availability |
| Groq reports model not found | Select a currently supported model identifier and update `GROQ_MODEL` |
| Firebase authentication fails | Check Firebase configuration, enabled providers, authorized domains, and authentication errors |
| Backend reports missing credentials | Verify the `FIREBASE_SERVICE_ACCOUNT` value and mounted Secret File path |
| CORS error occurs | Check the configured frontend origin and backend CORS middleware |
| API calls target localhost in production | Replace the local API base URL with the production origin or use a relative API path |
| Financial records are missing | Check the authenticated UID, Firestore document paths, security rules, and database contents |
| Docker build fails | Verify the Node/Python versions, dependency paths, lockfile, Dockerfile, and `.dockerignore` |
| Local time-zone errors occur | Verify the configured time zone and install `tzdata` if required by the runtime |

---

## 19. Future Enhancements

Potential future improvements include:

- Automated monthly financial reports.
- More detailed spending and cash-flow visualizations.
- Budget threshold notifications.
- Upcoming recurring payment reminders.
- Savings progress indicators.
- Improved deterministic calculations and AI response validation.
- Export of transactions and reports to CSV or PDF.
- Search, filtering, and date-range comparisons.
- Stronger automated testing and backend validation.
- Rate limiting and monitoring for AI requests.
- Additional financial insights based on historical spending patterns.
- Improved accessibility and mobile responsiveness.

These items are potential enhancements and should not be considered implemented features unless they are present in the application.

## 20. Limitations

- AI responses depend on the configured model, prompt, and available financial context.
- Incorrect or incomplete transaction records can affect financial summaries.
- Availability and pricing of external AI services depend on the provider.
- Render service availability and resource limits depend on the hosting configuration.
- Recurring transaction records do not by themselves execute payments.
- Financial insights should be verified against the underlying records.
- Advanced features such as bank synchronization, automatic payments, and investment integrations require separate implementations.

## 21. Disclaimer

MoneyMate is an educational software project intended to support personal finance organization and provide informational financial insights.

AI-generated responses may contain inaccuracies and should not be treated as guaranteed financial advice. Users should verify important calculations and consult a qualified professional for significant financial decisions.

The application does not execute bank transfers or payments unless a separately implemented and authorized payment integration is added.

## 22. Author and Links

**Project:** MoneyMate — Personal Finance Budgeting & Cash Flow Bot

**Developer:** Amit

- **GitHub Repository:** https://github.com/24-amit/Finance-Bot
- **Live Application:** https://finance-bot-t34l.onrender.com
- **Backend Health Check:** https://finance-bot-t34l.onrender.com/health
- **API Documentation:** https://finance-bot-t34l.onrender.com/docs

---

*MoneyMate brings personal finance management and AI-powered financial assistance together in one application.*
