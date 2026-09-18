\set ON_ERROR_STOP on
\pset pager off
\pset null '[NULL]'

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '5s';

\echo 'AUDIT_CONTEXT'
SELECT current_database() AS database_name,
       current_user AS database_user,
       current_setting('transaction_read_only') AS transaction_read_only,
       statement_timestamp() AS audited_at;

\echo 'EVENT_COVERAGE'
SELECT * FROM (
  SELECT 'invoice' AS event,
    count(*) AS rows,
    count(*) FILTER (WHERE "createdAt" IS NOT NULL) AS timestamp_complete,
    count(*) FILTER (WHERE "branchId" IS NOT NULL) AS branch_assigned,
    0::bigint AS doctor_assigned,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM visit_invoices vi WHERE vi."invoiceId" = i.id)) AS relationship_linked,
    count(*) FILTER (WHERE "totalCents" < 0 OR "balanceCents" < 0) AS invalid_or_null,
    count(*) - count(DISTINCT "invoiceNumber") AS duplicate_or_overlap
  FROM invoices i
  UNION ALL
  SELECT 'payment', count(*), count(*) FILTER (WHERE "paidAt" IS NOT NULL), 0, 0,
    count(*) FILTER (WHERE "invoiceId" IS NOT NULL),
    count(*) FILTER (WHERE "amountCents" <= 0), count(*) - count(DISTINCT id)
  FROM payments
  UNION ALL
  SELECT 'visit', count(*), count(*) FILTER (WHERE "visitDate" IS NOT NULL),
    count(*) FILTER (WHERE "branchId" IS NOT NULL), count(*) FILTER (WHERE "doctorId" IS NOT NULL),
    count(*) FILTER (WHERE "patientId" IS NOT NULL),
    count(*) FILTER (WHERE status IN ('COMPLETED','READY_TO_PAY') AND "completedAt" IS NULL AND "lockedAt" IS NULL),
    count(*) - count(DISTINCT "visitNumber")
  FROM visits
  UNION ALL
  SELECT 'arrival_queue', count(*), count(*) FILTER (WHERE "arrivedAt" IS NOT NULL), count(*) FILTER (WHERE "branchId" IS NOT NULL),
    count(*) FILTER (WHERE "assignedDoctorId" IS NOT NULL),
    count(*) FILTER (WHERE "patientId" IS NOT NULL OR "appointmentId" IS NOT NULL),
    count(*) FILTER (WHERE "patientId" IS NULL AND "appointmentId" IS NULL), count(*) - count(DISTINCT id)
  FROM reception_queue_items
  UNION ALL
  SELECT 'encounter_queue_proxy', count(*) FILTER (WHERE "startedAt" IS NOT NULL),
    count(*) FILTER (WHERE "startedAt" IS NOT NULL),
    count(*) FILTER (WHERE "startedAt" IS NOT NULL AND "branchId" IS NOT NULL),
    count(*) FILTER (WHERE "startedAt" IS NOT NULL AND "assignedDoctorId" IS NOT NULL),
    count(*) FILTER (WHERE "startedAt" IS NOT NULL AND "visitId" IS NOT NULL),
    count(*) FILTER (WHERE "startedAt" IS NOT NULL AND "finishedAt" IS NULL), 0
  FROM reception_queue_items
  UNION ALL
  SELECT 'appointment', count(*), count(*) FILTER (WHERE "startTime" IS NOT NULL), count(*) FILTER (WHERE "branchId" IS NOT NULL),
    count(*) FILTER (WHERE "providerId" IS NOT NULL), count(*) FILTER (WHERE "patientId" IS NOT NULL),
    count(*) FILTER (WHERE "endTime" <= "startTime" OR "durationMins" <= 0),
    count(*) - count(DISTINCT "appointmentNumber")
  FROM appointments
  UNION ALL
  SELECT 'treatment_presentation', count(*) FILTER (WHERE "presentedAt" IS NOT NULL), count(*) FILTER (WHERE "presentedAt" IS NOT NULL),
    0, count(*) FILTER (WHERE "presentedAt" IS NOT NULL AND "createdById" IS NOT NULL),
    count(*) FILTER (WHERE "presentedAt" IS NOT NULL AND "patientId" IS NOT NULL), 0, 0
  FROM treatment_plans
  UNION ALL
  SELECT 'treatment_acceptance', count(*) FILTER (WHERE "acceptedAt" IS NOT NULL), count(*) FILTER (WHERE "acceptedAt" IS NOT NULL),
    0, count(*) FILTER (WHERE "acceptedAt" IS NOT NULL AND "createdById" IS NOT NULL),
    count(*) FILTER (WHERE "acceptedAt" IS NOT NULL AND "patientId" IS NOT NULL), 0, 0
  FROM treatment_plans
  UNION ALL
  SELECT 'treatment_item_completion', count(*) FILTER (WHERE tpi."completedAt" IS NOT NULL), count(*) FILTER (WHERE tpi."completedAt" IS NOT NULL),
    count(*) FILTER (WHERE tpi."completedAt" IS NOT NULL AND v."branchId" IS NOT NULL),
    count(*) FILTER (WHERE tpi."completedAt" IS NOT NULL AND v."doctorId" IS NOT NULL),
    count(*) FILTER (WHERE tpi."completedAt" IS NOT NULL AND tpi."completedVisitId" IS NOT NULL),
    count(*) FILTER (WHERE tpi."completedAt" IS NOT NULL AND tpi."completedVisitId" IS NULL), 0
  FROM treatment_plan_items tpi LEFT JOIN visits v ON v.id = tpi."completedVisitId"
  UNION ALL
  SELECT 'doctor_status', count(*), count(*) FILTER (WHERE "createdAt" IS NOT NULL), count(*) FILTER (WHERE "branchId" IS NOT NULL),
    count(*) FILTER (WHERE "doctorId" IS NOT NULL), count(*) FILTER (WHERE "queueItemId" IS NOT NULL),
    count(*) FILTER (WHERE "branchId" IS NULL), 0
  FROM doctor_status_events
  UNION ALL
  SELECT 'payroll_obligation', count(*), count(*), 0, count(*) FILTER (WHERE "userId" IS NOT NULL),
    count(*) FILTER (WHERE "userId" IS NOT NULL),
    count(*) FILTER (WHERE "netCents" <> "baseCents" + "allowancesCents" - "deductionsCents"),
    count(*) - count(DISTINCT ("userId", "periodYear", "periodMonth"))
  FROM salary_records
  UNION ALL
  SELECT 'stock_movement', count(*), count(*) FILTER (WHERE sa."createdAt" IS NOT NULL), count(*) FILTER (WHERE s."branchId" IS NOT NULL),
    count(*) FILTER (WHERE sa."userId" IS NOT NULL), count(*) FILTER (WHERE sa."stockId" IS NOT NULL),
    count(*) FILTER (WHERE sa.delta = 0), count(*) - count(DISTINCT sa.id)
  FROM stock_adjustments sa LEFT JOIN inventory_stock s ON s.id = sa."stockId"
) coverage ORDER BY event;

