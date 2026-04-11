import { useState, useEffect, useContext } from "react";
import { AppContext } from "../context/AppContext";
import { getAdminUsers, updateAdminUser, addDoctor, addAdminUser } from "../api";
import { Shield, Stethoscope, Users, UserPlus, Activity, FileText } from "lucide-react";

export default function AdminPanel() {
  const { token } = useContext(AppContext);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("manage"); // manage, doctor, staff
  const [loading, setLoading] = useState(true);

  // Form states
  const [docForm, setDocForm] = useState({ name: "", email: "", specialization: "", department: "", certificate: null });
  const [staffForm, setStaffForm] = useState({ name: "", email: "", role: "front_desk", document: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await getAdminUsers(token);
      setUsers(res.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [token]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await updateAdminUser(userId, { role: newRole }, token);
      setUsers((prev) => prev.map((u) => (u._id === userId ? res.user : u)));
    } catch (err) {
      alert("Failed to update role");
    }
  };

  const handleActiveToggle = async (userId, currentState) => {
    try {
      const res = await updateAdminUser(userId, { is_active: !currentState }, token);
      setUsers((prev) => prev.map((u) => (u._id === userId ? res.user : u)));
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const fd = new FormData();
    fd.append("name", docForm.name);
    fd.append("email", docForm.email);
    fd.append("specialization", docForm.specialization);
    fd.append("department", docForm.department);
    if (docForm.certificate) fd.append("certificate", docForm.certificate);

    try {
      await addDoctor(fd, token);
      setMessage({ type: "success", text: "Doctor added successfully." });
      setDocForm({ name: "", email: "", specialization: "", department: "", certificate: null });
      if (document.getElementById("docFile")) document.getElementById("docFile").value = null;
      loadUsers();
    } catch (err) {
      setMessage({ type: "error", text: err.error || "Failed to add doctor." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const fd = new FormData();
    fd.append("name", staffForm.name);
    fd.append("email", staffForm.email);
    fd.append("role", staffForm.role);
    if (staffForm.document) fd.append("document", staffForm.document);

    try {
      await addAdminUser(fd, token);
      setMessage({ type: "success", text: "Staff user created successfully." });
      setStaffForm({ name: "", email: "", role: "front_desk", document: null });
      if (document.getElementById("staffFile")) document.getElementById("staffFile").value = null;
      loadUsers();
    } catch (err) {
      setMessage({ type: "error", text: err.error || "Failed to create staff." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1000px", margin: "0 auto" }}>
      <h1 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "2rem" }}>
        <Shield /> System Administration
      </h1>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <TabButton active={activeTab === "manage"} onClick={() => { setActiveTab("manage"); setMessage(null); }} icon={<Users size={18}/>} label="Manage Users" />
        <TabButton active={activeTab === "doctor"} onClick={() => { setActiveTab("doctor"); setMessage(null); }} icon={<Stethoscope size={18}/>} label="Add Doctor" />
        <TabButton active={activeTab === "staff"} onClick={() => { setActiveTab("staff"); setMessage(null); }} icon={<UserPlus size={18}/>} label="Add Staff" />
      </div>

      {message && (
        <div style={{ padding: "1rem", borderRadius: "8px", marginBottom: "1rem", backgroundColor: message.type === "success" ? "#d1fae5" : "#fee2e2", color: message.type === "success" ? "#065f46" : "#991b1b" }}>
          {message.text}
        </div>
      )}

      {activeTab === "manage" && (
        <div style={{ background: "#fff", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
          {loading ? <p>Loading users...</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "1rem 0" }}>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "1rem 0", fontWeight: 500 }}>{u.name}</td>
                    <td style={{ color: "#6b7280" }}>{u.email}</td>
                    <td>
                      <select 
                        value={u.role} 
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        style={{ padding: "0.25rem", borderRadius: "4px", border: "1px solid #d1d5db" }}
                      >
                        <option value="patient">Patient</option>
                        <option value="front_desk">Front Desk</option>
                        <option value="queue_manager">Queue Manager</option>
                        <option value="doctor">Doctor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <button 
                        onClick={() => handleActiveToggle(u._id, u.is_active)}
                        style={{ padding: "4px 8px", borderRadius: "4px", background: u.is_active ? "#d1fae5" : "#fee2e2", color: u.is_active ? "#065f46" : "#991b1b", border: "none" }}
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "doctor" && (
        <FormCard title="Register New Doctor">
          <form onSubmit={handleAddDoctor} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            <div style={gridStyle}>
              <Input label="Doctor Name" required value={docForm.name} onChange={e => setDocForm({...docForm, name: e.target.value})} />
              <Input label="Email Address" type="email" required value={docForm.email} onChange={e => setDocForm({...docForm, email: e.target.value})} />
            </div>
            <div style={gridStyle}>
              <Input label="Specialization (e.g. Cardiology)" required value={docForm.specialization} onChange={e => setDocForm({...docForm, specialization: e.target.value})} />
              <Input label="Department (e.g. Ward A)" required value={docForm.department} onChange={e => setDocForm({...docForm, department: e.target.value})} />
            </div>
            <FileInput label="Medical Certificate (JPG, PNG, PDF)" id="docFile" onChange={e => setDocForm({...docForm, certificate: e.target.files[0]})} />
            
            <button disabled={isSubmitting} type="submit" style={btnStyle}>
              {isSubmitting ? "Adding..." : "Add Doctor & Upload File"}
            </button>
          </form>
        </FormCard>
      )}

      {activeTab === "staff" && (
        <FormCard title="Register Staff Member">
          <form onSubmit={handleAddStaff} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            <div style={gridStyle}>
              <Input label="Staff Name" required value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} />
              <Input label="Email Address" type="email" required value={staffForm.email} onChange={e => setStaffForm({...staffForm, email: e.target.value})} />
            </div>
            <div>
              <label style={labelStyle}>Staff Role</label>
              <select value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value})} style={inputStyle}>
                <option value="front_desk">Front Desk</option>
                <option value="queue_manager">Queue Manager</option>
                <option value="admin">System Admin</option>
              </select>
            </div>
            <FileInput label="ID Document or Qualifications (JPG, PNG, PDF)" id="staffFile" onChange={e => setStaffForm({...staffForm, document: e.target.files[0]})} />
            
            <button disabled={isSubmitting} type="submit" style={btnStyle}>
              {isSubmitting ? "Adding..." : "Add Staff & Upload Info"}
            </button>
          </form>
        </FormCard>
      )}
    </div>
  );
}

// Subcomponents for cleaner code
function TabButton({ active, label, icon, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: "8px",
      padding: "0.75rem 1.5rem", borderRadius: "8px", fontWeight: "600",
      background: active ? "#312e81" : "#e0e7ff",
      color: active ? "#fff" : "#3730a3",
      border: "none", cursor: "pointer", transition: "0.2s"
    }}>
      {icon} {label}
    </button>
  );
}

