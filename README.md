# Confessional — Anonymous Confession Wall
## Complete Setup Guide

---

## What You're Getting

A full-stack web app with:
- **Backend**: Node.js + Express + PostgreSQL + Socket.io
- **Frontend**: React + Vite + Tailwind CSS
- **Auth**: JWT, bcrypt, Google OAuth, password reset via email
- **Real-time**: Socket.io — posts and comments appear instantly for all users
- **Security**: rate limiting, XSS protection, input validation, SQL injection prevention

---

## Prerequisites

Install these first (free):

| Tool | Download | Why |
|------|----------|-----|
| Node.js (v18+) | https://nodejs.org | Runs the backend |
| PostgreSQL (v14+) | https://www.postgresql.org/download | Database |
| Git | https://git-scm.com | Version control |

---

## Step 1 — Set Up PostgreSQL

### On Windows:
1. Download the PostgreSQL installer from https://www.postgresql.org/download/windows
2. Run the installer — remember your password for the `postgres` user
3. Open **pgAdmin** (installed alongside PostgreSQL)
4. Right-click "Databases" → Create → Database → Name it `confessional`

### On Mac:
```bash
# Install via Homebrew (easiest)
brew install postgresql@16
brew services start postgresql@16

# Create database
createdb confessional
```

### On Linux (Ubuntu/Debian):
```bash
sudo apt update && sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb confessional
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'yourpassword';"
```

---

## Step 2 — Download & Organize Files

Create this exact folder structure on your computer:

```
confessional/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── security.js
│   │   │   └── validate.js
│   │   ├── migrations/
│   │   │   ├── schema.sql
│   │   │   ├── run.js
│   │   │   └── seed.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── posts.js
│   │   │   └── admin.js
│   │   ├── utils/
│   │   │   ├── jwt.js
│   │   │   └── email.js
│   │   └── server.js
│   ├── .env              ← you create this (copy from .env.example)
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Layout.jsx
    │   │   ├── PostCard.jsx
    │   │   └── PostModal.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── pages/
    │   │   ├── AuthPage.jsx
    │   │   ├── HomePage.jsx
    │   │   ├── TrendingPage.jsx
    │   │   ├── CreatePage.jsx
    │   │   ├── SearchPage.jsx
    │   │   ├── BookmarksPage.jsx
    │   │   ├── ProfilePage.jsx
    │   │   └── AdminPage.jsx
    │   ├── utils/
    │   │   ├── api.js
    │   │   └── socket.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html        ← the one you asked for
    ├── .env              ← you create this
    ├── .env.example
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── postcss.config.js
```

---

## Step 3 — Configure Environment Variables

### Backend `.env`
Create a file called `.env` inside the `backend/` folder:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=confessional
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here

# JWT (make these long random strings — you can use: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=paste_a_long_random_string_here
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=paste_a_different_long_random_string_here
JWT_REFRESH_EXPIRES_IN=30d

# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Google OAuth (see Step 4)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Email (see Step 5)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_16_char_app_password
EMAIL_FROM=Confessional <your_gmail@gmail.com>

# Security
BCRYPT_ROUNDS=12
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_MINUTES=15
PASSWORD_RESET_EXPIRES_MINUTES=60
```

### Frontend `.env`
Create a file called `.env` inside the `frontend/` folder:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

---

## Step 4 — Google OAuth Setup (Free)

This enables "Continue with Google" on login/register.

1. Go to https://console.cloud.google.com
2. Click **"Select a project"** → **"New Project"** → Name it `Confessional` → Create
3. In the left menu: **APIs & Services** → **OAuth consent screen**
   - Choose **External** → Create
   - Fill in: App name = `Confessional`, User support email = your email
   - Under "Authorized domains" add: `localhost` (for testing)
   - Save and Continue through all steps
4. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
   - Application type: **Web application**
   - Name: `Confessional Web`
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000`
   - Click **Create**
5. Copy the **Client ID** and **Client Secret**
6. Paste them into both `.env` files

> 💡 For production: add your real domain to the authorized origins.

---

## Step 5 — Email Setup for Password Reset (Free via Gmail)

1. Go to your Google Account → https://myaccount.google.com/security
2. Enable **2-Step Verification** if not already on
3. Search for **"App passwords"** in your account settings
4. Select app: **Mail**, Select device: **Other** → type `Confessional`
5. Click **Generate** — copy the 16-character password shown
6. Paste it as `EMAIL_PASS` in your backend `.env`
7. Set `EMAIL_USER` to your Gmail address

> ⚠️ Never share your app password. It's different from your Google password.

---

## Step 6 — Install Dependencies

Open a terminal/command prompt:

```bash
# Install backend packages
cd confessional/backend
npm install

# Install frontend packages
cd ../frontend
npm install
```

