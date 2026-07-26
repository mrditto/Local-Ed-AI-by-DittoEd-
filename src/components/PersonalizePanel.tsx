import { useState } from "react";
import {
  applyTextSize,
  loadPersonalization,
  savePersonalization,
  RESPONSE_LANGUAGE_NAMES,
  type Personalization,
  type ResponseLanguage,
  type TextSize,
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
  const [language, setLanguage] = useState<ResponseLanguage>(initial.language);
  const [textSize, setTextSize] = useState<TextSize>(initial.textSize);
  const [saved, setSaved] = useState(false);

  function handleTextSizeChange(next: TextSize) {
    markDirty();
    setTextSize(next);
    applyTextSize(next);
  }

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
      language,
      textSize,
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

      <div className="settings-field">
        <label htmlFor="personalize-language">Response language</label>
        <select
          id="personalize-language"
          value={language}
          onChange={(e) => {
            markDirty();
            setLanguage(e.currentTarget.value as ResponseLanguage);
          }}
        >
          {Object.entries(RESPONSE_LANGUAGE_NAMES).map(([code, langName]) => (
            <option key={code} value={code}>
              {langName}
            </option>
          ))}
        </select>
        <span className="settings-hint">
          The AI answers in this language; the app's own buttons and menus stay in English.
          Quality depends on the local model you've picked — smaller models are noticeably
          weaker outside English. The IEP Form Assistant always drafts in English, to match
          Maryland's official form.
        </span>
      </div>

      <div className="settings-field">
        <label htmlFor="personalize-text-size">Text size</label>
        <select
          id="personalize-text-size"
          value={textSize}
          onChange={(e) => handleTextSizeChange(e.currentTarget.value as TextSize)}
        >
          <option value="small">Small</option>
          <option value="standard">Standard</option>
          <option value="large">Large</option>
        </select>
        <span className="settings-hint">Applies right away — Save just makes it stick.</span>
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
