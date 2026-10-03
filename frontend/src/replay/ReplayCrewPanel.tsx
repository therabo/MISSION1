import { useEffect, useRef, useState } from "react";
import type { ReplayResult } from "./replayApi";
import { CrewSummary } from "../crew/CrewSummary";
import { CrewProfile } from "../crew/CrewMemberDetail";
export function ReplayCrewPanel({
  data,
  loading,
  error,
  at,
  onClose,
}: {
  data: ReplayResult | null;
  loading: boolean;
  error: string | null;
  at: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    setSelected(null);
  }, [at]);
  const person = data?.crew.profiles.find((p) => p.id === selected);
  return (
    <aside
      id="crew-panel"
      className="crew-panel"
      aria-labelledby="replay-crew-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          if (selected) setSelected(null);
          else onClose();
        }
      }}
    >
      <header className="crew-panel-header">
        <div>
          <span className="eyebrow">REPLAY / EFFECTIVE TIME</span>
          <h2 id="replay-crew-title" ref={heading} tabIndex={-1}>
            ISS Crew history
          </h2>
        </div>
        <button aria-label="Close crew panel" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="crew-panel-content">
        <p className="crew-note">
          Effective at {at}. Best reconstruction from evidence stored today.
          Coverage and roster may be partial.
        </p>
        {data?.orbit.availability === 'UNAVAILABLE' && <p className="crew-note" role="status">Orbit history unavailable at this instant.</p>}
        {loading && <p role="status">Loading historical crew…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && data?.crew.availability === "UNAVAILABLE" && (
          <p role="status">
            Crew history unavailable at this instant. No current roster is
            substituted.
          </p>
        )}
        {person ? (
          <>
            <button onClick={() => setSelected(null)}>← Back to crew</button>
            <h3>{person.name}</h3>
            <CrewProfile person={person} replayAt={at} />
          </>
        ) : (
          data?.crew.state && (
            <CrewSummary crew={data.crew.state} onMember={setSelected} />
          )
        )}
      </div>
    </aside>
  );
}