\echo 'FINANCIAL_RECONCILIATION'
SELECT
  (SELECT count(*) FROM payments) AS payment_rows,
  (SELECT coalesce(sum("amountCents"),0) FROM payments) AS payment_cents,
  (SELECT count(*) FROM financial_transactions WHERE "refType" = 'payment') AS payment_ledger_rows,
  (SELECT coalesce(sum("amountCents"),0) FROM financial_transactions WHERE "refType" = 'payment' AND direction = 'IN') AS payment_ledger_in_cents,
  (SELECT count(*) FROM payments p WHERE NOT EXISTS (SELECT 1 FROM financial_transactions ft WHERE ft."refType"='payment' AND ft."refId"=p.id)) AS payments_without_ledger,
  (SELECT count(*) FROM financial_transactions ft WHERE ft."refType"='payment' AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id=ft."refId")) AS ledger_without_payment,
  (SELECT count(*) FROM payments p JOIN financial_transactions ft ON ft."refType"='payment' AND ft."refId"=p.id WHERE ft."amountCents"<>p."amountCents" OR ft.direction<>'IN') AS payment_ledger_mismatch,
  (SELECT count(*) FROM (SELECT "refId" FROM financial_transactions WHERE "refType"='payment' GROUP BY "refId" HAVING count(*)>1) d) AS duplicate_payment_ledger_refs;

