-- Cuándo se subió la fila a CDV_COL.Preadmision_Bienvenida_Sorteo (BigQuery).
-- NULL = pendiente: cada corrida sube las pendientes, así un fallo de
-- BigQuery se reintenta solo al día siguiente.
ALTER TABLE sayasend.preadmision_sorteo ADD COLUMN IF NOT EXISTS sincronizado_bq_at timestamptz;
