import { prisma } from '@/lib/prisma'

// Asesores activos, para los selectores de asignación y filtros del admin.
export function listarAsesoresActivos() {
  return prisma.crmUsuario.findMany({
    where: { rol: 'asesor', activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })
}
