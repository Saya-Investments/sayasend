# Qué cambia en el CRM: de la v1 a la v2 del Bot Educador

**Reemplaza a `info/GUIA_CRM_GESTION_CLIENTES_BOT.md`** en todo lo que toca el
modelo de datos del bot. Lo que esa guía dice sobre **login, roles, middleware,
Prisma y despliegue sigue valiendo tal cual** — eso no cambió y está bien
resuelto.

Lo que cambió es el modelo de abajo: el bot ya no mide "acompañamiento
BAJO/MEDIO/ALTO por caso", mide un **score 0–100** e **incidencias**.

---

## 1. Resumen para el que ya leyó la guía v1

| Sección de la guía v1 | Estado |
|---|---|
| §2 Roles (admin / asesor) | **Vale igual** |
| §3.1 Mis clientes (lista) | Cambian las columnas (§4 de acá) |
| §3.2 Colores del acompañamiento | **Se reemplaza** por rangos de score |
| §3.3 Cola de derivaciones | Vale, cambia la consulta |
| §3.4 Ficha del cliente | Cambia el contenido |
| §4.2 Login | **Vale igual** |
| §4.3 Tabla de usuarios (`crm_usuarios`) | **Vale igual** |
| §4.4 Asignación (`crm_asignacion`) | Vale, cambia a qué apunta |
| §4.5 Acciones (`crm_acciones`) | Vale, cambia a qué apunta |
| §4.6 Cómo habla el CRM con el bot | Cambian las rutas |
| §6.4 No escribir en `bot_*` | **Vale igual** (más las `edu_*`) |
| §6.8 "`bot_cliente_etapa` cambia de fila al cambiar de etapa" | **Ya no**: ahora conviven las dos etapas |

---

## 2. El cambio de fondo

En la v1 el bot decía *cuánto acompañamiento necesita este cliente*. En la v2
dice **cuán bien va este cliente** y **qué le quedó sin resolver**.

| | v1 | v2 |
|---|---|---|
| Medida | `acompanamiento` BAJO/MEDIO/ALTO + `critico` | **`score_actual`** 0–100 |
| Unidad | caso (PREPARACION, FUNCIONAMIENTO, PAGO…) + nivel | **incidencia** (un tema abierto) + **categoría** |
| Cierre de un tema | el cliente confirma | **3 intentos del bot** → asesor |
| Estado final | el último nivel | `estado_conversacional` + `motivo_principal` |

El score arranca en **50**, que significa "no sabemos nada de él", no "cliente
promedio". Baja cuando el cliente trae un problema y sube cuando se le resuelve.

---

## 3. Las tablas: qué leer y qué ignorar

### Se lee

| Tabla | Para qué |
|---|---|
| `clientes` | El maestro de siempre. No cambia |
| `chat_messages` | **Toda** la conversación, entrante y saliente. Ya existía |
| `edu_etapa_cliente` | La etapa del cliente: ventana, score, estado, motivo |
| `edu_incidencia` | Los temas que trajo, su estado y **su derivación adentro** |
| `edu_clasificacion` | Qué se clasificó cada mensaje (para auditar al bot) |
| `edu_score_evento` | El ledger: por qué el score es el que es |
| `edu_estado_actual` (vista) | Todo lo anterior junto, solo etapas en curso. **Empezá por acá** |

### No se toca

- Las tablas `bot_*`: son la historia del piloto v1. Solo lectura histórica.
- `clientes.bot_etapa`: columna de la v1. **La v2 no la lee.**
- `edu_score_evento` y `edu_clasificacion`: son *append-only*. Si hay que
  corregir un score va un evento nuevo con motivo `AJUSTE_MANUAL`, nunca un
  `UPDATE`.

---

## 4. La lista de clientes del asesor

Sale de la vista `edu_estado_actual`, filtrada por asignación y ordenada por
`score_actual` ascendente (los peores primero).

| Columna | Campo |
|---|---|
| Cliente / código / teléfono | `nombre`, `codigo_asociado`, `telefono` |
| Etapa | `etapa` (`PRE` \| `ADM`) |
| Días que quedan | `ventana_fin - CURRENT_DATE` |
| **Score** | `score_actual` |
| **Variación** | `delta_score` (contra el inicio de la etapa) |
| Estado | `estado_conversacional` |
| Motivo | `motivo_principal` |
| Temas abiertos | `n_abiertas` |

### Los colores, que reemplazan a §3.2 de la guía v1

| Score | Lectura | Color |
|---|---|---|
| 0 – 29 | En riesgo: pidió retirarse o tiene un reclamo sin resolver | rojo |
| 30 – 49 | Inconforme: algo le quedó abierto | ámbar |
| 50 – 69 | Neutro o sin señales | gris |
| 70 – 100 | Conforme | verde |

