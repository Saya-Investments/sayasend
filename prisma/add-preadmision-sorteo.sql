-- Sorteo diario de la bienvenida de Pre-admisión (Bot Educador). Una fila por
-- persona (DNI) que entró a un sorteo, sea RETADOR (recibe la bienvenida) o
-- CONTROL (no recibe nada). El DNI es único: nadie se sortea dos veces.
-- `datos_bq` guarda todas las columnas de BD_FONDOS_COL tal como estaban el día
-- del sorteo, un elemento por contrato.
CREATE TABLE IF NOT EXISTS sayasend.preadmision_sorteo (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dni                varchar(20)  NOT NULL,
  grupo              varchar(10)  NOT NULL,
  fecha_corrida      date         NOT NULL,
  semilla            bigint       NOT NULL,
  asamblea_objetivo  date         NOT NULL,
  fecha_inscripcion  date,
  nombre             varchar(150),
  telefono           varchar(20),
  codigos_asociado   varchar(150),
  campaign_id        uuid REFERENCES sayasend.campaigns(id) ON DELETE SET NULL,
  cliente_id         uuid REFERENCES sayasend.clientes(id) ON DELETE SET NULL,
  datos_bq           jsonb        NOT NULL,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT uq_preadmision_sorteo_dni UNIQUE (dni),
  CONSTRAINT ck_preadmision_sorteo_grupo CHECK (grupo IN ('RETADOR', 'CONTROL'))
);

CREATE INDEX IF NOT EXISTS idx_preadmision_sorteo_fecha ON sayasend.preadmision_sorteo (fecha_corrida);
