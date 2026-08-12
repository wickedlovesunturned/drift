interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: ToggleSwitchProps) {
  return (
    <label className={`setting-toggle${disabled ? " disabled" : ""}`}>
      <span className="setting-toggle-copy">
        <span className="setting-toggle-label">{label}</span>
        {description && <span className="setting-toggle-desc">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        className={`switch${checked ? " on" : ""}`}
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-thumb" />
      </button>
    </label>
  );
}
