# `fecha_asamblea` — por qué aparece el "GMT 00:00:00" y qué ajustar al extraer

## TL;DR

- En la base de datos **no** se guarda hora: la columna `fecha_asamblea` es `DATE` puro (ver [database/sayasend_schema.sql:17](../database/sayasend_schema.sql#L17) y [prisma/schema.prisma:20](../prisma/schema.prisma#L20)).
- El `T00:00:00.000Z` / `GMT 00:00:00` que se ve en APIs, CSV o logs proviene de serializar el objeto `Date` de JavaScript al **leer** el valor — no del almacenamiento.
- Si al extraer la data queremos mostrar solo `YYYY-MM-DD`, hay que cambiar el **formateo de lectura**, no la escritura.

## Por qué pasa

Prisma mapea `DateTime? @db.Date` a un objeto `Date` de JS cuando lee la columna. Ese `Date` siempre trae hora (00:00:00 UTC por convención para fechas puras). Al pasar por `JSON.stringify` o `Date.prototype.toISOString()` el resultado queda como `"2026-05-10T00:00:00.000Z"`, aunque en Postgres esté guardado solo `2026-05-10`.

Confirmación rápida en la DB:

```sql
SELECT fecha_asamblea, pg_typeof(fecha_asamblea)
FROM sayasend.clientes
LIMIT 1;
-- fecha_asamblea | pg_typeof
-- 2026-05-10     | date
```

## Qué cambiar al extraer la data

El único sitio donde hoy se serializa y se "cuela" el `T00:00:00.000Z` en un output es el **export CSV**.

### [app/api/campaigns/\[id\]/export/route.ts](../app/api/campaigns/[id]/export/route.ts)

Hoy:

```ts
function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = value instanceof Date ? value.toISOString() : String(value)
  // ...
}

function formatDate(value: Date | null | undefined): string {
  return value ? value.toISOString() : ''
}
```

Problema: `toISOString()` siempre devuelve el timestamp completo en UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).

Propuesta — separar fechas puras (`@db.Date`) de timestamps con hora real (`sentAt`, `deliveredAt`, etc.):

```ts
// Para columnas @db.Date (fechaAsamblea, fechaVencimiento, fecUltPagCcap)
function formatDateOnly(value: Date | null | undefined): string {
  if (!value) return ''
  // El Date viene como UTC midnight; tomar la parte YYYY-MM-DD en UTC
  // para que coincida con lo que está en Postgres, sin corrimiento de TZ.
  return value.toISOString().slice(0, 10)
}

// Para timestamps reales (sentAt, deliveredAt, etc.) — dejar ISO completo
function formatTimestamp(value: Date | null | undefined): string {
  return value ? value.toISOString() : ''
}
```

Y aplicarlo según el tipo de columna en la fila del CSV:

```ts
return [
  // ...
  formatDateOnly(c.fechaAsamblea),
  formatDateOnly(c.fechaVencimiento),
  formatDateOnly(c.fecUltPagCcap),
  // ...
  formatTimestamp(cc.sentAt),
  formatTimestamp(cc.deliveredAt),
  // ...
]
```

> **Cuidado con `toLocaleDateString()` en el backend**: depende del timezone del server y puede shiftear el día (por ejemplo, UTC midnight + server en `America/Bogota` → muestra el día anterior). Usar siempre `.toISOString().slice(0, 10)` para fechas puras.

### Otros puntos a revisar si se agregan exports/APIs nuevos

- Cualquier endpoint que retorne `fechaAsamblea`, `fechaVencimiento` o `fecUltPagCcap` por JSON: Next.js por defecto serializa `Date` con `toJSON()` → ISO completo. Si el consumidor necesita solo `YYYY-MM-DD`, convertir antes de responder.
- El componente [components/campaigns/campaign-form.tsx:57-70](../components/campaigns/campaign-form.tsx#L57-L70) ya maneja bien los strings `YYYY-MM-DD` para render — no requiere cambios.

## Qué ya está hecho en la escritura

En [app/api/campaigns/route.ts:13-26](../app/api/campaigns/route.ts#L13-L26) `toNullableDate` parsea strings `YYYY-MM-DD` con `Date.UTC(...)` para evitar que el timezone del server recorra la fecha un día al insertar. Esto **no cambia** cómo se ve el valor al leer (sigue siendo un `Date` JS), pero garantiza que lo guardado en Postgres sea exactamente el día que entró.
