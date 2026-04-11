const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const headers = (token, json = true) => ({
  ...(json && { "Content-Type": "application/json" }),
  ...(token && { Authorization: `Bearer ${token}` }),
});

const handle = async (res) => {
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
};

// ── AUTH ──────────────────────────────────────────────────────────
export const register = (body) =>
  fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: headers(null),
    body: JSON.stringify(body),
  }).then(handle);

export const login = (body) =>
  fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: headers(null),
    body: JSON.stringify(body),
  }).then(handle);

export const getMe = (token) =>
  fetch(`${BASE}/auth/me`, { headers: headers(token) }).then(handle);

// ── APPOINTMENTS ──────────────────────────────────────────────────
export const bookAppointment = (body, token) =>
  fetch(`${BASE}/appointments`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body),
  }).then(handle);

export const getMyAppointments = (token) =>
  fetch(`${BASE}/appointments/my`, { headers: headers(token) }).then(handle);

export const updateAppointmentStatus = (id, status, token) =>
  fetch(`${BASE}/appointments/${id}/status`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify({ status }),
  }).then(handle);

export const rescheduleAppointment = (body, token) =>
  fetch(`${BASE}/appointments/reschedule`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body),
  }).then(handle);

export const getAppointmentsByDate = (date, token, doctorId = null) =>
  fetch(
    `${BASE}/appointments/date/${date}${doctorId ? `?doctor_id=${doctorId}` : ""}`,
    { headers: headers(token) }
  ).then(handle);

// ── QUEUE ─────────────────────────────────────────────────────────
export const getQueue = (doctorId, token) =>
  fetch(`${BASE}/queue/${doctorId}`, { headers: headers(token) }).then(handle);

export const advanceQueue = (doctorId, token) =>
  fetch(`${BASE}/queue/next`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ doctor_id: doctorId }),
  }).then(handle);

export const skipPatient = (appointmentId, reason, token) =>
  fetch(`${BASE}/queue/skip/${appointmentId}`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ reason }),
  }).then(handle);

// ── DOCTORS ───────────────────────────────────────────────────────
export const getDoctors = () =>
  fetch(`${BASE}/doctors`).then(handle);

export const addDoctor = (formData, token) =>
  fetch(`${BASE}/doctors`, {
    method: "POST",
    headers: headers(token, false),
    body: formData,
  }).then(handle);

export const updateDoctor = (id, body, token) =>
  fetch(`${BASE}/doctors/${id}`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify(body),
  }).then(handle);

export const deleteDoctor = (id, token) =>
  fetch(`${BASE}/doctors/${id}`, {
    method: "DELETE",
    headers: headers(token),
  }).then(handle);

export const uploadDoctorCert = (id, file, token) => {
  const fd = new FormData();
  fd.append("certificate", file);
  return fetch(`${BASE}/doctors/${id}`, {
    method: "PUT",
    headers: headers(token, false), // no Content-Type — browser sets multipart boundary
    body: fd,
  }).then(handle);
};

export const assignDoctor = (problem, date, token) =>
  fetch(
    `${BASE}/doctors/assign?problem=${encodeURIComponent(problem)}&date=${date}`,
    { headers: headers(token) }
  ).then(handle);

// ── DASHBOARD + ADMIN ─────────────────────────────────────────────
export const getDashboard = (token) =>
  fetch(`${BASE}/dashboard`, { headers: headers(token) }).then(handle);

export const getAdminUsers = (token) =>
  fetch(`${BASE}/admin/users`, { headers: headers(token) }).then(handle);

export const addAdminUser = (formData, token) =>
  fetch(`${BASE}/admin/users`, {
    method: "POST",
    headers: headers(token, false),
    body: formData,
  }).then(handle);

export const updateAdminUser = (id, body, token) =>
  fetch(`${BASE}/admin/users/${id}`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify(body),
  }).then(handle);