SELECT
  count(*) AS invoice_rows,
  count(*) FILTER (WHERE status NOT IN ('DRAFT','CANCELLED','WRITTEN_OFF')) AS issued_population_proxy,
  count(*) FILTER (WHERE "totalCents" - "amountPaidCents" <> "balanceCents") AS cents_balance_mismatch,
  count(*) FILTER (WHERE round((total * 100)::numeric)::bigint <> "totalCents") AS float_total_mismatch,
  count(*) FILTER (WHERE round(("amountPaid" * 100)::numeric)::bigint <> "amountPaidCents") AS float_paid_mismatch,
  count(*) FILTER (WHERE round((balance * 100)::numeric)::bigint <> "balanceCents") AS float_balance_mismatch,
  count(*) FILTER (WHERE status='PAID' AND "balanceCents"<>0) AS paid_with_balance,
  count(*) FILTER (WHERE status<>'PAID' AND "balanceCents"=0 AND status NOT IN ('CANCELLED','WRITTEN_OFF')) AS zero_balance_not_paid,
  count(*) FILTER (WHERE status='PAID' AND "paidDate" IS NULL) AS paid_without_paid_date
FROM invoices;

SELECT currency::text AS currency, count(*) AS invoices, coalesce(sum("totalCents"),0) AS invoice_cents
FROM invoices GROUP BY currency ORDER BY currency;
SELECT currency::text AS currency, count(*) AS payments, coalesce(sum("amountCents"),0) AS payment_cents
FROM payments GROUP BY currency ORDER BY currency;

