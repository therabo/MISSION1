interface Props { oemReason: string | null }

export function TrajectoryLegend({ oemReason }: Props) {
  return <div className="trajectory-legend" role="group" aria-label="Orbital trajectories">
    <span title="Computed from GP/TLE orbital elements"><i className="trajectory-swatch gp" aria-hidden="true" />GP/TLE</span>
    <span title={oemReason ? `NASA OEM unavailable: ${oemReason}` : 'NASA source-provided predicted ephemeris'}>
      <i className="trajectory-swatch oem" aria-hidden="true" />NASA OEM
    </span>
  </div>;
}
