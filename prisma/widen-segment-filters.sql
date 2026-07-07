-- Los filtros de segmentación ahora admiten varios valores por filtro. Cuando se
-- selecciona más de uno se guardan como un arreglo JSON (["A","B"]), así que las
-- columnas se amplían a TEXT para no truncar la selección (antes VARCHAR(50/100)).
ALTER TABLE sayasend.campaigns ALTER COLUMN segmento_filter TYPE TEXT;
ALTER TABLE sayasend.campaigns ALTER COLUMN estrategia_filter TYPE TEXT;
ALTER TABLE sayasend.campaigns ALTER COLUMN frente_filter TYPE TEXT;
