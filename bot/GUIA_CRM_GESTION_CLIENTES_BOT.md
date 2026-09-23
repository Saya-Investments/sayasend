# Guía: gestión de clientes del Bot Educador en el CRM sayasend

> **Desactualizada** en todo lo que toca el modelo del bot: lo reemplaza
> `bot/CAMBIOS_CRM_v1_a_v2.md` (v2: score 0-100 e incidencias). Sigue valiendo
> lo de login, roles, proxy.ts, usuarios y despliegue.

> **Para:** una sesión nueva de Claude que va a construir esto en el CRM.
> **Escrita:** 21-sep-2026, verificada contra el código y la base reales.
> Léela entera antes de tocar nada. La sección 6 tiene las trampas que rompen producción.

---

## 0. Qué hay que construir, en una frase

Al CRM `sayasend` (Next.js) hay que agregarle **login con roles**, dejar la vista actual como **vista de administrador**, y crear una **vista de asesor** donde cada asesor gestione a los clientes que atiende el Bot Educador: verlos, entender cómo están, registrar acciones comerciales y cerrar los casos que el bot le derivó.

El modelo de referencia es el CRM del bot comercial (`/home/admin_/comercial_front/`), **con una excepción importante en seguridad** (sección 4.2).

---

## 1. Contexto: las piezas que ya existen

| Pieza | Dónde | Qué es |
|---|---|---|
| **CRM sayasend** | `/home/admin_/sayasend/` · git `Saya-Investments/sayasend` · **Vercel** | Next.js. Hoy: campañas, plantillas, chat. **Sin login.** Acá se trabaja. |
| **Bot Educador** | `/home/admin_/sayasent/` · Cloud Run `sayasent` (us-west4) | Python/Flask + LangGraph. Recibe el webhook de Meta, conversa, clasifica. **No se toca desde esta tarea.** |
| **Base** | Postgres `bdMaqui`, schema **`sayasend`** | La comparten el CRM y el bot. El DSN está en `/home/admin_/sayasent/bot_postgres.py` (`DSN_DEFECTO`). |
| **Referencia** | `/home/admin_/comercial_front/` | CRM del bot comercial (Perú). Tiene login, roles y vista de asesor. |

> ⚠️ **Nombres confusos pero reales:** el servicio de Cloud Run es `sayasen`**`t`** (con T). El CRM, el repo y el schema de Postgres son `sayasen`**`d`** (con D).

### El Bot Educador en 30 segundos

Acompaña por WhatsApp a clientes de Colombia en dos etapas: **Pre-Admisión** (del primer pago a la 1.ª asamblea) y **Admisión** (de la 1.ª asamblea al 2.º pago). Por cada cliente produce un **acompañamiento**: `SIN_SENAL` · `BAJO` · `MEDIO` · `ALTO` (+ marca `CRÍTICO` si pidió retirarse). Cuando el tema lo supera, **deriva a un humano**: esa es la cola que el asesor tiene que atender.

La lógica de negocio completa está en `/home/admin_/sayasent/info/` (`reglas_finales_preadmision_bot_educador.md` y `admision_bot_estados_implementacion.md`). Para el CRM alcanza con esta guía.

---

## 2. Qué debe ver y hacer cada rol

### 2.1 Administrador — lo que hoy es el CRM entero

Todo lo actual se queda tal cual, detrás del login:
- Campañas, plantillas, calendario, chat.

Y se le agrega:
- **Usuarios**: crear asesores, activarlos/desactivarlos, resetear contraseña.
- **Todos los clientes del bot**, sin filtro de asesor.
- **Asignar / reasignar** clientes a asesores.
- **Cargar códigos asociados** al bot (la lista que les entregan al empezar) y ver **los que no se pudieron resolver**.
- **Métricas del piloto**: distribución de acompañamiento, derivaciones abiertas y vencidas.

### 2.2 Asesor — nuevo

