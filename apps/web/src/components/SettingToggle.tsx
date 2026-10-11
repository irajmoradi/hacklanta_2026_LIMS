import { useId } from 'react';

/** Native keyboard behavior with a village switch and a separate description. */
export function SettingToggle({ label, help, checked, onChange, disabled = false }: {
  label: string; help: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean;
}) {
  const id = useId();
  return <div className="setting-toggle">
    <label htmlFor={id}>{label}</label>
    <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled}
      aria-describedby={`${id}-help`} onChange={e => onChange(e.target.checked)} />
    <p id={`${id}-help`} className="help-text">{help}</p>
  </div>;
}
