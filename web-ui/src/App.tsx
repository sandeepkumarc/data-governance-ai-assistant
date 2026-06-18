import { Route, Routes, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { AnalyzePage } from "./pages/Analyze";
import { LineagePage } from "./pages/Lineage";
import { OwnershipPage } from "./pages/Ownership";
import { ExportPage } from "./pages/Export";
import { AuditPage } from "./pages/Audit";
import { KnowledgePage } from "./pages/Knowledge";
import { PlatformTourPage } from "./pages/PlatformTour";
import { HelpDeskPage } from "./pages/HelpDesk";
import {
  GovernanceHealthPage,
  GovernanceHealthRedirect,
} from "./pages/GovernanceHealthPage";
import { ReviewPage, ReviewRedirect } from "./pages/ReviewPage";

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="platform-tour" element={<PlatformTourPage />} />
            <Route path="analyze" element={<AnalyzePage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="review" element={<ReviewRedirect />} />
            <Route path="review/definitions" element={<ReviewPage />} />
            <Route path="review/quality" element={<ReviewPage />} />
            <Route path="steward" element={<Navigate to="/review/definitions" replace />} />
            <Route path="quality" element={<Navigate to="/review/quality" replace />} />
            <Route path="lineage" element={<LineagePage />} />
            <Route path="governance" element={<GovernanceHealthRedirect />} />
            <Route path="governance/readiness" element={<GovernanceHealthPage />} />
            <Route path="governance/principles" element={<GovernanceHealthPage />} />
            <Route path="governance/maturity" element={<GovernanceHealthPage />} />
            <Route path="trust" element={<Navigate to="/governance/readiness" replace />} />
            <Route path="data-maturity" element={<Navigate to="/governance/maturity" replace />} />
            <Route path="ownership" element={<OwnershipPage />} />
            <Route path="export" element={<ExportPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="help-desk" element={<HelpDeskPage />} />
          </Route>
        </Route>
      </Routes>
    </AppProvider>
  );
}
