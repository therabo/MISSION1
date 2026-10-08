import { memo, useEffect, useRef, useState } from 'react';
import { useIssCrew } from '../api/useCrewResource';
import type { CrewMember } from './types';
import { CrewSummary } from './CrewSummary';
import { CrewMemberDetail } from './CrewMemberDetail';
import { CurrentCrewPanel } from './CurrentCrewPanel';

/** Pure DOM operational context; no Cesium, camera, orbital clock, provider or scheduler dependency. */
export const CrewPanel = memo(function CrewPanel({ onClose, workspace = false, interactive = true }: { onClose: () => void; workspace?: boolean; interactive?: boolean }) {
  return workspace ? <CurrentCrewPanel onClose={onClose} interactive={interactive} /> : <LegacyCrewPanel onClose={onClose} />;
});

/** Retained standalone presentation; Historical continues to use ReplayCrewPanel. */
function LegacyCrewPanel({ onClose }: { onClose: () => void }) {
  const resource = useIssCrew();
  const [selected, setSelected] = useState<CrewMember | null>(null);
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const restoreMember = useRef<string | null>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (!selected && restoreMember.current) {
      const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('[data-member-id]');
      const button =
        buttons && [...buttons].find((button) => button.dataset.memberId === restoreMember.current);
      button?.focus();
      restoreMember.current = null;
    }
  }, [selected]);
  function back() {
    restoreMember.current = selected?.id ?? null;
    setSelected(null);
  }
  return (
    <aside
      id="crew-panel"
      className="crew-panel"
      ref={panel}
      aria-labelledby="crew-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          if (selected) back();
          else onClose();
        }
      }}
    >
      <header className="crew-panel-header">
        <div>
          <span className="eyebrow">ISS / OPERATIONAL CONTEXT</span>
          <h2 id="crew-title" tabIndex={-1} ref={heading}>
            {resource.data?.station.name ?? 'International Space Station'}
          </h2>
        </div>
        <button type="button" aria-label="Close crew panel" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="crew-toolbar">
        {selected ? (
          <button type="button" onClick={back}>
            ← Back to crew
          </button>
        ) : (
          <span>Crew</span>
        )}
        {!selected && (
          <button type="button" disabled={resource.loading} onClick={resource.refresh}>
            {resource.loading && resource.data ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      </div>
      <div className="crew-panel-content" key={selected?.id ?? 'list'}>
        {selected ? (
          <CrewMemberDetail key={selected.id} member={selected} />
        ) : (
          <>
            {resource.loading && !resource.data && (
              <div className="crew-loading" role="status">
                <p>Loading crew information…</p>
                <span />
                <span />
                <span />
              </div>
            )}
            {resource.error && (
              <div className="crew-error" role="alert">
                <p>{resource.error}</p>
                {resource.data && (
                  <p>
                    Showing the previous response. Refresh failed; the displayed assessment has not been
                    updated.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    heading.current?.focus();
                    resource.refresh();
                  }}
                >
                  Retry crew
                </button>
              </div>
            )}
            {resource.data && (
              <CrewSummary
                crew={resource.data}
                onMember={(id) => {
                  const member = resource.data?.members.find((member) => member.id === id);
                  if (member) setSelected(member);
                }}
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
}
