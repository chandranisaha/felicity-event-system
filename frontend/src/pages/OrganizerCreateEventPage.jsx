import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";

const emptyFormField = (order = 0) => ({
  label: "",
  type: "text",
  required: false,
  optionsText: "",
  order,
});

const emptyVariant = () => ({
  name: "",
  sizeMode: "ONE_SIZE",
  customSizesText: "",
  colorsText: "Black, White",
  stock: 10,
});

const OrganizerCreateEventPage = ({ auth }) => {
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [successNotice, setSuccessNotice] = useState(null);
  const navigate = useNavigate();
  const [newEvent, setNewEvent] = useState({
    name: "",
    description: "",
    coverImage: "",
    eventType: "Normal",
    eligibility: "iiit",
    registrationDeadline: "",
    startDate: "",
    endDate: "",
    registrationLimit: 100,
    registrationFee: 0,
    formFields: [emptyFormField(0)],
    purchaseLimitPerUser: 2,
    allowCancellation: true,
    variants: [emptyVariant()],
  });

  const normalizeFormFields = () => {
    return newEvent.formFields
      .filter((field) => field.label.trim())
      .map((field, index) => ({
        label: field.label.trim(),
        type: field.type,
        required: Boolean(field.required),
        options:
          field.type === "dropdown"
            ? field.optionsText
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            : [],
        order: index,
      }));
  };

  const normalizeVariants = () => {
    return newEvent.variants
      .filter((variant) => variant.name.trim())
      .map((variant) => ({
        name: variant.name.trim(),
        sizeMode: variant.sizeMode,
        sizes:
          variant.sizeMode === "CUSTOM"
            ? variant.customSizesText
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            : [],
        colors: variant.colorsText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        stock: Number(variant.stock),
        remainingStock: Number(variant.stock),
      }));
  };

  const createEventWithStatus = async (status) => {
    setCreating(true);
    setError("");
    try {
      const payload = {
        name: newEvent.name,
        description: newEvent.description,
        coverImage: newEvent.coverImage,
        eventType: newEvent.eventType,
        eligibility: newEvent.eligibility,
        registrationDeadline: newEvent.registrationDeadline,
        startDate: newEvent.startDate,
        endDate: newEvent.endDate,
        registrationLimit: Number(newEvent.registrationLimit),
        registrationFee: Number(newEvent.registrationFee),
        status,
      };

      if (newEvent.eventType === "Normal") {
        payload.formFields = normalizeFormFields();
      } else {
        payload.merchandiseConfig = {
          purchaseLimitPerUser: Number(newEvent.purchaseLimitPerUser),
          allowCancellation: Boolean(newEvent.allowCancellation),
          variants: normalizeVariants(),
        };
      }

      await apiRequest({
        path: "/api/events",
        method: "POST",
        token: auth.token,
        body: payload,
      });

      setSuccessNotice({
        title: status === "Draft" ? "Draft Saved" : "Event Published",
        message: status === "Draft" ? "Your event has been saved as draft." : "Your event is now published.",
      });
      setNewEvent({
        name: "",
        description: "",
        coverImage: "",
        eventType: "Normal",
        eligibility: "iiit",
        registrationDeadline: "",
        startDate: "",
        endDate: "",
        registrationLimit: 100,
        registrationFee: 0,
        formFields: [emptyFormField(0)],
        purchaseLimitPerUser: 2,
        allowCancellation: true,
        variants: [emptyVariant()],
      });
      setTimeout(() => {
        navigate("/dashboard/organizer");
      }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const updateField = (index, patch) => {
    setNewEvent((prev) => {
      const next = [...prev.formFields];
      next[index] = { ...next[index], ...patch };
      return { ...prev, formFields: next };
    });
  };

  const moveField = (index, direction) => {
    setNewEvent((prev) => {
      const next = [...prev.formFields];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, formFields: next };
    });
  };

  const removeField = (index) => {
    setNewEvent((prev) => {
      const next = prev.formFields.filter((_, i) => i !== index);
      return { ...prev, formFields: next.length ? next : [emptyFormField(0)] };
    });
  };

  const updateVariant = (index, patch) => {
    setNewEvent((prev) => {
      const next = [...prev.variants];
      next[index] = { ...next[index], ...patch };
      return { ...prev, variants: next };
    });
  };

  const removeVariant = (index) => {
    setNewEvent((prev) => {
      const next = prev.variants.filter((_, i) => i !== index);
      return { ...prev, variants: next.length ? next : [emptyVariant()] };
    });
  };

  return (
    <main className="page">
      <h1>Create Event</h1>
      {error && <p className="error">{error}</p>}
      <section className="card form">
        <label>
          Event Name
          <input value={newEvent.name} onChange={(e) => setNewEvent((prev) => ({ ...prev, name: e.target.value }))} required />
        </label>
        <label>
          Event Description
          <textarea rows={4} value={newEvent.description} onChange={(e) => setNewEvent((prev) => ({ ...prev, description: e.target.value }))} required />
        </label>
        <label>
          Cover Image URL
          <input value={newEvent.coverImage} onChange={(e) => setNewEvent((prev) => ({ ...prev, coverImage: e.target.value }))} />
        </label>
        <div className="row">
          <label>
            Event Type
            <select value={newEvent.eventType} onChange={(e) => setNewEvent((prev) => ({ ...prev, eventType: e.target.value }))}>
              <option value="Normal">Normal</option>
              <option value="Merchandise">Merchandise</option>
            </select>
          </label>
          <label>
            Eligibility
            <select value={newEvent.eligibility} onChange={(e) => setNewEvent((prev) => ({ ...prev, eligibility: e.target.value }))}>
              <option value="iiit">IIIT</option>
              <option value="non-iiit">Non-IIIT</option>
              <option value="all">All</option>
            </select>
          </label>
          <label>
            Registration Limit
            <input type="number" min={1} value={newEvent.registrationLimit} onChange={(e) => setNewEvent((prev) => ({ ...prev, registrationLimit: e.target.value }))} required />
          </label>
          <label>
            Registration Fee
            <input type="number" min={0} value={newEvent.registrationFee} onChange={(e) => setNewEvent((prev) => ({ ...prev, registrationFee: e.target.value }))} required />
          </label>
        </div>
        <div className="row">
          <label>
            Registration Deadline
            <input type="datetime-local" value={newEvent.registrationDeadline} onChange={(e) => setNewEvent((prev) => ({ ...prev, registrationDeadline: e.target.value }))} required />
          </label>
          <label>
            Start Date
            <input type="datetime-local" value={newEvent.startDate} onChange={(e) => setNewEvent((prev) => ({ ...prev, startDate: e.target.value }))} required />
          </label>
          <label>
            End Date
            <input type="datetime-local" value={newEvent.endDate} onChange={(e) => setNewEvent((prev) => ({ ...prev, endDate: e.target.value }))} required />
          </label>
        </div>

        {newEvent.eventType === "Normal" && (
          <div className="card form">
            <h3>Dynamic Registration Form Builder</h3>
            <p className="muted">Supported field types: text, dropdown, checkbox, file URL (Google Drive/Cloudinary link).</p>
            {newEvent.formFields.map((field, index) => (
              <div key={`field-${index}`} className="inline-box form-builder-item">
                <div className="row">
                  <label>
                    Label
                    <input value={field.label} onChange={(e) => updateField(index, { label: e.target.value })} />
                  </label>
                  <label>
                    Type
                    <select value={field.type} onChange={(e) => updateField(index, { type: e.target.value })}>
                      <option value="text">Text</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="file">File URL</option>
                    </select>
                  </label>
                  <label className="checkbox-inline">
                    <input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} />
                    Required
                  </label>
                </div>
                {field.type === "dropdown" && (
                  <label>
                    Dropdown Options (comma separated)
                    <input value={field.optionsText} onChange={(e) => updateField(index, { optionsText: e.target.value })} placeholder="AI,Web,Systems" />
                  </label>
                )}
                <div className="row">
                  <button type="button" className="tab-btn" onClick={() => moveField(index, -1)}>
                    Move Up
                  </button>
                  <button type="button" className="tab-btn" onClick={() => moveField(index, 1)}>
                    Move Down
                  </button>
                  <button type="button" className="danger-btn" onClick={() => removeField(index)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setNewEvent((prev) => ({ ...prev, formFields: [...prev.formFields, emptyFormField(prev.formFields.length)] }))}>
              Add Field
            </button>
          </div>
        )}

        {newEvent.eventType === "Merchandise" && (
          <div className="card form">
            <h3>Merchandise Configuration</h3>
            <div className="row">
              <label>
                Purchase Limit Per User
                <input
                  type="number"
                  min={1}
                  value={newEvent.purchaseLimitPerUser}
                  onChange={(e) => setNewEvent((prev) => ({ ...prev, purchaseLimitPerUser: e.target.value }))}
                />
              </label>
              <label className="checkbox-inline">
                <input type="checkbox" checked={newEvent.allowCancellation} onChange={(e) => setNewEvent((prev) => ({ ...prev, allowCancellation: e.target.checked }))} />
                Allow Cancellation and Stock Restore
              </label>
            </div>
            {newEvent.variants.map((variant, index) => (
              <div key={`variant-${index}`} className="inline-box">
                <div className="row">
                  <label>
                    Item Name
                    <input value={variant.name} onChange={(e) => updateVariant(index, { name: e.target.value })} />
                  </label>
                  <label>
                    Size Mode
                    <select value={variant.sizeMode} onChange={(e) => updateVariant(index, { sizeMode: e.target.value })}>
                      <option value="ONE_SIZE">One Size</option>
                      <option value="S_XL">S-XL</option>
                      <option value="XS_XXL">XS-XXL</option>
                      <option value="S_XXL">S-XXL</option>
                      <option value="CUSTOM">Custom</option>
                    </select>
                  </label>
                  <label>
                    Colors (comma separated)
                    <input value={variant.colorsText} onChange={(e) => updateVariant(index, { colorsText: e.target.value })} placeholder="Black, Blue, Red" />
                  </label>
                  <label>
                    Stock
                    <input type="number" min={0} value={variant.stock} onChange={(e) => updateVariant(index, { stock: e.target.value })} />
                  </label>
                </div>
                {variant.sizeMode === "CUSTOM" && (
                  <label>
                    Custom Sizes (comma separated)
                    <input
                      value={variant.customSizesText}
                      onChange={(e) => updateVariant(index, { customSizesText: e.target.value })}
                      placeholder="XS, S, M, L, XL, XXL"
                    />
                  </label>
                )}
                <button type="button" className="danger-btn" onClick={() => removeVariant(index)}>
                  Remove Item
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setNewEvent((prev) => ({ ...prev, variants: [...prev.variants, emptyVariant()] }))}>
              Add Merchandise Item
            </button>
          </div>
        )}

        <div className="row">
          <button type="button" disabled={creating} onClick={() => createEventWithStatus("Draft")}>
            {creating ? "Saving..." : "Save as Draft"}
          </button>
          <button type="button" disabled={creating} onClick={() => createEventWithStatus("Published")}>
            {creating ? "Publishing..." : "Publish Event"}
          </button>
        </div>
      </section>

      {successNotice ? (
        <div className="scanner-modal-overlay" onClick={() => setSuccessNotice(null)}>
          <div className="scanner-result-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{successNotice.title}</h3>
            <p className="success-text">{successNotice.message}</p>
            <p className="event-meta">Redirecting to Organizer Dashboard...</p>
            <button type="button" onClick={() => navigate("/dashboard/organizer")}>
              Go Now
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
};

export default OrganizerCreateEventPage;
