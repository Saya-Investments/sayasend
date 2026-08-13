-- Métricas por estado excluyentes.
--
-- `sent`, `delivered` y `read` son acumulados (un leído también cuenta como
-- entregado y como enviado), lo cual sirve para el funnel pero hace que las
-- tarjetas de la campaña se solapen y no sumen el total.
--
-- Se agregan tres columnas donde cada contacto cae en un solo balde:
--   sent_only      -> se envió pero WhatsApp aún no confirma entrega
--   delivered_only -> llegó pero no se leyó
--   pending        -> todavía no se procesa
-- Junto con `read` y `failed`, los cinco suman `total`.
CREATE OR REPLACE VIEW sayasend.vw_campaign_metrics AS
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
    ) AS failure_rate,
    -- Van al final a propósito: CREATE OR REPLACE VIEW solo deja agregar
    -- columnas después de las existentes, no intercalarlas.
    COUNT(*) FILTER (WHERE cc.send_status = 'sent') AS sent_only,
    COUNT(*) FILTER (WHERE cc.send_status = 'delivered') AS delivered_only,
    COUNT(*) FILTER (
        WHERE cc.id IS NOT NULL
          AND (cc.send_status IS NULL
               OR cc.send_status NOT IN ('sent', 'delivered', 'read', 'failed'))
    ) AS pending
FROM sayasend.campaigns c
LEFT JOIN sayasend.campaign_contacts cc
    ON cc.campaign_id = c.id
GROUP BY c.id, c.nombre;
