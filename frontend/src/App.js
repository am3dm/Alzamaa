import "@/App.css";
import "leaflet/dist/leaflet.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth, homeFor } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AdminDashboard from "@/pages/AdminDashboard";
import StudentPortal from "@/pages/StudentPortal";
import DriverPortal from "@/pages/DriverPortal";

const Loading = () => (
  <div className="min-h-screen grid place-items-center text-muted-foreground" data-testid="app-loading">جارِ التحميل...</div>
);

const Protected = ({ role, children }) => {
  const { user } = useAuth();
  if (user === null) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
};

const Home = () => {
  const { user } = useAuth();
  if (user === null) return <Loading />;
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
};

function App() {
  return (
    <div className="App" dir="rtl">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
            <Route path="/student" element={<Protected role="student"><StudentPortal /></Protected>} />
            <Route path="/driver" element={<Protected role="driver"><DriverPortal /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors dir="rtl" toastOptions={{ style: { fontFamily: "Tajawal" } }} />
      </AuthProvider>
    </div>
  );
}

export default App;
