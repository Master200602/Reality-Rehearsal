# 🔧 Reality Rehearsal — Setup Guide

Complete step-by-step instructions to get the project running on your local machine.

---

## Prerequisites

Before you begin, ensure you have the following installed:

| Tool     | Minimum Version | Check Command        |
|----------|----------------|----------------------|
| Node.js  | v18.0.0        | `node --version`     |
| npm      | v9.0.0         | `npm --version`      |
| Git      | v2.30.0        | `git --version`      |

### Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy and save the key securely

> [!NOTE]
> The app will still run without an API key, but AI features (question generation, answer evaluation) will return mock/demo data.

---

## Installation

### Step 1: Clone the Repository

```bash
git clone <your-repo-url> reality-rehearsal
cd reality-rehearsal
```

Or if you already have the folder:

```bash
cd reality-rehearsal
```

### Step 2: Install Backend Dependencies

```bash
cd backend
npm install
```

### Step 3: Configure Backend Environment

```bash
# Copy the example environment file
cp .env.example .env
```

Now edit `backend/.env` with your text editor and set your API key:

```env
PORT=5000
NODE_ENV=development
GEMINI_API_KEY=your_actual_gemini_api_key_here
FRONTEND_URL=http://localhost:3000
```

### Step 4: Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### Step 5: (Optional) Configure Frontend Environment

The frontend uses Vite's proxy to forward API requests, so no environment configuration is needed for local development. If you want to customize:

```bash
cp .env.example .env
```

---

## Running the Application

You need **two terminal windows** to run both servers simultaneously.

### Terminal 1 — Backend Server

```bash
cd reality-rehearsal/backend
npm run dev
```

Expected output:
```
🚀 Reality Rehearsal server running on http://localhost:5000
📡 Environment: development
```

### Terminal 2 — Frontend Server

```bash
cd reality-rehearsal/frontend
npm run dev
```

Expected output:
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
```

### Verify Everything Works

1. **Backend Health Check:** Open http://localhost:5000/api/health in your browser
   - You should see: `{ "status": "ok", "timestamp": "...", ... }`

2. **Frontend:** Open http://localhost:3000 in your browser
   - You should see the Reality Rehearsal landing page

3. **API Communication:** The frontend connects to the backend via Vite's proxy
   - No CORS issues in development mode

---

## Verification Checklist

- [ ] Node.js v18+ installed
- [ ] npm v9+ installed
- [ ] Backend dependencies installed (`backend/node_modules` exists)
- [ ] Frontend dependencies installed (`frontend/node_modules` exists)
- [ ] Backend `.env` file created with Gemini API key
- [ ] Backend starts without errors on port 5000
- [ ] Frontend starts without errors on port 3000
- [ ] Health check endpoint responds at `/api/health`
- [ ] Landing page loads in browser
- [ ] No console errors in browser DevTools

---

## Common Issues

### Port Already in Use

If port 3000 or 5000 is already in use:

```bash
# Windows: Find process using port
netstat -ano | findstr :3000
# Kill it
taskkill /PID <PID> /F

# Or change ports in the config files
```

### Module Not Found Errors

```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Gemini API Errors

- Verify your API key is correct in `backend/.env`
- Ensure you have API access enabled in Google AI Studio
- Check your API quota limits

---

## Project URLs

| Service          | URL                              |
|------------------|----------------------------------|
| Frontend         | http://localhost:3000             |
| Backend          | http://localhost:5000             |
| API Health Check | http://localhost:5000/api/health  |

---

## Next Steps After Setup

1. **Add your Gemini API key** to `backend/.env`
2. **Start both servers** using the commands above
3. **Open the frontend** at http://localhost:3000
4. **Try the interview setup** — select a domain and start practicing!

---

<p align="center">Need help? Open an issue on GitHub.</p>
