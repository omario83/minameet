-- Stap 1a: nieuwe statussen voor de partner-aanmelding.
-- Los uitvoeren: een nieuwe enumwaarde kan pas na een commit worden gebruikt (zie 0005).

alter type vendor_status add value if not exists 'draft';
alter type vendor_status add value if not exists 'rejected';
