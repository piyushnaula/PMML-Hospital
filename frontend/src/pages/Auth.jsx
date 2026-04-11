import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../context/AppContext.jsx";
import * as api from "../api/index.js";

const roleHome = {
  patient: "/patient",
  front_desk: "/queue",
  queue_manager: "/queue",
  doctor: "/doctor/panel",
  admin: "/dashboard",
};

const inputStyle = {
  width: "100%",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "11px 14px",
  fontSize: "15px",
  outline: "none",
  background: "#f7fafc",
  transition: "border-color 0.15s",
};

const labelStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "#4a5568",
  marginBottom: "6px",
};

export default function Auth() {
  const { login } = useContext(AppContext);
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "register"
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      let data;
      if (mode === "login") {
        data = await api.login({ email: form.email, password: form.password });
      } else {
        if (!form.name.trim()) {
          setError("Name is required.");
          setLoading(false);
          return;
        }
        data = await api.register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim(),
        });
      }
      login(data.user, data.token);
      navigate(roleHome[data.user.role] || "/");
    } catch (err) {
      setError(err?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%)",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "40px 36px",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        }}
      >
        {/* Logo / Title */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              background: "#1e3a5f",
              borderRadius: "14px",
              marginBottom: "12px",
            }}
          >
            <span style={{ color: "#fff", fontSize: "24px" }}>🏥</span>
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#1a202c" }}>
            PMML Hospital
          </h1>
          <p style={{ color: "#718096", fontSize: "14px", marginTop: "4px" }}>
            {mode === "login" ? "Sign in to your account" : "Create a patient account"}
          </p>
        </div>

        {/* Toggle Tabs */}
        <div
          style={{
            display: "flex",
            background: "#f0f4f8",
            borderRadius: "8px",
            padding: "4px",
            marginBottom: "24px",
          }}
        >
          {["login", "register"].map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              style={{
                flex: 1,
                padding: "8px",
                border: "none",
                borderRadius: "6px",
                background: mode === m ? "#fff" : "transparent",
                fontWeight: mode === m ? 600 : 400,
                fontSize: "14px",
                color: mode === m ? "#1a202c" : "#718096",
                boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s",
              }}
            >
              {m === "login" ? "Login" : "Register"}
            </button>
          ))}
        </div>

        {/* Form Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {mode === "register" && (
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Rahul Sharma"
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          {mode === "register" && (
            <div>
              <label style={labelStyle}>Phone (optional)</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="9876543210"
                style={inputStyle}
              />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#fff5f5",
              border: "1px solid #feb2b2",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "13px",
              color: "#c53030",
              marginTop: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%",
            background: loading ? "#a0aec0" : "#1e3a5f",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "13px",
            fontSize: "15px",
            fontWeight: 600,
            marginTop: "20px",
            transition: "background 0.15s",
          }}
        >
          {loading
            ? "Please wait..."
            : mode === "login"
            ? "Sign In"
            : "Create Account"}
        </button>

        {mode === "register" && (
          <p
            style={{
              textAlign: "center",
              fontSize: "12px",
              color: "#718096",
              marginTop: "14px",
            }}
          >
            Staff and doctor accounts are created by the Admin.
          </p>
        )}
      </div>
    </div>
  );
}
