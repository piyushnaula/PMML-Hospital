import { useState, useEffect, useContext, useCallback } from "react";
import { AppContext } from "../context/AppContext.jsx";
import { useWebSocket } from "../hooks/useWebSocket.js";
import QueueCard from "../components/QueueCard.jsx";
import Modal from "../components/Modal.jsx";
import * as api from "../api/index.js";

export default function QueueMonitor() {
  const { user, token } = useContext(AppContext);

  const [doctors, setDoctors] = useState([]);
  const [queues, setQueues] = useState({}); // doctorId → queue data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Walk-in booking modal
  const [bookOpen, setBookOpen] = useState(false);
  const [bookForm, setBookForm] = useState({
    problem_description: "",
    appointment_date: new Date().toISOString().split("T")[0],
    time_slot: { start: "09:00", end: "09:30" },
  });
  const [bookLoading, setBookLoading] = useState(false);
  const [bookError, setBookError] = useState(null);

  const today = new Date().toISOString().split("T")[0];

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch all doctors, then fetch each one's queue
  const loadQueues = useCallback(async () => {
    try {
      const data = await api.getDoctors();
      const docList = data.doctors || [];
      setDoctors(docList);

      const results = {};
      await Promise.all(
        docList.map(async (doc) => {
          try {
            const q = await api.getQueue(doc._id, token);
            results[doc._id] = q;
          } catch (_) {
            results[doc._id] = null;
          }
        })
      );
      setQueues(results);
    } catch (err) {
      setError("Could not load queues.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  // Refresh a single doctor's queue
  const refreshQueue = useCallback(
    async (doctorId) => {
      try {
        const q = await api.getQueue(doctorId, token);
        setQueues((prev) => ({ ...prev, [doctorId]: q }));
      } catch (_) {}
    },
    [token]
  );

  // WebSocket — staff feed
  const handleWsMessage = useCallback(
    (msg) => {
      if (msg.event === "queue.updated" && msg.doctor_id) {
        refreshQueue(msg.doctor_id);
      }
    },
    [refreshQueue]
  );

  const { send } = useWebSocket(handleWsMessage);

  useEffect(() => {
    send({ event: "subscribe.staff", token });
  }, [send, token]);

  // Advance queue for a doctor
  const handleNext = async (doctorId) => {
    try {
      await api.advanceQueue(doctorId, token);
      refreshQueue(doctorId);
      showToast("Queue advanced.");
    } catch (err) {
      showToast(err?.error || "Could not advance queue.");
    }
  };

  // Skip a patient
  const handleSkip = async (appointmentId, reason) => {
    try {
      await api.skipPatient(appointmentId, reason, token);
      showToast("Patient skipped.");
      loadQueues();
    } catch (err) {
      showToast(err?.error || "Could not skip patient.");
    }
  };

  // Walk-in booking
  const handleBook = async () => {
    setBookError(null);
    if (!bookForm.problem_description.trim()) {
      setBookError("Please describe the patient's problem.");
      return;
    }
    setBookLoading(true);
    try {
      await api.bookAppointment(
        {
          booking_type: "walk_in",
          problem_description: bookForm.problem_description.trim(),
          appointment_date: bookForm.appointment_date,
          time_slot: bookForm.time_slot,
          doctor_id: null,
        },
        token
      );
      setBookOpen(false);
      setBookForm({
        problem_description: "",
        appointment_date: today,
        time_slot: { start: "09:00", end: "09:30" },
      });
      loadQueues();
      showToast("Walk-in appointment booked!");
    } catch (err) {
      setBookError(err?.error || "Booking failed. No available doctor may be found.");
    } finally {
      setBookLoading(false);
    }
  };

  const isQueueManager = user.role === "queue_manager";

  return (
    <div style={{ padding: "28px 24px", maxWidth: "960px", margin: "0 auto" }}>
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
            maxWidth: "300px",
            fontSize: "14px",
          }}
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#1a202c" }}>
            Queue Monitor
          </h1>
          <p style={{ color: "#718096", fontSize: "14px", marginTop: "2px" }}>
            Live queue — {today}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={loadQueues}
            style={{
              background: "#edf2f7",
              color: "#4a5568",
              border: "none",
              borderRadius: "8px",
              padding: "9px 16px",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            Refresh
          </button>
          <button
            onClick={() => setBookOpen(true)}
            style={{
              background: "#1e3a5f",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "9px 18px",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            + Walk-in Booking
          </button>
        </div>
      </div>

      {loading && <p style={{ color: "#718096" }}>Loading queues...</p>}
      {error && <p style={{ color: "#e53e3e" }}>{error}</p>}

      {/* Doctor Queues */}
      {doctors.map((doc) => {
        const queue = queues[doc._id];
        const queueList = queue?.queue_list || [];
        const current = queue?.current_position || 0;
        const total = queue?.total_active || 0;

        return (
          <div
            key={doc._id}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "20px 24px",
              marginBottom: "20px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            {/* Doctor Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1a202c" }}>
                  {doc.name}
                </h2>
                <p style={{ fontSize: "13px", color: "#718096" }}>
                  {doc.specialization} &nbsp;·&nbsp; {doc.department}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  style={{
                    background:
                      doc.status === "on_duty"
                        ? "#f0fff4"
                        : doc.status === "in_consultation"
                        ? "#fefcbf"
                        : "#fff5f5",
                    color:
                      doc.status === "on_duty"
                        ? "#276749"
                        : doc.status === "in_consultation"
                        ? "#744210"
                        : "#c53030",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  {doc.status?.replace("_", " ")}
                </span>
                <span style={{ fontSize: "13px", color: "#718096" }}>
                  Now serving: <strong>#{current}</strong> &nbsp;|&nbsp; Waiting:{" "}
                  <strong>{total}</strong>
                </span>
                {isQueueManager && total > 0 && (
                  <button
                    onClick={() => handleNext(doc._id)}
                    style={{
                      background: "#38a169",
                      color: "#fff",
                      border: "none",
                      borderRadius: "7px",
                      padding: "8px 14px",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Next Patient →
                  </button>
                )}
              </div>
            </div>

            {/* Queue List */}
            {queueList.length === 0 ? (
              <p style={{ color: "#a0aec0", fontSize: "13px" }}>
                No patients in queue.
              </p>
            ) : (
              queueList
                .filter((item) => item.status === "waiting")
                .map((item) => (
                  <QueueCard
                    key={item.appointment_id}
                    position={item.position}
                    patientName={`Patient`}
                    problem=""
                    status={item.status}
                    appointmentId={item.appointment_id}
                    showActions={isQueueManager}
                    onSkip={isQueueManager ? handleSkip : null}
                    onNext={null} // Next is handled at doctor level
                  />
                ))
            )}
          </div>
        );
      })}

      {/* Walk-in Booking Modal */}
      <Modal
        isOpen={bookOpen}
        onClose={() => {
          setBookOpen(false);
          setBookError(null);
        }}
        title="Walk-in Appointment"
        size="md"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#4a5568",
                marginBottom: "6px",
              }}
            >
              Patient's Problem / Symptoms
            </label>
            <textarea
              value={bookForm.problem_description}
              onChange={(e) =>
                setBookForm((p) => ({ ...p, problem_description: e.target.value }))
              }
              rows={3}
              placeholder="e.g. Fever, joint pain, toothache..."
              style={{
                width: "100%",
                border: "1px solid #e2e8f0",
                borderRadius: "7px",
                padding: "10px",
                fontSize: "14px",
                resize: "vertical",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#4a5568",
                marginBottom: "6px",
              }}
            >
              Date
            </label>
            <input
              type="date"
              value={bookForm.appointment_date}
              min={today}
              onChange={(e) =>
                setBookForm((p) => ({ ...p, appointment_date: e.target.value }))
              }
              style={{
                width: "100%",
                border: "1px solid #e2e8f0",
                borderRadius: "7px",
                padding: "10px",
                fontSize: "14px",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#4a5568",
                  marginBottom: "6px",
                }}
              >
                Start Time
              </label>
              <input
                type="time"
                value={bookForm.time_slot.start}
                onChange={(e) =>
                  setBookForm((p) => ({
                    ...p,
                    time_slot: { ...p.time_slot, start: e.target.value },
                  }))
                }
                style={{
                  width: "100%",
                  border: "1px solid #e2e8f0",
                  borderRadius: "7px",
                  padding: "10px",
                  fontSize: "14px",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#4a5568",
                  marginBottom: "6px",
                }}
              >
                End Time
              </label>
              <input
                type="time"
                value={bookForm.time_slot.end}
                onChange={(e) =>
                  setBookForm((p) => ({
                    ...p,
                    time_slot: { ...p.time_slot, end: e.target.value },
                  }))
                }
                style={{
                  width: "100%",
                  border: "1px solid #e2e8f0",
                  borderRadius: "7px",
                  padding: "10px",
                  fontSize: "14px",
                }}
              />
            </div>
          </div>

          <p style={{ fontSize: "12px", color: "#718096" }}>
            Doctor will be auto-assigned based on the problem description.
          </p>

          {bookError && (
            <div
              style={{
                background: "#fff5f5",
                border: "1px solid #fed7d7",
                borderRadius: "7px",
                padding: "10px",
                fontSize: "13px",
                color: "#c53030",
              }}
            >
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
            }}
          >
            {bookLoading ? "Booking..." : "Book Walk-in"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
