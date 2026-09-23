# CORS del bucket de GCS (necesario para headers de video)

El video de header de una plantilla puede pesar hasta 16MB, y Vercel corta el
body de cualquier route handler en 4.5MB. Por eso el archivo **no** viaja por el
backend: el navegador lo sube directo a Google Cloud Storage con una signed URL
(`POST /api/templates/media/upload-url` → `PUT` a la URL firmada).

Ese `PUT` es cross-origin, así que el bucket tiene que tener CORS habilitado.
Sin esto, la subida falla con un error de red y el diálogo muestra
"Falló la subida a Cloud Storage".

## Configurar

Guardar como `cors.json` (reemplazando los orígenes por los reales):

```json
[
  {
    "origin": [
      "https://sayasend.vercel.app",
      "http://localhost:3000"
    ],
    "method": ["PUT", "GET", "HEAD"],
    "responseHeader": ["Content-Type", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
```

Y aplicarlo:

```bash
gcloud storage buckets update gs://$GCS_BUCKET_NAME --cors-file=cors.json
```

Para verificar:

```bash
gcloud storage buckets describe gs://$GCS_BUCKET_NAME --format="default(cors_config)"
```

## Permisos del service account

`GCS_SERVICE_ACCOUNT_KEY` ya se usa para subir objetos, pero firmar URLs v4
necesita además el rol **Service Account Token Creator** (o que la key sea una
clave privada JSON completa, que es el caso actual — con `private_key` en el
JSON la firma se hace local y no hace falta el rol extra).
