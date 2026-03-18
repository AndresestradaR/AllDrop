import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No se recibio archivo' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

  // Skip header row
  const dataRows = rows.slice(1).filter(r => r.length >= 4 && r[0])

  // Transaction type detection from description
  const DESCRIPTION_CATEGORIES: Record<string, { code: string, friendlyName: string }> = {
    'GANANCIA EN LA ORDEN COMO DROPSHIPPER': { code: '1002', friendlyName: 'Ganancia como dropshipper' },
    'GANANCIA EN LA ORDEN COMO PROVEEDOR': { code: '1006', friendlyName: 'Ganancia como proveedor' },
    'CAMBIO DE ESTATUS': { code: '1001', friendlyName: 'Recaudo por entrega' },
    'COBRO DE FLETE INICIAL': { code: '1000', friendlyName: 'Flete cobrado (nueva orden)' },
    'DEVOLUCION DE FLETE ORDEN ENTREGADA': { code: '1003', friendlyName: 'Devolucion de flete (entregada)' },
    'DEVOLUCION DE FLETE POR ENTREGA NO EFECTIVA': { code: '1013', friendlyName: 'Devolucion flete (no efectiva)' },
    'COBRO DE DEVOLUCION POR ENTREGA NO EFECTIVA': { code: '1014', friendlyName: 'Cobro devolucion (no efectiva)' },
    'MANTENIMIENTO MENSUAL TARJETA': { code: '1045', friendlyName: 'Mantenimiento mensual tarjeta' },
    'RECARGA DE TARJETA DE CREDITO': { code: '1038', friendlyName: 'Recarga tarjeta de credito' },
    'RETIRO DE TARJETA DE CREDITO': { code: '1039', friendlyName: 'Retiro tarjeta de credito' },
    'TRANSFERENCIA DE WALLET DESDE': { code: '1030', friendlyName: 'Transferencia recibida' },
    'TRANSFERENCIA DE WALLET AL': { code: '1031', friendlyName: 'Transferencia enviada' },
    'PETICION DE RETIRO DE SALDO': { code: '1020', friendlyName: 'Retiro de saldo en cartera' },
    'NUEVA ORDEN': { code: '1000b', friendlyName: 'Salida por nueva orden' },
    'COMISION DE REFERIDOS': { code: '1005', friendlyName: 'Comision de referidos' },
    'COBRO DE FLETE POR ORDEN': { code: '1040', friendlyName: 'Flete por garantia' },
    'INDEMNIZACION': { code: '1044', friendlyName: 'Indemnizacion' },
    'FULFILLMENT': { code: '1055', friendlyName: 'Fulfillment' },
  }

  function categorize(description: string): { code: string, friendlyName: string } {
    const upper = (description || '').toUpperCase()
    for (const [keyword, info] of Object.entries(DESCRIPTION_CATEGORIES)) {
      if (upper.includes(keyword)) return info
    }
    return { code: 'other', friendlyName: description.split(':')[0].trim().substring(0, 60) }
  }

  // Order-related codes (affect utility)
  const ORDER_RELATED_CODES = new Set(['1000', '1001', '1002', '1003', '1006', '1013', '1014', '1040'])
  // Omitted codes (shown but don't affect utility)
  const OMITTED_CODES = new Set(['1020', '1030', '1031', '1038', '1039', '1045'])

  // Parse and aggregate
  const summary: Record<string, { code: string, friendlyName: string, type: string, count: number, total: number }> = {}
  let totalEntradas = 0
  let totalSalidas = 0

  for (const row of dataRows) {
    const tipo = String(row[2] || '').trim().toUpperCase()  // ENTRADA or SALIDA
    const monto = parseFloat(row[3]) || 0
    const description = String(row[7] || '')
    const { code, friendlyName } = categorize(description)

    if (tipo === 'ENTRADA') totalEntradas += monto
    if (tipo === 'SALIDA') totalSalidas += monto

    const key = code + '_' + tipo
    if (!summary[key]) {
      summary[key] = { code, friendlyName, type: tipo, count: 0, total: 0 }
    }
    summary[key].count += 1
    summary[key].total += monto
  }

  // Separate order-related vs omitted
  const orderRelated = Object.values(summary).filter(s => ORDER_RELATED_CODES.has(s.code))
  const omitted = Object.values(summary).filter(s => OMITTED_CODES.has(s.code))
  const other = Object.values(summary).filter(s => !ORDER_RELATED_CODES.has(s.code) && !OMITTED_CODES.has(s.code))

  // Calculate revenue and costs from order-related transactions
  let revenue = 0
  let costs = 0
  for (const item of orderRelated) {
    if (item.type === 'ENTRADA') revenue += item.total
    else costs += item.total
  }

  return NextResponse.json({
    available: true,
    error: null,
    source: 'excel',
    transaction_count: dataRows.length,
    total_entradas: totalEntradas,
    total_salidas: totalSalidas,
    summary: [...orderRelated, ...other].sort((a, b) => b.total - a.total),
    revenue,
    costs,
    other_entries: other.filter(s => s.type === 'ENTRADA').reduce((sum, s) => sum + s.total, 0),
    other_exits: other.filter(s => s.type === 'SALIDA').reduce((sum, s) => sum + s.total, 0),
    omitted: omitted.sort((a, b) => b.total - a.total),
  })
}
