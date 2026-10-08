import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useIssCrew, type CrewResource } from '../api/useCrewResource';
import type { CurrentCrew } from './types';
import { CloseButton } from '../components/CloseButton';
import { CurrentCrewRoster } from './CurrentCrewRoster';
import { CrewAstronautDock } from './CrewAstronautDock';

/** Current presentation owns one UUID, never a second copy of Crew/profile facts.
 * The roster resource and its scroll container survive every selection change. */
export function CurrentCrewPanel({ onClose, interactive }: { onClose: () => void; interactive: boolean }) {
  const resource = useIssCrew();
  return <CurrentCrewPanelView resource={resource} onClose={onClose} interactive={interactive} />;
}

/** A Crew session may retain its real Current resource during a temporal handoff.
 * Historical never reads this resource. Selection belongs to this Current view. */
export function CurrentCrewPanelView({ resource, onClose, interactive, notice }: {
  resource: CrewResource<CurrentCrew>; onClose: () => void; interactive: boolean; notice?: ReactNode;
}) {
  const [selectedCrewMemberId, setSelectedCrewMemberId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const roster = useRef<HTMLElement>(null);
  const restoreMember = useRef<string | null>(null);
  const selectedMember = resource.data?.members.find(member => member.id === selectedCrewMemberId) ?? null;
  const restoreRow = useCallback((id: string | null) => {
    const row = [...roster.current?.querySelectorAll<HTMLButtonElement>('[data-member-id]') ?? []]
      .find(button => button.dataset.memberId === id);
    (row ?? heading.current)?.focus({ preventScroll: true });
  }, []);
  const closeDetail = useCallback(() => {
    restoreMember.current = selectedCrewMemberId;
    setSelectedCrewMemberId(null);
  }, [selectedCrewMemberId]);
  useLayoutEffect(() => {
    if (!selectedCrewMemberId && restoreMember.current) {
      restoreRow(restoreMember.current); restoreMember.current = null;
    }
  }, [selectedCrewMemberId, restoreRow]);
  useLayoutEffect(() => {
    if (interactive && !document.activeElement?.closest('.context-temporal')) heading.current?.focus({ preventScroll: true });
  }, [interactive]);
  useLayoutEffect(() => {
    if (selectedCrewMemberId && (!selectedMember || !interactive)) {
      if (interactive) restoreMember.current = selectedCrewMemberId;
      setSelectedCrewMemberId(null);
    }
  }, [selectedCrewMemberId, selectedMember, interactive, restoreRow]);
  useEffect(() => {
    if (!interactive) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest('[role="dialog"],dialog')) return;
      const credits = document.querySelector<HTMLElement>('.cesium-credit-lightbox-overlay');
      if (credits && getComputedStyle(credits).display !== 'none') return;
      event.preventDefault(); event.stopPropagation();
      if (selectedCrewMemberId) closeDetail(); else onClose();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [interactive, selectedCrewMemberId, closeDetail, onClose]);
  return <div className={`crew-current-layout${selectedMember ? ' has-astronaut' : ''}`} data-selected-member-id={selectedMember?.id}
    onKeyDown={event => {
      if (!interactive || event.key !== 'Escape' || event.defaultPrevented || event.target instanceof Element && event.target.closest('[role="dialog"],dialog')) return;
      event.preventDefault(); event.stopPropagation();
      if (selectedCrewMemberId) closeDetail(); else onClose();
    }}>
    <aside id="crew-panel" className="crew-panel crew-workspace" ref={roster} aria-labelledby="crew-title">
      <header className="crew-panel-header">
        <div><h2 id="crew-title" tabIndex={-1} ref={heading}>Crew</h2>
          <p className="crew-mission-context">{resource.data?.expedition?.name ?? 'Expedition unavailable'} · crew identities and presence evidence</p>
        </div>
        <div className="crew-header-actions">
          <CloseButton aria-label="Close crew panel" onClick={onClose} />
        </div>
      </header>
      <div className="crew-panel-content">
        {notice}
        {resource.loading && !resource.data && <div className="crew-loading" role="status"><p>Loading crew information…</p><span /><span /><span /></div>}
        {resource.error && <div className="crew-error" role="alert"><p>{resource.error}</p>
          {resource.data && <p>Showing the previous response. Refresh failed; the displayed assessment has not been updated.</p>}
          <button type="button" onClick={() => { heading.current?.focus({ preventScroll: true }); resource.refresh(); }}>Retry crew</button>
        </div>}
        {resource.data && <CurrentCrewRoster crew={resource.data} selectedMemberId={selectedCrewMemberId} onMember={id => {
          if (resource.data?.members.some(member => member.id === id)) setSelectedCrewMemberId(id);
        }} />}
      </div>
    </aside>
    <CrewAstronautDock member={selectedMember} crew={resource.data} onClose={closeDetail} onSelect={setSelectedCrewMemberId} />
  </div>;
}
