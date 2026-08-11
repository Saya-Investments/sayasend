-- Telefono_3: teléfono alterno que viene de CDV_COL.DB_BDfondos_actual, unido
-- por Codigo_Asociado. Es opcional (la mayoría de asociados no lo tiene) y
-- convive con `telefono`, que sigue saliendo de Telefono_2.
ALTER TABLE sayasend.clientes ADD COLUMN IF NOT EXISTS telefono_3 VARCHAR(20);