---

## Step 7 — Run Database Migrations

This creates all the tables:

```bash
cd confessional/backend
npm run migrate
```

You should see: `✅ Migrations completed successfully`

Then seed the database with sample data and test accounts:

```bash
npm run seed
```

You should see:
```
✅ Seed data inserted
   Admin: admin@confessional.app / Admin@123!
   Demo:  demo@confessional.app  / Demo@123!
```

---

## Step 8 — Start the Application

You need **two terminal windows** open at the same time:

### Terminal 1 — Backend:
```bash
cd confessional/backend
npm run dev
```
You should see: `🚀 Confessional server running on port 5000`

### Terminal 2 — Frontend:
```bash
cd confessional/frontend
npm start
```
You should see: `Local: http://localhost:3000`

Open http://localhost:3000 in your browser!

---

## Test Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@confessional.app | Admin@123! | Admin (full access) |
| demo@confessional.app | Demo@123! | Regular user |

---

## How Real-Time Works

Once both users are logged in on different browser windows (or different devices on the same network):
- Post a confession → it appears instantly on the other screen
- Add a comment on an open post → the other user sees it live
- React to a post → counts update in real time

---

## Folder-by-Folder Explanation

```
backend/src/
├── config/database.js     — PostgreSQL connection pool
├── middleware/
│   ├── auth.js            — JWT verification, attaches req.user
│   ├── security.js        — Rate limiting, XSS sanitization
│   └── validate.js        — Input validation rules
├── migrations/
│   ├── schema.sql         — All database tables (run once)
│   ├── run.js             — Applies schema.sql
│   └── seed.js            — Sample data + test accounts
├── routes/
│   ├── auth.js            — Register, login, Google, reset password
│   ├── posts.js           — CRUD posts, reactions, comments, reports
│   └── admin.js           — Admin stats, ban users, review reports
├── utils/
│   ├── jwt.js             — Token generation & verification
│   └── email.js           — Nodemailer email templates
└── server.js              — Express app + Socket.io setup

frontend/src/
├── context/AuthContext.jsx — Global auth state, token storage
├── utils/
│   ├── api.js             — All API calls, auto token refresh
│   └── socket.js          — Socket.io connection manager
├── components/
│   ├── Layout.jsx         — Sidebar + mobile nav wrapper
│   ├── PostCard.jsx       — Confession card with reactions
│   └── PostModal.jsx      — Full post view with live comments
└── pages/                 — One file per page/route
```

---

## Deploying Online (So Friends Can Use It)

### Option A — Railway (Easiest, free tier available)
1. Push your code to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Add a PostgreSQL database from the Railway dashboard
4. Set all environment variables in Railway's Variables tab
5. Railway gives you a live URL automatically

### Option B — Render (Free)
1. Push to GitHub
2. https://render.com → New Web Service → connect GitHub repo
3. Add environment variables
4. Create a free PostgreSQL database on Render
5. Set `DATABASE_URL` to the Render database URL

### For the frontend:
- Build: `npm run build` (creates a `dist/` folder)
- Deploy `dist/` to Vercel or Netlify (both free)
- Update `VITE_API_URL` in frontend `.env` to your deployed backend URL

---

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `password authentication failed` | Check DB_PASSWORD in .env matches PostgreSQL password |
| `ECONNREFUSED 5432` | PostgreSQL isn't running — start it first |
| `relation "users" does not exist` | Run `npm run migrate` first |
| `Google sign-in failed` | Check GOOGLE_CLIENT_ID matches in both .env files |
| `Failed to send email` | Check EMAIL_PASS is the App Password, not your Google password |
| Port 5000 already in use | Change PORT in .env to 5001 |
| Port 3000 already in use | Vite will auto-pick 3001 |
| `Cannot find module` | Run `npm install` in that folder |

---

## Security Features Built In

- ✅ Passwords hashed with bcrypt (12 rounds)
- ✅ JWT access tokens (7 days) + refresh tokens (30 days)
- ✅ Account lockout after 5 failed login attempts
- ✅ Rate limiting on all endpoints (stricter on auth)
- ✅ XSS sanitization on all inputs
- ✅ SQL injection prevention (parameterized queries)
- ✅ Helmet.js security headers
- ✅ CORS restricted to frontend origin
- ✅ Password reset tokens hashed before storage
- ✅ Terms & Conditions acceptance recorded with timestamp

---

## Need Help?

If something isn't working, check:
1. Both terminal windows are running (no errors)
2. All `.env` values are filled in (no `your_xxx_here` placeholders)
3. PostgreSQL is running
4. You ran `npm run migrate` and `npm run seed`
5. You ran `npm install` in both backend and frontend folders