- **Mis clientes**: solo los asignados a él (ver 4.4).
- **Cola de derivaciones**: los casos que el bot le pasó. **Es la pantalla más importante** (ver 3.3).
- **Ficha del cliente**: todo lo que el bot sabe de él + su conversación + sus acciones.
- **Registrar acciones comerciales**: llamada, WhatsApp, nota, con resultado.
- **Cerrar una derivación** con su resultado.
- **Responder por chat** (el chat que ya existe).

El asesor **no** ve campañas, plantillas ni usuarios.

---

## 3. Las pantallas del asesor

### 3.1 Mis clientes (lista)

Una fila por cliente del bot asignado al asesor. Columnas sugeridas:

| Columna | De dónde sale |
|---|---|
| Nombre, teléfono | `clientes.nombre`, `bot_cliente_etapa.telefono` |
| Contratos en el bot | `bot_cliente_etapa.codigos_asociados` (text[]) — ver 6.6 |
| Etapa | `bot_cliente_etapa.etapa` → Pre-Admisión / Admisión |
| **Acompañamiento** | `bot_cliente_etapa.acompanamiento` + `critico` → pastilla de color |
| Próxima asamblea | `bot_cliente_etapa.fecha_asamblea` (+ "faltan N días") |
| Derivación abierta | existe fila en `bot_derivacion_humana` con `cerrado_at IS NULL` |
| Última interacción | `max(chat_messages.created_at)` por teléfono (cruce por últimos 10 dígitos, ver 6.5) |

**Filtros:** acompañamiento, etapa, solo CRÍTICO, solo con derivación abierta.
**Orden por defecto:** CRÍTICO primero, luego ALTO, luego por fecha de asamblea más cercana.

Filtrar siempre por `bot_cliente_etapa.cerrado_at IS NULL` (la etapa vigente). Un cliente que pasó a Admisión tiene **dos filas**: la de Pre-Admisión cerrada y la de Admisión abierta.

### 3.2 Colores del acompañamiento

| Nivel | Qué significa | Sugerencia |
|---|---|---|
| `SIN_SENAL` | No conversó lo suficiente. **No es ni bueno ni malo.** | gris |
| `BAJO` | Conversó y lo que salió quedó resuelto | azul |
| `MEDIO` | Tema abierto, no grave | amarillo |
| `ALTO` | Alerta vigente | naranja |
| `ALTO` + `critico=true` | Pidió retirarse | rojo + etiqueta "CRÍTICO" |

⚠️ No lo pinten como semáforo verde/amarillo/rojo: `SIN_SENAL` (~77% de los clientes, es lo esperado) no debe verse como "malo".

### 3.3 Cola de derivaciones — la pantalla clave

Sale de `bot_derivacion_humana WHERE cerrado_at IS NULL`.

- Orden: `prioridad = 'INMEDIATA'` primero (son retiros), después por `abierto_at`.
- Mostrar el **SLA**: `sla_vence_at` (24 h desde que se abrió). Vencido en rojo.
- Mostrar `caso` y `motivo` (lo escribió el bot al derivar).
- Botón para ir a la ficha y **cerrar** la derivación.

**Por qué importa tanto:** mientras una derivación esté abierta, el cliente queda en `ALTO` **para siempre** — ni el silencio ni el pago lo bajan (es una regla de negocio). Si nadie la cierra, el piloto se llena de ALTO falsos. El bot además le prometió al cliente *"un asesor te va a contactar"*.

### 3.4 Ficha del cliente

- **Cabecera:** nombre, teléfono, contratos en alcance, etapa, asamblea, acompañamiento.
- **Estado por caso** (`bot_cliente_etapa`): `estado_preparacion`, `estado_funcionamiento`, `estado_expectativa`, `estado_desconfianza`, `estado_pago`. Mostrar solo los no nulos.
- **Banderas históricas** (booleanos de `bot_cliente_etapa`): `tuvo_duda`, `tuvo_expectativa_desalineada`, `tuvo_desconfianza`, `requirio_humano`, `retiro_explicito`, `dificultad_pago`, `promesa_pago`, `promesa_incumplida`, `conversacion_inconclusa`, `cliente_preparado`. Nunca vuelven a `false`.
- **Si viene de Pre-Admisión** (`etapa_previa_id` no nulo): mostrar `acompanamiento_heredado`, `banderas_heredadas` y `alerta_heredada` — "cómo llegó".
- **Historial del acompañamiento:** `bot_acompanamiento_historial` ordenado por `ts`.
- **Conversación:** reutilizar el componente de chat existente (`components/chat/`). Los mensajes del bot tienen `chat_messages.origen = 'BOT'`.
- **Acciones comerciales** del cliente (sección 4.5).
- **Botones:** registrar acción · cerrar derivación · marcar que renunció (solo Pre-Admisión).

