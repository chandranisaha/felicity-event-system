import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const CasCallbackPage = ({ setAuth }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const status = searchParams.get("status");
    if (status !== "success") {
      navigate(`/auth/cas/failure?reason=${encodeURIComponent(searchParams.get("reason") || "CAS login failed")}`);
      return;
    }

    const token = searchParams.get("token");
    const id = searchParams.get("id");
    const name = searchParams.get("name");
    const email = searchParams.get("email");
    const onboardingCompleted = searchParams.get("onboardingCompleted") === "true";

    if (!token || !id || !email) {
      setError("Missing CAS response data");
      return;
    }

    setAuth({
      token,
      user: {
        id,
        role: "participant",
        name: name || email,
        email,
        onboardingCompleted,
      },
    });
    navigate(onboardingCompleted ? "/dashboard/participant" : "/onboarding/participant", { replace: true });
  }, [searchParams, navigate, setAuth]);

  return (
    <main className="page narrow">
      <div className="card">
        <h1>Finalizing CAS Login</h1>
        {error ? <p className="error">{error}</p> : <p className="muted">Please wait while we complete authentication.</p>}
      </div>
    </main>
  );
};

export default CasCallbackPage;
