import { useEffect, useState } from "react";
import { utcInput, type ReplayCoverage } from "./replayApi";
export function ReplayControls({
  enabled,
  at,
  onMode,
  onTime,
  disabled,
  coverage,
}: {
  enabled: boolean;
  at: string;
  onMode: (value: boolean) => void;
  onTime: (value: string) => void;
  disabled: boolean;
  coverage: ReplayCoverage | null;
}) {
  const [input, setInput] = useState(at.slice(0, 19)),
    [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setInput(at.slice(0, 19));
    setInvalid(false);
  }, [at]);
  const shortUtc = (value: string | null) => value ? new Date(value).toISOString().slice(0,19).replace('T',' ') : 'unavailable';
  const change = (value: string) => {
    setInput(value);
    const valid = utcInput(value);
    setInvalid(!valid);
    if (valid) onTime(valid);
  };
  return (
    <div className={`replay-controls ${enabled ? "is-replay" : ""}`}>
      <button
        type="button"
        aria-pressed={enabled}
        disabled={disabled}
        onClick={() => onMode(!enabled)}
      >
        {enabled ? "Return to LIVE" : "Replay history"}
      </button>
      {enabled && (
        <>
          <strong>REPLAY / UTC</strong>
          <label>
            <span className="sr-only">Replay UTC instant</span>
            <input
              aria-label="Replay UTC instant"
              type="datetime-local"
              step="1"
              value={input}
              aria-invalid={invalid}
              onChange={(e) => change(e.target.value)}
            />
          </label>
          <button
            type="button"
            aria-label="Replay back one hour"
            onClick={() =>
              onTime(new Date(Date.parse(at) - 3600000).toISOString())
            }
          >
            −1h
          </button>
          <button
            type="button"
            aria-label="Replay forward one hour"
            disabled={Date.parse(at) + 3600000 > Date.now()}
            onClick={() =>
              onTime(new Date(Date.parse(at) + 3600000).toISOString())
            }
          >
            +1h
          </button>
          {invalid && <span role="alert">Enter a valid past UTC instant.</span>}
          {coverage && (
            <small>
              Crew support: {shortUtc(coverage.crew.start)} →{" "}
              {shortUtc(coverage.crew.end)} · partial evidence · {coverage.crew.intervals.length} support interval(s)
            </small>
          )}
        </>
      )}
    </div>
  );
}