Con una regla que manda sobre el color: **si `motivo_principal = 'retiro'`, va en
rojo siempre**, tenga el score que tenga.

### Los seis estados conversacionales

| Estado | Qué pasó |
|---|---|
| `SIN_INTERACCION` | Nunca contestó |
| `CONFORME` | Contestó y solo acusó recibo |
| `CONFORME_INCIDENCIA_RESUELTA` | Trajo temas y **todos** se cerraron |
| `INCONFORME_CON_DUDA` | Le quedó una pregunta sin resolver |
| `INCONFORME_CON_RECLAMO` | Le quedó un reclamo o un retiro sin resolver |
| `NO_CLASIFICABLE` | Solo mandó saludos o audios |

---

## 5. La ficha del cliente

Con `etapa_cliente_id`. Cuatro bloques:

```sql
-- 1. La conversación completa (ya está toda en chat_messages)
SELECT direction, created_at, text_body, origen, edu_incidencia_id
  FROM chat_messages
 WHERE cliente_id = $cliente_id
 ORDER BY created_at;

-- 2. Qué entendió el bot de cada mensaje suyo
SELECT m.text_body, c.categoria, c.confianza, c.marcas, c.requiere_revision
  FROM chat_messages m JOIN edu_clasificacion c ON c.chat_message_id = m.id
 WHERE m.cliente_id = $cliente_id
 ORDER BY m.created_at;

-- 3. Sus temas y en qué intento va cada uno
SELECT incidencia_id, categoria, estado, intentos_bot, insistencias,
       abierta_en, derivada_en, asesor, resultado
  FROM edu_incidencia
 WHERE etapa_cliente_id = $1
 ORDER BY abierta_en;

-- 4. Por qué el score es el que es
SELECT ocurrido_en, motivo, grupo, puntos, score_antes, score_despues, nota
  FROM edu_score_evento
 WHERE etapa_cliente_id = $1
 ORDER BY evento_id;
```

El bloque 4 es el que más sirve en una discusión con el cliente: muestra el
movimiento exacto y por qué. Así se ve hoy en el cliente de prueba:

```
ARRASTRE_ETAPA         —                 0.00 → 50.00
APERTURA_INCIDENCIA    saludo_media     -2.50 → 47.50
APERTURA_INCIDENCIA    duda             -4.80 → 42.70
INCIDENCIA_RESUELTA    —                 2.40 → 45.10
ACUSE                  sin_necesidad     1.00 → 46.10
APERTURA_INCIDENCIA    reclamo          -6.00 → 40.10
APERTURA_INCIDENCIA    retiro          -13.20 → 26.90
```

---

## 6. La cola de derivaciones

Es la pantalla que más importa: lo que el bot no pudo resolver. En la v2 la
derivación **vive dentro de la incidencia**, no en una tabla aparte.

```sql
SELECT i.incidencia_id, i.categoria, i.intentos_bot, i.derivada_en, i.motivo_derivacion,
       e.etapa_cliente_id, e.etapa, e.score_actual, e.estado_conversacional,
       c.id AS cliente_id, c.nombre, c.telefono, c.codigo_asociado
  FROM edu_incidencia i
  JOIN edu_etapa_cliente e USING (etapa_cliente_id)
  JOIN clientes c ON c.id = e.cliente_id
 WHERE i.derivada_en IS NOT NULL AND i.atendida_en IS NULL
 ORDER BY (i.categoria = 'retiro') DESC, i.derivada_en;
```

**Filtrá por `derivada_en`, no por `estado = 'DERIVADA'`.** Un retiro se manda
al asesor en el momento en que el cliente lo dice, y en ese momento la
incidencia todavía está `ABIERTA` porque el bot sigue conversando con él.
Filtrando por estado, justo los retiros —lo más urgente— no aparecen.

`motivo_derivacion` vale:

| Motivo | Significa |
|---|---|
| `RETIRO` | Pidió retirarse. **Va primero siempre** |
| `CAJA_NEGRA` | Seguros, legal, traspaso o pidió un asesor. Derivó al **primer** intento |
| `TRES_INTENTOS` | El bot lo intentó tres veces y no lo resolvió |

### Qué puede marcar el asesor al cerrar una gestión

Seis resultados. El CRM **no debería hardcodearlos**: `GET /bot/resultados`
devuelve la lista con etiqueta, texto de ayuda y efecto, para armar el
desplegable.