SELECT
  count(*) AS salary_rows,
  count(*) FILTER (WHERE "paidAt" IS NOT NULL) AS marked_paid,
  count(*) FILTER (WHERE "paidAt" IS NOT NULL AND "ledgerTxId" IS NULL) AS paid_without_ledger_link,
  count(*) FILTER (WHERE "ledgerTxId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financial_transactions ft WHERE ft.id=sr."ledgerTxId")) AS broken_ledger_link,
  count(*) FILTER (WHERE "ledgerTxId" IS NOT NULL AND EXISTS (SELECT 1 FROM financial_transactions ft WHERE ft.id=sr."ledgerTxId" AND (ft."amountCents"<>sr."netCents" OR ft.direction<>'OUT'))) AS salary_ledger_mismatch
FROM salary_records sr;

SELECT
  count(*) FILTER (WHERE status='RECEIVED') AS received_pos,
  count(*) FILTER (WHERE status='RECEIVED' AND "receivedAt" IS NULL) AS received_without_timestamp,
  count(*) FILTER (WHERE status='RECEIVED' AND "ledgerTxId" IS NULL) AS received_without_ledger_link,
  count(*) FILTER (WHERE "ledgerTxId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financial_transactions ft WHERE ft.id=po."ledgerTxId")) AS broken_ledger_link,
  count(*) FILTER (WHERE "ledgerTxId" IS NOT NULL AND EXISTS (SELECT 1 FROM financial_transactions ft WHERE ft.id=po."ledgerTxId" AND ft."amountCents"<>po."totalCents")) AS po_ledger_amount_mismatch
FROM purchase_orders po;

\echo 'PATIENT_VISIT_RECONCILIATION'
SELECT
  (SELECT count(*) FROM patients) AS patients,
  (SELECT count(*) FROM patients WHERE "deletedAt" IS NULL) AS undeleted_patients,
  (SELECT count(*) FROM patients WHERE "firstVisitDate" IS NOT NULL) AS stored_first_visit,
  (SELECT count(*) FROM patients p WHERE EXISTS (SELECT 1 FROM visits v WHERE v."patientId"=p.id AND v.status IN ('COMPLETED','READY_TO_PAY'))) AS patients_with_completed_visit_proxy,
  (SELECT count(*) FROM patients p WHERE "firstVisitDate" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM visits v WHERE v."patientId"=p.id AND v.status IN ('COMPLETED','READY_TO_PAY'))) AS first_visit_without_completed_visit;

SELECT
  count(*) AS visits,
  count(*) FILTER (WHERE status IN ('COMPLETED','READY_TO_PAY')) AS completion_status_proxy,
  count(*) FILTER (WHERE "completedAt" IS NOT NULL) AS completed_at,
  count(*) FILTER (WHERE "lockedAt" IS NOT NULL) AS locked_at,
  count(*) FILTER (WHERE "completedAt" IS NOT NULL AND "lockedAt" IS NOT NULL) AS both_completion_markers,
  count(*) FILTER (WHERE status IN ('COMPLETED','READY_TO_PAY') AND "completedAt" IS NULL AND "lockedAt" IS NULL) AS status_without_markers,
  count(*) FILTER (WHERE status='IN_PROGRESS' AND ("completedAt" IS NOT NULL OR "lockedAt" IS NOT NULL)) AS markers_but_in_progress
FROM visits;

SELECT
  count(*) AS queue_rows,
  count(*) FILTER (WHERE "visitId" IS NOT NULL) AS linked_visit,
  count(*) FILTER (WHERE "finishedAt" IS NOT NULL) AS finished,
  count(*) FILTER (WHERE status IN ('COMPLETED','PAID') AND "finishedAt" IS NULL) AS terminal_without_finish,
  count(*) FILTER (WHERE status='PAID') AS paid_status,
  count(*) FILTER (WHERE status='PAID' AND ("visitId" IS NULL OR NOT EXISTS (SELECT 1 FROM visits v WHERE v.id=q."visitId"))) AS paid_without_valid_visit,
  count(*) FILTER (WHERE "visitId" IS NOT NULL AND EXISTS (SELECT 1 FROM visits v WHERE v.id=q."visitId" AND v.status='IN_PROGRESS') AND status IN ('COMPLETED','PAID')) AS queue_terminal_visit_in_progress
FROM reception_queue_items q;

\echo 'ATTRIBUTION_COVERAGE'
SELECT * FROM (
  SELECT 'ATTR-D01' AS role, count(*) AS eligible, count(*) FILTER (WHERE "providerId" IS NOT NULL) AS assigned, 0::bigint AS unassigned, count(*) AS inferred_or_mutable, 0::bigint AS conflicts FROM appointments
  UNION ALL SELECT 'ATTR-D02', count(*), count(*) FILTER (WHERE "assignedDoctorId" IS NOT NULL), count(*) FILTER (WHERE "assignedDoctorId" IS NULL), count(*), 0 FROM reception_queue_items
  UNION ALL SELECT 'ATTR-D03', count(*) FILTER (WHERE "startedAt" IS NOT NULL), count(*) FILTER (WHERE "startedAt" IS NOT NULL AND "assignedDoctorId" IS NOT NULL), count(*) FILTER (WHERE "startedAt" IS NOT NULL AND "assignedDoctorId" IS NULL), count(*) FILTER (WHERE "startedAt" IS NOT NULL), 0 FROM reception_queue_items
  UNION ALL SELECT 'ATTR-D04', count(*) FILTER (WHERE status IN ('COMPLETED','READY_TO_PAY')), count(*) FILTER (WHERE status IN ('COMPLETED','READY_TO_PAY') AND "doctorId" IS NOT NULL), 0, count(*) FILTER (WHERE status IN ('COMPLETED','READY_TO_PAY')), 0 FROM visits
  UNION ALL SELECT 'ATTR-D05', count(*) FILTER (WHERE status IN ('COMPLETED','READY_TO_PAY')), count(*) FILTER (WHERE status IN ('COMPLETED','READY_TO_PAY') AND "doctorId" IS NOT NULL), 0, 0, 0 FROM visits
  UNION ALL SELECT 'ATTR-D06', count(*), count(*) FILTER (WHERE "createdById" IS NOT NULL), 0, 0, 0 FROM treatment_plans
  UNION ALL SELECT 'ATTR-D07', count(*) FILTER (WHERE tpi."completedAt" IS NOT NULL), count(*) FILTER (WHERE tpi."completedAt" IS NOT NULL AND v."doctorId" IS NOT NULL), count(*) FILTER (WHERE tpi."completedAt" IS NOT NULL AND v."doctorId" IS NULL), count(*) FILTER (WHERE tpi."completedAt" IS NOT NULL), 0 FROM treatment_plan_items tpi LEFT JOIN visits v ON v.id=tpi."completedVisitId"
  UNION ALL SELECT 'ATTR-D08', count(*), count(*) FILTER (WHERE EXISTS (SELECT 1 FROM visit_invoices vi WHERE vi."invoiceId"=i.id)), count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM visit_invoices vi WHERE vi."invoiceId"=i.id)), 0, count(*) FILTER (WHERE (SELECT count(DISTINCT v."doctorId") FROM visit_invoices vi JOIN visits v ON v.id=vi."visitId" WHERE vi."invoiceId"=i.id)>1) FROM invoices i
  UNION ALL SELECT 'ATTR-D09', count(*), 0, count(*), 0, 0 FROM invoice_items
  UNION ALL SELECT 'ATTR-D10', count(*), 0, count(*), 0, 0 FROM payments
  UNION ALL SELECT 'ATTR-D11', count(*) FILTER (WHERE "nextVisitDate" IS NOT NULL), count(*) FILTER (WHERE "nextVisitDate" IS NOT NULL AND "doctorId" IS NOT NULL), 0, count(*) FILTER (WHERE "nextVisitDate" IS NOT NULL), 0 FROM visits
  UNION ALL SELECT 'ATTR-D12', count(*), count(*) FILTER (WHERE "doctorId" IS NOT NULL), 0, 0, 0 FROM prescriptions
  UNION ALL SELECT 'ATTR-D13', count(*) FILTER (WHERE "referredById" IS NOT NULL OR "referralNote" IS NOT NULL), count(*) FILTER (WHERE "referredById" IS NOT NULL), count(*) FILTER (WHERE "referredById" IS NULL AND "referralNote" IS NOT NULL), count(*) FILTER (WHERE "referredById" IS NOT NULL OR "referralNote" IS NOT NULL), 0 FROM reception_queue_items
  UNION ALL SELECT 'ATTR-B01', count(*), count(*) FILTER (WHERE "branchId" IS NOT NULL), 0, count(*), 0 FROM appointments
  UNION ALL SELECT 'ATTR-B02', count(*), count(*) FILTER (WHERE "branchId" IS NOT NULL), 0, 0, 0 FROM reception_queue_items
  UNION ALL SELECT 'ATTR-B03', count(*) FILTER (WHERE "startedAt" IS NOT NULL), count(*) FILTER (WHERE "startedAt" IS NOT NULL AND "branchId" IS NOT NULL), 0, count(*) FILTER (WHERE "startedAt" IS NOT NULL), 0 FROM reception_queue_items
  UNION ALL SELECT 'ATTR-B04', count(*) FILTER (WHERE status IN ('COMPLETED','READY_TO_PAY')), count(*) FILTER (WHERE status IN ('COMPLETED','READY_TO_PAY') AND "branchId" IS NOT NULL), count(*) FILTER (WHERE status IN ('COMPLETED','READY_TO_PAY') AND "branchId" IS NULL), 0, 0 FROM visits
  UNION ALL SELECT 'ATTR-B05', count(*) FILTER (WHERE status NOT IN ('DRAFT','CANCELLED','WRITTEN_OFF')), count(*) FILTER (WHERE status NOT IN ('DRAFT','CANCELLED','WRITTEN_OFF') AND "branchId" IS NOT NULL), count(*) FILTER (WHERE status NOT IN ('DRAFT','CANCELLED','WRITTEN_OFF') AND "branchId" IS NULL), count(*) FILTER (WHERE status NOT IN ('DRAFT','CANCELLED','WRITTEN_OFF')), 0 FROM invoices
  UNION ALL SELECT 'ATTR-B06', count(*), 0, count(*), count(*) FILTER (WHERE EXISTS (SELECT 1 FROM invoices i WHERE i.id=p."invoiceId" AND i."branchId" IS NOT NULL)), 0 FROM payments p
  UNION ALL SELECT 'ATTR-B07', count(*) FILTER (WHERE direction='OUT'), count(*) FILTER (WHERE direction='OUT' AND "branchId" IS NOT NULL), count(*) FILTER (WHERE direction='OUT' AND "branchId" IS NULL), count(*) FILTER (WHERE direction='OUT'), 0 FROM financial_transactions
  UNION ALL SELECT 'ATTR-B08', count(*), count(*) FILTER (WHERE "branchId" IS NOT NULL), 0, 0, 0 FROM inventory_stock
  UNION ALL SELECT 'ATTR-B09', count(*), count(*) FILTER (WHERE "branchId" IS NOT NULL), 0, count(*), 0 FROM doctor_branch_availability
  UNION ALL SELECT 'ATTR-B10', count(*) FILTER (WHERE "paidAt" IS NOT NULL), count(*) FILTER (WHERE "paidAt" IS NOT NULL AND EXISTS (SELECT 1 FROM financial_transactions ft WHERE ft.id=sr."ledgerTxId" AND ft."branchId" IS NOT NULL)), count(*) FILTER (WHERE "paidAt" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financial_transactions ft WHERE ft.id=sr."ledgerTxId" AND ft."branchId" IS NOT NULL)), count(*) FILTER (WHERE "paidAt" IS NOT NULL), 0 FROM salary_records sr
  UNION ALL SELECT 'ATTR-B11', count(*) FILTER (WHERE status='RECEIVED'), 0, count(*) FILTER (WHERE status='RECEIVED'), count(*) FILTER (WHERE status='RECEIVED' AND "branchId" IS NOT NULL), 0 FROM purchase_orders
  UNION ALL SELECT 'ATTR-B12', count(*) FILTER (WHERE "presentedAt" IS NOT NULL), 0, count(*) FILTER (WHERE "presentedAt" IS NOT NULL), 0, 0 FROM treatment_plans
  UNION ALL SELECT 'ATTR-B13', count(*) FILTER (WHERE "acceptedAt" IS NOT NULL), 0, count(*) FILTER (WHERE "acceptedAt" IS NOT NULL), 0, 0 FROM treatment_plans
) attribution ORDER BY role;

