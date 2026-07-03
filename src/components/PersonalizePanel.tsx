import { useState } from "react";
import {
  loadPersonalization,
  savePersonalization,
  type Personalization,
} from "../config/personalization";
import { Button } from "./ui/Button";

interface PersonalizePanelProps {
  onDone: () => void;
}

export function PersonalizePanel({ onDone }: PersonalizePanelProps) {
  const initial = loadPersonalization();
  const [name, setName] = useState(initial.name);
  const [preferredName, setPreferredName] = useState(initial.preferredName);
  const [role, setRole] = useState(initial.role);
  const [school, setSchool] = useState(initial.school);
  const [tone, setTone] = useState<Personalization["tone"]>(initial.tone);
  const [length, setLength] = useState<Personalization["length"]>(initial.length);
  const [saved, setSaved] = useState(false);

  function markDirty() {
    if (saved) setSaved(false);
  }

  function handleSave() {
    savePersonalization({
      name: name.trim(),
      preferredName: preferredName.trim(),
      role: role.trim(),
      school: school.trim(),
      tone,
      length,
    });
    setSaved(true);
  }

  return (
    <div className="settings-panel">
      <header className="settings-header">
        <h2>Personalize</h2>
        <p>
          Set your defaults once so every response is tailored to you. Stored only on this
          computer — never sent anywhere except to your local model.
        </p>
      </header>

      <div className="settings-field">
        <label htmlFor="personalize-name">Name</label>
        <input
          id="personalize-name"
          type="text"
          value={name}
          onChange={(e) => {
            markDirty();
            setName(e.currentTarget.value);
          }}
        />
      </div>

      <div className="settings-field">
        <label htmlFor="personalize-preferred-name">What should we call you?</label>
        <input
          id="personalize-preferred-name"
          type="text"
          value={preferredName}
          placeholder="e.g., Mr. Ditto"
          onChange={(e) => {
            markDirty();
            setPreferredName(e.currentTarget.value);
          }}
        />
      </div>

      <div className="settings-field">
        <label htmlFor="personalize-role">Role</label>
        <input
          id="personalize-role"
          type="text"
          value={role}
          placeholder="e.g., Principal, 4th grade teacher"
          onChange={(e) => {
            markDirty();
            setRole(e.currentTarget.value);
          }}
        />
      </div>

      <div className="settings-field">
        <label htmlFor="personalize-school">School</label>
        <input
          id="personalize-school"
          type="text"
          value={school}
          placeholder="e.g., West Side Elementary"
          onChange={(e) => {
            markDirty();
            setSchool(e.currentTarget.value);
          }}
        />
      </div>

      <div className="settings-field">
        <label htmlFor="personalize-tone">Default tone</label>
        <select
          id="personalize-tone"
          value={tone}
          onChange={(e) => {
            markDirty();
            setTone(e.currentTarget.value as Personalization["tone"]);
          }}
        >
          <option value="professional">Professional</option>
          <option value="friendly">Friendly</option>
          <option value="casual">Casual</option>
        </select>
      </div>

      <div className="settings-field">
        <label htmlFor="personalize-length">Default response length</label>
        <select
          id="personalize-length"
          value={length}
          onChange={(e) => {
            markDirty();
            setLength(e.currentTarget.value as Personalization["length"]);
          }}
        >
          <option value="short">Short</option>
          <option value="standard">Standard</option>
          <option value="detailed">Detailed</option>
        </select>
      </div>

      <div className="settings-actions">
        <Button onClick={handleSave}>Save</Button>
        <Button variant="secondary" onClick={onDone}>
          Done — back to library
        </Button>
      </div>

      {saved && (
        <div className="connection-banner connection-banner-success">
          Saved — your responses will now be personalized.
        </div>
      )}
      <div className="settings-hint">
        These settings are private to this computer and can be changed any time.
      </div>
    </div>
  );
}
