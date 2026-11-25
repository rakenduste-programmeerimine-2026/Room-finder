-- SAMPLE DATA. NOT REAL ASIO OR TALLINN UNIVERSITY DATA.
--
-- Fictional rooms for development, tests and the hosted project until the real
-- room catalogue is filled (docs/data-model.md, Q9). Every code starts with
-- "DEMO-" so it cannot be mistaken for a real room.
--
-- Users, groups and searches are not seeded: users come from anonymous sign-in.
-- Idempotent: running it again updates the sample rooms instead of failing.

insert into public.rooms (code, capacity, bookable_for_teaching, aliases, complexity, event_types)
values
  ('DEMO-101',  30, true,  '{"Demo auditoorium 101"}',               'google_form',           '{loeng,seminar}'),
  ('DEMO-102',  24, true,  '{"Demo arvutiklass"}',                    'google_form',           '{seminar,töötuba}'),
  ('DEMO-103',   8, false, '{"Demo nõupidamisruum","Demo väike ruum"}', 'google_form',          '{koosolek}'),
  ('DEMO-201', 120, true,  '{"Demo suur saal"}',                      'university_permission', '{loeng,kaitsmine}'),
  ('DEMO-202',  40, true,  '{"Demo seminariruum 202"}',               'institute_permission',  '{seminar,kaitsmine}'),
  ('DEMO-203',  16, false, '{"Demo projektiruum"}',                   'institute_permission',  '{koosolek,töötuba}'),
  ('DEMO-301', 200, false, '{"Demo aula","Demo konverentsisaal"}',    'university_permission', '{loeng,koosolek}'),
  ('DEMO-302',  12, false, '{"Demo stuudio"}',                        'contact_owner',         '{töötuba}'),
  ('DEMO-303',  60, false, '{"Demo raamatukogu saal"}',               'contact_owner',         '{seminar,koosolek}'),
  ('DEMO-401',  20, false, '{"Demo kohvik"}',                         'other',                 '{koosolek}')
on conflict (code) do update set
  capacity              = excluded.capacity,
  bookable_for_teaching = excluded.bookable_for_teaching,
  aliases               = excluded.aliases,
  complexity            = excluded.complexity,
  event_types           = excluded.event_types;
