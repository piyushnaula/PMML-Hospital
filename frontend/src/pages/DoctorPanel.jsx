import { useState, useEffect, useContext, useCallback } from "react";
import { AppContext } from "../context/AppContext.jsx";
import { useWebSocket } from "../hooks/useWebSocket.js";
import QueueCard from "../components/QueueCard.jsx";
import * as api from "../api/index.js";

const STATUSES = ["on_duty", "off_duty", "in_consultation"];

const statusConfig = {
  on_duty:         { bg: "#f0fff4", color: "#276749", label: "On Duty" },
  off_duty:        { bg: "#fff5f5", color: "#c53030", label: "Off Duty" },
  in_consultation: { bg: "#fefcbf", color: "#744210", label: "In Consultation" },
};

export default function DoctorPanel() {
  const { user, token } = useContext(AppContext);

  const [doctors, setDoctors] = useState([]);
  const [myDoctor, setMyDoctor] = useState(null);
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Status toggle
  const [statusLoading, setStatusLoading] = useState(false);

  // Certificate upload
  const [certFile, setCertFile] = useState(null);
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      const data = await api.getDoctors();
      const allDocs = data.doctors || [];
      setDoctors(allDocs);

      // Find the doctor profile linked to the logged-in user
      // The doctor's user_id matches the current user's _id
      const mine = allDocs.find((d) => d.user_id === user._id);
      setMyDoctor(mine || null);

      if (mine) {
        const q = await api.getQueue(mine._id, token);
        setQueue(q);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user._id, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // WebSocket — listen for queue updates on own queue
  const handleWsMessage = useCallback(
    (msg) => {
      if (msg.event === "queue.updated" && myDoctor && msg.doctor_id === myDoctor._id) {
        api.getQueue(myDoctor._id, token).then((q) => setQueue(q)).catch(() => {});
      }
    },
    [myDoctor, token]
  );

  const { send } = useWebSocket(handleWsMessage);

  useEffect(() => {
    send({ event: "subscribe.staff", token });
  }, [send, token]);

  // Status update
  const handleStatusChange = async (newStatus) => {
    if (!myDoctor) return;
    setStatusLoading(true);
    try {
      await api.updateDoctor(myDoctor._id, { status: newStatus }, token);
      setMyDoctor((prev) => ({ ...prev, status: newStatus }));
      showToast(`Status updated to "${newStatus.replace("_", " ")}"`);
    } catch (err) {
      showToast(err?.error || "Could not update status.");
    } finally {
      setStatusLoading(false);
    }
  };

  // Advance queue
  const handleNext = async () => {
    if (!myDoctor) return;
    try {
      await api.advanceQueue(myDoctor._id, token);
      const q = await api.getQueue(myDoctor._id, token);
      setQueue(q);
      showToast("Advanced to next patient.");
    } catch (err) {
      showToast(err?.error || "Could not advance queue.");
    }
  };

  // Certificate upload
  const handleCertUpload = async () => {
    if (!certFile || !myDoctor) return;
    setCertError(null);
    setCertLoading(true);
    try {
      await api.uploadDoctorCert(myDoctor._id, certFile, token);
      setCertFile(null);
      loadData();
      showToast("Certificate uploaded! Waiting for admin verification.");
    } catch (err) {
      setCertError(err?.error || "Upload failed.");
    } finally {
      setCertLoading(false);
    }
  };

  const cardStyle = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  };

  const queueList = queue?.queue_list || [];
  const waitingList = queueList.filter((item) => item.status === "waiting");
  const currentPos = queue?.current_position || 0;
  const currentEntry = queueList.find((item) => item.position === currentPos);

  if (loading) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center", color: "#718096" }}>
        Loading your panel...
      </div>
    );
  }

  if (!myDoctor) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center", color: "#718096" }}>
        Doctor profile not found. Please contact the admin.
      </div>
    );
  }

  const status = statusConfig[myDoctor.status] || statusConfig.off_duty;

  return (
    <div style={{ padding: "28px 24px", maxWidth: "860px", margin: "0 auto" }}>
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
            fontSize: "14px",
          }}
        >
          {toast}
        </div>
      )}

      {/* Doctor Profile Header */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#1e3a5f",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: 700,
              }}
            >
              {myDoctor.name?.charAt(0)}
            </div>
            <div>
              <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#1a202c" }}>
                {myDoctor.name}
              </h1>
              <p style={{ color: "#718096", fontSize: "13px" }}>
                {myDoctor.specialization} &nbsp;·&nbsp; {myDoctor.department}
              </p>
              <span
                style={{
                  display: "inline-block",
                  marginTop: "6px",
                  background: status.bg,
                  color: status.color,
                  padding: "3px 12px",
                  borderRadius: "14px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {status.label}
              </span>
            </div>
          </div>

          {/* Status Toggle */}
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#718096", marginBottom: "6px" }}>
              Change Status
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={statusLoading || myDoctor.status === s}
                  style={{
                    background: myDoctor.status === s ? statusConfig[s].bg : "#edf2f7",
                    color: myDoctor.status === s ? statusConfig[s].color : "#4a5568",
                    border: myDoctor.status === s ? `1px solid ${statusConfig[s].color}` : "1px solid #e2e8f0",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: myDoctor.status === s ? "default" : "pointer",
                  }}
                >
                  {s.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Current Patient Card */}
      {currentEntry && (
        <div style={{ ...cardStyle, borderLeft: "4px solid #3b82f6" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "10px", color: "#1a202c" }}>
            Currently Serving — Position #{currentPos}
          </h2>
          <div style={{ fontSize: "14px", color: "#4a5568" }}>
            <strong>Appointment ID:</strong> {currentEntry.appointment_id}
          </div>
          <div style={{ marginTop: "12px" }}>
            <button
              onClick={handleNext}
              style={{
                background: "#38a169",
                color: "#fff",
                border: "none",
                borderRadius: "7px",
                padding: "10px 20px",
                fontWeight: 600,
                fontSize: "14px",
              }}
            >
              Done — Next Patient →
            </button>
          </div>
        </div>
      )}

      {/* Live Queue */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1a202c" }}>
            My Queue Today
          </h2>
          <span style={{ fontSize: "13px", color: "#718096" }}>
            {waitingList.length} waiting &nbsp;·&nbsp; Serving #{currentPos}
          </span>
        </div>

        {waitingList.length === 0 ? (
          <p style={{ color: "#a0aec0", fontSize: "14px" }}>No patients waiting.</p>
        ) : (
          waitingList.map((item) => (
            <QueueCard
              key={item.appointment_id}
              position={item.position}
              patientName="Patient"
              problem=""
              status={item.status}
              appointmentId={item.appointment_id}
              showActions={false}
            />
          ))
        )}
      </div>

      {/* Certificate Upload */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1a202c", marginBottom: "14px" }}>
          Upload Degree Certificate
        </h2>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              setCertFile(e.target.files[0] || null);
              setCertError(null);
            }}
            style={{ flex: 1, fontSize: "14px" }}
          />
          <button
            onClick={handleCertUpload}
            disabled={!certFile || certLoading}
            style={{
              background: !certFile || certLoading ? "#a0aec0" : "#1e3a5f",
              color: "#fff",
              border: "none",
              borderRadius: "7px",
              padding: "10px 20px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: !certFile || certLoading ? "not-allowed" : "pointer",
            }}
          >
            {certLoading ? "Uploading..." : "Upload"}
          </button>
        </div>
        {certError && (
          <p style={{ color: "#e53e3e", fontSize: "13px", marginTop: "8px" }}>{certError}</p>
        )}
        <p style={{ fontSize: "12px", color: "#a0aec0", marginTop: "8px" }}>
          Accepted formats: PDF, JPG, PNG. Admin will verify after upload.
        </p>

        {/* Existing certs */}
        {myDoctor.certificates?.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#718096", marginBottom: "8px" }}>
              Uploaded Certificates
            </p>
            {myDoctor.certificates.map((cert, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  background: "#f7fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "7px",
                  padding: "9px 14px",
                  marginBottom: "6px",
                  fontSize: "13px",
                }}
              >
                <span>{cert.original_name}</span>
                <span
                  style={{
                    color: cert.verified ? "#276749" : "#c05621",
                    fontWeight: 600,
                  }}
                >
                  {cert.verified ? "✓ Verified" : "Pending Verification"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
