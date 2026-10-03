-- Per-router "pause time during outages": when a router is unreachable for a
-- while (blackout / ISP down) the time customers lose is added back to their
-- running packages once the router returns.
alter table mikrotiks add column if not exists pause_on_outage boolean not null default false;
-- Set when a probe first fails, cleared when the router answers again.
alter table mikrotiks add column if not exists down_since timestamptz;
