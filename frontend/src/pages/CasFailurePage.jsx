import { Link, useSearchParams } from "react-router-dom";

const CasFailurePage = () => {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get("reason") || "CAS authentication could not be completed.";

  return (
    <main className="page narrow">
      <div className="card form">
        <h1>CAS Login Failed</h1>
        <p className="error">{reason}</p>
        <div className="action-row">
          <Link to="/login" className="link-btn">
            Back to Login
          </Link>
          <Link to="/" className="link-btn subtle-btn">
            Go to Home
          </Link>
        </div>
      </div>
    </main>
  );
};

export default CasFailurePage;