| Resultado | Clave | Qué hace el sistema |
|---|---|---|
| **Resuelta** | `RESUELTA` | Cierra · queda en el ledger, **no mueve el score principal** (ver abajo) |
| **No resuelta** | `NO_RESUELTA` | Cierra · no recupera nada |
| **Seguimiento** | `SEGUIMIENTO` | **Sigue en la bandeja** · exige `agendada_para` y no se muestra hasta esa fecha |
| **No contestó** | `NO_CONTESTO` | **Sigue en la bandeja** · suma un intento de contacto |
| **Retiro** | `RETIRO` | Cierra · **cierra la etapa** con salida `SALIDA_RETIRO` |
| **Número equivocado** | `NUMERO_ERRADO` | Cierra · **pone `clientes.opt_out`**: lo saca del bot |

### Qué significa exactamente "Resuelta"

**"Resuelta" es sobre la INCIDENCIA, no sobre la llamada.** Una incidencia es una
necesidad concreta que el cliente trajo y que el bot no pudo cerrar: una duda de
pagos, un reclamo de que le prometieron el carro en tres meses, una intención de
retiro. Llega al asesor porque el bot la intentó tres veces —o una, si era de
seguros o legal— y no alcanzó.

Marcar `RESUELTA` significa **"hablé con el cliente y su necesidad quedó
atendida"**. No significa "la llamada salió bien" ni "lo pude contactar".

### El asesor NO mueve el score principal

Decisión de producto: **el score mide lo que el bot logró por sí solo.** Una
llamada del asesor no es mérito del bot, así que cerrar un caso a mano no sube
el score.

Pero el hecho **sí queda registrado**: en el ledger aparece un evento
`RESOLUCION_HUMANA` con `puntos = 0` y una nota con lo que habría recuperado.

```
ARRASTRE_ETAPA         —         0.00 → 50.00
APERTURA_INCIDENCIA    duda     -4.80 → 45.20
INCIDENCIA_RESUELTA    —         2.40 → 47.60    ← lo cerró el BOT: sí suma
APERTURA_INCIDENCIA    reclamo  -6.00 → 41.60
RESOLUCION_HUMANA      —         0.00 → 41.60    [el asesor resolvió;
                                                  habría recuperado 3.0]

score principal (solo el bot) : 41.60
si contáramos al asesor       : 44.60
aporte del equipo humano      :  3.00
```

`BotDatos.scores_comparados(etapa_cliente_id)` devuelve los tres números. El
tercero es una métrica que antes no existía: **cuánto recupera el equipo humano
de lo que el bot no pudo**.

Dos consecuencias para la pantalla:

- **El score de un cliente atendido por un asesor no sube.** Si el asesor espera
  verlo mejorar después de resolver, se va a confundir. Conviene que la ficha
  muestre los dos números, o que diga explícitamente que el score es del bot.
- **El estado sí cambia.** La incidencia pasa a `RESUELTA_HUMANO` y la etapa
  puede pasar a `CONFORME_INCIDENCIA_RESUELTA`. O sea: el caso se ve resuelto,
  aunque el score no se mueva.

### Las reglas que la pantalla tiene que respetar

1. **`Seguimiento` y `No contestó` no cierran nada.** El caso sigue en la
   bandeja. Un cliente que no atendió el teléfono no es un caso resuelto.
2. **`No contestó` tiene tope: 4.** Al cuarto, la incidencia se cierra sola como
   `ABANDONADA`. Sin tope, un número que nunca atiende tapa la bandeja para
   siempre. La respuesta trae `intentos_contacto` y `restantes`, para mostrarlo.
3. **`Seguimiento` exige fecha.** Sin `agendada_para` devuelve `400`. Con fecha,
   el caso desaparece de la bandeja hasta que llegue: así la cola muestra lo que
   hay que hacer **hoy**, no todo lo pendiente.
4. **`Retiro` y `Número equivocado` deberían pedir confirmación.** El primero
   cierra la etapa entera; el segundo saca al cliente del bot para siempre.
5. **Un resultado que no esté en la lista se rechaza** con `400` y la lista de
   válidos. El endpoint no adivina.

Campos opcionales: `observaciones` (texto libre, va a
`edu_incidencia.observaciones`) y `agendada_para` (obligatorio en
`SEGUIMIENTO`).

**Lo que NO está y hay que saberlo:** no existe un resultado para "pidió que no
lo contacten más" sin que sea un retiro ni un número equivocado. Si aparece el
caso, hoy se resuelve marcando `clientes.opt_out` desde la ficha del cliente,
como una acción aparte y no como resultado de una llamada.

## 7. Cómo habla el CRM con el bot

Reemplaza a §4.6 de la guía v1. Servicio `sayasend-bot` (el Cloud Run de
`sayasent`), cabecera `X-Bot-Secret`.