\echo 'CAPACITY_FEASIBILITY'
SELECT
  (SELECT count(*) FROM doctor_branch_availability) AS current_recurring_roster_rows,
  (SELECT count(*) FROM doctor_status_events) AS status_events,
  (SELECT count(*) FROM doctor_status_events WHERE "branchId" IS NULL) AS status_without_branch,
  (SELECT count(*) FROM doctor_status_events WHERE "queueItemId" IS NOT NULL) AS status_linked_queue,
  (SELECT count(*) FROM reception_queue_items WHERE "startedAt" IS NOT NULL) AS queue_started,
  (SELECT count(*) FROM reception_queue_items WHERE "startedAt" IS NOT NULL AND "finishedAt" IS NOT NULL) AS queue_complete_intervals,
  (SELECT count(*) FROM reception_queue_items WHERE "startedAt" IS NOT NULL AND "finishedAt" <= "startedAt") AS invalid_queue_intervals,
  (SELECT count(*) FROM appointments WHERE chair IS NOT NULL AND btrim(chair)<>'') AS appointments_with_chair,
  (SELECT count(*) FROM reception_queue_items WHERE "chairNumber" IS NOT NULL) AS queue_with_chair,
  (SELECT count(*) FROM appointments WHERE "durationMins" = extract(epoch FROM ("endTime"-"startTime"))/60) AS appointment_duration_consistent;

