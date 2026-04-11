import { useState, useEffect, useContext, useCallback } from "react";
import { AppContext } from "../context/AppContext.jsx";
import * as api from "../api/index.js";

const statCard = (label, value, color = "#1e3a5f") => (
  <div
    style={{
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      padding: "20px 24px",
      flex: "1 1 160px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}
  >
    <div style={{ fontSize: "13px", color: "#718096", marginBottom: "6px" }}>{label}</div>
    <div style={{ fontSize: "32px", fontWeight: 800, color }}>{value ?? "—"}</div>
  </div>
);

export default function HospitalDashboard() {
  const { token } = useContext(AppContext);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getDashboard(token);
      setData(res);
      setLastRefresh(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(err?.error || "Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    // Auto-refresh every 60 seconds
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const sectionTitle = (title) => (
    <h2
      style={{
        fontSize: "16px",
        fontWeight: 700,
        color: "#1a202c",
        marginBottom: "14px",
        marginTop: "28px",
      }}
    >
      {title}
    </h2>
  );

  return (
    <div style={{ padding: "28px 24px", maxWidth: "1000px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#1a202c" }}>
            Hospital Dashboard
          </h1>
          {lastRefresh && (
            <p style={{ color: "#a0aec0", fontSize: "12px", marginTop: "2px" }}>
              Last updated: {lastRefresh} · Auto-refreshes every 60s
            </p>
          )}
        </div>
        <button
          onClick={load}
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
          Refresh Now
        </button>
      </div>

      {loading && <p style={{ color: "#718096", marginTop: "20px" }}>Loading...</p>}
      {error && (
        <p style={{ color: "#e53e3e", marginTop: "20px" }}>{error}</p>
      )}

      {data && (
        <>
          {/* Patient Stats */}
          {sectionTitle("Today's Patients")}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {statCard("Total Patients Today", data.total_patients_today, "#1e3a5f")}
            {statCard("Online Bookings", data.online_bookings, "#2b6cb0")}
            {statCard("Walk-in Bookings", data.walkin_bookings, "#2c7a7b")}
          </div>

          {/* Doctor Stats */}
          {sectionTitle("Doctor Status")}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {statCard("Total Doctors", data.doctors?.total, "#553c9a")}
            {statCard("On Duty", data.doctors?.on_duty, "#276749")}
            {statCard("Off Duty", data.doctors?.off_duty, "#c53030")}
          </div>

          {/* Department Load */}
          {sectionTitle("Department Queue Load")}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "20px 24px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            {data.departments?.length === 0 && (
              <p style={{ color: "#a0aec0", fontSize: "14px" }}>No department data.</p>
            )}
            {data.departments?.map((dept) => {
              const max = Math.max(...(data.departments.map((d) => d.queue_load) || [1]), 1);
              const pct = Math.round((dept.queue_load / max) * 100);
              return (
                <div key={dept.name} style={{ marginBottom: "14px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "13px",
                      marginBottom: "5px",
                      color: "#4a5568",
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{dept.name}</span>
                    <span style={{ fontWeight: 600 }}>{dept.queue_load} patients</span>
                  </div>
                  <div
                    style={{
                      height: "10px",
                      background: "#edf2f7",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background:
                          pct > 75 ? "#e53e3e" : pct > 40 ? "#ed8936" : "#38a169",
                        borderRadius: "8px",
                        transition: "width 0.4s",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Alerts */}
          {sectionTitle("Active Alerts")}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "20px 24px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            {data.alerts?.length === 0 && (
              <p style={{ color: "#276749", fontSize: "14px" }}>
                ✓ No active alerts right now.
              </p>
            )}
            {data.alerts?.map((alert, idx) => (
              <div
                key={idx}
                style={{
                  background: "#fff5f5",
                  border: "1px solid #fed7d7",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "14px",
                  color: "#742a2a",
                }}
              >
                <span style={{ fontSize: "18px" }}>⚠️</span>
                <div>
                  <strong>{alert.type?.replace("_", " ").toUpperCase()}</strong>
                  <span style={{ marginLeft: "8px" }}>{alert.message}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Booking Split Visual */}
          {sectionTitle("Booking Type Split")}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "20px 24px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              display: "flex",
              gap: "24px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "Online", value: data.online_bookings, color: "#3b82f6" },
              { label: "Walk-in", value: data.walkin_bookings, color: "#10b981" },
            ].map((item) => {
              const total = (data.online_bookings || 0) + (data.walkin_bookings || 0);
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <div key={item.label} style={{ flex: 1, minWidth: "180px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "13px",
                      marginBottom: "6px",
                      color: "#4a5568",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: item.color }}>
                      {item.label}
                    </span>
                    <span>
                      {item.value} ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: "12px",
                      background: "#edf2f7",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: item.color,
                        borderRadius: "8px",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
