-- El grupo que no recibe la bienvenida se llama CONVENCIONAL, no CONTROL.
-- Además la campaña de la corrida queda en las filas de los dos grupos, para
-- poder bajar desde ella el Excel de retadores y el de convencional.
ALTER TABLE sayasend.preadmision_sorteo DROP CONSTRAINT IF EXISTS ck_preadmision_sorteo_grupo;

ALTER TABLE sayasend.preadmision_sorteo ALTER COLUMN grupo TYPE varchar(15);

UPDATE sayasend.preadmision_sorteo SET grupo = 'CONVENCIONAL' WHERE grupo = 'CONTROL';

UPDATE sayasend.preadmision_sorteo s
SET campaign_id = r.campaign_id
FROM (
  SELECT DISTINCT fecha_corrida, semilla, campaign_id
  FROM sayasend.preadmision_sorteo
  WHERE grupo = 'RETADOR' AND campaign_id IS NOT NULL
) r
WHERE s.grupo = 'CONVENCIONAL' AND s.campaign_id IS NULL
  AND s.fecha_corrida = r.fecha_corrida AND s.semilla = r.semilla;

ALTER TABLE sayasend.preadmision_sorteo
  ADD CONSTRAINT ck_preadmision_sorteo_grupo CHECK (grupo IN ('RETADOR', 'CONVENCIONAL'));