\echo 'TREATMENT_LINKAGE'
SELECT
  count(*) AS plan_items,
  count(*) FILTER (WHERE "feeId" IS NOT NULL) AS with_fee_id,
  count(*) FILTER (WHERE "completedAt" IS NOT NULL) AS completed_items,
  count(*) FILTER (WHERE "completedAt" IS NOT NULL AND "completedVisitId" IS NOT NULL) AS completed_with_visit,
  count(*) FILTER (WHERE "completedAt" IS NOT NULL AND "completedVisitId" IS NULL) AS completed_without_visit,
  count(*) FILTER (WHERE status='IN_PROGRESS') AS start_status_proxy,
  0::bigint AS item_acceptance_events,
  0::bigint AS item_start_events
FROM treatment_plan_items;

SELECT
  count(*) AS plans,
  count(*) FILTER (WHERE "presentedAt" IS NOT NULL) AS with_presented_at,
  count(*) FILTER (WHERE "acceptedAt" IS NOT NULL) AS with_accepted_at,
  count(*) FILTER (WHERE "declinedAt" IS NOT NULL) AS with_declined_at,
  count(*) FILTER (WHERE "acceptedAt" IS NOT NULL AND "presentedAt" IS NULL) AS accepted_without_presented
FROM treatment_plans;