| Acción | Llamada |
|---|---|
| Ver los resultados que puede marcar el asesor | `GET /bot/resultados` |
| Cerrar una gestión | `POST /bot/derivacion/<incidencia_id>` · `{"resultado":"RESUELTA","asesor":"<email>","observaciones":"..."}` |
| Tomar la conversación (callar al bot) | `POST /bot/pausa/<etapa_cliente_id>` · `{"horas":24}` |
| Dar de alta a un cliente en el bot | `POST /bot/etapa` · `{"cliente_id":"<uuid>","etapa":"ADM"}` |
| Estado del servicio | `GET /bot/health` |

Los identificadores son **bigint**, no uuid. Es el cambio que rompe las
foráneas actuales de `crm_asignacion`, `crm_acciones` y
`crm_asignacion_historial` — ver §9.

---

## 7 bis. Los crons del bot

Solo dos. El bot ya no manda nada programado: eso lo hacen las campañas.

| Cron | Qué hace | Cada cuánto |
|---|---|---|
| `POST /bot/cron/incidencias?horas=48` | Las incidencias mudas por más de 48 h pasan a `ABANDONADA`. **Sin esto el contador de intentos no avanza y nada se deriva nunca** | 1 vez por hora |
| `POST /bot/cron/ventanas` | Cierra las etapas cuya ventana venció y consolida el estado final | 1 vez por día, temprano |

Ya está hecho en Cloud Scheduler (`us-west4`, zona horaria América/Bogotá). Los
5 jobs de la v1 (`transicion`, `timers`, `vincular`, `corte`, `promesas`) se
borraron, y los dos nuevos quedaron **PAUSADOS**:

```
sayasend-bot-incidencias  |  0 * * * *    |  PAUSED
sayasend-bot-ventanas     |  15 6 * * *   |  PAUSED
```

**Hay que reanudarlos en el despliegue de la v2**, no antes: el servicio que
está arriba todavía es la v1 y los endpoints no existen.

---

## 8. Quién habla con el bot

En la v1 alcanzaba con marcar `clientes.bot_etapa`. **En la v2 no.** El bot
responde solo si se dan las cuatro condiciones:

1. el teléfono cruza por los últimos 10 dígitos con `clientes.telefono`
2. el cliente tiene fila en `edu_etapa_cliente`
3. esa etapa está en `estado_etapa = 'EN_CURSO'`
4. `clientes.opt_out = false`

Si falla cualquiera, el webhook registra el mensaje y no pasa nada más. Hoy hay
**una sola etapa abierta** en toda la base, la del número de prueba.

Para dar de alta a alguien hay que **abrir la etapa** (`POST /bot/etapa`), que
además calcula la ventana de días hábiles. No hay forma de que se active solo.

Tres frenos, de mayor a menor alcance:

| Freno | Alcance | Cómo |
|---|---|---|
| `clientes.opt_out` | el cliente, para siempre | corta respuestas y campañas |
| `edu_etapa_cliente.bot_pausado_hasta` | una conversación | `POST /bot/pausa/<id>` |
| `estado_etapa = 'CERRADA'` | la etapa | el cron de ventanas |

---

## 9. La migración de las tablas `crm_*`

Las tres tablas de gestión tienen foráneas **a las tablas de la v1**, que ya no
se alimentan:

```
crm_asignacion.etapa_id            → bot_cliente_etapa.id        (uuid)
crm_acciones.etapa_id              → bot_cliente_etapa.id        (uuid)
crm_acciones.derivacion_id         → bot_derivacion_humana.id    (uuid)
crm_asignacion_historial.etapa_id  → bot_cliente_etapa.id        (uuid)
crm_asignacion_historial.derivacion_id → bot_derivacion_humana.id (uuid)
```

La v2 usa `bigint` como clave primaria. Para **no cambiarle el contrato al CRM**
(que el login y la asignación sigan hablando en uuid), las tablas de la v2 ya
tienen un uuid propio, **ya aplicado en la base**:

- `edu_etapa_cliente.etapa_uuid`
- `edu_incidencia.incidencia_uuid`

Falta repuntar las foráneas. Nombres verificados contra la base el 23/09/2026:

