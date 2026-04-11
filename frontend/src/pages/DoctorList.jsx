import { useState, useEffect, useContext } from "react";
import { AppContext } from "../context/AppContext.jsx";
import * as api from "../api/index.js";

const statusConfig = {
  on_duty:        { bg: "#f0fff4", color: "#276749", label: "On Duty" },
  off_duty:       { bg: "#fff5f5", color: "#c53030", label: "Off Duty" },
  in_consultation: { bg: "#fefcbf", color: "#744210", label: "In Consultation" },
};

export default function DoctorList() {
  const { user, token } = useContext(AppContext);

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Inline edit state (admin only)
  const [expandedId, setExpandedId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  const isAdmin = user?.role === "admin";

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadDoctors = async () => {
    try {
      const data = await api.getDoctors();
      setDoctors(data.doctors || []);
    } catch (err) {
      setError("Could not load doctors.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  const handleExpand = (doc) => {
    if (expandedId === doc._id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(doc._id);
    setEditForm({
      name: doc.name,
      specialization: doc.specialization,
      department: doc.department,
    });
    setEditError(null);
  };

  const handleEditSave = async (docId) => {
    setEditError(null);
    setEditLoading(true);
    try {
      await api.updateDoctor(docId, editForm, token);
      setExpandedId(null);
      loadDoctors();
      showToast("Doctor profile updated.");
    } catch (err) {
      setEditError(err?.error || "Update failed.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleVerifyCert = async (docId, filename) => {
    try {
      await api.updateDoctor(docId, { action: "verify", certificate_filename: filename }, token);
      loadDoctors();
      showToast("Certificate verified.");
    } catch (err) {
      showToast(err?.error || "Could not verify.");
    }
  };

  const inputStyle = {
    width: "100%",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    padding: "8px 10px",
    fontSize: "14px",
  };

  const labelStyle = {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "#718096",
    marginBottom: "4px",
  };

  return (
    <div style={{ padding: "28px 24px", maxWidth: "900px", margin: "0 auto" }}>
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

      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#1a202c" }}>
          Doctors Directory
        </h1>
        <p style={{ color: "#718096", fontSize: "14px", marginTop: "2px" }}>
          {doctors.length} doctor{doctors.length !== 1 ? "s" : ""} registered
          {isAdmin && " · Click any row to edit"}
        </p>
      </div>

      {loading && <p style={{ color: "#718096" }}>Loading doctors...</p>}
      {error && <p style={{ color: "#e53e3e" }}>{error}</p>}

      {doctors.map((doc) => {
        const status = statusConfig[doc.status] || statusConfig.off_duty;
        const isExpanded = expandedId === doc._id;
        const certs = doc.certificates || [];

        return (
          <div
            key={doc._id}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              marginBottom: "12px",
              overflow: "hidden",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            {/* Doctor Row */}
            <div
              onClick={() => isAdmin && handleExpand(doc)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px 20px",
                cursor: isAdmin ? "pointer" : "default",
                background: isExpanded ? "#f7fafc" : "#fff",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: "#1e3a5f",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "16px",
                  flexShrink: 0,
                }}
              >
                {doc.name?.charAt(0) || "D"}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "15px", color: "#1a202c" }}>
                  {doc.name}
                </div>
                <div style={{ fontSize: "13px", color: "#718096", marginTop: "2px" }}>
                  {doc.specialization} &nbsp;·&nbsp; {doc.department}
                </div>
              </div>

              {/* Certificates count */}
              <div style={{ fontSize: "12px", color: "#a0aec0", textAlign: "center" }}>
                <div style={{ fontWeight: 600, color: "#4a5568" }}>
                  {certs.filter((c) => c.verified).length}/{certs.length}
                </div>
                <div>certs verified</div>
              </div>

              {/* Available slots */}
              <div style={{ fontSize: "12px", color: "#718096", textAlign: "center" }}>
                {doc.available_slots?.map((s, i) => (
                  <div key={i}>
                    {s.start}–{s.end}
                  </div>
                ))}
              </div>

              {/* Status Badge */}
              <span
                style={{
                  background: status.bg,
                  color: status.color,
                  padding: "4px 14px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {status.label}
              </span>

              {isAdmin && (
                <span style={{ color: "#a0aec0", fontSize: "18px" }}>
                  {isExpanded ? "▲" : "▼"}
                </span>
              )}
            </div>

            {/* Inline Edit Panel (admin only) */}
            {isAdmin && isExpanded && (
              <div
                style={{
                  borderTop: "1px solid #e2e8f0",
                  padding: "20px 24px",
                  background: "#f7fafc",
                }}
              >
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
                  <div style={{ flex: "1 1 180px" }}>
                    <label style={labelStyle}>Name</label>
                    <input
                      value={editForm.name || ""}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: "1 1 180px" }}>
                    <label style={labelStyle}>Specialization</label>
                    <input
                      value={editForm.specialization || ""}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, specialization: e.target.value }))
                      }
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: "1 1 180px" }}>
                    <label style={labelStyle}>Department</label>
                    <input
                      value={editForm.department || ""}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, department: e.target.value }))
                      }
                      style={inputStyle}
                    />
                  </div>
                </div>

                {editError && (
                  <p style={{ color: "#e53e3e", fontSize: "13px", marginBottom: "12px" }}>
                    {editError}
                  </p>
                )}

                <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                  <button
                    onClick={() => handleEditSave(doc._id)}
                    disabled={editLoading}
                    style={{
                      background: editLoading ? "#a0aec0" : "#1e3a5f",
                      color: "#fff",
                      border: "none",
                      borderRadius: "7px",
                      padding: "9px 18px",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    {editLoading ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => setExpandedId(null)}
                    style={{
                      background: "#edf2f7",
                      color: "#4a5568",
                      border: "none",
                      borderRadius: "7px",
                      padding: "9px 18px",
                      fontSize: "13px",
                    }}
                  >
                    Cancel
                  </button>
                </div>

                {/* Certificates */}
                {certs.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#718096",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Certificates
                    </div>
                    {certs.map((cert, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "7px",
                          padding: "10px 14px",
                          marginBottom: "6px",
                          fontSize: "13px",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 500 }}>{cert.original_name}</span>
                          <span style={{ color: "#a0aec0", marginLeft: "8px" }}>
                            {cert.uploaded_at
                              ? new Date(cert.uploaded_at).toLocaleDateString()
                              : ""}
                          </span>
                        </div>
                        {cert.verified ? (
                          <span
                            style={{
                              background: "#f0fff4",
                              color: "#276749",
                              padding: "3px 10px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            ✓ Verified
                          </span>
                        ) : (
                          <button
                            onClick={() => handleVerifyCert(doc._id, cert.filename)}
                            style={{
                              background: "#ebf8ff",
                              color: "#2b6cb0",
                              border: "1px solid #bee3f8",
                              borderRadius: "6px",
                              padding: "4px 12px",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            Verify
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
