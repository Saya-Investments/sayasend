-- Índice por los últimos 10 dígitos del teléfono, igual que idx_clientes_tel10.
-- Meta guarda '573102022107' y clientes '3102022107': todo cruce por teléfono
-- (ficha y lista de clientes del bot) compara right(dígitos, 10).
-- CONCURRENTLY para no bloquear los inserts del bot mientras se construye.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_tel10 ON sayasend.chat_messages ("right"(regexp_replace((phone)::text, '[^0-9]'::text, ''::text, 'g'::text), 10), created_at DESC)
