-- Usuarios del CRM (login + roles). Tabla propia de sayasend: NO reutilizar
-- comercial.crm_usuarios (otro país, otro equipo).
-- password_hash = 'temp_hash' obliga a fijar la contraseña en el primer ingreso.
CREATE TABLE IF NOT EXISTS sayasend.crm_usuarios (
  id_usuario     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          varchar(150) NOT NULL UNIQUE,
  nombre         varchar(100) NOT NULL,
  password_hash  varchar(255) NOT NULL DEFAULT 'temp_hash',
  rol            varchar(20)  NOT NULL DEFAULT 'asesor',
  activo         boolean      NOT NULL DEFAULT true,
  ultimo_login   timestamptz,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT ck_crm_usuarios_rol CHECK (rol IN ('admin','asesor'))
);

-- Primer admin: entra con este correo y fija su contraseña en el primer login.
INSERT INTO sayasend.crm_usuarios (email, nombre, rol)
VALUES ('yomira@sayainvestments.co', 'Yomira', 'admin')
ON CONFLICT (email) DO NOTHING;
