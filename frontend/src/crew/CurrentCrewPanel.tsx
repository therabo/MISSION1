import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { CrewResource } from '../api/useCrewResource';
import type { CrewPerson, CurrentCrew } from './types';
import { CloseButton } from '../components/CloseButton';
import { CurrentCrewRoster } from './CurrentCrewRoster';
import { CrewAstronautDock } from './CrewAstronautDock';
import { CurrentCrewProfileRequest } from './CurrentCrewProfileRequest';
import { ContextButton } from '../components/ContextButton';

/** A Crew session may retain its real Current resource during a temporal handoff.
 * Historical never reads this resource. Selection belongs to this Current view. */
export const CurrentCrewPanelView = memo(function CurrentCrewPanelView({ resource, onClose, interactive, notice }: {
  resource: CrewResource<CurrentCrew>; onClose: () => void; interactive: boolean; notice?: ReactNode;
}) {
  const [selectedCrewMemberId, setSelectedCrewMemberId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ id: string; resource: CrewResource<CrewPerson> } | null>(null);
  const profileChanged = useCallback((id: string, resource: CrewResource<CrewPerson>) => setProfile({ id, resource }), []);
  const heading = useRef<HTMLHeadingElement>(null);
  const roster = useRef<HTMLElement>(null);
  const restoreMember = useRef<string | null>(null);
  const selectedMember = resource.data?.members.find(member => member.id === selectedCrewMemberId) ?? null;
  const selectedProfile = profile?.id === selectedMember?.id ? profile?.resource : null;
  const profileError = selectedProfile?.error ?? (selectedProfile?.data && selectedProfile.data.id !== selectedMember?.id
    ? 'This astronaut profile is unavailable.' : null);
  const person = selectedProfile && !selectedProfile.loading && !profileError && selectedProfile.data?.id === selectedMember?.id
    ? selectedProfile.data : null;
  const restoreRow = useCallback((id: string | null) => {
    const row = [...roster.current?.querySelectorAll<HTMLButtonElement>('[data-member-id]') ?? []]
      .find(button => button.dataset.memberId === id);
    (row ?? heading.current)?.focus({ preventScroll: true });
  }, []);
  const closeDetail = useCallback(() => {
    restoreMember.current = selectedCrewMemberId;
    setSelectedCrewMemberId(null);
    setProfile(null);
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
  return <div className={`crew-current-layout crew-detail-layout${selectedMember && person ? ' has-astronaut' : ''}`} data-selected-member-id={selectedMember?.id}
    onKeyDown={event => {
      if (!interactive || event.key !== 'Escape' || event.defaultPrevented || event.target instanceof Element && event.target.closest('[role="dialog"],dialog')) return;
      event.preventDefault(); event.stopPropagation();
      if (selectedCrewMemberId) closeDetail(); else onClose();
    }}>
    <aside id="crew-panel" className="crew-panel crew-workspace" ref={roster} aria-labelledby="crew-title">
      <header className="crew-panel-header">
        <div><h2 id="crew-title" tabIndex={-1} ref={heading}>Crew</h2>
          <p className="crew-mission-context">{resource.data?.expedition?.name ?? 'Expedition unavailable'} · Current membership and operational evidence</p>
        </div>
        <div className="crew-header-actions">
          <CloseButton aria-label="Close crew panel" onClick={onClose} />
        </div>
      </header>
      {selectedMember && !person && <div className="crew-profile-request">
        {profileError ? <div className="crew-error" role="alert" data-profile-error={selectedMember.id}>
          <p>{profileError}</p><p>Member summary remains available in the roster.</p>
          <ContextButton onClick={selectedProfile?.refresh}>Retry profile</ContextButton>
        </div> : <p role="status" data-profile-loading={selectedMember.id}>Loading astronaut profile… {selectedMember.name}</p>}
        <ContextButton aria-label="Close astronaut detail" onClick={closeDetail}>Cancel profile</ContextButton>
      </div>}
      <div className="crew-panel-content">
        {notice}
        {resource.loading && !resource.data && <div className="crew-loading" role="status"><p>Loading crew information…</p><span /><span /><span /></div>}
        {resource.error && <div className="crew-error" role="alert"><p>{resource.error}</p>
          {resource.data && <p>Showing the previous response. Refresh failed; the displayed assessment has not been updated.</p>}
          <button type="button" onClick={() => { heading.current?.focus({ preventScroll: true }); resource.refresh(); }}>Retry crew</button>
        </div>}
        {resource.data && <CurrentCrewRoster crew={resource.data} selectedMemberId={selectedCrewMemberId} onMember={id => {
          if (id !== selectedCrewMemberId && resource.data?.members.some(member => member.id === id)) {
            setProfile(null);
            setSelectedCrewMemberId(id);
          }
        }} />}
      </div>
    </aside>
    {selectedMember && <CurrentCrewProfileRequest key={selectedMember.id} id={selectedMember.id} onChange={profileChanged} />}
    <CrewAstronautDock member={selectedMember} crew={resource.data} person={person} onClose={closeDetail} />
  </div>;
});
