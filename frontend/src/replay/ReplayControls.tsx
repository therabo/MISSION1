import { useEffect, useState } from "react";
import { utcInput, type ReplayCoverage } from "./replayApi";
import { stepHistoricalUtc } from './historicalPresentation';
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
            aria-label="Replay back 10 minutes"
            onClick={() =>
              onTime(stepHistoricalUtc(at, -600))
            }
          >
            -10 min
          </button>
          <button
            type="button"
            aria-label="Replay forward 10 minutes"
            disabled={Date.parse(at) + 600000 > Date.now()}
            onClick={() =>
              onTime(stepHistoricalUtc(at, 600))
            }
          >
            +10 min
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