### 3.5 Cerrar una derivación

Formulario con **uno de estos 6 resultados** (son los únicos que acepta el bot):

| Resultado | Cuándo |
|---|---|
| `CLIENTE_PREPARADO` | El caso era de preparación y quedó listo |
| `DUDA_RESUELTA` | Era una duda y quedó resuelta |
| `EXPECTATIVA_ALINEADA` | Entendió que la adjudicación no tiene fecha garantizada |
| `CONFIANZA_RECUPERADA` | Desconfiaba y se recuperó |
| `CONFIANZA_FRAGIL` | Sigue, pero con dudas de fondo |
| `RETIRO_CONFIRMADO` | Se retira de verdad |

+ una **nota obligatoria**. Esto va por el endpoint del bot, **no por UPDATE directo** (ver 4.6).

---

## 4. Diseño técnico

### 4.1 Estado real del stack (verificado 21-sep)

| | sayasend (acá se trabaja) | comercial_front (referencia) |
|---|---|---|
| Next | 16.2.0 | 16.1.6 |
| React | 19.2.4 | ^19 |
| Prisma | **^5.22** | **^7.4** ← distinto, no copiar sintaxis de 7 |
| Tailwind | ^4.2 | ^3.4 |
| Navegación | **rutas** (`app/campaigns/page.tsx`, `app/chat/…`) | SPA: un `app/page.tsx` + módulos por `#hash` |
| Auth | **ninguna** | login propio con `bcryptjs` |
| Deploy | Vercel (`vercel.json` con un cron) | Vercel |

sayasend usa **rutas de Next de verdad**, comercial usa una SPA con hash. **Mantengan las rutas**: encajan con un `middleware.ts` y es como ya está hecho el CRM.

### 4.2 Login: copiar la experiencia de comercial, NO su seguridad

Cómo funciona en comercial (`app/api/auth/login/route.ts`, `contexts/auth-context.tsx`):
- `POST /api/auth/login` compara con `bcrypt` contra `comercial.crm_usuarios`.
- Si `password_hash = 'temp_hash'` responde `SETUP_REQUIRED` → el usuario fija su contraseña en `/api/auth/setup-password`. **Este flujo está bueno, cópienlo.**
- Devuelve el usuario como JSON y el front lo guarda en **`localStorage`**.

**El problema, verificado:** no hay sesión del lado del servidor ni middleware. Las rutas de API saben quién llama porque el front les manda **`?userId=...`** en la URL (ej. `app/api/advisor-dashboard/route.ts`). Cualquiera que cambie ese parámetro ve los datos de otro asesor, y cualquiera sin login puede llamar las APIs directo. Además los módulos "solo admin" se ocultan **solo en el front**.

Para sayasend esto importa más: el CRM tendrá datos personales de clientes y botones que cierran casos. Y **hoy mismo** la ruta que envía WhatsApp (`app/api/chat/conversations/[phone]/messages/route.ts`) **no tiene ninguna verificación**: cualquiera que conozca la URL puede mandar mensajes desde el número de la empresa. El login lo arregla.

**Cómo hacerlo en sayasend:**

1. **Sesión en cookie `httpOnly`, firmada.** Usar `jose` (JWT firmado, funciona en el runtime edge del middleware). Nada en `localStorage`.
   - `SESSION_SECRET` como variable de entorno en Vercel.
   - Cookie: `httpOnly`, `secure`, `sameSite=lax`, vencimiento ~12 h.
   - Payload mínimo: `{ sub: id_usuario, rol }`.