function FormCard({ title, children }) {
  return (
    <div style={{ background: "#fff", padding: "2rem", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", border: "1px solid #f3f4f6" }}>
      <h3 style={{ marginTop: 0, marginBottom: "1.5rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "1rem" }}>{title}</h3>
      {children}
    </div>
  );
}

function Input({ label, type = "text", ...handlers }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} style={inputStyle} {...handlers} />
    </div>
  );
}

function FileInput({ label, id, onChange }) {
  return (
    <div style={{ 
      border: "2px dashed #d1d5db", padding: "1.5rem", borderRadius: "8px", 
      display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem"
    }}>
      <FileText size={32} color="#9ca3af" />
      <label htmlFor={id} style={{ fontWeight: 500, cursor: "pointer", color: "#4f46e5" }}>
        {label}
      </label>
      <input id={id} type="file" accept="image/jpeg, image/png, application/pdf" onChange={onChange} style={{ 
        color: "#6b7280", marginTop: "0.5rem" 
      }} />
    </div>
  );
}

const gridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" };
const labelStyle = { fontWeight: 500, marginBottom: "0.5rem", color: "#374151", fontSize: "0.9rem" };
const inputStyle = { padding: "0.75rem", borderRadius: "6px", border: "1px solid #d1d5db", width: "100%", outline: "none" };
const btnStyle = { padding: "1rem", borderRadius: "8px", background: "#4f46e5", color: "#fff", fontWeight: "bold", border: "none", cursor: "pointer", marginTop: "1rem", fontSize: "1rem" };
