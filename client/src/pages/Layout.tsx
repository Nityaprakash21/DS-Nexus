import { Navigate, Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../../context/AuthContext";
import Loading from "../components/Loading";
import { useAdminNotifications } from "../hooks/useAdminNotifications";
import AdminNotificationBell from "../components/admin/AdminNotificationBell";

const Layout = () => {
  const { user, loading } = useAuth();
  // Headless background notification listener for PWA / native Android device push
  useAdminNotifications();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="flex h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50/30">
      <Sidebar />

      <main className="flex-1 overflow-y-auto relative">
        {/* Floating Top Notification Bell for reminders and tasks */}
        <div className="fixed top-3 right-4 sm:top-5 sm:right-8 z-30">
          <AdminNotificationBell />
        </div>

        <div className="p-4 pt-16 sm:p-6 sm:pt-6 lg:p-8 max-w-400 mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;