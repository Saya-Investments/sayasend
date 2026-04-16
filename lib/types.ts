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
  codigoAsociado: string
  nombre: string
  telefono: string
  segmento: string
  monto: number
  fechaUltimoPago: Date
}

export interface Campaign {
  id: string
  name: string
  templateId: string
  databaseName: string
  sendMode: 'M0' | 'M1'
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
