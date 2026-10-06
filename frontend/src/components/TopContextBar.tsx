import type { ReactNode } from 'react';
import crewChevron from '../assets/interface/crew-chevron.svg';
import { ContextButton } from './ContextButton';

interface Props {
  source: ReactNode;
  sceneTimeMs: number | null;
  inspectionDisabled: boolean;
  onInspect: () => void;
  onHistorical: () => void;
  onCrew: () => void;
}

export function TopContextBar({ source, sceneTimeMs, inspectionDisabled, onInspect, onHistorical, onCrew }: Props) {
  const date = sceneTimeMs === null ? null : new Date(sceneTimeMs).toISOString();
  return <header className="top-context-bar" aria-label="Mission context">
    <div className="context-identity" aria-hidden="true" />
    <nav className="context-spatial" aria-label="Spatial view">
      <ContextButton selected>Earth</ContextButton>
      <ContextButton disabled={inspectionDisabled} onClick={onInspect}>ISS Inspection</ContextButton>
    </nav>
    <span className="context-divider context-divider-spatial" aria-hidden="true" />
    {source}
    <div className="context-date" aria-label="Scene UTC">
      <span>CURRENT DATE</span>
      <time dateTime={date ?? undefined}>{date ? date.replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : 'Unavailable'}</time>
    </div>
    <nav className="context-temporal" aria-label="Temporal context">
      <ContextButton selected>Current</ContextButton>
      <ContextButton onClick={onHistorical}>Historical</ContextButton>
    </nav>
    <span className="context-divider context-divider-crew" aria-hidden="true" />
    <ContextButton id="crew-launcher" className="context-crew" aria-controls="crew-panel" aria-expanded={false} onClick={onCrew}>
      Crew<img className="crew-entry-chevron" src={crewChevron} alt="" />
    </ContextButton>
  </header>;
}
