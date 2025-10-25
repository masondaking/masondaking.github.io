import { Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./pages/Landing/LandingPage";
import { SignupPage } from "./pages/Auth/SignupPage";
import { LoginPage } from "./pages/Auth/LoginPage";
import { StoryBuilderPage } from "./pages/Workspace/StoryBuilderPage";
import { LibraryPage } from "./pages/Library/LibraryPage";
import { StoryDetailPage } from "./pages/Library/StoryDetailPage";
import { MainLayout } from "./components/layout/MainLayout";
import { ProtectedRoute } from "./components/navigation/ProtectedRoute";
import { DevRoute } from "./components/navigation/DevRoute";
import { SettingsPage } from "./pages/Settings/SettingsPage";
import { DevToolsPage } from "./pages/Dev/DevToolsPage";

function App() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/stories" element={<LibraryPage />} />
        <Route path="/stories/:storyId" element={<StoryDetailPage />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studio"
          element={
            <ProtectedRoute>
              <StoryBuilderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dev"
          element={
            <DevRoute>
              <DevToolsPage />
            </DevRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MainLayout>
  );
}

export default App;