SELECT
  count(*) AS invoice_items,
  count(*) FILTER (WHERE "feeId" IS NOT NULL) AS with_fee_id,
  count(*) FILTER (WHERE "appointmentId" IS NOT NULL) AS with_appointment,
  0::bigint AS directly_linked_plan_items
FROM invoice_items;

SELECT count(*) AS completed_visits_without_completed_plan_item
FROM visits v
WHERE v.status IN ('COMPLETED','READY_TO_PAY')
  AND NOT EXISTS (SELECT 1 FROM treatment_plan_items tpi WHERE tpi."completedVisitId"=v.id);

\echo 'PAYROLL_RECONCILIATION'
SELECT
  (SELECT count(*) FROM staff_contracts) AS contracts,
  (SELECT count(*) FROM staff_contracts WHERE "endDate" IS NOT NULL AND "endDate" < "startDate") AS invalid_contract_ranges,
  (SELECT count(*) FROM staff_contracts a JOIN staff_contracts b ON a."userId"=b."userId" AND a.id<b.id AND a."startDate"<=coalesce(b."endDate",'infinity') AND b."startDate"<=coalesce(a."endDate",'infinity')) AS overlapping_contract_pairs,
  (SELECT count(DISTINCT "userId") FROM staff_contracts) AS staff_with_contract,
  (SELECT count(*) FROM users WHERE "isActive") AS active_user_proxy_population,
  (SELECT count(*) FROM salary_records) AS salary_rows,
  (SELECT count(*) FROM salary_records WHERE "netCents"<>"baseCents"+"allowancesCents"-"deductionsCents") AS component_mismatch,
  (SELECT count(*) FROM salary_records WHERE "paidAt" IS NULL) AS unpaid_rows,
  (SELECT count(*) FROM salary_records WHERE "paidAt" IS NOT NULL AND "ledgerTxId" IS NULL) AS paid_without_ledger_link;

\echo 'INVENTORY_RECONCILIATION'
SELECT
  (SELECT count(*) FROM inventory_items WHERE "isActive") AS active_items,
  (SELECT count(*) FROM branches WHERE "isActive") AS active_branches,
  (SELECT count(*) FROM inventory_items i CROSS JOIN branches b WHERE i."isActive" AND b."isActive") AS diagnostic_active_combinations,
  (SELECT count(*) FROM inventory_stock s JOIN inventory_items i ON i.id=s."itemId" JOIN branches b ON b.id=s."branchId" WHERE i."isActive" AND b."isActive") AS existing_active_stock_rows,
  (SELECT count(*) FROM inventory_items i CROSS JOIN branches b WHERE i."isActive" AND b."isActive" AND NOT EXISTS (SELECT 1 FROM inventory_stock s WHERE s."itemId"=i.id AND s."branchId"=b.id)) AS missing_active_combinations,
  (SELECT count(*) FROM inventory_stock WHERE quantity<0) AS negative_stock,
  (SELECT count(*) FROM inventory_stock WHERE "reorderThreshold"=0) AS zero_threshold,
  (SELECT count(*) FROM inventory_stock WHERE "reorderThreshold"<0) AS negative_threshold,
  (SELECT count(*) FROM stock_adjustments) AS adjustment_rows,
  (SELECT count(*) FROM stock_adjustments WHERE kind='AUTO_DEDUCT') AS auto_deduct_rows,
  (SELECT count(*) FROM stock_adjustments WHERE kind='AUTO_DEDUCT' AND "visitId" IS NULL) AS auto_deduct_without_visit;