```sql
SET search_path TO sayasend;

-- La única fila apunta a una etapa de prueba de la v1 y violaría la nueva FK.
DELETE FROM crm_asignacion;

ALTER TABLE crm_asignacion
  DROP CONSTRAINT crm_asignacion_etapa_id_fkey;
ALTER TABLE crm_acciones
  DROP CONSTRAINT crm_acciones_etapa_id_fkey,
  DROP CONSTRAINT crm_acciones_derivacion_id_fkey;
ALTER TABLE crm_asignacion_historial
  DROP CONSTRAINT crm_asignacion_historial_etapa_id_fkey,
  DROP CONSTRAINT crm_asignacion_historial_derivacion_id_fkey;

ALTER TABLE crm_asignacion
  ADD CONSTRAINT fk_asig_etapa FOREIGN KEY (etapa_id)
      REFERENCES edu_etapa_cliente (etapa_uuid) ON DELETE CASCADE;
ALTER TABLE crm_acciones
  ADD CONSTRAINT fk_acc_etapa FOREIGN KEY (etapa_id)
      REFERENCES edu_etapa_cliente (etapa_uuid) ON DELETE CASCADE,
  ADD CONSTRAINT fk_acc_inc   FOREIGN KEY (derivacion_id)
      REFERENCES edu_incidencia (incidencia_uuid) ON DELETE SET NULL;
ALTER TABLE crm_asignacion_historial
  ADD CONSTRAINT fk_hist_etapa FOREIGN KEY (etapa_id)
      REFERENCES edu_etapa_cliente (etapa_uuid) ON DELETE CASCADE,
  ADD CONSTRAINT fk_hist_inc   FOREIGN KEY (derivacion_id)
      REFERENCES edu_incidencia (incidencia_uuid) ON DELETE SET NULL;
```

`crm_acciones.derivacion_id` pasa a apuntar a la **incidencia**, porque la
derivación ya no es una tabla aparte. Conviene renombrarla a `incidencia_id`
cuando se toque el código.

---

## 10. Trampas, actualizadas

Las de la guía v1 que **siguen valiendo**: el middleware no puede bloquear
`/api/cron/*`, disco de Cloud Shell, Prisma 5 y no 7, cruce por últimos 10
dígitos, una persona con varios contratos, clientes de prueba.

Las que **cambian**:

- **§6.8 ya no aplica, y hay más de lo que decía.** En la v1 la fila de etapa
  *cambiaba* al pasar de Pre-Admisión a Admisión. En la v2 **conviven todas**, y
  Admisión además es un **ciclo mensual**: un cliente que lleva un año en
  Admisión tiene una fila por mes. La clave es
  `UNIQUE (cliente_id, etapa, ciclo)`, con `ciclo = YYYYMM` del inicio de la
  ventana. Solo una puede estar `EN_CURSO` a la vez (índice parcial único).
  **La lista del asesor usa la vista, que ya filtra por `EN_CURSO`**; para el
  histórico de un cliente hay que leer todas sus filas ordenadas por
  `ventana_inicio`.

- **El score no se reinicia nunca** (§1.1 de la especificación). Cada etapa
  arranca donde cerró la anterior, con un evento `ARRASTRE_ETAPA` de 0 puntos
  que lo deja explícito en el ledger:

  ```
  PRE  ciclo 202609   50.00 → 40.00
  ADM  ciclo 202610   40.00 → 34.00     ← arranca donde cerró Pre
  ADM  ciclo 202611   34.00 → 29.20     ← y el mes siguiente donde cerró el anterior
  ```

  Para la ficha del cliente esto importa: el score de hoy solo se entiende con
  el recorrido completo, no con la etapa en curso.
- **Los envíos salientes los siguen haciendo las campañas del CRM**, no el bot.
  El bot solo responde dentro de la conversación. El cron del journey existe
  pero está apagado (`BOT_IMPACTOS_ACTIVOS`), justamente para que un cliente no
  reciba la campaña y el mensaje del bot el mismo día.
- **La etapa se decide por fechas.** `fecha_1ra_asamblea > hoy` → Pre-Admisión;
  ya pasó → Admisión. Hoy: 8.147 clientes en Admisión, 2 en Pre, 1.132 sin fecha
  (esos no se pueden dar de alta hasta que tengan `fecha_inscripcion` y
  `fecha_1ra_asamblea`).

---

## 11. Preguntas abiertas

1. **¿El asesor puede corregir una clasificación del bot?** `edu_clasificacion`
   tiene `requiere_revision` para las de baja confianza. Si se quiere corregir,
   va una fila nueva, no un `UPDATE`.
2. **¿Un cliente con dos contratos (varios `codigo_asociado`) es un caso o dos?**
   Hoy es **uno**: un WhatsApp es una persona. 683 de 9.078 filas tienen varios
   códigos separados por coma.
3. **PENDIENTE DE DECIDIR — ¿quién abre las etapas?** Ver §13. Es lo único que
   bloquea el arranque del piloto.
4. **PENDIENTE DE DECIDIR — ¿por contrato o por persona?** Ver §14. Hoy es por
   persona porque los datos no permiten otra cosa.


---

## 12. El modelo son cinco tablas, no veinte

