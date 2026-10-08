import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReplayResult } from './replayApi';
import { CurrentCrewRoster } from '../crew/CurrentCrewRoster';
import { CrewProfile } from '../crew/CrewMemberDetail';
import { CloseButton } from '../components/CloseButton';
import { CrewTemporalNotice, type CrewTemporalRequest } from '../crew/CrewTemporalNotice';
import { utc } from '../crew/presentation';

/** S9 receives ONLY the accepted replay envelope. Latest-retained profile
 * metadata retains its existing legacy detail presentation and explicit meaning. */
export function ReplayCrewPanel({ data, loading, error, at, onClose, interactive = true, request }: {
  data: ReplayResult | null; loading: boolean; error: string | null; at: string;
  onClose: () => void; interactive?: boolean; request?: CrewTemporalRequest;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const restoreMember = useRef<string | null>(null);
  const accepted = data && Date.parse(data.requestedAt) === Date.parse(at) ? data : null;
  const crew = accepted?.crew.availability !== 'UNAVAILABLE' ? accepted?.crew.state : null;
  const member = crew?.members.find(m => m.id === selected);
  const person = member && accepted?.crew.profiles.find(p => p.id === member.id);
  const back = useCallback(() => { restoreMember.current = selected; setSelected(null); }, [selected]);
  useLayoutEffect(() => {
    if (interactive && !document.activeElement?.closest('.context-temporal')) heading.current?.focus({ preventScroll: true });
  }, [interactive]);
  useLayoutEffect(() => {
    if (selected && (!member || !interactive)) {
      restoreMember.current = selected; setSelected(null);
    }
  }, [selected, member, interactive]);
  useLayoutEffect(() => {
    if (!selected && restoreMember.current) {
      const row = [...panel.current?.querySelectorAll<HTMLButtonElement>('[data-member-id]') ?? []]
        .find(b => b.dataset.memberId === restoreMember.current);
      if (interactive) (row ?? heading.current)?.focus({ preventScroll: true });
      restoreMember.current = null;
    }
    if (interactive && document.activeElement === document.body) heading.current?.focus({ preventScroll: true });
  }, [selected, accepted, interactive]);
  useLayoutEffect(() => {
    if (selected && interactive) detailHeading.current?.focus({ preventScroll: true });
  }, [selected, interactive]);
  useEffect(() => {
    if (!interactive) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.target instanceof Element && event.target.closest('[role="dialog"],dialog')) return;
      const credits = document.querySelector<HTMLElement>('.cesium-credit-lightbox-overlay');
      if (credits && getComputedStyle(credits).display !== 'none') return;
      event.preventDefault(); event.stopPropagation();
      if (selected) back(); else onClose();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [interactive, selected, back, onClose]);
  return <aside id="crew-panel" className="crew-panel crew-workspace crew-historical" ref={panel}
    aria-labelledby="replay-crew-title" data-accepted-at={at}
    onKeyDown={event => {
      if (!interactive || event.key !== 'Escape' || event.defaultPrevented || event.target instanceof Element && event.target.closest('[role="dialog"],dialog')) return;
      event.preventDefault(); event.stopPropagation();
      if (selected) back(); else onClose();
    }}>
    <header className="crew-panel-header">
      <div><h2 id="replay-crew-title" ref={heading} tabIndex={-1}>Crew<span className="sr-only"> · ISS Crew history</span></h2>
        <p className="crew-mission-context" aria-label="Historical expedition at accepted UTC">{crew?.expedition?.name ?? 'Expedition unavailable'}</p>
      </div>
      <div className="crew-header-actions"><CloseButton aria-label="Close crew panel" onClick={onClose} /></div>
    </header>
    <div className="crew-panel-content">
      <p className="sr-only">Effective at {at}. Historical roster and assignments; profile metadata is latest-retained.</p>
      <CrewTemporalNotice request={request} />
      {loading && !accepted && <p className="crew-loading" role="status">Loading historical crew…</p>}
      {error && <div className="crew-error" role="alert"><p>{error}</p></div>}
      {!loading && !crew && <div className="crew-historical-unavailable" role="status">
        <p>Crew history unavailable at {utc(at)}. No current roster is substituted.</p>
        {accepted?.crew.coverage.limitations.map((limitation, i) => <p key={i}>{limitation}</p>)}
      </div>}
      {selected && member ? <div className="crew-historical-detail">
        <button type="button" onClick={back}>← Back to crew</button>
        <h3 tabIndex={-1} ref={detailHeading}>{member.name ?? 'Name unavailable'}</h3>
        {person ? <CrewProfile person={person} replayAt={at} /> : <p role="status">Historical profile unavailable for this identity. No Current profile is substituted.</p>}
      </div> : crew && <CurrentCrewRoster crew={crew} historical={{ at, availability: accepted!.crew.availability, coverage: accepted!.crew.coverage }}
        onMember={id => { if (crew.members.some(m => m.id === id)) setSelected(id); }} />}
    </div>
  </aside>;
}
