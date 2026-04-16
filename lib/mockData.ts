import type { Template, Campaign, CampaignContact, ContactabilityMetrics } from './types'

export const mockTemplates: Template[] = [
  {
    id: '1',
    name: 'Premio PD Baja',
    description: 'Template for PD Baja promotional campaign',
    content: 'Hola {{1}}, con tu pago puntual de {{2}} avanzas y puedes entrar a la Ruleta Ganadora con premios cada mes. Podemos ayudarte con recordatorios para que no se te pase. Código: {{3}}, ¿Te animas a girar la ruleta este mes? Si o no',
    variables: [
      { id: '1', name: 'Nombre', placeholder: '{{1}}', type: 'text' },
      { id: '2', name: 'Monto', placeholder: '{{2}}', type: 'number' },
      { id: '3', name: 'Código Asociado', placeholder: '{{3}}', type: 'text' },
    ],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Recordatorio de Pago',
    description: 'Payment reminder template',
    content: 'Hola {{1}}, te recordamos que tu pago de {{2}} está por vencer. Ingresa ahora a tu cuenta para realizarlo.',
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
    content: '¡Felicitaciones {{1}}! Has completado {{2}} transacciones exitosas. Sigue así y desbloquea beneficios exclusivos.',
    variables: [
      { id: '1', name: 'Nombre', placeholder: '{{1}}', type: 'text' },
      { id: '2', name: 'Número de Transacciones', placeholder: '{{2}}', type: 'number' },
    ],
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05'),
  },
]

export const mockContacts: CampaignContact[] = [
  {
    codigoAsociado: 'AS001',
    nombre: 'Juan García',
    telefono: '3001234567',
    segmento: 'Premium',
    monto: 150000,
    fechaUltimoPago: new Date('2024-03-10'),
  },
  {
    codigoAsociado: 'AS002',
    nombre: 'María López',
    telefono: '3017654321',
    segmento: 'Standard',
    monto: 75000,
    fechaUltimoPago: new Date('2024-03-08'),
  },
  {
    codigoAsociado: 'AS003',
    nombre: 'Carlos Rodríguez',
    telefono: '3009876543',
    segmento: 'Premium',
    monto: 200000,
    fechaUltimoPago: new Date('2024-03-12'),
  },
  {
    codigoAsociado: 'AS004',
    nombre: 'Ana Martínez',
    telefono: '3005432109',
    segmento: 'Standard',
    monto: 50000,
    fechaUltimoPago: new Date('2024-03-05'),
  },
  {
    codigoAsociado: 'AS005',
    nombre: 'Pedro Sánchez',
    telefono: '3002468135',
    segmento: 'Premium',
    monto: 180000,
    fechaUltimoPago: new Date('2024-03-11'),
  },
  {
    codigoAsociado: 'AS006',
    nombre: 'Laura Jiménez',
    telefono: '3003579246',
    segmento: 'Standard',
    monto: 80000,
    fechaUltimoPago: new Date('2024-03-07'),
  },
  {
    codigoAsociado: 'AS007',
    nombre: 'Roberto Silva',
    telefono: '3008642135',
    segmento: 'Premium',
    monto: 220000,
    fechaUltimoPago: new Date('2024-03-13'),
  },
  {
    codigoAsociado: 'AS008',
    nombre: 'Sofía González',
    telefono: '3001357924',
    segmento: 'Standard',
    monto: 60000,
    fechaUltimoPago: new Date('2024-03-06'),
  },
]

export const mockCampaigns: Campaign[] = [
  {
    id: '1',
    name: 'Campaña Premio PD Baja - Marzo',
    templateId: '1',
    databaseName: 'clientes_pdb',
    sendMode: 'M0',
    segmentFilters: {
      segmento: 'Premium',
      estrategia: 'Reactivación',
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
      segmento: 'Standard',
      estrategia: 'Cobranza',
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
