-- Permite que una campaña quede marcada como 'failed' (p. ej. cuando la base
-- del día de envío devuelve 0 contactos en campañas con base actualizada).
ALTER TABLE sayasend.campaigns DROP CONSTRAINT IF EXISTS ck_campaign_status;
ALTER TABLE sayasend.campaigns ADD CONSTRAINT ck_campaign_status
    CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed'));

-- Opción "usar base actualizada del día de envío": cuando es true, el scheduler
-- re-consulta BigQuery el día del envío en vez de usar la foto de la creación.
ALTER TABLE sayasend.campaigns ADD COLUMN IF NOT EXISTS refresh_on_send BOOLEAN NOT NULL DEFAULT false;

-- Tipo de gestión usado al consultar BigQuery (gestion_m0 | gestion_cobranza),
-- necesario para que el scheduler reconstruya la misma consulta el día del envío.
ALTER TABLE sayasend.campaigns ADD COLUMN IF NOT EXISTS gestion_type VARCHAR(20);
