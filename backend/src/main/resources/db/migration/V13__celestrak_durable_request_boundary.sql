-- No source data is seeded. Reserve before HTTP so failed/crashed startups cannot bypass pacing.
CREATE TABLE celestrak_request_state (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    next_eligible_at timestamptz NOT NULL DEFAULT 'epoch',
    suspended boolean NOT NULL DEFAULT false
);
INSERT INTO celestrak_request_state(singleton) VALUES(true);
