import { useContext } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AppContext } from "../context/AppContext.jsx";

const navLinks = {
  patient: [{ to: "/patient", label: "My Dashboard" }],
  front_desk: [
    { to: "/queue", label: "Queue Monitor" },
    { to: "/doctors", label: "Doctors" },
  ],
  queue_manager: [
    { to: "/queue", label: "Queue Monitor" },
    { to: "/dashboard", label: "Hospital Dashboard" },
    { to: "/doctors", label: "Doctors" },
  ],
  doctor: [
    { to: "/doctor/panel", label: "My Queue" },
    { to: "/doctors", label: "All Doctors" },
  ],
  admin: [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/doctors", label: "Doctors" },
    { to: "/admin", label: "Admin Panel" },
  ],
};

export default function Navbar() {
  const { user, logout } = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const links = navLinks[user.role] || [];

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <nav
      style={{
        background: "#1e3a5f",
        color: "#fff",
        padding: "0 24px",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div style={{ fontWeight: 700, fontSize: "18px", letterSpacing: "0.5px" }}>
        PMML Hospital
      </div>

      {/* Links */}
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        {links.map((link) => {
          const active = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: active ? 600 : 400,
                background: active ? "rgba(255,255,255,0.15)" : "transparent",
                color: "#fff",
                transition: "background 0.15s",
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* User + Logout */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <span style={{ fontSize: "14px", opacity: 0.85 }}>
          {user.name}
          <span
            style={{
              marginLeft: "8px",
              background: "rgba(255,255,255,0.2)",
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "11px",
              textTransform: "capitalize",
            }}
          >
            {user.role.replace("_", " ")}
          </span>
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: "rgba(255,255,255,0.15)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "6px",
            padding: "5px 14px",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
