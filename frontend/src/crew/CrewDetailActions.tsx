import { CloseButton } from '../components/CloseButton';
import { ContextButton } from '../components/ContextButton';
import { ControlIcon } from '../components/ControlIcon';

/** One navigation row for both temporal presentations. CSS exposes Back only
 * when the Crew container replaces its roster with the selected profile. */
export function CrewDetailActions({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  return <div className="crew-detail-actions">
    <ContextButton className="secondary-face crew-detail-back" aria-label="Back to Crew" onClick={onBack}>
      <span className="secondary-icon" aria-hidden="true"><ControlIcon name="previous" /></span>
    </ContextButton>
    <CloseButton aria-label="Close astronaut detail" onClick={onClose} />
  </div>;
}
