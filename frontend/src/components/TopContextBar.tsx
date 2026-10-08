import type { ReactNode } from 'react';
import crewChevron from '../assets/interface/crew-chevron.svg';
import { ContextButton } from './ContextButton';
import { ControlIcon } from './ControlIcon';
import type { ViewMode } from '../cesium/inspectionMode';

interface Props {
  source: ReactNode;
  sceneTimeMs: number | null;
  inspectionDisabled: boolean;
  onInspect: () => void;
  onHistorical: () => void;
  onCrew: () => void;
  historical?: boolean;
  presentedHistorical?: boolean;
  onCurrent?: () => void;
  viewMode?: ViewMode;
  onEarth?: () => void;
  crewOpen?: boolean;
  crewPending?: boolean;
}

export function TopContextBar({ source, sceneTimeMs, inspectionDisabled, onInspect, onHistorical, onCrew, historical = false, presentedHistorical = historical, onCurrent, viewMode = 'EARTH_OVERVIEW', onEarth, crewOpen = false, crewPending = false }: Props) {
  const date = sceneTimeMs === null ? null : new Date(sceneTimeMs).toISOString();
  const stationFocused = viewMode !== 'EARTH_OVERVIEW';
  const inspectionActive = viewMode === 'ENTERING_INSPECTION' || viewMode === 'ISS_INSPECTION';
  const guard = stationFocused ? 'Return to Earth View to change temporal context.' : undefined;
  return <header className="top-context-bar" aria-label="Mission context">
    <div className="context-identity" aria-hidden="true" />
    <nav className="context-spatial" aria-label="Spatial view">
      <ContextButton aria-label="Earth" icon={<ControlIcon name="earth" />} selected={!inspectionActive && !crewOpen} disabled={viewMode === 'EXITING_INSPECTION'} onClick={onEarth}
        title={viewMode === 'EXITING_INSPECTION' ? 'Returning to Earth View' : undefined}>Earth</ContextButton>
      <ContextButton aria-label="ISS Inspection" icon={<ControlIcon name="inspection" />} selected={inspectionActive} disabled={inspectionDisabled || stationFocused} onClick={onInspect}>ISS Inspection</ContextButton>
    </nav>
    <span className="context-divider context-divider-spatial" aria-hidden="true" />
    {source}
    <div className="context-date" aria-label="Scene UTC">
      <span>{presentedHistorical ? 'HISTORICAL DATE' : 'CURRENT DATE'}</span>
      <time dateTime={date ?? undefined}>{date ? date.replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : 'Unavailable'}</time>
    </div>
    <nav className="context-temporal" aria-label="Temporal context">
      <ContextButton aria-label="Current" icon={<ControlIcon name="current" />} selected={!historical} disabled={stationFocused} title={guard} aria-describedby={guard ? 'inspection-navigation-guard' : undefined} onClick={onCurrent}>Current</ContextButton>
      <ContextButton aria-label="Historical" icon={<ControlIcon name="historical" />} selected={historical} disabled={stationFocused} title={guard} aria-describedby={guard ? 'inspection-navigation-guard' : undefined} onClick={onHistorical}>Historical</ContextButton>
    </nav>
    <span className="context-divider context-divider-crew" aria-hidden="true" />
    <ContextButton id="crew-launcher" className="context-crew" aria-label="Crew" icon={<ControlIcon name="crew" />} selected={crewOpen} aria-busy={crewPending || undefined}
      title={crewPending ? 'Returning to Earth before opening Crew. Activate again to cancel.' : stationFocused ? 'Return to Earth View and open Crew' : undefined}
      aria-controls="crew-panel" aria-expanded={crewOpen} onClick={onCrew}>
      Crew<img className="crew-entry-chevron" src={crewChevron} alt="" />
    </ContextButton>
    {guard && <span id="inspection-navigation-guard" className="sr-only">{guard}</span>}
  </header>;
}
