import type { Campaign, CampaignContact, ContactabilityMetrics, Template } from './types'

export const mockTemplates: Template[] = [
  {
    id: '1',
    name: 'Premio PD Baja',
    description: 'Template for PD Baja promotional campaign',
    content:
      'Hola {{1}}, con tu pago puntual de {{2}} avanzas y puedes entrar a la Ruleta Ganadora con premios cada mes. Podemos ayudarte con recordatorios para que no se te pase. Codigo: {{3}}, te animas a girar la ruleta este mes? Si o no',
    variables: [
      { id: '1', name: 'Nombre', placeholder: '{{1}}', type: 'text' },
      { id: '2', name: 'Monto', placeholder: '{{2}}', type: 'number' },
      { id: '3', name: 'Codigo Asociado', placeholder: '{{3}}', type: 'text' },
    ],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Recordatorio de Pago',
    description: 'Payment reminder template',
    content:
      'Hola {{1}}, te recordamos que tu pago de {{2}} esta por vencer. Ingresa ahora a tu cuenta para realizarlo.',
    variables: [
      { id: '1', name: 'Nombre', placeholder: '{{1}}', type: 'text' },
      { id: '2', name: 'Monto', placeholder: '{{2}}', type: 'number' },
    ],
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
  },
  {
    id: '3',
    name: 'Felicitaciones',
    description: 'Congratulations template',
    content:
      'Felicitaciones {{1}}! Has completado {{2}} transacciones exitosas. Sigue asi y desbloquea beneficios exclusivos.',
    variables: [
      { id: '1', name: 'Nombre', placeholder: '{{1}}', type: 'text' },
      { id: '2', name: 'Numero de Transacciones', placeholder: '{{2}}', type: 'number' },
    ],
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05'),
  },
]

export const mockContacts: CampaignContact[] = [
  {
    codigoAsociado: 'AS001',
    numDoc: '10000001',
    probabilidadPago: 82,
    segmento: 'ALTA',
    gestion: 'RETADOR',
    nombre: 'Juan Garcia',
    telefono: '3001234567',
    monto: 150000,
    fechaAsamblea: new Date('2026-04-01'),
    fechaVencimiento: new Date('2026-04-30'),
    mes: '202604',
    fecUltPagCcap: new Date('2026-03-10'),
    fechaUltimoPago: new Date('2026-03-10'),
  },
  {
    codigoAsociado: 'AS002',
    numDoc: '10000002',
    probabilidadPago: 65,
    segmento: 'MEDIA',
    gestion: 'CONVENCIONAL',
    nombre: 'Maria Lopez',
    telefono: '3017654321',
    monto: 75000,
    fechaAsamblea: new Date('2026-04-01'),
    fechaVencimiento: new Date('2026-04-30'),
    mes: '202604',
    fecUltPagCcap: new Date('2026-03-08'),
    fechaUltimoPago: new Date('2026-03-08'),
  },
  {
    codigoAsociado: 'AS003',
    numDoc: '10000003',
    probabilidadPago: 41,
    segmento: 'BAJA',
    gestion: 'RETADOR',
    nombre: 'Carlos Rodriguez',
    telefono: '3009876543',
    monto: 200000,
    fechaAsamblea: new Date('2026-04-01'),
    fechaVencimiento: new Date('2026-04-30'),
    mes: '202604',
    fecUltPagCcap: new Date('2026-03-12'),
    fechaUltimoPago: new Date('2026-03-12'),
  },
]

export const mockCampaigns: Campaign[] = [
  {
    id: '1',
    name: 'Campana Premio PD Baja - Marzo',
    templateId: '1',
    databaseName: 'clientes_pdb',
    sendMode: 'M0',
    segmentFilters: {
      segmento: 'ALTA',
      estrategia: 'RETADOR',
    },
    variableMappings: {
      '{{1}}': 'nombre',
      '{{2}}': 'monto',
      '{{3}}': 'codigoAsociado',
    },
    totalContacts: 45,
    createdAt: new Date('2024-03-10'),
    status: 'completed',
  },
  {
    id: '2',
    name: 'Recordatorio de Pago - Activos',
    templateId: '2',
    databaseName: 'clientes_activos',
    sendMode: 'M1',
    segmentFilters: {
      segmento: 'MEDIA',
      estrategia: 'CONVENCIONAL',
    },
    variableMappings: {
      '{{1}}': 'nombre',
      '{{2}}': 'monto',
    },
    totalContacts: 120,
    createdAt: new Date('2024-03-08'),
    status: 'sending',
  },
]

export const mockMetrics: ContactabilityMetrics = {
  total: 351,
  sent: 351,
  delivered: 45,
  read: 197,
  failed: 95,
  deliveryRate: 12.8,
  readRate: 56.1,
  failureRate: 27.1,
}
