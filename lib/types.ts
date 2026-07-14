export interface Variable {
  id: string
  name: string
  placeholder: string
  type: 'text' | 'number' | 'date'
}

export interface Template {
  id: string
  name: string
  description: string
  content: string
  variables: Variable[]
  createdAt: Date
  updatedAt: Date
}

export interface CampaignContact {
  [key: string]: unknown
  codigoAsociado: string
  numDoc: string
  probabilidadPago?: number
  segmento: string
  gestion?: string
  frente?: string | null
  nombre: string
  telefono: string
  monto: number
  monto1?: number | null
  monto2?: number | null
  monto3?: number | null
  ctaActPag?: number | null
  fechaAsamblea?: string | Date | null
  fechaVencimiento?: string | Date | null
  mes?: string
  fecUltPagCcap?: string | Date | null
  fechaUltimoPago: string | Date | null
  mesPasado?: string | null
  fechaVencimientoPasado?: string | Date | null
}

export interface Campaign {
  id: string
  name: string
  templateId: string | null
  databaseName: string
  sendMode?: 'M0' | 'M1' | null
  segmentFilters: {
    segmento?: string | string[]
    estrategia?: string | string[]
    frente?: string | string[]
  }
  variableMappings: {
    [variablePlaceholder: string]: string
  }
  totalContacts: number
  createdAt: Date
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed'
}

export interface ContactabilityMetrics {
  total: number
  sent: number
  delivered: number
  read: number
  failed: number
  deliveryRate: number
  readRate: number
  failureRate: number
}

export interface CampaignDetail extends Campaign {
  template: Template
  contacts: CampaignContact[]
  metrics: ContactabilityMetrics
}

export interface BigQueryDatabase {
  id: string
  name: string
}

export interface BigQueryColumn {
  name: string
  type: string
}

export interface BigQueryContactsPayload {
  columns: BigQueryColumn[]
  contacts: CampaignContact[]
}

export type CampaignSource = 'bigquery' | 'excel'

export type GestionType = 'gestion_m0' | 'gestion_cobranza'

export interface CreateCampaignPayload {
  name: string
  templateId?: string | null
  source?: CampaignSource
  databaseName: string
  segmentFilters: {
    segmento?: string | string[]
    estrategia?: string | string[]
    frente?: string | string[]
  }
  variableMappings: {
    [variablePlaceholder: string]: string
  }
  contacts: CampaignContact[]
  // Tipo de gestión usado al consultar BigQuery — se persiste para poder
  // reconstruir la consulta el día del envío cuando refreshOnSend es true.
  gestionType?: GestionType
  // "Usar base actualizada del día de envío": si es true, el scheduler
  // re-consulta BigQuery el día del envío en vez de usar la foto de creación.
  refreshOnSend?: boolean
}