2. **`middleware.ts`** que exige sesión válida en todo, salvo:
   - `/login` y `/api/auth/*`
   - **`/api/cron/*`** ← ver 6.1, esto es crítico
   - `_next/*`, estáticos, favicon
   - Página sin sesión → redirect a `/login`. API sin sesión → `401`.
3. **Cada ruta de API saca el usuario de la cookie.** Nunca de un parámetro. Un helper tipo `getSesion(req)` / `requireRol(req, 'admin')`.
4. **El control de rol va en el servidor.** Las rutas de admin devuelven `403` a un asesor. Ocultar el botón en el front es cosmético, no seguridad.
5. **Filtrar por asesor en el SQL**, no en el front: la ruta "mis clientes" filtra por el asesor de la sesión.

Dependencias nuevas: `bcryptjs`, `jose` (y `@types/bcryptjs`).

### 4.3 Tabla de usuarios

Crear **`sayasend.crm_usuarios`**, inspirada en `comercial.crm_usuarios`. **No reutilicen la de comercial**: son otro país, otro equipo y otro producto; mezclar usuarios de Perú con Colombia es pedir problemas de permisos.

```sql
-- prisma/add-crm-usuarios.sql
CREATE TABLE IF NOT EXISTS sayasend.crm_usuarios (
  id_usuario     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          varchar(150) NOT NULL UNIQUE,
  nombre         varchar(100) NOT NULL,
  password_hash  varchar(255) NOT NULL DEFAULT 'temp_hash',  -- fuerza el setup la 1.ª vez
  rol            varchar(20)  NOT NULL DEFAULT 'asesor',
  activo         boolean      NOT NULL DEFAULT true,
  ultimo_login   timestamptz,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT ck_crm_usuarios_rol CHECK (rol IN ('admin','asesor'))
);
```

Arranquen con dos roles. Si después hace falta `supervisor` (comercial lo tiene), se agrega al CHECK.

**El primer admin** se crea con un INSERT a mano (con `temp_hash`) y entra por el flujo de setup. Documenten ese paso.

### 4.4 Qué asesor atiende a qué cliente

**Hoy no existe.** Ni `bot_cliente_etapa` ni `bot_derivacion_humana` tienen asesor asignado (`bot_derivacion_humana.asignado_a` es un varchar libre que nadie llena).

Propuesta (confirmar con el usuario, ver sección 7):

```sql
-- prisma/add-asignacion-asesor.sql
ALTER TABLE sayasend.bot_cliente_etapa
  ADD COLUMN IF NOT EXISTS id_asesor uuid REFERENCES sayasend.crm_usuarios(id_usuario);

-- Historial: quién lo tuvo antes (para reasignaciones y auditoría)
CREATE TABLE IF NOT EXISTS sayasend.crm_asignacion_historial (
  id            bigserial PRIMARY KEY,
  etapa_id      uuid NOT NULL REFERENCES sayasend.bot_cliente_etapa(id) ON DELETE CASCADE,
  id_asesor     uuid REFERENCES sayasend.crm_usuarios(id_usuario),
  asignado_por  uuid REFERENCES sayasend.crm_usuarios(id_usuario),
  motivo        text,
  ts            timestamptz NOT NULL DEFAULT now()
);
```

⚠️ Cuando un cliente pasa de Pre-Admisión a Admisión el bot **crea una fila nueva** de `bot_cliente_etapa`. La asignación tiene que viajar: o el admin reasigna, o (mejor) el CRM hereda el `id_asesor` de la fila apuntada por `etapa_previa_id`. Decidirlo y documentarlo.

### 4.5 Acciones comerciales

En comercial: `comercial.crm_acciones_comerciales` con `tipo_accion` (Llamada 4586 · Agendar_llamada 543 · Mensaje_WSP 318 · Cita 180) y `estado_asesor` (Contactado, No_interesado, Seguimiento, No_contesta, Interesado, Venta_cerrada…).

