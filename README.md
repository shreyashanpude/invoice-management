# Smart Invoice Management System

A production-style, full-stack MERN invoice management system with AI-powered invoice scanning, financial analytics, and payment tracking.

---

## Features

- **Authentication** — JWT + HttpOnly cookie auth, bcrypt password hashing, protected routes
- **Invoice Management** — Full CRUD, line items, tax/discount calculation (server-side), PDF-ready print, status tracking
- **Customer Management** — Full CRUD, invoice history, outstanding balance tracking
- **AI Invoice Scanner** — Upload PDF/image → OCR text extraction → LLM field extraction → editable review form → save as invoice
- **Duplicate Detection** — Warns before saving a likely duplicate invoice
- **Payment Tracking** — Record partial/full payments, overdue detection by date
- **Dashboard** — Revenue charts, status breakdown, top customers, upcoming due dates
- **Reports & Analytics** — Monthly revenue vs invoiced, collection rate, customer leaderboard
- **AI Financial Insights** — Rule-based or LLM-generated observations from real aggregated data
- **Payment Reminder Drafts** — Generate professional email drafts for overdue invoices
- **Settings & Profile** — Business info, invoice prefix, password change

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, Tailwind CSS, React Router v6, React Hook Form + Zod, Recharts, Axios |
| Backend | Node.js, Express.js, JWT, bcryptjs, Multer, express-validator |
| Database | MongoDB + Mongoose (all amounts stored in integer paise) |
| AI | Configurable: Google Gemini / OpenAI GPT / Groq |
| OCR | Tesseract.js (client-side OCR for images) + pdf-parse for PDFs |
| Tests | Jest + Supertest (backend), Vitest + Testing Library (frontend) |

---

## Prerequisites

- Node.js 18+
- MongoDB 6+ (local) **or** MongoDB Atlas connection string
- An AI API key (Gemini, OpenAI, or Groq) — optional but required for AI Scanner

---

## Installation

### 1. Clone / open the project

```bash
# The project is already in your workspace
```

### 2. Install backend dependencies

```bash
cd server
npm install
```

### 3. Install frontend dependencies

```bash
cd client
npm install
```

---

## Environment Setup

### Backend (`server/.env`)

Copy the example file and fill in your values:

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
NODE_ENV=development
PORT=5000

# MongoDB — choose one:
MONGODB_URI=mongodb://localhost:27017/smart_invoice_db
# MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/smart_invoice_db

# JWT (generate a secure random string, min 32 chars)
JWT_SECRET=your_super_secret_key_change_this_min_32_characters
JWT_EXPIRES_IN=7d
JWT_COOKIE_EXPIRES_IN=7

# Frontend URL
FRONTEND_URL=http://localhost:5173