El primer diseño del bot v2 recreaba cosas que `sayasend` ya tenía. Se eliminaron
catorce tablas. Lo que hay que saber para el CRM:

| Ya existía y se usa | En vez de |
|---|---|
| `chat_messages` | `edu_entrante` + `edu_saliente` — el bot guardaba cada mensaje **dos veces** |
| `templates` (90 aprobadas en Meta) | `edu_plantilla` |
| `campaigns` (ya trae `etapa_bot`, `journey_paso`) | `edu_impacto` + `edu_journey_config` |
| `edu_incidencia` con la derivación adentro | `edu_derivacion` + `edu_intento` + `edu_alerta` |
| `bot_taxonomia.py` / `bot_score.py` / `bot_calendario.py` | `edu_cat_categoria` + `edu_score_peso` + `edu_dia_habil` |
| La fila de la etapa, ya cerrada | `edu_cierre_etapa` |

Consecuencia práctica para la pantalla: **la conversación completa está en
`chat_messages`**, con `edu_etapa_id` y `edu_incidencia_id` para filtrar. No hay
que ir a buscarla a ninguna tabla del bot.


---

## 13. PENDIENTE — cómo se dan de alta los clientes en el bot

**Sin resolver esto el bot no le habla a nadie.** Es lo único que falta para
arrancar el piloto.

### Qué significa "dar de alta"

Crear la fila en `edu_etapa_cliente` (`POST /bot/etapa` con el `cliente_id`).
Esa fila **es** la compuerta: si no existe, el webhook registra el mensaje del
cliente y el bot no contesta.

No es solo prender un flag. Al abrirla se calcula todo el contexto de la etapa:

```
cliente: JESSICA · 1ra asamblea 2023-12-11
  etapa deducida : ADM                          ← de fecha_1ra_asamblea vs hoy
  ventana        : 2026-09-08 → 2026-10-07      ← días hábiles (Ley Emiliani)
  score_inicio   : 50.00                        ← o el score con que cerró PRE
  thread_id      : be2-adm-3246663497           ← memoria del agente
```

Más un evento `ARRASTRE_ETAPA` en el ledger, para que el punto de partida quede
explícito.

`etapa` es opcional en la llamada: si no se manda, se deduce de
`fecha_inscripcion` y `fecha_1ra_asamblea`. Si al cliente le falta alguna de las
dos, la llamada devuelve error en vez de adivinar.

### El estado hoy (23/09/2026)

| | |
|---|---|
| Clientes en la base | 9.281 |
| Sin `fecha_inscripcion` / `fecha_1ra_asamblea` | 1.132 — **no se pueden dar de alta** |
| En opt-out | 2 |
| **Elegibles** | **8.147**, todos irían a `ADM` |
| **Etapas abiertas** | **1** (el número de prueba) |

### Las dos opciones

**A. Atado a la campaña.** `campaigns` ya trae las columnas `etapa_bot`,
`journey_paso` y `bot_vinculada_at` — hechas para esto, y con 640 campañas y
**0 vinculadas**. Al enviar una campaña marcada con `etapa_bot`, se abre la
etapa de cada contacto que la recibió.

- A favor: usa infraestructura que ya existe; la audiencia de la campaña define
  quién entra, así que se puede arrancar con 50 y crecer; el cliente recibe el
  primer mensaje y queda habilitado para responder en el mismo acto.
- En contra: hay que tocar el CRM (el envío de campañas).

**B. Script de alta masiva.** Recibe una lista de `codigo_asociado` y abre las
etapas. Con un `--limite` para arrancar chico.

- A favor: no toca el CRM; se puede correr hoy.
- En contra: hay que mantener la lista aparte, y es fácil habilitar 8.147
  conversaciones de una sola vez sin querer.

### Lo que hay que tener en cuenta al decidir

- **Dar de alta a alguien lo habilita a conversar, no le manda nada.** El bot
  solo responde; los mensajes salientes los siguen haciendo las campañas.
- **Los 1.132 sin fechas quedan afuera** hasta que alguien les cargue
  `fecha_inscripcion` y `fecha_1ra_asamblea`. Conviene ver de dónde salen esas
  fechas antes de prometer cobertura total.
- **La ventana de Admisión es la del ciclo vigente, no la de la primera
  asamblea.** 1.677 de los 8.147 tuvieron su primera asamblea en 2023, 2024 o
  2025; calcularles la ventana desde esa fecha daba una ventana ya vencida y el
  cron se la cerraba al instante. Ya está corregido
  (`bot_calendario.ventana_adm_vigente`), pero explica por qué el alta no puede
  ser un simple `INSERT`: tiene que pasar por `POST /bot/etapa`.
