import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

const ParticipantProfilePage = ({ auth }) => {
  const interestOptions = ["Technical", "Cultural", "Sports", "Entrepreneurship", "Design", "Music", "Dance", "Photography", "Robotics", "AI/ML", "Gaming", "Literature"];
  const [profile, setProfile] = useState(null);
  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [profileResponse, organizerResponse] = await Promise.all([
        apiRequest({ path: "/api/participants/profile", token: auth.token }),
        apiRequest({ path: "/api/participants/organizers", token: auth.token }),
      ]);
      setProfile(profileResponse.participant);
      setOrganizers(organizerResponse.organizers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleInterest = (interest) => {
    setProfile((prev) => {
      const exists = prev.interests.includes(interest);
      return {
        ...prev,
        interests: exists ? prev.interests.filter((item) => item !== interest) : [...prev.interests, interest],
      };
    });
  };

  const toggleFollow = (organizerId) => {
    setProfile((prev) => {
      const ids = (prev.followedOrganizers || []).map((item) => String(item._id || item));
      const exists = ids.includes(organizerId);
      const nextIds = exists ? ids.filter((id) => id !== organizerId) : [...ids, organizerId];
      return { ...prev, followedOrganizers: nextIds };
    });
  };

  const saveProfile = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const followedIds = (profile.followedOrganizers || []).map((item) => String(item._id || item));
      const response = await apiRequest({
        path: "/api/participants/profile",
        method: "PATCH",
        token: auth.token,
        body: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          contact: profile.contact,
          college: profile.college,
          interests: profile.interests,
          followedOrganizers: followedIds,
        },
      });
      setProfile(response.participant);
      setMessage("profile updated successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setError("");
    setMessage("");
    try {
      const response = await apiRequest({
        path: "/api/participants/profile/change-password",
        method: "POST",
        token: auth.token,
        body: passwordForm,
      });
      setMessage(response.message);
      setPasswordForm({ currentPassword: "", newPassword: "" });
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <main className="page">Loading profile...</main>;
  }

  return (
    <main className="page">
      <h1>Profile</h1>
      {error && <p className="error">{error}</p>}
      {message && <p className="muted">{message}</p>}

      <section className="card form">
        <h3>Editable Fields</h3>
        <label>
          First Name
          <input value={profile.firstName || ""} onChange={(e) => setProfile((prev) => ({ ...prev, firstName: e.target.value }))} />
        </label>
        <label>
          Last Name
          <input value={profile.lastName || ""} onChange={(e) => setProfile((prev) => ({ ...prev, lastName: e.target.value }))} />
        </label>
        <label>
          Contact Number
          <input value={profile.contact || ""} onChange={(e) => setProfile((prev) => ({ ...prev, contact: e.target.value }))} />
        </label>
        <label>
          College / Organization Name
          <input value={profile.college || ""} onChange={(e) => setProfile((prev) => ({ ...prev, college: e.target.value }))} />
        </label>
        <div>
          <p className="muted">Selected Interests</p>
          <div className="choice-grid">
            {interestOptions.map((interest) => (
              <label key={interest} className="choice-item">
                <input type="checkbox" checked={(profile.interests || []).includes(interest)} onChange={() => toggleInterest(interest)} />
                <span>{interest}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="muted">Followed Clubs</p>
          <div className="choice-grid">
            {organizers.map((organizer) => {
              const selected = (profile.followedOrganizers || []).map((item) => String(item._id || item)).includes(organizer.id);
              return (
                <label key={organizer.id} className="choice-item">
                  <input type="checkbox" checked={selected} onChange={() => toggleFollow(organizer.id)} />
                  <span>{organizer.name}</span>
                </label>
              );
            })}
          </div>
        </div>
        <button type="button" onClick={saveProfile} disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </section>

      <section className="card form">
        <h3>Non-Editable Fields</h3>
        <label>
          Email Address
          <input value={profile.email || ""} disabled />
        </label>
        <label>
          Participant Type (IIIT / Non-IIIT)
          <input value={profile.institutionCategory || ""} disabled />
        </label>
      </section>

      <section className="card form">
        <h3>Security Settings</h3>
        <label>
          Current Password
          <input
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
          />
        </label>
        <label>
          New Password
          <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))} />
        </label>
        <button type="button" onClick={changePassword}>
          Change Password
        </button>
      </section>
    </main>
  );
};

export default ParticipantProfilePage;
