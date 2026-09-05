import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { POSPage } from './pages/pos/POSPage';
import { InventoryPage } from './pages/inventory/InventoryPage';
import { ProductsPage } from './pages/products/ProductsPage';
import { PrescriptionsPage } from './pages/prescriptions/PrescriptionsPage';
import { PatientsPage } from './pages/patients/PatientsPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { UsersPage } from './pages/users/UsersPage';
import { MobileRxUploadPage } from './pages/prescriptions/MobileRxUploadPage';
import { OrdersPage } from './pages/orders/OrdersPage';
import { ReconciliationPage } from './pages/reconciliation/ReconciliationPage';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen overflow-hidden flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Loading TilexPharmacy...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const RoleRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/rx-upload/:sessionId" element={<MobileRxUploadPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="pos" element={<POSPage />} />
        <Route
          path="inventory"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'PHARMACIST']}>
              <InventoryPage />
            </RoleRoute>
          }
        />
        <Route path="products" element={<ProductsPage />} />
        <Route
          path="prescriptions"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'PHARMACIST']}>
              <PrescriptionsPage />
            </RoleRoute>
          }
        />
        <Route
          path="patients"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'PHARMACIST']}>
              <PatientsPage />
            </RoleRoute>
          }
        />
        <Route
          path="reports"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'PHARMACIST']}>
              <ReportsPage />
            </RoleRoute>
          }
        />
        <Route path="reconciliation" element={<ReconciliationPage />} />
        <Route
          path="settings"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <SettingsPage />
            </RoleRoute>
          }
        />
        <Route
          path="users"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <UsersPage />
            </RoleRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