- **Se puede deshacer.** Cerrar la etapa (`estado_etapa='CERRADA'`) o marcar
  `clientes.opt_out` saca al cliente del bot sin borrar nada.


---

## 14. PENDIENTE — ¿por contrato o por persona?

**Hoy el modelo es por PERSONA, no por contrato.** Hay que decidirlo, pero antes
hay que resolver un problema de datos.

### Lo que dice la base hoy

`clientes` **no tiene una fila por contrato**: tiene una fila por persona, con
los contratos colapsados en una celda.

| | |
|---|---|
| Filas en `clientes` | 9.281 |
| Filas con **varios códigos separados por coma** | **686** (de 2 a 7 contratos) |
| Teléfonos con más de una fila | 4, y son datos de prueba |
| Tablas con nivel de contrato en todo el schema | **ninguna** |

Un ejemplo real:

```
códigos     : 30617303, 30616802, 30617203, 30616502, 30616403, 30617002
nombre      : ELEUTERIO
monto       : 5.775.600,06          ← sumado
inscripción : 2026-03-02   1ra asamblea: 2026-03-09   ← UNA sola de cada una
frente      : Fidelizacion          ← UNA sola etapa
```

O sea: **seis contratos, un monto sumado, una fecha de inscripción, una fecha de
asamblea y un `frente`.** La base, tal como está, no puede expresar "este
contrato en Admisión y este otro en Fidelización": no hay fechas por contrato ni
`frente` por contrato. De los 686 con varios contratos, 174 están en
Fidelización, 151 en M3, 107 en Admisión — pero **es un `frente` por persona**,
no por contrato.

Por eso el bot abre la etapa por persona. No es una decisión de diseño que tomé
mirando alternativas: es lo único que los datos permiten hoy.

Lo que sí quedó hecho: cada etapa guarda en `edu_etapa_cliente.codigos` el
arreglo de contratos que cubre, para que el alcance esté documentado y la
migración sea posible.

```
cliente con códigos: 31110902,33513601
etapa cubre        : ['31110902', '33513601']
```

### Lo que hay que decidir

**A. Seguir por persona.** Una etapa, un score, una conversación.
- A favor: es lo que los datos permiten; una persona tiene un solo WhatsApp y
  una sola conversación.
- En contra: el score mezcla contratos. Si alguien tiene un contrato al día y
  otro con problemas, el score no distingue cuál.

**B. Pasar a por contrato.** Una etapa por contrato.
- Requiere primero: que BigQuery entregue `fecha_inscripcion`,
  `fecha_1ra_asamblea` y `frente` **por contrato**, y que `clientes` deje de
  colapsarlos (o que haya una tabla de contratos aparte).
- Y además hay que resolver algo que no es de datos sino de conversación: **una
  persona tiene un solo WhatsApp**. Si escribe "¿cuándo es mi asamblea?" y tiene
  un contrato en Admisión y otro en Fidelización, ¿de cuál habla? Alguien tiene
  que definir si el bot pregunta, si asume el más reciente, o si responde por
  todos.

### Recomendación

Arrancar el piloto **por persona** —no hay alternativa con los datos actuales— y
poner en la agenda la pregunta a quien mantiene el ETL de BigQuery: *¿existe el
dato por contrato en el origen, o también viene agregado?* La respuesta decide
si B es siquiera posible.

Mientras tanto, para el asesor: **`edu_etapa_cliente.codigos` dice exactamente
qué contratos cubre lo que está viendo**, y conviene mostrarlo en la ficha para
que no crea que el score es de un solo contrato.

---

## 15. Estado de la implementación en el CRM (23/09/2026)

El CRM ya está migrado a la v2. Login, roles, `proxy.ts`, usuarios y asignación
siguen como los dejó la v1 (§4.2, §4.3 de la guía anterior); lo que se reescribió
es todo lo que tocaba el modelo del bot.

**Base de datos (§9 aplicada):** las foráneas de `crm_asignacion`,
`crm_acciones` y `crm_asignacion_historial` apuntan ahora a
`edu_etapa_cliente.etapa_uuid` y `edu_incidencia.incidencia_uuid`, y la columna
`derivacion_id` se llama `incidencia_id`. SQL en
`prisma/crm-v2-foraneas-edu.sql`. La única fila de `crm_asignacion` (de prueba)
se borró, como indicaba el documento.

**Qué ve el asesor ahora:**

