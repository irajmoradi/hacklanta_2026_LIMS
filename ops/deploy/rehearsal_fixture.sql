-- Synthetic rows only; applied exclusively to a newly created rehearsal database.
INSERT INTO users(id,auth_issuer,auth_subject,display_name)
VALUES ('13370000-0000-4000-8000-000000000001','demo','cutover-fixture','Cutover Fixture');
INSERT INTO villages(id,name,seed,invite_code)
VALUES ('13370000-0000-4000-8000-000000000000','Cutover Scratch',1337,'CUTOVER-SCRATCH');
INSERT INTO village_members(village_id,user_id,role,house_slot)
VALUES ('13370000-0000-4000-8000-000000000000','13370000-0000-4000-8000-000000000001','owner',0);
INSERT INTO check_ins(village_id,user_id,kind,body,idempotency_key)
VALUES ('13370000-0000-4000-8000-000000000000','13370000-0000-4000-8000-000000000001','status','Synthetic restore proof','cutover-rehearsal');
INSERT INTO activity_events(village_id,user_id,type,payload)
VALUES ('13370000-0000-4000-8000-000000000000','13370000-0000-4000-8000-000000000001','checkin','{}');
INSERT INTO xp_ledger(village_id,user_id,delta,reason,source_key)
VALUES ('13370000-0000-4000-8000-000000000000','13370000-0000-4000-8000-000000000001',10,'checkin','cutover-rehearsal');
