import { useState, useEffect, useContext, useCallback } from "react";
import { AppContext } from "../context/AppContext.jsx";
import { useWebSocket } from "../hooks/useWebSocket.js";
import Modal from "../components/Modal.jsx";
import * as api from "../api/index.js";

const statusBadge = {
  pending:     { bg: "#ebf8ff", color: "#2b6cb0", label: "Pending" },
  confirmed:   { bg: "#f0fff4", color: "#276749", label: "Confirmed" },
  in_queue:    { bg: "#fefcbf", color: "#744210", label: "In Queue" },
  skipped:     { bg: "#fff5f5", color: "#c53030", label: "Skipped" },
  completed:   { bg: "#f0fff4", color: "#276749", label: "Completed" },
  cancelled:   { bg: "#fff5f5", color: "#c53030", label: "Cancelled" },
  rescheduled: { bg: "#faf5ff", color: "#553c9a", label: "Rescheduled" },
};

const WS_MESSAGES = {
  "queue.position": (msg) =>
    msg.position === 1 ? "You are next!" : `${msg.position} patients ahead — ${positionHint(msg.position)}`,
  "queue.your_turn": () => "🔔 It's your turn — go to the doctor now!",
  "queue.skipped": () => "You were skipped. Please contact the front desk.",
  "queue.cancelled": () => "Your appointment was cancelled.",
};

function positionHint(pos) {
  if (pos === 5) return "start heading over";
  if (pos === 3) return "please be ready";
  if (pos === 2) return "proceed to waiting area";
  return "";
}

