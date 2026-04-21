import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { Toaster } from './components/shared/Toaster';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import DashboardPage from './pages/DashboardPage';
import ScenariosPage from './pages/ScenariosPage';
import CreateSessionPage from './pages/CreateSessionPage';
import SessionLobbyPage from './pages/SessionLobbyPage';
import GamePage from './pages/GamePage';
import DebriefPage from './pages/DebriefPage';
import ScenarioBuilderPage from './pages/ScenarioBuilderPage';
import JoinPage from './pages/JoinPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import SessionsPage from './pages/SessionsPage';
import OnboardingPage from './pages/OnboardingPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function FacilitatorRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!['FACILITATOR', 'ORG_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:code" element={<JoinPage />} />

        {/* Protected */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/game/:sessionId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
        <Route path="/debrief/:sessionId" element={<ProtectedRoute><DebriefPage /></ProtectedRoute>} />

        {/* Facilitator+ */}
        <Route path="/scenarios" element={<FacilitatorRoute><ScenariosPage /></FacilitatorRoute>} />
        <Route path="/scenarios/new" element={<FacilitatorRoute><ScenarioBuilderPage /></FacilitatorRoute>} />
        <Route path="/scenarios/:id/edit" element={<FacilitatorRoute><ScenarioBuilderPage /></FacilitatorRoute>} />
        <Route path="/sessions" element={<FacilitatorRoute><SessionsPage /></FacilitatorRoute>} />
        <Route path="/sessions/new" element={<FacilitatorRoute><CreateSessionPage /></FacilitatorRoute>} />
        <Route path="/sessions/:sessionId/lobby" element={<FacilitatorRoute><SessionLobbyPage /></FacilitatorRoute>} />
        <Route path="/sessions/:id/onboarding" element={<FacilitatorRoute><OnboardingPage /></FacilitatorRoute>} />
        <Route path="/admin" element={<FacilitatorRoute><AdminPage /></FacilitatorRoute>} />

        {/* Default */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster />
    </ErrorBoundary>
  );
}
