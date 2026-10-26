import type { Query } from "../api";

interface Props {
  value: Query;
  onChange: (q: Query) => void;
}

export default function Controls({ value, onChange }: Props) {
  return (
    <div className="controls">
      <label>
        From
        <input
          type="date"
          min="2026-01-01"
          max="2026-01-31"
          value={value.start}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
        />
      </label>
      <label>
        To
        <input
          type="date"
          min="2026-01-01"
          max="2026-01-31"
          value={value.end}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
        />
      </label>
      <label>
        Decision time (day before, UK time)
        <select
          value={value.decisionHour}
          onChange={(e) => onChange({ ...value, decisionHour: Number(e.target.value) })}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}