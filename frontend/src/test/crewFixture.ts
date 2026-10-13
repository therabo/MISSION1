// TEST ONLY: recorded persisted REST observations, 2026-10-03. Never a runtime fallback.
import crew from '../../../docs/crew/rest-api-validation/crew-response.json';
import person from '../../../docs/crew/rest-api-validation/person-response.json';
import { decodeCrew, decodeHistoricalCrew, decodePerson } from '../crew/decode';
export const crewFixture = () => decodeCrew(structuredClone(crew));
export const personFixture = () => decodePerson(structuredClone(person));

export const historicalCrewFixture = () => decodeHistoricalCrew(structuredClone(crew));
