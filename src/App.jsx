import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./layout/MainLayout";

import Login          from "./pages/Login";
import Home           from "./pages/Home";
import DailyEntries   from "./pages/DailyEntries";
import AddStock       from "./pages/AddStock";
import ScanQR         from "./pages/ScanQR";
import Billing        from "./pages/Billing";
import Success        from "./pages/Success";
import SearchProducts from "./pages/SearchProducts";
import SearchStock    from "./pages/SearchStock";
import MissingItems   from "./pages/MissingItems";
import Expenses       from "./pages/Expenses";

import "./styles.css";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected pages rendered inside MainLayout sidebar */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/"               element={<Home />} />
            <Route path="/daily"          element={<DailyEntries />} />
            <Route path="/search"         element={<SearchProducts />} />
            <Route path="/search-stock"   element={<SearchStock />} />
            <Route path="/add-stock"      element={<AddStock />} />
            <Route path="/add-stock/:productId" element={<AddStock />} />
            <Route path="/missing-items"  element={<MissingItems />} />
            <Route path="/expenses"       element={<Expenses />} />
          </Route>

          {/* Full-screen flow pages — no sidebar */}
          <Route path="/scan"               element={<ProtectedRoute><ScanQR /></ProtectedRoute>} />
          <Route path="/billing/:productId" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
          <Route path="/success"            element={<ProtectedRoute><Success /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
