import { Routes, Route } from "react-router-dom";

import PreinscripcionWizard from "@/components/preinscripcion/PreinscripcionWizard";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { buildPublicRoutes } from "@/router/routes/PublicRoutes";
import { buildAppShellRoutes } from "@/router/routes/AppShellRoutes";
import { buildAdminRoutes } from "@/router/routes/AdminRoutes";
import { ProtectedRoute } from "@/router/guards";
import ChangePasswordPage from "@/pages/Auth/ChangePasswordPage";

export default function App() {
  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  const preinscripcionElement = recaptchaKey ? (
    <GoogleReCaptchaProvider reCaptchaKey={recaptchaKey}>
      <PreinscripcionWizard />
    </GoogleReCaptchaProvider>
  ) : (
    <PreinscripcionWizard />
  );

  return (
    <Routes>
      {buildPublicRoutes({ preinscripcionElement })}
      {buildAppShellRoutes()}
      {buildAdminRoutes()}
      <Route path="/cambiar-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
    </Routes>
  );
}
