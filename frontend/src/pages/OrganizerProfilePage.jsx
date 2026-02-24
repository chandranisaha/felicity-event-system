import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

const OrganizerProfilePage = ({ auth }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest({ path: "/api/organizers/profile", token: auth.token });
      setProfile(response.organizer);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await apiRequest({
        path: "/api/organizers/profile",
        method: "PATCH",
        token: auth.token,
        body: {
          name: profile.name,
          category: profile.category,
          description: profile.description,
          contactNumber: profile.contactNumber,
          discordWebhookUrl: profile.discordWebhookUrl,
        },
      });
      setProfile(response.organizer);
      setMessage("profile updated");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="page">Loading organizer profile...</main>;

  return (
    <main className="page">
      <h1>Organizer Profile</h1>
      {error && <p className="error">{error}</p>}
      {message && <p className="muted">{message}</p>}
      <section className="card form">
        <label>
          Organizer Name
          <input value={profile.name || ""} onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))} />
        </label>
        <label>
          Category
          <input value={profile.category || ""} onChange={(e) => setProfile((prev) => ({ ...prev, category: e.target.value }))} />
        </label>
        <label>
          Description
          <textarea rows={4} value={profile.description || ""} onChange={(e) => setProfile((prev) => ({ ...prev, description: e.target.value }))} />
        </label>
        <label>
          Contact Number
          <input value={profile.contactNumber || ""} onChange={(e) => setProfile((prev) => ({ ...prev, contactNumber: e.target.value }))} />
        </label>
        <label>
          Contact Email (Login Email, Non-editable)
          <input value={profile.contactEmail || ""} disabled />
        </label>
        <label>
          Discord Webhook URL
          <input
            placeholder="https://discord.com/api/webhooks/..."
            value={profile.discordWebhookUrl || ""}
            onChange={(e) => setProfile((prev) => ({ ...prev, discordWebhookUrl: e.target.value }))}
          />
        </label>
        <button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </section>
    </main>
  );
};

export default OrganizerProfilePage;