**Esos estados son de venta y no aplican acá**: estos clientes ya compraron. Lo que el asesor registra es **seguimiento de permanencia**. Propuesta:

```sql
-- prisma/add-crm-acciones.sql
CREATE TABLE IF NOT EXISTS sayasend.crm_acciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id        uuid NOT NULL REFERENCES sayasend.bot_cliente_etapa(id) ON DELETE CASCADE,
  derivacion_id   uuid REFERENCES sayasend.bot_derivacion_humana(id) ON DELETE SET NULL,
  id_usuario      uuid NOT NULL REFERENCES sayasend.crm_usuarios(id_usuario),
  tipo            varchar(20) NOT NULL,   -- LLAMADA | WHATSAPP | NOTA
  resultado       varchar(30) NOT NULL,   -- CONTACTADO | NO_CONTESTA | NUMERO_EQUIVOCADO
                                          -- | SEGUIMIENTO | RESUELTO | RENUNCIA
  observaciones   text,
  duracion_seg    integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_crm_acciones_tipo CHECK (tipo IN ('LLAMADA','WHATSAPP','NOTA'))
);
CREATE INDEX IF NOT EXISTS idx_crm_acciones_etapa ON sayasend.crm_acciones (etapa_id, created_at DESC);
```

La lista exacta de resultados es para validar con el equipo (sección 7).

**Una acción comercial NO cierra la derivación.** Son dos cosas: la acción es el registro de lo que hizo el asesor; el cierre de derivación cambia el estado del cliente en el bot. Una llamada que no contesta es una acción, y la derivación sigue abierta.

### 4.6 Cómo habla el CRM con el bot

**La regla:**
- **Leer** → directo de la base, con Prisma (`bot_cliente_etapa`, `bot_derivacion_humana`, `bot_acompanamiento_historial`, `bot_episodio`, `bot_episodio_estado`…).
- **Cambiar el estado del cliente en el bot** → **siempre por los endpoints HTTP del bot**, desde una ruta de API de Next (servidor). **Nunca con UPDATE directo a las tablas `bot_*`.**

Por qué: el estado lo decide el **motor de reglas** del bot (`sayasent/bot_motor_reglas.py`). Cerrar una derivación no es solo poner `cerrado_at`: aplica el resultado con origen `HUMANO`, recalcula el acompañamiento, respeta que una alerta solo la baja un cierre humano, y escribe el historial. Un UPDATE directo se salta todo eso y deja el piloto inconsistente.

**Endpoints que el CRM va a usar** (base: `https://sayasent-763512810578.us-west4.run.app`):

| Para | Método y ruta | Body |
|---|---|---|
| Cerrar derivación | `POST /bot/derivaciones/<derivacion_id>/cerrar` | `{"estado_cierre": "...", "nota": "...", "asesor": "<email>"}` |
| Marcar que renunció en la 1.ª asamblea | `POST /bot/transicion/<etapa_id>` | `{"resultado_1ra_asamblea": "REN_1_ASAM"}` |
| Cargar códigos al bot (admin) | `POST /bot/cargar` | `{"codigos": ["30912702", ...], "etapa": "ADMISION"}` |
| Códigos que no se resolvieron (admin) | `GET /bot/codigos/sin-resolver` | — |
| Pausar el bot manualmente | `POST /bot/etapas/<etapa_id>/pausa` | `{"horas": 3}` |
| Registrar un pago (si aplica) | `POST /bot/pagos` | `{"etapa_id": "...", "fecha_pago": "YYYY-MM-DD", "monto": 0}` |

Todos exigen el header **`X-Bot-Secret`**. El valor está en `/home/admin_/sayasent/api_keys.py` (`bot_procesar_secret`). En Vercel va como variable de entorno (ej. `BOT_SECRET`) y **solo se usa desde rutas de API del servidor**. Si se llama desde el navegador, el secreto queda expuesto.

**Pausar el bot no hace falta llamarlo:** el bot detecta solo cuando un asesor escribe desde el chat del CRM (un saliente `message_type='text'` sin `origen='BOT'`) y se calla 3 h. El endpoint de pausa existe para casos especiales.

