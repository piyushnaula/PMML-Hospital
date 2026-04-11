import { useState } from "react";
import Modal from "./Modal.jsx";

const statusColors = {
  waiting: { bg: "#ebf8ff", color: "#2b6cb0", label: "Waiting" },
  in_consultation: { bg: "#f0fff4", color: "#276749", label: "In Consultation" },
  skipped: { bg: "#fff5f5", color: "#c53030", label: "Skipped" },
  completed: { bg: "#f0fff4", color: "#276749", label: "Completed" },
};

export default function QueueCard({
  position,
  patientName,
  problem,
  status,
  appointmentId,
  onSkip,
  onNext,
  showActions = false,
}) {
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [skipError, setSkipError] = useState("");

  const badge = statusColors[status] || statusColors.waiting;

  const handleSkipSubmit = () => {
    if (!skipReason.trim()) {
      setSkipError("Please enter a reason before skipping.");
      return;
    }
    onSkip(appointmentId, skipReason.trim());
    setSkipModalOpen(false);
    setSkipReason("");
    setSkipError("");
  };

  return (
    <>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "10px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {/* Position Badge */}
        <div
          style={{
            minWidth: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "#3b82f6",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: "16px",
          }}
        >
          {position}
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "15px", color: "#1a202c" }}>
            {patientName || "Patient"}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#718096",
              marginTop: "2px",
              maxWidth: "320px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {problem || "—"}
          </div>
        </div>

        {/* Status Badge */}
        <span
          style={{
            background: badge.bg,
            color: badge.color,
            padding: "4px 12px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          {badge.label}
        </span>

        {/* Actions */}
        {showActions && (
          <div style={{ display: "flex", gap: "8px" }}>
            {onNext && (
              <button
                onClick={onNext}
                style={{
                  background: "#38a169",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "7px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                Next
              </button>
            )}
            {onSkip && status === "waiting" && (
              <button
                onClick={() => setSkipModalOpen(true)}
                style={{
                  background: "#e53e3e",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "7px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                Skip
              </button>
            )}
          </div>
        )}
      </div>

      {/* Skip Reason Modal */}
      <Modal
        isOpen={skipModalOpen}
        onClose={() => {
          setSkipModalOpen(false);
          setSkipReason("");
          setSkipError("");
        }}
        title="Skip Patient"
        size="sm"
      >
        <p style={{ fontSize: "14px", color: "#4a5568", marginBottom: "12px" }}>
          Please provide a reason for skipping this patient.
        </p>
        <textarea
          value={skipReason}
          onChange={(e) => {
            setSkipReason(e.target.value);
            setSkipError("");
          }}
          placeholder="e.g. Patient not responding..."
          rows={3}
          style={{
            width: "100%",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            padding: "10px",
            fontSize: "14px",
            resize: "vertical",
          }}
        />
        {skipError && (
          <p style={{ color: "#e53e3e", fontSize: "13px", marginTop: "6px" }}>
            {skipError}
          </p>
        )}
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button
            onClick={handleSkipSubmit}
            style={{
              flex: 1,
              background: "#e53e3e",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "10px",
              fontWeight: 600,
            }}
          >
            Confirm Skip
          </button>
          <button
            onClick={() => {
              setSkipModalOpen(false);
              setSkipReason("");
              setSkipError("");
            }}
            style={{
              flex: 1,
              background: "#edf2f7",
              color: "#4a5568",
              border: "none",
              borderRadius: "6px",
              padding: "10px",
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </>
  );
}
