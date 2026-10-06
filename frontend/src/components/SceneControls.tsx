import { ContextButton } from './ContextButton';

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
    <ContextButton aria-label="Zoom out" onClick={onZoomOut}>−</ContextButton>
    <ContextButton aria-label="Zoom in" onClick={onZoomIn}>+</ContextButton>
    <ContextButton onClick={onReset}>Reset view</ContextButton>
  </div>;
}