# AI Provider — pick one: gemini | openai | groq
AI_PROVIDER=gemini
AI_API_KEY=your_api_key_here
AI_MODEL=gemini-1.5-flash
```

### Frontend (`client/.env`)

```bash
cp client/.env.example client/.env
```

`client/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_APP_NAME=Smart Invoice
```

---

## AI Provider Setup

### Google Gemini (recommended free tier)
1. Go to https://aistudio.google.com/app/apikey
2. Create an API key
3. Set `AI_PROVIDER=gemini`, `AI_API_KEY=<key>`, `AI_MODEL=gemini-1.5-flash`

### OpenAI
1. Go to https://platform.openai.com/api-keys
2. Set `AI_PROVIDER=openai`, `AI_API_KEY=sk-...`, `AI_MODEL=gpt-4o-mini`

### Groq (free, fast)
1. Go to https://console.groq.com/keys
2. Set `AI_PROVIDER=groq`, `AI_API_KEY=gsk_...`, `AI_MODEL=llama3-70b-8192`

> **Without an AI key:** The AI Scanner will return an error. Manual invoice entry remains available. Financial Insights will fall back to rule-based analysis at no cost.

---

## MongoDB Setup

### Local MongoDB
```bash
# Install MongoDB Community: https://www.mongodb.com/try/download/community
# Start service:
mongod --dbpath /data/db
```

### MongoDB Atlas (cloud)
1. Create account at https://cloud.mongodb.com
2. Create a free M0 cluster
3. Add your IP to network access
4. Get connection string → paste into `MONGODB_URI`

---

## Running the Application

### Start Backend

```bash
cd server
npm run dev      # development with nodemon
# or
npm start        # production
```

Backend will start at: http://localhost:5000

### Start Frontend

```bash
cd client
npm run dev
```

Frontend will start at: http://localhost:5173

---

## Optional: Seed Demo Data

Creates a demo account with 20 sample invoices across 5 customers:

```bash
cd server
npm run seed
```

Login credentials after seeding:
- **Email:** `demo@invoice.app`
- **Password:** `Demo@12345`

---

## Running Tests

### Backend tests (Jest + Supertest)

> Requires a running MongoDB instance (uses `smart_invoice_test` database)

```bash
cd server
npm test
```

### Frontend tests (Vitest)

```bash
cd client
npm test
```

### Production build

```bash
cd client
npm run build
```

---

## API Endpoint Reference

All endpoints are prefixed with `/api/v1`.

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout (clears cookie) |
| GET | `/auth/me` | Get current user |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoices` | List invoices (paginated, filterable) |
| POST | `/invoices` | Create invoice |
| GET | `/invoices/:id` | Get invoice + payments |
| PUT | `/invoices/:id` | Update invoice |
| DELETE | `/invoices/:id` | Delete invoice |
| POST | `/invoices/:id/payments` | Record payment |
| GET | `/invoices/:id/payments` | List payments |
| GET | `/invoices/check-duplicate` | Duplicate check |

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/customers` | List customers |
| POST | `/customers` | Create customer |
| GET | `/customers/:id` | Get customer + invoice history |
| PUT | `/customers/:id` | Update customer |
| DELETE | `/customers/:id` | Delete/deactivate customer |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/summary` | KPIs + recent invoices |
| GET | `/dashboard/revenue` | Monthly revenue chart data |
| GET | `/dashboard/invoice-status` | Status distribution + top customers |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/extract-invoice` | Upload file → extract invoice data |
| POST | `/ai/financial-insights` | Generate financial observations |
| POST | `/ai/payment-reminders` | Generate reminder email draft |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Get profile |
| PUT | `/profile` | Update profile |
| PUT | `/profile/password` | Change password |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | API + DB connectivity status |

---

## Query Parameters

**GET /invoices**
- `page`, `limit` — pagination
- `search` — invoice number or customer name
- `status` — draft | sent | partially_paid | paid | overdue | cancelled
- `customerId` — filter by customer
- `dateFrom`, `dateTo` — date range
- `sortBy`, `sortOrder` — sorting

**GET /customers**
- `page`, `limit`, `search`, `sortBy`, `sortOrder`

---

## Architecture Notes

### Monetary values
All amounts are stored as **integers in paise** (1 INR = 100 paise) to avoid floating-point errors. The backend recalculates all totals from line items — frontend-submitted totals are ignored.

### Invoice status derivation
`overdue` status is computed at query time by comparing `dueDate` with `now` and checking `paidAmount < grandTotal`. It is not solely based on the stored status field.

### Authentication strategy
JWT is issued as both a cookie (HttpOnly, Secure in prod) and in the response body. The frontend stores it in localStorage as a Bearer token fallback. Both are checked by the auth middleware.

### AI security
- Document text is never allowed to override system instructions
- Only server-side AI calls — API keys never sent to browser
- Extracted values are sanitized against an allowlist before use
- Server recalculates totals and flags discrepancies

---

## Common Issues

| Problem | Solution |
|---------|----------|
| `MongoDB connection failed` | Verify `MONGODB_URI` in `.env`, ensure MongoDB is running |
| `AI_API_KEY is not configured` | Set `AI_API_KEY` in `server/.env` or use manual entry |
| `CORS error` | Ensure `FRONTEND_URL` in server `.env` matches your Vite port |
| `Cannot find module` | Run `npm install` in both `server/` and `client/` |
| `Port 5000 in use` | Change `PORT` in server `.env` |
| Port 5173 in use | Vite will auto-increment to 5174 |

---

## Project Structure

```
├── client/                    # React + Vite frontend
│   └── src/
│       ├── components/        # Reusable UI + layout components
│       ├── context/           # AuthContext
│       ├── hooks/             # useInvoices, useCustomers
│       ├── pages/             # All page components
│       ├── routes/            # ProtectedRoute, GuestRoute
│       ├── services/          # Axios API service layer
│       ├── test/              # Vitest tests
│       └── utils/             # formatters, helpers
│
└── server/                    # Express backend
    └── src/
        ├── __tests__/         # Jest + Supertest tests
        ├── config/            # Database connection
        ├── controllers/       # Route handlers
        ├── middleware/        # auth, errorHandler, upload
        ├── models/            # Mongoose models
        ├── routes/            # Express routers
        ├── utils/             # calculations, seed, apiResponse
        └── validators/        # express-validator rules
```

---

## What Works / What Needs External Config

| Feature | Status |
|---------|--------|
| Auth (register/login/logout) | ✅ Complete |
| Invoice CRUD + calculations | ✅ Complete |
| Customer CRUD | ✅ Complete |
| Payment recording | ✅ Complete |
| Dashboard analytics | ✅ Complete |
| Reports & charts | ✅ Complete |
| AI Scanner | ✅ Complete — requires `AI_API_KEY` |
| OCR (images) | ✅ Complete — uses Tesseract.js |
| PDF text extraction | ✅ Complete — uses pdf-parse |
| Financial Insights | ✅ Rule-based without AI key; LLM with key |
| Reminder drafts | ✅ Complete |
| Duplicate detection | ✅ Complete |
| Tests (backend) | ✅ Complete |
| Tests (frontend) | ✅ Complete |
| Email sending | ❌ Not implemented — reminders are copy-paste drafts only |
| PDF download | ❌ Use browser print-to-PDF via the Print button |

---

## Screenshots

> Run the app and use `demo@invoice.app` / `Demo@12345` (after seeding) to see it populated.
"# invoice-management" 
"# invoice-management" 
"# invoice-management" 
