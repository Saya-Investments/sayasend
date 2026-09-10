-- Fechas manuales de campaña: permiten sobrescribir la fecha de vencimiento y
-- la fecha de asamblea que normalmente se derivan de `ciclos_pago` en BigQuery.
-- Se guardan en la campaña (no solo en los clientes) para que el scheduler
-- pueda volver a aplicarlas cuando refresh_on_send re-consulta BigQuery el día
-- del envío.
ALTER TABLE sayasend.campaigns ADD COLUMN IF NOT EXISTS fecha_vencimiento_manual DATE;
ALTER TABLE sayasend.campaigns ADD COLUMN IF NOT EXISTS fecha_asamblea_manual DATE;
