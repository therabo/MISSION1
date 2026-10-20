import { useLayoutEffect } from 'react';
import { useCrewMember, type CrewResource } from '../api/useCrewResource';
import type { CrewPerson } from './types';

/** Keyed by the selected UUID: changing/clearing selection aborts the existing
 * lazy resource. Report before paint so layout and complete detail reveal agree. */
export function CurrentCrewProfileRequest({ id, onChange }: {
  id: string; onChange: (id: string, resource: CrewResource<CrewPerson>) => void;
}) {
  const resource = useCrewMember(id);
  const { data, loading, error, refresh } = resource;
  useLayoutEffect(() => {
    onChange(id, { data, loading, error, refresh });
  }, [id, data, loading, error, refresh, onChange]);
  return null;
}
