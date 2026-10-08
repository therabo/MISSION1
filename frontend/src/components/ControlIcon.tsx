/** Local action glyphs, matching the existing calendar's 1.5px rounded stroke. */
export function ControlIcon({ name }: { name: 'earth' | 'inspection' | 'current' | 'historical' | 'crew' | 'previous' | 'next' }) {
  return <svg className="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'earth' && <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18M5 6.5h14M5 17.5h14" /></>}
    {name === 'inspection' && <><path d="M9 9h6v6H9zM3 6h4v12H3zM17 6h4v12h-4zM7 12h2m6 0h2M12 5v4m0 6v4M3 10h4m10 0h4M3 14h4m10 0h4" /></>}
    {name === 'current' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
    {name === 'historical' && <><path d="M3 10a9 9 0 1 1 2 8M3 5v5h5M12 7v5l3 2" /></>}
    {name === 'crew' && <><circle cx="10" cy="8" r="3" /><path d="M3 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M17 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 2 4v2" /></>}
    {name === 'previous' && <path d="m14 6-6 6 6 6M8 12h12" />}
    {name === 'next' && <path d="m10 6 6 6-6 6M4 12h12" />}
  </svg>;
}
