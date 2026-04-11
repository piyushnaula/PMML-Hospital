# PMML Hospital Backend

This is the backend for the PMML Hospital Management System. It's built with PHP 8.2+, MongoDB, and Ratchet WebSockets to provide real-time queue management, appointments, and role-based access control (RBAC).

## Features

- **RBAC**: Admin, Queue Manager, Front Desk, Doctor, and Patient roles.
- **REST API**: HTTP endpoints for authentication, appointments, and doctors.
- **Real-time Queue**: WebSockets for live position updates and notifications.
- **Smart Assignment**: Automatically matches patients with available doctors based on symptoms and queue load.

## Tech Stack

- **PHP 8.2+** 
- **MongoDB 7.x** + `mongodb/mongodb` driver
- **Firebase JWT** (`firebase/php-jwt`)
- **Ratchet** (`cboden/ratchet`)
- **Router** (`bramus/router`)

## Prerequisites

1.  **PHP 8.2+** with the following extensions enabled in `php.ini`:
    - `extension=mongodb`
2.  **Composer** included globally to install dependencies.
3.  **MongoDB Server** running locally (or adjust `MONGO_URI` in `.env`).

*Note on MongoDB Extension on Windows:*
If `ext-mongodb` is missing, download the Thread Safe (TS) x64 DLL for your PHP version from [PECL releases](https://downloads.php.net/~windows/pecl/releases/mongodb/), extract `php_mongodb.dll` into your `C:\php\ext` directory, and add `extension=mongodb` to your `php.ini`.

## Setup

1. **Install dependencies:**
   ```bash
   composer install
   ```
2. **Setup environment:**
   Create a `.env` file in the root backend directory:
   ```env
   # MongoDB
   MONGO_URI=mongodb://localhost:27017
   MONGO_DB=pmml_hospital

   # JWT
   JWT_SECRET=your_super_secret_key_here
   JWT_EXPIRY=86400

   # App
   APP_URL=http://localhost:8000
   WS_PORT=8001
   UPLOAD_PATH=./uploads/certs/
   ```
   *Make sure to create the `uploads/certs/` directory as it is meant for doctor certificate storage.*

## Running the Servers

To run the backend fully, you need to spin up two servers: the HTTP REST API server, and the WebSocket server. Open two separate terminal windows inside the `backend` directory.

### 1. HTTP REST API
Serves all authentication and data endpoints.
```bash
php -S localhost:8000 index.php
```
*API Base URL is `http://localhost:8000/api`*

### 2. WebSocket Node
Handles real-time push notifications for the queue.
```bash
php websocket/Server.php
```
*WebSocket connects at `ws://localhost:8001`*

## Key Endpoints

- **Auth**: `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`
- **Appointments**: `POST /api/appointments`, `GET /api/appointments/my`, `PUT /api/appointments/:id/status`
- **Queue**: `GET /api/queue/:doctorId`, `POST /api/queue/next`, `POST /api/queue/skip/:appointmentId`
- **Doctors**: `GET /api/doctors`, `POST /api/doctors`
- **Dashboard**: `GET /api/dashboard`
