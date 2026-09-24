-- Stoppage (added) time for operator matches, in whole minutes per half.
-- The clock runs 45 + first, a 10 minute break, then 45 more + second.
alter table custom_matches add column if not exists stoppage_first smallint not null default 0;
alter table custom_matches add column if not exists stoppage_second smallint not null default 0;
