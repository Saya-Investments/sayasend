CREATE SCHEMA IF NOT EXISTS sayasend;

SET search_path TO sayasend;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sayasend.clientes (
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
    mes VARCHAR(20),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_clientes_codigo_asociado UNIQUE (codigo_asociado),
    CONSTRAINT uq_clientes_dni UNIQUE (dni),
    CONSTRAINT ck_clientes_probabilidad
        CHECK (probabilidad IS NULL OR (probabilidad >= 0 AND probabilidad <= 100))
);

CREATE INDEX IF NOT EXISTS idx_clientes_segmento
    ON sayasend.clientes (segmento);

CREATE INDEX IF NOT EXISTS idx_clientes_estrategia
    ON sayasend.clientes (estrategia);

CREATE INDEX IF NOT EXISTS idx_clientes_fecha_vencimiento
    ON sayasend.clientes (fecha_vencimiento);

CREATE TABLE IF NOT EXISTS sayasend.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    contenido TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_templates_nombre UNIQUE (nombre)
);

CREATE TABLE IF NOT EXISTS sayasend.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    template_id UUID NOT NULL REFERENCES sayasend.templates(id),
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
    ON sayasend.campaigns (status);

CREATE INDEX IF NOT EXISTS idx_campaigns_template
    ON sayasend.campaigns (template_id);


CREATE TABLE IF NOT EXISTS sayasend.campaign_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES sayasend.campaigns(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES sayasend.clientes(id) ON DELETE CASCADE,
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
    ON sayasend.campaign_contacts (campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status
    ON sayasend.campaign_contacts (send_status);

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
FROM sayasend.campaigns c
LEFT JOIN sayasend.campaign_contacts cc
    ON cc.campaign_id = c.id
GROUP BY c.id, c.nombre;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clientes_updated_at ON sayasend.clientes;
CREATE TRIGGER trg_clientes_updated_at
BEFORE UPDATE ON sayasend.clientes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_templates_updated_at ON sayasend.templates;
CREATE TRIGGER trg_templates_updated_at
BEFORE UPDATE ON sayasend.templates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


--ohno
