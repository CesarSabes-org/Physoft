-- AlterTable: add storage for the measured/observed assessment results
-- (Explosive Performance, Fatigue, Stability & Balance, Gait, Mobility range,
-- Muscle Asymmetry, Fall Risk, Body Composition) plus the patient snapshot
-- taken at evaluation time. Nullable JSONB column, so existing analyses
-- remain valid with no data migration needed.
-- IF NOT EXISTS keeps it safe if the column was already added by hand.
ALTER TABLE "analyses" ADD COLUMN IF NOT EXISTS "clinicalResults" JSONB;
