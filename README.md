# PMML Hospital Management System

A full-stack, real-time hospital queue management system featuring live patient tracking via WebSockets, role-based access control, smart doctor assignment, certificate verification, and a complete administration portal.

**Stack:** React 18 · Vite · PHP 8 · MongoDB · Ratchet WebSocket · JWT

---

## 📋 Table of Contents

- [System Architecture](#-system-architecture)
- [Features](#-features)
- [Quick Start (Local)](#-quick-start-local-development)
- [Dummy Credentials](#-dummy-credentials)
- [Deployment](#-production-deployment)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)

---

## 🏗️ System Architecture

```
┌──────────────────────┐     HTTP/JSON      ┌──────────────────────────┐
│   React Frontend     │ ◄────────────────► │   PHP REST API           │
│   (Vite · Port 5173) │                    │   (Port 8000)            │
│                      │     WebSocket      │                          │
│   useWebSocket.js    │ ◄────────────────► │   Ratchet WS Server      │
│                      │                    │   (Port 8001)            │
└──────────────────────┘                    └────────┬─────────────────┘
                                                     │ MongoDB Driver
                                                     ▼
                                            ┌──────────────────────┐
                                            │   MongoDB 7.x        │
                                            │   DB: pmml_hospital   │
                                            │                      │
                                            │   Collections:        │
                                            │   users · doctors     │
                                            │   appointments · queues│
                                            └──────────────────────┘
```

---

## ✨ Features

### Patient Portal
- Book appointments with smart doctor auto-assignment
- Live queue position tracking via WebSocket
- Confirm arrival, reschedule, or cancel appointments
- Real-time notifications: "5 ahead", "You're next!", "Your turn!"

### Staff Portal (Front Desk / Queue Manager)
- Live queue monitor for all active doctors
- Walk-in patient booking
- Advance queue, skip patients (with reason), mark attendance

### Doctor Panel
- View own live queue for the day
- Toggle duty status (on_duty / off_duty / in_consultation)
- Upload medical certificates (JPG, PNG, PDF)

### Admin Dashboard
- Hospital-wide statistics and alerts
- User management with role switching
- Add doctors with certificate upload
- Add staff (Front Desk, Queue Manager, Admin) with document upload
- Certificate verification workflow

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **PHP 8.2+** with `mongodb` extension enabled
- **MongoDB 7.x** running locally
- **Node.js 18+** and npm
- **Composer** (PHP package manager)

### Step 1 — Start MongoDB
```bash
mongod
```

### Step 2 — Backend Setup
```bash
cd backend
composer install
```

### Step 3 — Start the HTTP REST API (Terminal 1)
```bash
cd backend
php -S localhost:8000 index.php
```

### Step 4 — Start the WebSocket Server (Terminal 2)
```bash
cd backend
php websocket/Server.php
```

### Step 5 — Frontend Setup & Start (Terminal 3)
```bash
cd frontend
npm install
npm run dev
```

### Step 6 — Open in Browser
Navigate to **http://localhost:5173** and log in with any credential below.

---

## 🔐 Dummy Credentials

All seeded accounts use the same password: **`password123`**

### 🛡️ Admin
| Name | Email | Role |
|------|-------|------|
| Super Admin | `admin@pmml.com` | `admin` |

### 🏥 Staff
| Name | Email | Role |
|------|-------|------|
| Amit Verma | `desk@pmml.com` | `front_desk` |
| Neha Gupta | `manager@pmml.com` | `queue_manager` |

### 👨‍⚕️ Doctors
| Name | Specialization | Email |
|------|----------------|-------|
| Dr. Rajesh Sharma | Cardiology | `rajesh@pmml.com` |
| Dr. Priya Patel | General Medicine | `priya@pmml.com` |
| Dr. Anil Kumar | Orthopedics | `anil@pmml.com` |
| Dr. Sunita Reddy | Pediatrics | `sunita@pmml.com` |
| Dr. Vikram Singh | Neurology | `vikram@pmml.com` |

### 🤒 Patients
| Name | Email |
|------|-------|
| Rahul Mehta | `patient0@pmml.com` |
| Sneha Kapoor | `patient1@pmml.com` |
| Karan Johar | `patient2@pmml.com` |
| Arjun Das | `patient3@pmml.com` |
| Riya Sen | `patient4@pmml.com` |

### Role → Landing Page
| Role | Redirect Path |
|------|---------------|
| `patient` | `/patient` |
| `front_desk` | `/queue` |
| `queue_manager` | `/queue` |
| `doctor` | `/doctor/panel` |
| `admin` | `/dashboard` |

---

## ☁️ Production Deployment

### Frontend → Vercel

1. Push your repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo.
3. Set **Root Directory** to `frontend`.
4. Set **Framework Preset** to `Vite`.
5. Add **Environment Variables** in the Vercel dashboard:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://pmml-hospital-api.onrender.com/api` |
| `VITE_WS_URL` | `wss://pmml-hospital-ws.onrender.com` |

6. Click **Deploy**. Vercel handles the build (`npm run build`) automatically.

> The included `vercel.json` ensures all React Router paths rewrite to `index.html`.

---

### Backend → Render

The backend requires **two Web Services** on Render (one for the REST API and one for the persistent WebSocket server). A `render.yaml` Blueprint is included to automate this.

#### Option A: Render Blueprint (Recommended)
1. Push your repo to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Blueprint**.
3. Connect your GitHub repo. Render reads `render.yaml` and creates both services automatically.
4. Set the `MONGO_URI` environment variable manually in both services to your **MongoDB Atlas** connection string (e.g., `mongodb+srv://user:pass@cluster.mongodb.net/pmml_hospital`).

#### Option B: Manual Setup
Create two **Web Services** in Render:

**Service 1: REST API**
- **Name:** `pmml-hospital-api`
- **Build Command:** `cd backend && composer install --no-dev --optimize-autoloader`
- **Start Command:** `cd backend && php -S 0.0.0.0:$PORT index.php`

**Service 2: WebSocket Server**
- **Name:** `pmml-hospital-ws`
- **Build Command:** `cd backend && composer install --no-dev --optimize-autoloader`
- **Start Command:** `cd backend && php websocket/Server.php`

Set environment variables for both services (see table below).

---

## 🔧 Environment Variables

### Backend (`backend/.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGO_DB` | `pmml_hospital` | Database name |
| `JWT_SECRET` | `your_super_secret_key_here` | Secret for signing JWT tokens |
| `JWT_EXPIRY` | `86400` | Token TTL in seconds (24h) |
| `APP_URL` | `http://localhost:8000` | Public API base URL |
| `WS_PORT` | `8001` | WebSocket server port |
| `WS_TCP_PORT` | `8002` | Internal TCP push listener port |
| `WS_INTERNAL_HOST` | `127.0.0.1` | Hostname of WS server (Render private network in prod) |
| `UPLOAD_PATH` | `./uploads/certs/` | File upload directory |

### Frontend (`frontend/.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000/api` | Backend REST API base URL |
| `VITE_WS_URL` | `ws://localhost:8001` | WebSocket server URL |

---

## 📁 Project Structure

```
pmml-hospital-prototype/
│
├── README.md                  # ← You are here
├── render.yaml                # Render Blueprint (Infrastructure-as-Code)
│
├── backend/
│   ├── .env                   # Backend environment config
│   ├── composer.json          # PHP dependencies
│   ├── index.php              # HTTP entry point + CORS
│   ├── routes.php             # All 20 API route definitions
│   ├── config/db.php          # MongoDB connection + constants
│   ├── middleware/Auth.php    # JWT verification + RBAC
│   ├── controllers/
│   │   ├── AuthController.php
│   │   ├── AppointmentController.php
│   │   ├── QueueController.php
│   │   ├── DoctorController.php
│   │   ├── DashboardController.php
│   │   └── AdminController.php
│   ├── services/
│   │   ├── QueueService.php   # Queue reorder + WS notifications
│   │   └── DoctorAssign.php   # Smart specialization matching
│   ├── websocket/
│   │   └── Server.php         # Ratchet WebSocket + TCP listener
│   └── uploads/certs/         # Uploaded certificates storage
│
├── frontend/
│   ├── .env.example           # Environment variable template
│   ├── vercel.json            # Vercel SPA rewrite config
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── api/index.js       # All 20 API call functions
│       ├── context/AppContext.jsx
│       ├── hooks/useWebSocket.js
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── Modal.jsx
│       │   └── QueueCard.jsx
│       └── pages/
│           ├── Auth.jsx
│           ├── PatientDashboard.jsx
│           ├── QueueMonitor.jsx
│           ├── HospitalDashboard.jsx
│           ├── DoctorList.jsx
│           ├── DoctorPanel.jsx
│           └── AdminPanel.jsx
```

---

## 📝 License

This project is a prototype developed for the PMML Hospital Management System.

---

*PMML Hospital · Full-Stack Prototype · React 18 · PHP 8 · MongoDB · Ratchet WebSocket*
