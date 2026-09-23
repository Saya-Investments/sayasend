-- Qué asesor atiende a qué cliente del bot. Tabla propia del CRM (no se toca
-- bot_cliente_etapa). Se asigna solo cuando el bot deriva: el admin elige el
-- asesor desde la cola de derivaciones. Una fila por etapa; si el cliente pasa
-- de Pre-Admisión a Admisión, la etapa nueva hereda el asesor de la anterior
-- (se resuelve al leer, siguiendo etapa_previa_id).
CREATE TABLE IF NOT EXISTS sayasend.crm_asignacion (
  etapa_id      uuid PRIMARY KEY REFERENCES sayasend.bot_cliente_etapa(id) ON DELETE CASCADE,
  id_asesor     uuid NOT NULL REFERENCES sayasend.crm_usuarios(id_usuario),
  asignado_por  uuid REFERENCES sayasend.crm_usuarios(id_usuario),
  asignado_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_asignacion_asesor ON sayasend.crm_asignacion (id_asesor);

-- Historial: quién lo tuvo antes (reasignaciones y auditoría).
CREATE TABLE IF NOT EXISTS sayasend.crm_asignacion_historial (
  id             bigserial PRIMARY KEY,
  etapa_id       uuid NOT NULL REFERENCES sayasend.bot_cliente_etapa(id) ON DELETE CASCADE,
  derivacion_id  uuid REFERENCES sayasend.bot_derivacion_humana(id) ON DELETE SET NULL,
  id_asesor      uuid REFERENCES sayasend.crm_usuarios(id_usuario),
  asignado_por   uuid REFERENCES sayasend.crm_usuarios(id_usuario),
  ts             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_asig_hist_etapa ON sayasend.crm_asignacion_historial (etapa_id, ts DESC);

-- Acciones de seguimiento de permanencia que registra el asesor. Una acción NO
-- cierra la derivación (eso va por el endpoint del bot).
CREATE TABLE IF NOT EXISTS sayasend.crm_acciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id        uuid NOT NULL REFERENCES sayasend.bot_cliente_etapa(id) ON DELETE CASCADE,
  derivacion_id   uuid REFERENCES sayasend.bot_derivacion_humana(id) ON DELETE SET NULL,
  id_usuario      uuid NOT NULL REFERENCES sayasend.crm_usuarios(id_usuario),
  tipo            varchar(20) NOT NULL,
  resultado       varchar(30) NOT NULL,
  observaciones   text,
  duracion_seg    integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_crm_acciones_tipo CHECK (tipo IN ('LLAMADA','WHATSAPP','NOTA')),
  CONSTRAINT ck_crm_acciones_resultado CHECK (resultado IN ('CONTACTADO','NO_CONTESTA','NUMERO_EQUIVOCADO','SEGUIMIENTO','RESUELTO','RENUNCIA'))
);
CREATE INDEX IF NOT EXISTS idx_crm_acciones_etapa ON sayasend.crm_acciones (etapa_id, created_at DESC);