### 4.7 Cómo se aplican cambios de BD en este repo

**No se usa `prisma db pull` ni `prisma migrate`.** El flujo del repo es:

1. Escribir el SQL a mano en `prisma/<nombre>.sql` (ver los existentes: `add-telefono-3.sql`, `add-cta-act-pag.sql`…).
2. Aplicarlo: `node prisma/run-sql.mjs prisma/<nombre>.sql`
3. **Editar `prisma/schema.prisma` a mano** para exponer los modelos/columnas nuevos, con el estilo del archivo: campos en camelCase con `@map("columna_real")` y `@@map("tabla_real")`.

⚠️ **No usen `@@schema`.** El `schema.prisma` no tiene `previewFeatures = ["multiSchema"]`: el schema `sayasend` lo fija el `DATABASE_URL`. Agregar `@@schema` rompe el generate.

⚠️ `prisma db pull` reescribiría **todo** `schema.prisma` y se perderían los nombres curados a mano.

⚠️ `run-sql.mjs` parte el archivo por `;` y descarta líneas que empiezan con `--`: no escriban funciones con `$$` ni pongan `;` dentro de comentarios.

**Hoy `schema.prisma` no conoce nada del bot.** Hay que agregarle a mano, como mínimo: `BotClienteEtapa`, `BotDerivacionHumana`, `BotAcompanamientoHistorial`, y las columnas nuevas de `Cliente` (`botEtapa`, `fecha1raAsamblea`, `fechaInscripcion`) y `ChatMessage` (`origen`, `episodioId`). El DDL de referencia de todo lo del bot está en `/home/admin_/sayasent/bot_educador_schema.sql`.

---

## 5. Plan por fases

Cada fase se puede desplegar sola.

**Fase 1 — Login (sin cambiar nada más).** `crm_usuarios`, login + setup de contraseña, cookie firmada, `middleware.ts`, primer admin. Al terminar: todo el CRM actual funciona igual pero detrás de login, y las APIs devuelven 401 sin sesión. **Verificar que el cron de campañas programadas sigue corriendo** (sección 6.1).

**Fase 2 — Roles.** Helper de sesión en las rutas de API, `403` para asesor en rutas de admin, navegación según rol. Pantalla de usuarios para el admin.

**Fase 3 — Clientes del bot (solo lectura).** Modelos del bot en `schema.prisma`, asignación de asesor, lista "mis clientes", ficha, cola de derivaciones.

**Fase 4 — Acciones.** `crm_acciones`, registrar acción, **cerrar derivación vía el endpoint del bot**, marcar renuncia.

**Fase 5 — Admin del bot.** Carga de códigos, códigos sin resolver, reasignación, métricas del piloto.

---

## 6. Trampas — léelas antes de desplegar

### 6.1 ⚠️ El middleware NO puede bloquear `/api/cron/*`

`vercel.json` tiene un cron **cada minuto**: `/api/cron/send-scheduled-campaigns`. Es el que **envía las campañas programadas**. Esas rutas ya tienen su propia protección (`Authorization: Bearer ${CRON_SECRET}`, ver `app/api/cron/*/route.ts`). Si el middleware nuevo las exige con sesión, **las campañas programadas dejan de salir y nadie se entera**. Exclúyanlas del middleware explícitamente y prueben que el cron responde 200 después del deploy.

### 6.2 Disco de Cloud Shell

Al 21-sep el disco `/home` estaba al **89% (546 MB libres)** y `sayasend` **no tiene `node_modules`**. Un `node_modules` de Next.js pesa ~1 GB (el de `comercial_front` pesa 1,3 GB). **Corran `df -h /home` antes de `npm install`**; si no alcanza, pídanle al usuario liberar espacio. No borren nada de otros proyectos sin preguntar.

### 6.3 Prisma 5, no 7

sayasend usa Prisma **5.22**. comercial usa **7.4**. Si copian código de comercial, revisen que la sintaxis sirva en 5.

