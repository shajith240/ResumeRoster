-- Update reviewer payout default from ₹99 (9900 paise) to ₹259 (25900 paise).
-- Reflects new ₹399 candidate price at 65/35 split: reviewer keeps 65% = ₹259.35 → ₹259.
-- Existing pending rows are not backfilled — they were earned at the old price.

alter table public.reviewer_payouts
  alter column amount_paise set default 25900;

notify pgrst, 'reload schema';
