ALTER TABLE sayasend.campaigns ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP(6);

-- Marcar campañas ya completadas para que no se envíe correo retroactivo
UPDATE sayasend.campaigns
SET notification_sent_at = NOW()
WHERE status = 'completed'
  AND notification_sent_at IS NULL;
