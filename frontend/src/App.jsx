import { BrowserRouter, Routes, Route } from "react-router-dom";
import SurfariAdminApp from "./SurfariAdminApp";
import AuthCallback from "./pages/AuthCallback";
import AccessDenied from "./pages/AccessDenied";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SurfariAdminApp />} />
        <Route path="/access-denied" element={<AccessDenied />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </BrowserRouter>
  );
}