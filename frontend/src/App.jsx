import { BrowserRouter, Routes, Route } from "react-router-dom";
import SurfariAdminApp from "./SurfariAdminApp";
import AuthSuccess from "./pages/AuthSuccess";
import AuthCallback from "./pages/AuthCallback";
import AccessDenied from "./pages/AccessDenied";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SurfariAdminApp />} />
        <Route path="/auth/success" element={<AuthSuccess />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/access-denied" element={<AccessDenied />} />
      </Routes>
    </BrowserRouter>
  );
}