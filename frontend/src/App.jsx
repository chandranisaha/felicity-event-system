import { Navigate, Route, Routes } from "react-router-dom";
import { useState } from "react";
import NavBar from "./components/NavBar";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import LandingPage from "./pages/LandingPage";
import PublicEventsPage from "./pages/PublicEventsPage";
import EventDetailsPage from "./pages/EventDetailsPage";
import ParticipantDashboard from "./pages/ParticipantDashboard";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ParticipantOnboardingPage from "./pages/ParticipantOnboardingPage";
import ClubsPage from "./pages/ClubsPage";
import OrganizerDetailPage from "./pages/OrganizerDetailPage";
import ParticipantProfilePage from "./pages/ParticipantProfilePage";
import OrganizerProfilePage from "./pages/OrganizerProfilePage";
import OrganizerOngoingEventsPage from "./pages/OrganizerOngoingEventsPage";
import OrganizerCreateEventPage from "./pages/OrganizerCreateEventPage";
import CasCallbackPage from "./pages/CasCallbackPage";
import CasFailurePage from "./pages/CasFailurePage";
import { clearAuth, readAuth, writeAuth } from "./lib/auth";

const App = () => {
  const [auth, setAuthState] = useState(readAuth());

  const setAuth = (value) => {
    setAuthState(value);
    if (value) {
      writeAuth(value);
    } else {
      clearAuth();
    }
  };

  return (
    <div className="app-shell">
      <NavBar auth={auth} onLogout={() => setAuth(null)} />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/events/browse" element={<PublicEventsPage auth={auth} />} />
        <Route path="/events/:eventId" element={<EventDetailsPage auth={auth} />} />
        <Route path="/login" element={<LoginPage setAuth={setAuth} />} />
        <Route path="/register" element={<RegisterPage setAuth={setAuth} />} />
        <Route path="/auth/cas/callback" element={<CasCallbackPage setAuth={setAuth} />} />
        <Route path="/auth/cas/failure" element={<CasFailurePage />} />
        <Route
          path="/onboarding/participant"
          element={
            <ProtectedRoute auth={auth} allowedRoles={["participant"]}>
              <ParticipantOnboardingPage auth={auth} setAuth={setAuth} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/participant"
          element={
            <ProtectedRoute auth={auth} allowedRoles={["participant"]}>
              <ParticipantDashboard auth={auth} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clubs"
          element={
            <ProtectedRoute auth={auth} allowedRoles={["participant"]}>
              <ClubsPage auth={auth} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clubs/:organizerId"
          element={
            <ProtectedRoute auth={auth} allowedRoles={["participant"]}>
              <OrganizerDetailPage auth={auth} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute auth={auth} allowedRoles={["participant"]}>
              <ParticipantProfilePage auth={auth} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/organizer"
          element={
            <ProtectedRoute auth={auth} allowedRoles={["organizer"]}>
              <OrganizerDashboard auth={auth} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/create-event"
          element={
            <ProtectedRoute auth={auth} allowedRoles={["organizer"]}>
              <OrganizerCreateEventPage auth={auth} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/profile"
          element={
            <ProtectedRoute auth={auth} allowedRoles={["organizer"]}>
              <OrganizerProfilePage auth={auth} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/ongoing-events"
          element={
            <ProtectedRoute auth={auth} allowedRoles={["organizer"]}>
              <OrganizerOngoingEventsPage auth={auth} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute auth={auth} allowedRoles={["admin"]}>
              <AdminDashboard auth={auth} initialView="dashboard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/manage-organizers"
          element={
            <ProtectedRoute auth={auth} allowedRoles={["admin"]}>
              <AdminDashboard auth={auth} initialView="manage" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/password-reset-requests"
          element={
            <ProtectedRoute auth={auth} allowedRoles={["admin"]}>
              <AdminDashboard auth={auth} initialView="reset" />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

export default App;