SELECT kind, count(*) AS rows, count(*) FILTER (WHERE "visitId" IS NOT NULL) AS with_visit,
       min("createdAt") AS earliest, max("createdAt") AS latest
FROM stock_adjustments GROUP BY kind ORDER BY kind;

SELECT
  count(*) AS po_rows,
  count(*) FILTER (WHERE status='RECEIVED') AS received,
  count(*) FILTER (WHERE status='RECEIVED' AND "receivedAt" IS NOT NULL) AS received_with_timestamp,
  count(*) FILTER (WHERE status='RECEIVED' AND EXISTS (SELECT 1 FROM stock_adjustments sa JOIN inventory_stock s ON s.id=sa."stockId" WHERE s."branchId"=po."branchId" AND sa.kind='RECEIVED' AND sa."createdAt" BETWEEN po."receivedAt"-interval '5 minutes' AND po."receivedAt"+interval '5 minutes')) AS received_with_time_branch_movement_proxy,
  count(*) FILTER (WHERE status='RECEIVED' AND "ledgerTxId" IS NOT NULL) AS received_with_ledger
FROM purchase_orders po;

SELECT
  count(*) AS po_items,
  count(*) FILTER (WHERE "unitCostCents">0) AS positive_historical_unit_cost,
  count(*) FILTER (WHERE "unitCostCents"=0) AS zero_unit_cost,
  min("unitCostCents") AS min_unit_cost,
  max("unitCostCents") AS max_unit_cost
FROM purchase_order_items;

\echo 'HISTORICAL_DATE_RANGES'
SELECT * FROM (
  SELECT 'invoice' AS source, min("createdAt") AS earliest, max("createdAt") AS latest, count(*) AS rows FROM invoices
  UNION ALL SELECT 'payment', min("paidAt"), max("paidAt"), count(*) FROM payments
  UNION ALL SELECT 'visit', min("visitDate"), max("visitDate"), count(*) FROM visits
  UNION ALL SELECT 'queue_arrival', min("arrivedAt"), max("arrivedAt"), count(*) FROM reception_queue_items
  UNION ALL SELECT 'appointment', min("startTime"), max("startTime"), count(*) FROM appointments
  UNION ALL SELECT 'treatment_plan', min("createdAt"), max("createdAt"), count(*) FROM treatment_plans
  UNION ALL SELECT 'doctor_status', min("createdAt"), max("createdAt"), count(*) FROM doctor_status_events
  UNION ALL SELECT 'salary_record', min("createdAt"), max("createdAt"), count(*) FROM salary_records
  UNION ALL SELECT 'stock_adjustment', min("createdAt"), max("createdAt"), count(*) FROM stock_adjustments
  UNION ALL SELECT 'purchase_order', min("createdAt"), max("createdAt"), count(*) FROM purchase_orders
) ranges ORDER BY source;

\echo 'POPULATION_DISTRIBUTIONS'
SELECT status::text AS status, count(*) AS rows,
       coalesce(sum("totalCents"),0) AS total_cents,
       coalesce(sum("amountPaidCents"),0) AS paid_cents,
       coalesce(sum("balanceCents"),0) AS balance_cents
FROM invoices GROUP BY status ORDER BY status;

SELECT direction::text AS direction, coalesce("refType", '[NULL]') AS ref_type,
       count(*) AS rows, count(*) FILTER (WHERE "branchId" IS NULL) AS branch_null,
       coalesce(sum("amountCents"),0) AS amount_cents
FROM financial_transactions GROUP BY direction, "refType" ORDER BY direction, ref_type;

SELECT status, count(*) AS rows FROM visits GROUP BY status ORDER BY status;
SELECT status, count(*) AS rows FROM reception_queue_items GROUP BY status ORDER BY status;
SELECT status::text AS status, count(*) AS rows FROM appointments GROUP BY status ORDER BY status;
SELECT status::text AS status, count(*) AS rows FROM treatment_plans GROUP BY status ORDER BY status;
SELECT status::text AS status, count(*) AS rows FROM treatment_plan_items GROUP BY status ORDER BY status;

ROLLBACK;
