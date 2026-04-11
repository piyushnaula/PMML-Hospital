const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const BASE = API_URL.endsWith("/api") ? API_URL : `${API_URL}/api`;

const headers = (token, json = true) => ({
  ...(json && { "Content-Type": "application/json" }),
  ...(token && { Authorization: `Bearer ${token}` }),
});

const handle = async (res) => {
  // Handle network-level errors and non-JSON responses gracefully
  let data;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    throw {
      error: `Server returned invalid response (HTTP ${res.status})`,
      code: "PARSE_ERROR",
    };
  }

  if (!res.ok) {
    throw data;
  }
  return data;
};

/**
 * Wrapper around fetch that catches network errors (DNS, CORS, offline)
 * and converts them into a consistent error shape.
 */
const safeFetch = async (url, options = {}) => {
  try {
    const res = await fetch(url, options);
    return handle(res);
  } catch (err) {
    // If it's already our shaped error object, re-throw
    if (err && err.code) throw err;

    // Network-level failure (CORS block, offline, DNS failure, etc.)
    throw {
      error: "Unable to reach the server. Please check your connection.",
      code: "NETWORK_ERROR",
    };
  }
};

// ── AUTH ──────────────────────────────────────────────────────────
export const register = (body) =>
  safeFetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: headers(null),
    body: JSON.stringify(body),
  });

export const login = (body) =>
  safeFetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: headers(null),
    body: JSON.stringify(body),
  });

export const getMe = (token) =>
  safeFetch(`${BASE}/auth/me`, { headers: headers(token) });

// ── APPOINTMENTS ──────────────────────────────────────────────────
export const bookAppointment = (body, token) =>
  safeFetch(`${BASE}/appointments`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body),
  });

export const getMyAppointments = (token) =>
  safeFetch(`${BASE}/appointments/my`, { headers: headers(token) });

export const updateAppointmentStatus = (id, status, token) =>
  safeFetch(`${BASE}/appointments/${id}/status`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify({ status }),
  });

export const rescheduleAppointment = (body, token) =>
  safeFetch(`${BASE}/appointments/reschedule`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body),
  });

export const getAppointmentsByDate = (date, token, doctorId = null) =>
  safeFetch(
    `${BASE}/appointments/date/${date}${doctorId ? `?doctor_id=${doctorId}` : ""}`,
    { headers: headers(token) }
  );

// ── QUEUE ─────────────────────────────────────────────────────────
export const getQueue = (doctorId, token) =>
  safeFetch(`${BASE}/queue/${doctorId}`, { headers: headers(token) });

export const advanceQueue = (doctorId, token) =>
  safeFetch(`${BASE}/queue/next`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ doctor_id: doctorId }),
  });

export const skipPatient = (appointmentId, reason, token) =>
  safeFetch(`${BASE}/queue/skip/${appointmentId}`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ reason }),
  });

// ── DOCTORS ───────────────────────────────────────────────────────
export const getDoctors = () =>
  safeFetch(`${BASE}/doctors`);

export const addDoctor = (formData, token) =>
  safeFetch(`${BASE}/doctors`, {
    method: "POST",
    headers: headers(token, false),
    body: formData,
  });

export const updateDoctor = (id, body, token) =>
  safeFetch(`${BASE}/doctors/${id}`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify(body),
  });

export const deleteDoctor = (id, token) =>
  safeFetch(`${BASE}/doctors/${id}`, {
    method: "DELETE",
    headers: headers(token),
  });

export const uploadDoctorCert = (id, file, token) => {
  const fd = new FormData();
  fd.append("certificate", file);
  return safeFetch(`${BASE}/doctors/${id}`, {
    method: "PUT",
    headers: headers(token, false), // no Content-Type — browser sets multipart boundary
    body: fd,
  });
};

export const assignDoctor = (problem, date, token) =>
  safeFetch(
    `${BASE}/doctors/assign?problem=${encodeURIComponent(problem)}&date=${date}`,
    { headers: headers(token) }
  );

// ── DASHBOARD + ADMIN ─────────────────────────────────────────────
export const getDashboard = (token) =>
  safeFetch(`${BASE}/dashboard`, { headers: headers(token) });

export const getAdminUsers = (token) =>
  safeFetch(`${BASE}/admin/users`, { headers: headers(token) });

export const addAdminUser = (formData, token) =>
  safeFetch(`${BASE}/admin/users`, {
    method: "POST",
    headers: headers(token, false),
    body: formData,
  });

export const updateAdminUser = (id, body, token) =>
  safeFetch(`${BASE}/admin/users/${id}`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify(body),
  });
