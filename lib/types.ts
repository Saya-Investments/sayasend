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
  nombre: string
  telefono: string
  monto: number
  fechaAsamblea?: string | Date | null
  fechaVencimiento?: string | Date | null
  mes?: string
  fecUltPagCcap?: string | Date | null
  fechaUltimoPago: string | Date | null
}

export interface Campaign {
  id: string
  name: string
  templateId: string | null
  databaseName: string
  sendMode?: 'M0' | 'M1' | null
  segmentFilters: {
    segmento?: string
    estrategia?: string
  }
  variableMappings: {
    [variablePlaceholder: string]: string
  }
  totalContacts: number
  createdAt: Date
  status: 'draft' | 'scheduled' | 'sending' | 'completed'
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

export interface CreateCampaignPayload {
  name: string
  templateId?: string | null
  databaseName: string
  segmentFilters: {
    segmento?: string
    estrategia?: string
  }
  variableMappings: {
    [variablePlaceholder: string]: string
  }
  contacts: CampaignContact[]
}
