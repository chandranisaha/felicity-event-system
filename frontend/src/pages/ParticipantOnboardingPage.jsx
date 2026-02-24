import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";

const ParticipantOnboardingPage = ({ auth, setAuth }) => {
  const navigate = useNavigate();
  const [interestOptions, setInterestOptions] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [interests, setInterests] = useState([]);
  const [followedOrganizers, setFollowedOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  const loadOptions = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest({
        path: "/api/participants/onboarding/options",
        token: auth?.token,
      });
      setInterestOptions(response.interestOptions || []);
      setOrganizers(response.organizers || []);
      setInterests(response.current?.interests || []);
      setFollowedOrganizers(response.current?.followedOrganizers || []);
      if (response.current?.onboardingCompleted) {
        navigate("/dashboard/participant");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const toggleInterest = (value) => {
    setInterests((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  const toggleFollow = (organizerId) => {
    setFollowedOrganizers((prev) => (prev.includes(organizerId) ? prev.filter((item) => item !== organizerId) : [...prev, organizerId]));
  };

  const complete = async (skip = false) => {
    setSaving(true);
    setError("");
    try {
      const response = await apiRequest({
        path: "/api/participants/onboarding/complete",
        method: "POST",
        token: auth?.token,
        body: skip
          ? { skip: true }
          : {
              skip: false,
              interests,
              followedOrganizers,
            },
      });

      setAuth({
        ...auth,
        user: {
          ...auth.user,
          onboardingCompleted: true,
        },
      });

      if (!skip) {
        navigate("/dashboard/participant");
        return;
      }
      if (response?.participant) {
        navigate("/dashboard/participant");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="page narrow">Loading onboarding...</main>;
  }

  return (
    <main className="page">
      <div className="card form">
        <h1>Participant Onboarding</h1>
        <p className="muted">Step {step} of 2. You can skip now and edit later from profile.</p>
        {step === 1 ? (
          <div>
            <h3>Choose Areas of Interest</h3>
            <div className="chip-grid">
              {interestOptions.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={interests.includes(option) ? "chip-option active" : "chip-option"}
                  onClick={() => toggleInterest(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="row">
              <button type="button" onClick={() => setStep(2)}>
                Continue
              </button>
              <button type="button" className="ghost-btn" onClick={() => complete(true)} disabled={saving}>
                Skip for Now
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h3>Follow Clubs / Organizers</h3>
            <div className="chip-grid">
              {organizers.map((org) => (
                <button
                  type="button"
                  key={org.id}
                  className={followedOrganizers.includes(org.id) ? "chip-option active" : "chip-option"}
                  onClick={() => toggleFollow(org.id)}
                >
                  <span>{org.name}</span>
                  <span className="chip-subtitle">{org.category}</span>
                </button>
              ))}
            </div>
            <div className="row">
              <button type="button" className="ghost-btn" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" onClick={() => complete(false)} disabled={saving}>
                {saving ? "Saving..." : "Complete Onboarding"}
              </button>
            </div>
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
};

export default ParticipantOnboardingPage;
