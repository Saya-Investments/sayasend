-- Cta_Act_Pag: entero que viene de CDV_COL.BDfondos_snapshots, unido por
-- Codigo_Asociado. Un DNI puede tener varios códigos asociados con valores
-- distintos, y el envío es por persona, así que se guarda el MAX del DNI.
ALTER TABLE sayasend.clientes ADD COLUMN IF NOT EXISTS cta_act_pag INTEGER;