### 6.4 No escribir en las tablas `bot_*`

Ver 4.6. Leer sí; cambiar estado solo por el endpoint del bot. Las únicas tablas que el CRM escribe directo son las suyas: `crm_usuarios`, `crm_asignacion_historial`, `crm_acciones`, y la columna `id_asesor`.

### 6.5 Cruce por teléfono: últimos 10 dígitos

Meta manda `573102022107`, `clientes.telefono` guarda `3102022107`. **Todo cruce por teléfono compara los últimos 10 dígitos**:

```sql
right(regexp_replace(a.telefono, '[^0-9]', '', 'g'), 10)
  = right(regexp_replace(b.phone, '[^0-9]', '', 'g'), 10)
```

Comparar el número completo no matchea casi nunca. (El chat actual del CRM usa `contains` en algunos lados; no lo tomen como referencia.)

### 6.6 Una persona, varios contratos

`clientes` tiene **una fila por persona (DNI)**, y `codigo_asociado` guarda **todos sus contratos concatenados**: `'30912702, 30900401, 30916601'` (el 7,5% de las filas). No todos esos contratos están en el bot: los que sí están son `bot_cliente_etapa.codigos_asociados` (text[]). En la ficha muestren **los del bot**, no el string completo.

### 6.7 Clientes de prueba

Hay un cliente de prueba en producción: `codigo_asociado = 'PRUEBA-BOT-001'`, teléfono `+51993538942` (el del usuario). Filtren o márquenlo para que no ensucie las métricas. Existe además un schema aparte **`testing_sayasend`** que usa el banco de pruebas del bot: **el CRM no debe leerlo nunca**.

### 6.8 `bot_cliente_etapa` cambia de fila al cambiar de etapa

Un cliente que pasó a Admisión tiene la fila de Pre-Admisión **cerrada** (`cerrado_at` no nulo) y otra de Admisión abierta que apunta a la anterior con `etapa_previa_id`. Para "estado actual" filtren `cerrado_at IS NULL`. Para la historia, sigan `etapa_previa_id`.

---

## 7. Preguntas abiertas — hacérselas al usuario antes de construir

1. **¿Quiénes son los asesores?** ¿Hay una lista? ¿Nombre y correo de cada uno?
2. **¿Cómo se asigna un cliente a un asesor?** ¿Por cartera fija, al derivar, por turno, a mano el admin? (Define la fase 3.)
3. **¿Un cliente sin derivación también tiene asesor?** ¿O el asesor solo ve los que el bot derivó?
4. **¿Qué resultados registra el asesor** en una acción? La lista de 4.5 es una propuesta.
5. **¿Hace falta rol supervisor?** (comercial lo tiene.)
6. **¿Quién marca las renuncias (REN_1_ASAM)?** El chat no lo sabe; lo sabe recaudación. Si no se marcan antes de las 06:20 del día siguiente a la asamblea, el cron del bot pasa al cliente a Admisión igual.
7. **Login:** ¿correo + contraseña está bien, o lo quieren con Google (tienen Workspace)?

---

## 8. Referencias rápidas

| Qué | Dónde |
|---|---|
| CRM a modificar | `/home/admin_/sayasend/` |
| Login de referencia | `comercial_front/app/api/auth/login/route.ts`, `app/api/auth/setup-password/`, `contexts/auth-context.tsx`, `components/auth/login-form.tsx` |
| Pantallas de asesor de referencia | `comercial_front/components/modules/advisor-dashboard-module.tsx`, `my-prospects-module.tsx`, `leads-table.tsx`, `users-module.tsx` |
| Acciones comerciales de referencia | `comercial_front/app/api/acciones-comerciales/route.ts` |
| DDL de todas las tablas del bot | `/home/admin_/sayasent/bot_educador_schema.sql` |
| Endpoints del bot | `/home/admin_/sayasent/bot_educador.py` (buscar `@bot_bp.route`) |
| Motor de reglas (qué significa cada estado) | `/home/admin_/sayasent/bot_motor_reglas.py` (`EFECTO`, `puede_aplicar`) |
| Reglas de negocio | `/home/admin_/sayasent/info/` |
| Secreto del bot, llaves | `/home/admin_/sayasent/api_keys.py` — **no lo copien a ningún archivo del repo del CRM** |
| Crons del CRM | `sayasend/vercel.json` + `app/api/cron/` |

