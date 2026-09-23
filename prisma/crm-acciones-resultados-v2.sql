-- Los resultados que registra el asesor en el CRM pasan a usar las mismas seis
-- claves que define la v2 del bot (§6 de bot/CAMBIOS_CRM_v1_a_v2.md), en vez de
-- las de la v1. Así el vocabulario es uno solo aunque el registro del CRM y el
-- cierre del tema en el bot sigan siendo dos cosas distintas.
-- La tabla está vacía, así que no hay filas que migrar.
ALTER TABLE sayasend.crm_acciones DROP CONSTRAINT ck_crm_acciones_resultado;

ALTER TABLE sayasend.crm_acciones
  ADD CONSTRAINT ck_crm_acciones_resultado
  CHECK (resultado IN ('RESUELTA','NO_RESUELTA','SEGUIMIENTO','NO_CONTESTO','RETIRO','NUMERO_ERRADO'));