export default function PatientDashboard() {
  const { user, token, logout } = useContext(AppContext);

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState(null);

  // Modals
  const [bookOpen, setBookOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  // Booking form
  const [bookForm, setBookForm] = useState({
    problem_description: "",
    appointment_date: "",
    time_slot: { start: "09:00", end: "09:30" },
  });
  const [bookLoading, setBookLoading] = useState(false);
  const [bookError, setBookError] = useState(null);

  // Reschedule form
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    new_date: "",
    new_time_slot: { start: "09:00", end: "09:30" },
  });
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const fetchAppointments = useCallback(async () => {
    try {
      const data = await api.getMyAppointments(token);
      setAppointments(data.appointments || []);
    } catch (err) {
      if (err?.error?.includes("token") || err?.error?.includes("Token")) {
        logout();
      } else {
        setError("Could not load appointments.");
      }
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Active (today's pending/confirmed/in_queue) appointment for WS subscription
  const today = new Date().toISOString().split("T")[0];
  const activeAppt = appointments.find(
    (a) =>
      a.appointment_date === today &&
      ["pending", "confirmed", "in_queue"].includes(a.status)
  );

  // WebSocket
  const handleWsMessage = useCallback((msg) => {
    const builder = WS_MESSAGES[msg.event];
    if (!builder) return;
    const text = builder(msg);
    const note = { id: Date.now(), text, event: msg.event, time: new Date().toLocaleTimeString() };
    setNotifications((prev) => [note, ...prev].slice(0, 20));
    showToast(text);

    // Refresh appointments so queue_position updates in UI
    fetchAppointments();
  }, [fetchAppointments]);

  const { send } = useWebSocket(handleWsMessage);

  useEffect(() => {
    if (activeAppt?._id) {
      send({ event: "subscribe", appointment_id: activeAppt._id });
    }
  }, [activeAppt?._id, send]);

  // Confirm appointment
  const handleConfirm = async (apptId) => {
    try {
      await api.updateAppointmentStatus(apptId, "confirmed", token);
      fetchAppointments();
      showToast("Appointment confirmed!");
    } catch (err) {
      showToast(err?.error || "Could not confirm.");
    }
  };

  // Cancel appointment
  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    try {
      await api.updateAppointmentStatus(cancelTarget, "cancelled", token);
      setCancelTarget(null);
      fetchAppointments();
      showToast("Appointment cancelled.");
    } catch (err) {
      showToast(err?.error || "Could not cancel.");
    }
  };

  // Book appointment
  const handleBook = async () => {
    setBookError(null);
    if (!bookForm.problem_description.trim()) {
      setBookError("Please describe your problem.");
      return;
    }
    if (!bookForm.appointment_date) {
      setBookError("Please select a date.");
      return;
    }
    setBookLoading(true);
    try {
      await api.bookAppointment(
        {
          booking_type: "online",
          problem_description: bookForm.problem_description.trim(),
          appointment_date: bookForm.appointment_date,
          time_slot: bookForm.time_slot,
          doctor_id: null, // auto-assign
        },
        token
      );
      setBookOpen(false);
      setBookForm({ problem_description: "", appointment_date: "", time_slot: { start: "09:00", end: "09:30" } });
      fetchAppointments();
      showToast("Appointment booked!");
    } catch (err) {
      setBookError(err?.error || "Booking failed. No available doctor may be found.");
    } finally {
      setBookLoading(false);
    }
  };

  // Reschedule appointment
  const handleReschedule = async () => {
    setRescheduleError(null);
    if (!rescheduleForm.new_date) {
      setRescheduleError("Please select a new date.");
      return;
    }
    setRescheduleLoading(true);
    try {
      await api.rescheduleAppointment(
        {
          appointment_id: rescheduleTarget._id,
          new_date: rescheduleForm.new_date,
          new_time_slot: rescheduleForm.new_time_slot,
        },
        token
      );
      setRescheduleOpen(false);
      setRescheduleTarget(null);
      fetchAppointments();
      showToast("Appointment rescheduled!");
    } catch (err) {
      setRescheduleError(err?.error || "Reschedule failed.");
    } finally {
      setRescheduleLoading(false);
    }
  };

  const pageStyle = { padding: "28px 24px", maxWidth: "860px", margin: "0 auto" };
  const cardStyle = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  };

  return (
    <div style={pageStyle}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "72px",
            right: "24px",
            background: "#1e3a5f",
            color: "#fff",
            padding: "14px 20px",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            zIndex: 999,
            maxWidth: "320px",
            fontSize: "14px",
          }}
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#1a202c" }}>
            Welcome, {user.name}
          </h1>
          <p style={{ color: "#718096", fontSize: "14px", marginTop: "2px" }}>
            {today}
          </p>
        </div>
        <button
          onClick={() => setBookOpen(true)}
          style={{
            background: "#1e3a5f",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          + Book Appointment
        </button>
      </div>

      {/* Today's Active Queue Position */}
      {activeAppt && (
        <div style={{ ...cardStyle, borderLeft: "4px solid #3b82f6" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px", color: "#1a202c" }}>
            Your Queue Position Today
          </h2>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "48px", fontWeight: 800, color: "#3b82f6" }}>
                {activeAppt.queue_position}
              </div>
              <div style={{ fontSize: "12px", color: "#718096" }}>Your Position</div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", justifyContent: "center" }}>
              <div style={{ fontSize: "14px", color: "#4a5568" }}>
                <strong>Problem:</strong> {activeAppt.problem_description}
              </div>
              <div style={{ fontSize: "14px", color: "#4a5568" }}>
                <strong>Time Slot:</strong> {activeAppt.time_slot?.start} – {activeAppt.time_slot?.end}
              </div>
              <div style={{ fontSize: "14px" }}>
                <strong>Status:</strong>{" "}
                <span
                  style={{
                    background: statusBadge[activeAppt.status]?.bg || "#edf2f7",
                    color: statusBadge[activeAppt.status]?.color || "#4a5568",
                    padding: "2px 10px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  {statusBadge[activeAppt.status]?.label || activeAppt.status}
                </span>
              </div>
            </div>
            {activeAppt.status === "pending" && (
              <div style={{ display: "flex", gap: "8px", alignSelf: "center" }}>
                <button
                  onClick={() => handleConfirm(activeAppt._id)}
                  style={{
                    background: "#38a169",
                    color: "#fff",
                    border: "none",
                    borderRadius: "7px",
                    padding: "9px 16px",
                    fontWeight: 600,
                    fontSize: "13px",
                  }}
                >
                  Confirm Arrival
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications */}
      {notifications.length > 0 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px", color: "#1a202c" }}>
            Notifications
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  background: "#ebf8ff",
                  border: "1px solid #bee3f8",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "14px",
                  color: "#2c5282",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{n.text}</span>
                <span style={{ fontSize: "12px", opacity: 0.7 }}>{n.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Appointments */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", color: "#1a202c" }}>
          All Appointments
        </h2>

        {loading && <p style={{ color: "#718096" }}>Loading...</p>}
        {error && <p style={{ color: "#e53e3e" }}>{error}</p>}
        {!loading && appointments.length === 0 && (
          <p style={{ color: "#718096", fontSize: "14px" }}>
            No appointments yet. Book one above!
          </p>
        )}

        {appointments.map((appt) => {
          const badge = statusBadge[appt.status] || {};
          const isActive = ["pending", "confirmed", "in_queue"].includes(appt.status);
          return (
            <div
              key={appt._id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "14px 18px",
                marginBottom: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "14px", color: "#1a202c" }}>
                  {appt.appointment_date} &nbsp;·&nbsp; {appt.time_slot?.start}–{appt.time_slot?.end}
                </div>
                <div style={{ fontSize: "13px", color: "#718096", marginTop: "3px" }}>
                  {appt.problem_description}
                </div>
                <div style={{ fontSize: "12px", color: "#a0aec0", marginTop: "2px" }}>
                  Queue #{appt.queue_position} &nbsp;·&nbsp; Appt #{appt.appointment_number}
                </div>
              </div>

              <span
                style={{
                  background: badge.bg || "#edf2f7",
                  color: badge.color || "#4a5568",
                  padding: "4px 12px",
                  borderRadius: "16px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {badge.label || appt.status}
              </span>

              {isActive && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => {
                      setRescheduleTarget(appt);
                      setRescheduleOpen(true);
                    }}
                    style={{
                      background: "#edf2f7",
                      color: "#4a5568",
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 500,
                    }}
                  >
                    Reschedule
                  </button>
                  <button
                    onClick={() => setCancelTarget(appt._id)}
                    style={{
                      background: "#fff5f5",
                      color: "#c53030",
                      border: "1px solid #fed7d7",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 500,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Book Appointment Modal */}
      <Modal isOpen={bookOpen} onClose={() => setBookOpen(false)} title="Book New Appointment" size="md">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#4a5568", marginBottom: "6px" }}>
              Describe your problem / symptoms
            </label>
            <textarea
              value={bookForm.problem_description}
              onChange={(e) => setBookForm((p) => ({ ...p, problem_description: e.target.value }))}
              rows={3}
              placeholder="e.g. Chest pain, headache, skin rash..."
              style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "10px", fontSize: "14px", resize: "vertical" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#4a5568", marginBottom: "6px" }}>
              Appointment Date
            </label>
            <input
              type="date"
              value={bookForm.appointment_date}
              min={today}
              onChange={(e) => setBookForm((p) => ({ ...p, appointment_date: e.target.value }))}
              style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "10px", fontSize: "14px" }}
            />
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#4a5568", marginBottom: "6px" }}>
                Start Time
              </label>
              <input
                type="time"
                value={bookForm.time_slot.start}
                onChange={(e) =>
                  setBookForm((p) => ({ ...p, time_slot: { ...p.time_slot, start: e.target.value } }))
                }
                style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "10px", fontSize: "14px" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#4a5568", marginBottom: "6px" }}>
                End Time
              </label>
              <input
                type="time"
                value={bookForm.time_slot.end}
                onChange={(e) =>
                  setBookForm((p) => ({ ...p, time_slot: { ...p.time_slot, end: e.target.value } }))
                }
                style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "10px", fontSize: "14px" }}
              />
            </div>
          </div>

          <p style={{ fontSize: "12px", color: "#718096" }}>
            A doctor will be automatically assigned based on your problem.
          </p>

          {bookError && (
            <div style={{ background: "#fff5f5", border: "1px solid #fed7d7", borderRadius: "7px", padding: "10px", fontSize: "13px", color: "#c53030" }}>
              {bookError}
            </div>
          )}

          <button
            onClick={handleBook}
            disabled={bookLoading}
            style={{
              background: bookLoading ? "#a0aec0" : "#1e3a5f",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "12px",
              fontWeight: 600,
              fontSize: "15px",
              marginTop: "4px",
            }}
          >
            {bookLoading ? "Booking..." : "Confirm Booking"}
          </button>
        </div>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Appointment"
        size="sm"
      >
        <p style={{ color: "#4a5568", fontSize: "14px", marginBottom: "20px" }}>
          Are you sure you want to cancel this appointment? This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleCancelConfirm}
            style={{
              flex: 1,
              background: "#e53e3e",
              color: "#fff",
              border: "none",
              borderRadius: "7px",
              padding: "11px",
              fontWeight: 600,
            }}
          >
            Yes, Cancel
          </button>
          <button
            onClick={() => setCancelTarget(null)}
            style={{
              flex: 1,
              background: "#edf2f7",
              color: "#4a5568",
              border: "none",
              borderRadius: "7px",
              padding: "11px",
              fontWeight: 600,
            }}
          >
            Keep It
          </button>
        </div>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        isOpen={rescheduleOpen}
        onClose={() => {
          setRescheduleOpen(false);
          setRescheduleTarget(null);
          setRescheduleError(null);
        }}
        title="Reschedule Appointment"
        size="md"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#4a5568", marginBottom: "6px" }}>
              New Date
            </label>
            <input
              type="date"
              value={rescheduleForm.new_date}
              min={today}
              onChange={(e) => setRescheduleForm((p) => ({ ...p, new_date: e.target.value }))}
              style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "10px", fontSize: "14px" }}
            />
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#4a5568", marginBottom: "6px" }}>
                Start Time
              </label>
              <input
                type="time"
                value={rescheduleForm.new_time_slot.start}
                onChange={(e) =>
                  setRescheduleForm((p) => ({
                    ...p,
                    new_time_slot: { ...p.new_time_slot, start: e.target.value },
                  }))
                }
                style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "10px", fontSize: "14px" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#4a5568", marginBottom: "6px" }}>
                End Time
              </label>
              <input
                type="time"
                value={rescheduleForm.new_time_slot.end}
                onChange={(e) =>
                  setRescheduleForm((p) => ({
                    ...p,
                    new_time_slot: { ...p.new_time_slot, end: e.target.value },
                  }))
                }
                style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "10px", fontSize: "14px" }}
              />
            </div>
          </div>

          {rescheduleError && (
            <div style={{ background: "#fff5f5", border: "1px solid #fed7d7", borderRadius: "7px", padding: "10px", fontSize: "13px", color: "#c53030" }}>
              {rescheduleError}
            </div>
          )}

          <button
            onClick={handleReschedule}
            disabled={rescheduleLoading}
            style={{
              background: rescheduleLoading ? "#a0aec0" : "#1e3a5f",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "12px",
              fontWeight: 600,
              fontSize: "15px",
            }}
          >
            {rescheduleLoading ? "Rescheduling..." : "Confirm Reschedule"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