| Pantalla | Qué muestra |
|---|---|
| `/asesor` — Tareas | **Centro de tareas**: contadores (total, pendientes, completadas, efectividad) y una caja por `edu_incidencia.tipo` — Retiro, Reclamo, Caja negra, Pregunta — con pendientes, completadas y progreso. Cada caja filtra la lista de abajo. La lista son los temas derivados (`derivada_en IS NOT NULL`), retiros primero, con pestañas Pendientes / Agendadas / Completadas. Un `SEGUIMIENTO` agendado no aparece hasta su fecha |
| `/asesor/clientes` — Clientes | La vista `edu_estado_actual` filtrada por asignación. Columnas: cliente, etapa, ventana y días restantes, score + variación, estado conversacional, motivo, temas abiertos, gestión del asesor, última respuesta |
| Panel lateral (3 botones por fila) | Detalle · Conversación · Gestiones, sin salir de la lista |
| Ficha completa | Los mismos bloques a página entera, con la conversación al lado |

El detalle trae: datos del cliente, contratos que cubre la etapa, etapa en curso
con su ventana, score con su variación, estado y motivo, los temas con sus
intentos, **el ledger del score** (`edu_score_evento`) y el recorrido de etapas
del cliente. La conversación sale de `chat_messages` y muestra, bajo cada
mensaje del cliente, **qué entendió el bot** (`edu_clasificacion`: categoría,
confianza y la marca de revisión).

**Lo que el asesor puede hacer:** marcar el resultado de un tema derivado
(`POST /bot/derivacion/<incidencia_id>`), tomar la conversación 24 h
(`POST /bot/pausa/<etapa_cliente_id>`), registrar una gestión en el CRM
(`crm_acciones`) y responder por WhatsApp dentro de la ventana de 24 h.

Detalles que respeta la pantalla, de §6:

- Los seis resultados **no están hardcodeados**: salen de `GET /bot/resultados`
  (proxy en `/api/bot/resultados`). Si el bot no responde, el diálogo lo dice en
  vez de inventar la lista.
- `SEGUIMIENTO` exige fecha; sin ella el botón queda deshabilitado.
- `NO_CONTESTO` muestra cuántos intentos van y cuántos quedan para los 4.
- `RETIRO` y `NUMERO_ERRADO` piden una confirmación explícita.
- En la ficha y en los filtros se dice que **el score es del bot**: una gestión
  del asesor no lo sube.

**Mapa del código v2:**

| Qué | Dónde |
|---|---|
| Consultas (vista, incidencias, ledger, clasificación, métricas) | `lib/bot/queries.ts` |
| Etiquetas, rangos de score y reglas de la pantalla | `lib/bot/constants.ts` |
| Llamadas al bot (`X-Bot-Secret`) | `lib/bot/bot-api.ts` |
| Rutas de API del CRM | `app/api/bot/` (clientes, incidencias, resultados) |
| Pantallas del asesor | `app/asesor/` |
| Pantallas del admin | `app/bot/`, `app/usuarios/` |

**Lo que se eliminó del CRM:** la cola de `bot_derivacion_humana`, la ficha con
acompañamiento y casos, la pantalla de carga de códigos (`/bot/codigos`) y el
botón de renuncia en 1.ª asamblea. Las tablas `bot_*` quedan como historia.

**Sin probar contra el bot real:** no hay `BOT_SECRET` en el entorno local, así
que marcar un resultado, pausar el bot y `GET /bot/resultados` están escritos
contra el contrato de §6 y §7 pero nunca se ejecutaron. Probarlos con el primer
tema derivado real.

**Los resultados del CRM usan las claves de §6.** `crm_acciones.resultado`
pasó de las claves de la v1 (`CONTACTADO`, `NO_CONTESTA`, `RESUELTO`…) a las
seis de la v2: `RESUELTA`, `NO_RESUELTA`, `SEGUIMIENTO`, `NO_CONTESTO`,
`RETIRO`, `NUMERO_ERRADO` (SQL en `prisma/crm-acciones-resultados-v2.sql`).
Siguen siendo dos cosas distintas: **registrar una gestión queda solo en el CRM
y no le avisa al bot**; cerrar el tema es la otra acción, la que llama a
`POST /bot/derivacion/<incidencia_id>` con la lista que devuelve
`GET /bot/resultados`.

**Una tarea = una incidencia derivada.** No se creó ninguna tabla nueva: los
contadores salen de `edu_incidencia` (pendiente = `atendida_en IS NULL` y sin
agendar a futuro; completada = `atendida_en IS NOT NULL`; efectividad =
completadas / total). `tipo` lo calcula Postgres desde `categoria`, y un valor
inesperado cae en una caja "Otros" en vez de perderse.

**Bloqueado por §13:** el alta de clientes en el bot (`POST /bot/etapa`) no está
en el CRM porque falta decidir si se hace desde la campaña o con un script. Si
se elige la opción A, el cambio va en el envío de campañas del CRM.
