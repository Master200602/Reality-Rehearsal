<<<<<<< HEAD
# 🎯 Reality Rehearsal

> **AI-Powered Interview Simulator** — Practice interviews with voice interaction, real-time behavior tracking, and auto-generated performance reports.

![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=flat-square&logo=node.js)
![React](https://img.shields.io/badge/React-v19-61DAFB?style=flat-square&logo=react)
![Gemini](https://img.shields.io/badge/Google_Gemini-API-4285F4?style=flat-square&logo=google)

---

## ✨ Features

- **🎯 Smart Questions** — AI-generated interview questions tailored to your domain and difficulty
- **🎙️ Voice Interaction** — Natural speech-based Q&A using Web Speech API
- **📊 Behavior Analysis** — Real-time posture and expression tracking via OpenCV.js + MediaPipe
- **📈 Performance Scoring** — Detailed evaluation across technical, communication, and behavioral metrics
- **📄 PDF Reports** — Downloadable comprehensive performance summaries
- **⚡ No Login Required** — Session-based architecture, no database needed

## 🛠️ Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 19 + Vite                     |
| Backend    | Node.js + Express.js                |
| AI Engine  | Google Gemini API (gemini-2.0-flash) |
| Speech     | Web Speech API (browser native)     |
| Vision     | OpenCV.js + MediaPipe               |
| PDF        | jsPDF + html2canvas                 |
| Styling    | Custom CSS (glassmorphism theme)    |

## 📁 Project Structure

```
reality-rehearsal/
├── frontend/               # React application (Vite)
│   ├── public/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components (routes)
│   │   ├── services/       # API service layer
│   │   ├── App.jsx         # Root component with routing
│   │   └── main.jsx        # Entry point
│   └── package.json
│
├── backend/                # Express.js API server
│   ├── routes/             # API route definitions
│   ├── controllers/        # Request handlers
│   ├── server.js           # Server entry point
│   └── package.json
│
├── docs/                   # Documentation
│   └── API.md              # API reference
│
├── .gitignore
├── README.md               # This file
└── SETUP.md                # Detailed setup guide
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- **Google Gemini API Key** ([Get one here](https://aistudio.google.com/apikey))

### 1. Clone & Install

```bash
# Clone the repository
git clone <your-repo-url> reality-rehearsal
cd reality-rehearsal

# Install backend dependencies
cd backend
npm install
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment

Edit `backend/.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

### 3. Start Development Servers

```bash
# Terminal 1 — Start Backend
cd backend
npm run dev

# Terminal 2 — Start Frontend
cd frontend
npm run dev
```

### 4. Open in Browser

| Service        | URL                                    |
|----------------|----------------------------------------|
| **Frontend**   | http://localhost:3000                   |
| **Backend**    | http://localhost:5000                   |
| **Health Check**| http://localhost:5000/api/health       |

## 📖 Documentation

- [Setup Guide](./SETUP.md) — Detailed installation and configuration
- [API Reference](./docs/API.md) — Backend API documentation

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

---

<p align="center">Built with ❤️ and AI</p>
=======
# Reality-Rehearsal
>>>>>>> 8ac7be80d1ddde408237e3298c65e5c7b9dfbd80