---

## 9. Estado de la implementación (21-sep-2026)

Fases 1 a 5 construidas en el repo (sin commit ni deploy todavía). Decisiones que tomó el usuario (sección 7):

| Pregunta | Decisión |
|---|---|
| Login | Correo + contraseña, con el flujo `temp_hash` → fijar contraseña en el primer ingreso |
| Asignación | **Solo al derivar**: el admin elige el asesor desde la cola de derivaciones (`/bot`) |
| Qué ve el asesor | **Solo los clientes derivados** que le asignaron |
| Usuarios | Creados directo en la BD con contraseña: admin `yomira@sayainvestments.co` y asesor de prueba `asesor.prueba@sayainvestments.co` (tiene asignado el cliente `PRUEBA-BOT-001`). Los usuarios que cree el admin desde `/usuarios` sí usan el flujo `temp_hash`. |
| Estética | Todo con la paleta y el logo originales de SAYASEND (login, asesor y admin). Se probó la paleta Maqui+ y el usuario prefirió volver a la original. |

**Cambio respecto de 4.4:** la asignación NO es una columna en `bot_cliente_etapa`, es una tabla propia del CRM, `crm_asignacion` (PK `etapa_id`), más `crm_asignacion_historial`. Así el CRM no altera tablas `bot_*`. La etapa de Admisión hereda el asesor de la de Pre-Admisión al leer (`etapa_previa_id`), ver `ASESOR_EFECTIVO` en `lib/bot/queries.ts`.

**SQL aplicado en producción:** `prisma/add-crm-usuarios.sql`, `prisma/add-crm-asignacion-acciones.sql`, `prisma/add-chat-messages-tel10.sql` (índice por últimos 10 dígitos en `chat_messages`).

**Mapa del código:**

| Qué | Dónde |
|---|---|
| Sesión (cookie `sayasend_session`, JWT HS256 con `jose`, 12 h) | `lib/auth/session.ts`, `lib/auth/server.ts` (`getSesion`, `requireSesion`) |
| Protección de rutas | `proxy.ts` (en Next 16 reemplaza a `middleware.ts`). Excluye `/login`, `/api/auth/*`, `/api/cron/*`. Asesor: solo `/asesor/*` y `/api/bot/*`. |
| Login / setup / logout | `app/login/page.tsx`, `app/api/auth/*` |
| Área asesor | `app/asesor/` (mismo navbar que el admin + pestañas; derivaciones, mis clientes, ficha) |
| Área admin del bot | `app/bot/` (métricas + derivaciones con asignación, clientes, códigos), `app/usuarios/` |
| Lecturas (filtro por asesor en SQL) | `lib/bot/queries.ts` |
| Llamadas al bot (`X-Bot-Secret`) | `lib/bot/bot-api.ts`: cerrar derivación, REN_1_ASAM, cargar códigos |
| Mutaciones del CRM | `app/api/bot/*`, `app/api/usuarios/*` |

**Para desplegar, variables nuevas en Vercel:**
- `SESSION_SECRET`: 32+ caracteres aleatorios (sin esto nadie puede iniciar sesión).
- `BOT_SECRET`: el `bot_procesar_secret` de `sayasent/api_keys.py` (sin esto fallan cerrar derivación, renuncia y carga de códigos).
- Opcional `BOT_API_URL` (por defecto la URL de Cloud Run de la sección 4.6).
- Verificar que `CRON_SECRET` exista en Vercel: sin él la ruta del cron queda abierta. Después del deploy confirmar que el cron responde 200.

**Sin probar contra el bot real:** los tres endpoints de `lib/bot/bot-api.ts` siguen el contrato de la sección 4.6, pero no hubo `BOT_SECRET` en local. Probarlos con la primera derivación real.
