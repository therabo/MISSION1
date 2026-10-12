import { ContextButton } from './ContextButton';
import { ControlIcon } from './ControlIcon';

export interface EarthSceneControls {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function SceneControls({ onZoomIn, onZoomOut, onReset }: Props) {
  return <div className="earth-scene-controls" role="group" aria-label="Earth scene controls">
    <ContextButton className="secondary-face secondary-zoom" aria-label="Zoom out" onClick={onZoomOut}>
      <span className="secondary-desktop-glyph" aria-hidden="true">−</span>
      <span className="secondary-icon"><ControlIcon name="minus" /></span>
    </ContextButton>
    <ContextButton className="secondary-face secondary-zoom" aria-label="Zoom in" onClick={onZoomIn}>
      <span className="secondary-desktop-glyph" aria-hidden="true">+</span>
      <span className="secondary-icon"><ControlIcon name="plus" /></span>
    </ContextButton>
    <ContextButton className="secondary-face secondary-reset" onClick={onReset}>Reset view</ContextButton>
  </div>;
}

export function InspectionResetControl({ onReset, disabled }: { onReset: () => void; disabled: boolean }) {
  return <div className="inspection-reset-control" role="group" aria-label="Inspection scene controls">
    <ContextButton className="secondary-face secondary-reset" disabled={disabled} onClick={onReset}>Reset view</ContextButton>
  </div>;
}
