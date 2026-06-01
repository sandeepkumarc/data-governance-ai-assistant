import { Route, Routes } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { AnalyzePage } from "./pages/Analyze";
import { StewardPage } from "./pages/Steward";
import { LineagePage } from "./pages/Lineage";
import { QualityPage } from "./pages/Quality";
import { TrustPage } from "./pages/Trust";
import { OwnershipPage } from "./pages/Ownership";
import { ExportPage } from "./pages/Export";
import { AuditPage } from "./pages/Audit";
import { KnowledgePage } from "./pages/Knowledge";

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="analyze" element={<AnalyzePage />} />
            <Route path="steward" element={<StewardPage />} />
            <Route path="lineage" element={<LineagePage />} />
            <Route path="quality" element={<QualityPage />} />
            <Route path="trust" element={<TrustPage />} />
            <Route path="ownership" element={<OwnershipPage />} />
            <Route path="export" element={<ExportPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="audit" element={<AuditPage />} />
          </Route>
        </Route>
      </Routes>
    </AppProvider>
  );
}
