INSERT INTO "finance_categories" ("id", "code", "name", "direction") VALUES
  ('fincat-patient-payment', 'PATIENT_PAYMENT', 'Patient payment',      'IN'),
  ('fincat-other-income',    'OTHER_INCOME',    'Other income',         'IN'),
  ('fincat-refund',          'REFUND',          'Patient refund',       'OUT'),
  ('fincat-salary',          'SALARY',          'Staff salary',         'OUT'),
  ('fincat-rent',            'RENT',            'Rent',                 'OUT'),
  ('fincat-lab-fee',         'LAB_FEE',         'Laboratory fees',      'OUT'),
  ('fincat-supplies',        'SUPPLIES',        'Supplies & materials', 'OUT'),
  ('fincat-other-expense',   'OTHER_EXPENSE',   'Other expense',        'OUT')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "financial_transactions"
  ("id", "direction", "amountCents", "currency", "categoryId", "branchId", "date", "recordedByUserId", "refType", "refId", "createdAt")
SELECT
  'ftx-' || p."id", 'IN'::"TxDirection", p."amountCents", p."currency",
  'fincat-patient-payment', i."branchId", p."paidAt", p."processedById", 'payment', p."id", p."paidAt"
FROM "payments" p
JOIN "invoices" i ON i."id" = p."invoiceId"
ON CONFLICT ("id") DO NOTHING;
