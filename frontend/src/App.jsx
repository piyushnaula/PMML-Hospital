import { useContext } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AppContext } from "./context/AppContext.jsx";
import Navbar from "./components/Navbar.jsx";
import Auth from "./pages/Auth.jsx";
import PatientDashboard from "./pages/PatientDashboard.jsx";
import QueueMonitor from "./pages/QueueMonitor.jsx";
import HospitalDashboard from "./pages/HospitalDashboard.jsx";
import DoctorList from "./pages/DoctorList.jsx";
import DoctorPanel from "./pages/DoctorPanel.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";

// Role → default landing page map
const roleHome = {
  patient: "/patient",
  front_desk: "/queue",
  queue_manager: "/queue",
  doctor: "/doctor/panel",
  admin: "/dashboard",
};

// Route guard — redirects if not logged in or wrong role
function PrivateRoute({ children, roles }) {
  const { user } = useContext(AppContext);
  const location = useLocation();

  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) {
    const home = roleHome[user.role] || "/auth";
    return <Navigate to={home} replace />;
  }
  return children;
}

// Root "/" redirect: send to role home or /auth
function RootRedirect() {
  const { user } = useContext(AppContext);
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={roleHome[user.role] || "/auth"} replace />;
}

export default function App() {
  const { user } = useContext(AppContext);

  return (
    <BrowserRouter>
      {user && <Navbar />}
      <Routes>
        {/* Public */}
        <Route
          path="/auth"
          element={
            user ? <Navigate to={roleHome[user.role] || "/"} replace /> : <Auth />
          }
        />

        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Patient */}
        <Route
          path="/patient"
          element={
            <PrivateRoute roles={["patient"]}>
              <PatientDashboard />
            </PrivateRoute>
          }
        />

        {/* Staff — Queue Monitor */}
        <Route
          path="/queue"
          element={
            <PrivateRoute roles={["front_desk", "queue_manager"]}>
              <QueueMonitor />
            </PrivateRoute>
          }
        />

        {/* Admin + Manager Dashboard */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute roles={["admin", "queue_manager"]}>
              <HospitalDashboard />
            </PrivateRoute>
          }
        />

        {/* Doctor list — all authenticated */}
        <Route
          path="/doctors"
          element={
            <PrivateRoute roles={["patient", "front_desk", "queue_manager", "doctor", "admin"]}>
              <DoctorList />
            </PrivateRoute>
          }
        />

        {/* Doctor's own workspace */}
        <Route
          path="/doctor/panel"
          element={
            <PrivateRoute roles={["doctor"]}>
              <DoctorPanel />
            </PrivateRoute>
          }
        />

        {/* Admin panel */}
        <Route
          path="/admin"
          element={
            <PrivateRoute roles={["admin"]}>
              <AdminPanel />
            </PrivateRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}