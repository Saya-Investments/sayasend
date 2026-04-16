CREATE SCHEMA IF NOT EXISTS sayasend;

SET search_path TO sayasend;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_asociado VARCHAR(50) NOT NULL,
    dni VARCHAR(20) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    monto NUMERIC(12, 2) NOT NULL DEFAULT 0,
    probabilidad NUMERIC(5, 2),
    segmento VARCHAR(50),
    estrategia VARCHAR(50),
    fecha_asamblea DATE,
    fecha_vencimiento DATE,
    fec_ult_pag_ccap DATE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_clientes_codigo_asociado UNIQUE (codigo_asociado),
    CONSTRAINT uq_clientes_dni UNIQUE (dni),
    CONSTRAINT ck_clientes_probabilidad
        CHECK (probabilidad IS NULL OR (probabilidad >= 0 AND probabilidad <= 100))
);

CREATE INDEX IF NOT EXISTS idx_clientes_segmento
    ON clientes (segmento);

CREATE INDEX IF NOT EXISTS idx_clientes_estrategia
    ON clientes (estrategia);

CREATE INDEX IF NOT EXISTS idx_clientes_fecha_vencimiento
    ON clientes (fecha_vencimiento);

CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    contenido TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_templates_nombre UNIQUE (nombre)
);

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    template_id UUID NOT NULL REFERENCES templates(id),
    database_name VARCHAR(100) NOT NULL DEFAULT 'clientes',
    send_mode VARCHAR(2) NOT NULL,
    segmento_filter VARCHAR(50),
    estrategia_filter VARCHAR(50),
    total_contacts INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    scheduled_at TIMESTAMP WITHOUT TIME ZONE,
    started_at TIMESTAMP WITHOUT TIME ZONE,
    finished_at TIMESTAMP WITHOUT TIME ZONE,
    variable_mappings JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT ck_campaign_send_mode
        CHECK (send_mode IN ('M0', 'M1')),
    CONSTRAINT ck_campaign_status
        CHECK (status IN ('draft', 'scheduled', 'sending', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status
    ON campaigns (status);

CREATE INDEX IF NOT EXISTS idx_campaigns_template
    ON campaigns (template_id);

CREATE TABLE IF NOT EXISTS campaign_variable_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    placeholder VARCHAR(30) NOT NULL,
    source_column VARCHAR(100) NOT NULL,
    CONSTRAINT uq_campaign_mapping UNIQUE (campaign_id, placeholder)
);

CREATE INDEX IF NOT EXISTS idx_campaign_variable_mappings_campaign
    ON campaign_variable_mappings (campaign_id);

CREATE TABLE IF NOT EXISTS campaign_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    personalized_message TEXT,
    send_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMP WITHOUT TIME ZONE,
    delivered_at TIMESTAMP WITHOUT TIME ZONE,
    read_at TIMESTAMP WITHOUT TIME ZONE,
    failed_at TIMESTAMP WITHOUT TIME ZONE,
    failure_reason TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_campaign_contact UNIQUE (campaign_id, cliente_id),
    CONSTRAINT ck_campaign_contact_status
        CHECK (send_status IN ('pending', 'sent', 'delivered', 'read', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign
    ON campaign_contacts (campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status
    ON campaign_contacts (send_status);

CREATE OR REPLACE VIEW vw_campaign_metrics AS
SELECT
    c.id AS campaign_id,
    c.nombre AS campaign_name,
    COUNT(cc.id) AS total,
    COUNT(*) FILTER (WHERE cc.send_status IN ('sent', 'delivered', 'read', 'failed')) AS sent,
    COUNT(*) FILTER (WHERE cc.send_status IN ('delivered', 'read')) AS delivered,
    COUNT(*) FILTER (WHERE cc.send_status = 'read') AS read,
    COUNT(*) FILTER (WHERE cc.send_status = 'failed') AS failed,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE cc.send_status IN ('delivered', 'read'))
        / NULLIF(COUNT(cc.id), 0),
        2
    ) AS delivery_rate,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE cc.send_status = 'read')
        / NULLIF(COUNT(cc.id), 0),
        2
    ) AS read_rate,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE cc.send_status = 'failed')
        / NULLIF(COUNT(cc.id), 0),
        2
    ) AS failure_rate
FROM campaigns c
LEFT JOIN campaign_contacts cc
    ON cc.campaign_id = c.id
GROUP BY c.id, c.nombre;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clientes_updated_at ON clientes;
CREATE TRIGGER trg_clientes_updated_at
BEFORE UPDATE ON clientes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_templates_updated_at ON templates;
CREATE TRIGGER trg_templates_updated_at
BEFORE UPDATE ON templates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO templates (nombre, descripcion, contenido)
VALUES
    (
        'Premio PD Baja',
        'Plantilla promocional para clientes con probabilidad baja.',
        'Hola {{1}}, con tu pago puntual de {{2}} avanzas y puedes entrar a la Ruleta Ganadora. Codigo: {{3}}.'
    ),
    (
        'Recordatorio de Pago',
        'Plantilla de recordatorio de pago.',
        'Hola {{1}}, te recordamos que tu pago de {{2}} esta por vencer.'
    )
ON CONFLICT DO NOTHING;

