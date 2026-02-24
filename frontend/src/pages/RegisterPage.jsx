import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";

const RegisterPage = ({ setAuth }) => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [institutionCategory, setInstitutionCategory] = useState("IIIT");
  const [participantType, setParticipantType] = useState("Student");
  const [college, setCollege] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const normalizedContact = String(contact || "").replace(/[\s()-]/g, "");
    if (normalizedContact && !/^\+?[0-9]{7,15}$/.test(normalizedContact)) {
      setError("contact number must be 7 to 15 digits (optional + allowed)");
      setLoading(false);
      return;
    }
    try {
      const response = await apiRequest({
        path: "/api/auth/register",
        method: "POST",
        body: {
          firstName,
          lastName,
          email,
          password,
          role: "participant",
          institutionCategory,
          participantType,
          college: institutionCategory === "IIIT" ? "IIIT Hyderabad" : college,
          contact,
          interests: [],
          casVerified: false,
        },
      });
      const auth = { token: response.token, user: response.user };
      setAuth(auth);
      navigate(response.user.onboardingCompleted ? "/dashboard/participant" : "/onboarding/participant");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page narrow">
      <h1>Participant Registration</h1>
      <form className="card form" onSubmit={submit}>
        <div className="tabs">
          <button
            type="button"
            className={institutionCategory === "IIIT" ? "tab-btn tab-btn-active" : "tab-btn"}
            onClick={() => setInstitutionCategory("IIIT")}
          >
            IIIT
          </button>
          <button
            type="button"
            className={institutionCategory === "Non-IIIT" ? "tab-btn tab-btn-active" : "tab-btn"}
            onClick={() => setInstitutionCategory("Non-IIIT")}
          >
            Non-IIIT
          </button>
        </div>
        <p className="muted small-gap">
          {institutionCategory === "IIIT"
            ? "Use your iiit.ac.in email (faculty email is valid)."
            : "Use any valid email. Preferences can be set in onboarding."}
        </p>
        <label>
          First Name
          <input placeholder="Enter first name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </label>
        <label>
          Last Name
          <input placeholder="Enter last name (optional)" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </label>
        <label>
          Email
          <input placeholder="Enter email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Participant Type
          <select value={participantType} onChange={(e) => setParticipantType(e.target.value)} required>
            <option value="Student">Student</option>
            <option value="Faculty">Faculty</option>
            <option value="Staff">Staff</option>
            <option value="External">External</option>
          </select>
        </label>
        {institutionCategory === "Non-IIIT" ? (
          <label>
            College / Organization
            <input placeholder="Enter college or organization" value={college} onChange={(e) => setCollege(e.target.value)} required />
          </label>
        ) : null}
        <label>
          Contact Number
          <input placeholder="Enter contact number (optional)" value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        <label>
          Password
          <input placeholder="Enter password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {institutionCategory === "IIIT" ? <p className="helper-link">IIIT registrations use iiit.ac.in email verification in this flow.</p> : null}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Registering..." : "Create Participant Account"}
        </button>
      </form>
      <p className="helper-link">
        Organizer/Admin accounts are provisioned by Admin only. Already have an account? <Link to="/login">Login</Link>
      </p>
    </main>
  );
};

export default RegisterPage;
