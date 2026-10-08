import { memo, useEffect, useRef, useState } from 'react';
import { useIssCrew } from '../api/useCrewResource';
import type { CrewMember } from './types';
import { CrewSummary } from './CrewSummary';
import { CrewMemberDetail } from './CrewMemberDetail';
import { CurrentCrewRoster } from './CurrentCrewRoster';
import { ContextButton } from '../components/ContextButton';

/** Pure DOM operational context; no Cesium, camera, orbital clock, provider or scheduler dependency. */
export const CrewPanel = memo(function CrewPanel({ onClose, workspace = false, interactive = true }: { onClose: () => void; workspace?: boolean; interactive?: boolean }) {
  const resource = useIssCrew();
  const [selected, setSelected] = useState<CrewMember | null>(null);
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const restoreMember = useRef<string | null>(null);
  const rosterScroll = useRef(0);
  useEffect(() => {
    if (interactive) heading.current?.focus({ preventScroll: true });
  }, [interactive]);
  useEffect(() => {
    if (!selected && restoreMember.current) {
      const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('[data-member-id]');
      const button =
        buttons && [...buttons].find((button) => button.dataset.memberId === restoreMember.current);
      if (workspace) {
        const content = panel.current?.querySelector('.crew-panel-content');
        if (content) content.scrollTop = rosterScroll.current;
      }
      button?.focus({ preventScroll: workspace });
      restoreMember.current = null;
    }
  }, [selected, workspace]);
  function back() {
    restoreMember.current = selected?.id ?? null;
    setSelected(null);
  }
  useEffect(() => {
    if (!workspace || !interactive) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest('[role="dialog"],dialog')) return;
      const credits = document.querySelector<HTMLElement>('.cesium-credit-lightbox-overlay');
      if (credits && getComputedStyle(credits).display !== 'none') return;
      event.preventDefault(); event.stopPropagation();
      if (selected) back(); else onClose();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [workspace, interactive, selected, onClose]);
  const baseWorkspace = workspace && !selected;
  const Roster = workspace ? CurrentCrewRoster : CrewSummary;
  return (
    <aside
      id="crew-panel"
      className={`crew-panel${baseWorkspace ? ' crew-workspace' : ''}`}
      ref={panel}
      aria-labelledby="crew-title"
      onKeyDown={(event) => {
        if (event.target instanceof Element && event.target.closest('[role="dialog"],dialog')) return;
        if (interactive && event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
          if (selected) back();
          else onClose();
        }
      }}
    >
      <header className="crew-panel-header">
        <div>
          {!baseWorkspace && <span className="eyebrow">ISS / OPERATIONAL CONTEXT</span>}
          <h2 id="crew-title" tabIndex={-1} ref={heading}>
            {baseWorkspace ? 'Crew' : resource.data?.station.name ?? 'International Space Station'}
          </h2>
          {baseWorkspace && <p className="crew-mission-context">{resource.data?.expedition?.name ?? 'Expedition unavailable'} · crew identities and presence evidence</p>}
        </div>
        {baseWorkspace ? <div className="crew-header-actions">
          <ContextButton disabled={resource.loading} onClick={resource.refresh}>{resource.loading && resource.data ? 'Refreshing…' : 'Refresh'}</ContextButton>
          <ContextButton aria-label="Close crew panel" onClick={onClose}>×</ContextButton>
        </div> :
        <button type="button" aria-label="Close crew panel" onClick={onClose}>
          ×
        </button>}
      </header>
      {!baseWorkspace && <div className="crew-toolbar">
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
      </div>}
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
              <Roster
                crew={resource.data}
                onMember={(id) => {
                  const member = resource.data?.members.find((member) => member.id === id);
                  if (member) {
                    rosterScroll.current = panel.current?.querySelector('.crew-panel-content')?.scrollTop ?? 0;
                    setSelected(member);
                  }
                }}
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
});
