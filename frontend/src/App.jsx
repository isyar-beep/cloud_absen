import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from './store/themeStore';
import { PenyediaDialog } from './components/Dialog';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import History from './pages/History';
import AdminHistory from './pages/AdminHistory';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminShifts from './pages/AdminShifts';
import AdminHolidays from './pages/AdminHolidays';
import AdminStats from './pages/AdminStats';
import AdminGallery from './pages/AdminGallery';
import AdminLeaves from './pages/AdminLeaves';
import AdminProjects from './pages/AdminProjects';
import AdminNotifications from './pages/AdminNotifications';
import Panduan from './pages/Panduan';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  const mulaiTema = useThemeStore((s) => s.mulai);

  // Memasang kelas `dark` dan mendengarkan perubahan setelan sistem.
  useEffect(() => mulaiTema(), [mulaiTema]);

  return (
    <BrowserRouter>
      {/* Penyedia dialog membungkus seluruh rute: dialog konfirmasi
          dipanggil dari banyak halaman, dan tiap halaman tidak perlu
          mengingat untuk merender komponennya sendiri. */}
      <PenyediaDialog>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <Attendance />
            </ProtectedRoute>
          }
        />

        <Route
          path="/leaves"
          element={
            <ProtectedRoute>
              <Leaves />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole={['admin', 'konsultan']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/projects"
          element={
            <ProtectedRoute allowedRole={['admin', 'konsultan']}>
              <AdminProjects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRole={['admin', 'konsultan']}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/shifts"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminShifts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/stats"
          element={
            <ProtectedRoute allowedRole={['admin', 'konsultan']}>
              <AdminStats />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/gallery"
          element={
            <ProtectedRoute allowedRole={['admin', 'konsultan']}>
              <AdminGallery />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/holidays"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminHolidays />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/leaves"
          element={
            <ProtectedRoute allowedRole={['admin', 'konsultan']}>
              <AdminLeaves />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/history"
          element={
            <ProtectedRoute allowedRole={['admin', 'konsultan']}>
              <AdminHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/notifications"
          element={
            <ProtectedRoute allowedRole={['admin', 'konsultan']}>
              <AdminNotifications />
            </ProtectedRoute>
          }
        />

        <Route
          path="/panduan"
          element={
            <ProtectedRoute>
              <Panduan />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </PenyediaDialog>
    </BrowserRouter>
  );
}
