-- Migración del CRM a la v2 del Bot Educador (ver bot/CAMBIOS_CRM_v1_a_v2.md §9).
-- Las tablas crm_* apuntaban a bot_cliente_etapa / bot_derivacion_humana, que
-- son historia de la v1. Ahora apuntan a los uuid de las tablas edu_*.
-- En la v2 la derivación vive dentro de la incidencia: derivacion_id pasa a
-- llamarse incidencia_id.

-- La única fila apunta a una etapa de la v1 y violaría la nueva foránea.
DELETE FROM sayasend.crm_asignacion;

ALTER TABLE sayasend.crm_asignacion DROP CONSTRAINT crm_asignacion_etapa_id_fkey;

ALTER TABLE sayasend.crm_acciones DROP CONSTRAINT crm_acciones_etapa_id_fkey;

ALTER TABLE sayasend.crm_acciones DROP CONSTRAINT crm_acciones_derivacion_id_fkey;

ALTER TABLE sayasend.crm_asignacion_historial DROP CONSTRAINT crm_asignacion_historial_etapa_id_fkey;

ALTER TABLE sayasend.crm_asignacion_historial DROP CONSTRAINT crm_asignacion_historial_derivacion_id_fkey;

ALTER TABLE sayasend.crm_acciones RENAME COLUMN derivacion_id TO incidencia_id;

ALTER TABLE sayasend.crm_asignacion_historial RENAME COLUMN derivacion_id TO incidencia_id;

ALTER TABLE sayasend.crm_asignacion
  ADD CONSTRAINT fk_asig_etapa FOREIGN KEY (etapa_id)
      REFERENCES sayasend.edu_etapa_cliente (etapa_uuid) ON DELETE CASCADE;

ALTER TABLE sayasend.crm_acciones
  ADD CONSTRAINT fk_acc_etapa FOREIGN KEY (etapa_id)
      REFERENCES sayasend.edu_etapa_cliente (etapa_uuid) ON DELETE CASCADE;

ALTER TABLE sayasend.crm_acciones
  ADD CONSTRAINT fk_acc_inc FOREIGN KEY (incidencia_id)
      REFERENCES sayasend.edu_incidencia (incidencia_uuid) ON DELETE SET NULL;

ALTER TABLE sayasend.crm_asignacion_historial
  ADD CONSTRAINT fk_hist_etapa FOREIGN KEY (etapa_id)
      REFERENCES sayasend.edu_etapa_cliente (etapa_uuid) ON DELETE CASCADE;

ALTER TABLE sayasend.crm_asignacion_historial
  ADD CONSTRAINT fk_hist_inc FOREIGN KEY (incidencia_id)
      REFERENCES sayasend.edu_incidencia (incidencia_uuid) ON DELETE SET NULL;
