import { Cartesian3 } from 'cesium';
import { smootherstep } from './inspectionTransition';

/** Temporary display translation on an unavailable-source return. Physical
 * source selection changes immediately. Model and camera share this C2 offset
 * for 0.8s so the rendered station does not teleport outside the close view.
 * Never applied to samples, readouts, velocity, trajectories or stable Inspection.
 */
export class DisplayRetarget {
  private readonly delta: Cartesian3;
  readonly durationSeconds = 0.8;
  constructor(previousDisplay: Cartesian3, selectedDisplay: Cartesian3, readonly startMs: number) {
    this.delta = Cartesian3.subtract(previousDisplay, selectedDisplay, new Cartesian3());
  }
  evaluate(wallMs: number, result: Cartesian3): Cartesian3 {
    const p = (wallMs - this.startMs) / (this.durationSeconds * 1000);
    return Cartesian3.multiplyByScalar(this.delta, 1 - smootherstep(p), result);
  }
}
