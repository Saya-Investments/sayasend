// Mapeo de códigos de error de la WhatsApp Cloud API (Meta) a descripciones en español.
// Referencia: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes

export const WHATSAPP_ERROR_DESCRIPTIONS: Record<string, string> = {
  '0': 'Error de autenticación',
  '3': 'Permiso insuficiente para llamar a la API',
  '10': 'Permiso denegado',
  '33': 'El método invocado no existe',
  '100': 'Parámetro inválido',
  '130429': 'Límite de velocidad alcanzado',
  '131000': 'Algo salió mal (error genérico)',
  '131005': 'Acceso denegado',
  '131008': 'Falta un parámetro obligatorio',
  '131009': 'Valor de parámetro inválido',
  '131016': 'Servicio temporalmente no disponible',
  '131021': 'El destinatario no puede ser el remitente',
  '131026': 'Mensaje no entregable (número no en WhatsApp o incompatibilidad)',
  '131031': 'Cuenta bloqueada',
  '131042': 'Problema de elegibilidad de pago de la cuenta',
  '131045': 'Plantilla no aprobada',
  '131047': 'Ventana de 24 h vencida (requiere plantilla)',
  '131048': 'Límite de spam alcanzado para esta cuenta',
  '131049': 'Límite de mensajes de marketing por usuario alcanzado',
  '131050': 'El usuario dejó de recibir mensajes de marketing (opt-out)',
  '131051': 'Tipo de mensaje no soportado',
  '131052': 'Error al descargar el archivo multimedia',
  '131053': 'Error al cargar el archivo multimedia',
  '131056': 'Límite de mensajería por par (remitente/destinatario) alcanzado',
  '131057': 'Cuenta en modo mantenimiento',
  '132000': 'Discrepancia en los parámetros de la plantilla',
  '132001': 'La plantilla no existe',
  '132005': 'Texto de la plantilla demasiado largo tras hidratar',
  '132007': 'La plantilla viola la política de caracteres',
  '132012': 'Formato de parámetro de plantilla incorrecto',
  '132015': 'Plantilla pausada por baja calidad',
  '132016': 'Plantilla deshabilitada por baja calidad',
  '132068': 'Flow bloqueado',
  '132069': 'Flow limitado',
  '133000': 'Error genérico del usuario',
  '133004': 'Servidor temporalmente no disponible',
  '133005': 'PIN de verificación en dos pasos incorrecto',
  '133006': 'Se requiere volver a verificar el número',
  '133008': 'Demasiados intentos de PIN de verificación en dos pasos',
  '133009': 'PIN de verificación ingresado demasiado rápido',
  '133010': 'Número no registrado en la plataforma',
  '133015': 'Espera unos minutos antes de intentar registrar de nuevo',
  '135000': 'Error genérico',
}

export function getWhatsAppErrorDescription(code: string | number | null | undefined): string {
  if (code === null || code === undefined) return 'Sin descripción disponible'
  const key = String(code)
  return WHATSAPP_ERROR_DESCRIPTIONS[key] ?? 'Código no documentado'
}
