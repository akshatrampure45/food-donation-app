import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Navbar from "./components/Navbar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyOtp from "./pages/VerifyOtp";
import DonorDashboard from "./pages/DonorDashboard";
import RecipientDashboard from "./pages/RecipientDashboard";
import RequestDetail from "./pages/RequestDetail";
import Admin from "./pages/Admin";
import Leaderboard from "./pages/Leaderboard";
import Notifications from "./pages/Notifications";

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify" element={<VerifyOtp />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/donor" element={<Protected roles={["donor"]}><DonorDashboard /></Protected>} />
        <Route path="/recipient" element={<Protected roles={["recipient"]}><RecipientDashboard /></Protected>} />
        <Route path="/admin" element={<Protected roles={["admin"]}><Admin /></Protected>} />
        <Route path="/requests/:id" element={<Protected roles={["donor", "recipient"]}><RequestDetail /></Protected>} />
        <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
