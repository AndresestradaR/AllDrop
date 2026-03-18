'use client'

import { useState } from 'react'
import { CalendarDays, Loader2, Trash2, Plus, TrendingUp, TrendingDown, DollarSign, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderStatusBreakdown {
  status: string
  count: number
  percentage: number
  amount: number
}

interface WalletTransaction {
  code: string
  description: string
  type: string
  count: number
  total: number
}

interface WalletData {
  available: boolean
  error: string | null
  transaction_count: number
  summary: WalletTransaction[]
  revenue: number
  costs: number
  other_entries: number
  other_exits: number
  omitted: WalletTransaction[]
}

interface OrderData {
  total_orders: number
  confirmed_count: number
  confirmed_pct: number
  cancelled_count: number
  cancelled_pct: number
  status_breakdown: OrderStatusBreakdown[]
  revenue: number
  cost_merchandise: number
  cost_shipping: number
  cost_return_shipping: number
  wallet?: WalletData | null
}

interface MetaData {
  has_meta: boolean
  spend: number
  total_spend?: number
  impressions: number
  total_impressions?: number
  clicks: number
  total_clicks?: number
  cpc: number
  ctr: number
  accounts?: Array<{ cpc?: number; [key: string]: any }>
  error?: string
}

interface Expense {
  id: string
  category: string
  description: string
  amount: number
  date: string
  type: 'expense' | 'income'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatNumber = (n: number) => {
  return new Intl.NumberFormat('es-CO').format(n)
}

const formatPct = (pct: number | undefined | null) => `${(pct ?? 0).toFixed(1)}%`

const STATUS_COLORS: Record<string, string> = {
  ENTREGADO: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  DEVOLUCION: 'bg-red-50 border-red-200 text-red-700',
  'RECLAMAR EN OFICINA': 'bg-amber-50 border-amber-200 text-amber-700',
  'EN CAMINO': 'bg-blue-50 border-blue-200 text-blue-700',
  CONFIRMADO: 'bg-sky-50 border-sky-200 text-sky-700',
  PENDIENTE: 'bg-gray-50 border-gray-200 text-gray-600',
  CANCELADO: 'bg-red-50 border-red-200 text-red-600',
}

const WALLET_FRIENDLY_NAMES: Record<string, string> = {
  '1000': 'Flete cobrado (nueva orden)',
  '1001': 'Recaudo por entrega',
  '1002': 'Ganancia como dropshipper',
  '1003': 'Devolucion de flete (entregada)',
  '1006': 'Ganancia como proveedor',
  '1013': 'Devolucion flete (no efectiva)',
  '1014': 'Cobro devolucion (no efectiva)',
  '1020': 'Retiro de saldo en cartera',
  '1030': 'Transferencia recibida',
  '1031': 'Transferencia enviada',
  '1034': 'Devolucion flete (cambio transportadora)',
  '1038': 'Recarga tarjeta de credito',
  '1039': 'Retiro tarjeta de credito',
  '1045': 'Mantenimiento mensual tarjeta',
}

const EXPENSE_CATEGORIES = [
  'Inversion publicitaria',
  'Herramientas',
  'Equipo/Nomina',
  'Mercancia extra',
  'Otro gasto',
  'Otro ingreso',
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function InformeFinancieroPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const [loading, setLoading] = useState(false)
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [metaData, setMetaData] = useState<MetaData | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [orderError, setOrderError] = useState<string | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    category: 'Otro gasto',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
  })
  const [savingExpense, setSavingExpense] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Collapsible sections
  const [showStatusSection, setShowStatusSection] = useState(true)
  const [showTransactions, setShowTransactions] = useState(true)
  const [showOmitted, setShowOmitted] = useState(false)

  const generated = orderData !== null

  // ─── Fetch ───────────────────────────────────────────────────────────────

  const generateReport = async () => {
    setLoading(true)
    setOrderError(null)
    setMetaError(null)

    try {
      const [ordersRes, metaRes, expensesRes] = await Promise.all([
        fetch(`/api/informe-financiero/orders?date_from=${dateFrom}&date_to=${dateTo}`).catch(() => null),
        fetch(`/api/informe-financiero/meta-spend?date_from=${dateFrom}&date_to=${dateTo}`).catch(() => null),
        fetch(`/api/informe-financiero/expenses?date_from=${dateFrom}&date_to=${dateTo}`).catch(() => null),
      ])

      // Orders
      if (ordersRes && ordersRes.ok) {
        const data = await ordersRes.json()
        setOrderData(data)
      } else {
        setOrderError('No se pudieron cargar las ordenes. Verifica tu conexion con Dropi/DropPage.')
        setOrderData(null)
      }

      // Meta
      if (metaRes && metaRes.ok) {
        const data = await metaRes.json()
        setMetaData(data)
      } else {
        setMetaData({ has_meta: false, spend: 0, impressions: 0, clicks: 0, cpc: 0, ctr: 0, error: 'No se pudo conectar con Meta Ads.' })
        setMetaError(null)
      }

      // Expenses
      if (expensesRes && expensesRes.ok) {
        const data = await expensesRes.json()
        setExpenses(Array.isArray(data) ? data : data.expenses || [])
      } else {
        setExpenses([])
      }
    } catch {
      setOrderError('Error de conexion. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Expense CRUD ────────────────────────────────────────────────────────

  const addExpense = async () => {
    if (!expenseForm.description.trim() || !expenseForm.amount) return
    setSavingExpense(true)
    try {
      const isIncome = expenseForm.category === 'Otro ingreso'
      const res = await fetch('/api/informe-financiero/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: expenseForm.category,
          description: expenseForm.description.trim(),
          amount: parseFloat(expenseForm.amount),
          date: expenseForm.date,
          type: isIncome ? 'income' : 'expense',
        }),
      })
      if (res.ok) {
        // Refetch expenses
        const expRes = await fetch(`/api/informe-financiero/expenses?date_from=${dateFrom}&date_to=${dateTo}`)
        if (expRes.ok) {
          const data = await expRes.json()
          setExpenses(Array.isArray(data) ? data : data.expenses || [])
        }
        setExpenseForm({ category: 'Otro gasto', description: '', amount: '', date: new Date().toISOString().split('T')[0] })
        setShowExpenseForm(false)
      }
    } catch {
      // silent
    } finally {
      setSavingExpense(false)
    }
  }

  const deleteExpense = async (id: string) => {
    if (!confirm('Eliminar este registro?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/informe-financiero/expenses?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setExpenses(prev => prev.filter(e => e.id !== id))
      }
    } catch {
      // silent
    } finally {
      setDeletingId(null)
    }
  }

  // ─── Computed values ─────────────────────────────────────────────────────

  const totalExpenses = expenses.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0)
  const totalIncome = expenses.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0)
  const metaSpend = metaData?.has_meta ? (metaData.total_spend ?? metaData.spend ?? 0) : 0

  const utilidadActual = orderData?.wallet?.available
    ? orderData.wallet.revenue - orderData.wallet.costs
    : orderData
      ? orderData.revenue - orderData.cost_merchandise - orderData.cost_shipping - orderData.cost_return_shipping
      : 0

  const utilidadFinal = utilidadActual - metaSpend - totalExpenses + totalIncome

  // KPIs
  const confirmedOrders = orderData?.confirmed_count || 0
  const cpa = confirmedOrders > 0 ? metaSpend / confirmedOrders : 0
  const roi = metaSpend > 0 ? ((utilidadFinal / metaSpend) * 100) : 0
  const ticketPromedio = confirmedOrders > 0 ? orderData!.revenue / confirmedOrders : 0
  const utilidadPorVenta = confirmedOrders > 0 ? utilidadFinal / confirmedOrders : 0

  const daysDiff = () => {
    const from = new Date(dateFrom)
    const to = new Date(dateTo)
    const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return diff > 0 ? diff : 1
  }
  const ventasDiarias = confirmedOrders / daysDiff()

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">Informe Financiero</h1>
          <p className="text-sm text-text-secondary mt-1">Analiza la rentabilidad de tu operacion</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex gap-2">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
          </div>
          <button
            onClick={generateReport}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
            Generar informe
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-3" />
            <p className="text-sm text-text-secondary">Cargando datos...</p>
          </div>
        </div>
      )}

      {/* Error for orders */}
      {!loading && orderError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{orderError}</p>
        </div>
      )}

      {/* Content (only show after generating) */}
      {!loading && generated && orderData && (
        <>
          {/* ─── Estado de Ordenes ─────────────────────────────────────── */}
          <section>
            <button
              onClick={() => setShowStatusSection(!showStatusSection)}
              className="flex items-center gap-2 mb-4 group"
            >
              <h2 className="text-lg font-bold text-text-primary">Estado de Ordenes</h2>
              {showStatusSection ? (
                <ChevronUp className="w-4 h-4 text-text-secondary" />
              ) : (
                <ChevronDown className="w-4 h-4 text-text-secondary" />
              )}
            </button>

            {showStatusSection && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Summary card */}
                <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
                  <p className="text-sm text-text-secondary mb-1">Total ordenes</p>
                  <p className="text-3xl font-bold text-text-primary">{formatNumber(orderData.total_orders)}</p>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-600 font-medium">Confirmadas</span>
                      <span className="font-semibold">{formatNumber(orderData.confirmed_count)} ({formatPct(orderData.confirmed_pct)})</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className="bg-emerald-500 h-2.5 rounded-full transition-all"
                        style={{ width: `${orderData.confirmed_pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600 font-medium">Canceladas</span>
                      <span className="font-semibold">{formatNumber(orderData.cancelled_count)} ({formatPct(orderData.cancelled_pct)})</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className="bg-red-500 h-2.5 rounded-full transition-all"
                        style={{ width: `${orderData.cancelled_pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Status breakdown */}
                <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {orderData.status_breakdown.map(s => {
                    const colorClass = STATUS_COLORS[s.status] || 'bg-gray-50 border-gray-200 text-gray-600'
                    return (
                      <div key={s.status} className={`rounded-xl border p-4 ${colorClass}`}>
                        <p className="text-xs font-medium uppercase truncate">{s.status}</p>
                        <p className="text-xl font-bold mt-1">{formatNumber(s.count)}</p>
                        <p className="text-xs mt-0.5">{formatPct(s.percentage)}</p>
                        <p className="text-xs font-medium mt-1">{formatCurrency(s.amount)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          {/* ─── Transacciones ─────────────────────────────────────────── */}
          <section>
            <button
              onClick={() => setShowTransactions(!showTransactions)}
              className="flex items-center gap-2 mb-4 group"
            >
              <h2 className="text-lg font-bold text-text-primary">Transacciones</h2>
              {showTransactions ? (
                <ChevronUp className="w-4 h-4 text-text-secondary" />
              ) : (
                <ChevronDown className="w-4 h-4 text-text-secondary" />
              )}
            </button>

            {showTransactions && (
              <>
                <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-gray-50/50">
                          <th className="text-left py-3 px-4 font-semibold text-text-secondary">Concepto</th>
                          <th className="text-right py-3 px-4 font-semibold text-text-secondary">Registros</th>
                          <th className="text-right py-3 px-4 font-semibold text-text-secondary">Total</th>
                          <th className="text-right py-3 px-4 font-semibold text-text-secondary">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderData.wallet?.available ? (
                          /* ── Wallet real de Dropi ── */
                          orderData.wallet.summary.map((tx, i) => {
                            const isEntry = tx.type === 'ENTRADA'
                            const walletTotal = orderData.wallet!.revenue + orderData.wallet!.costs
                            return (
                              <tr key={`wallet-${tx.code}-${i}`} className="border-b border-border/50 last:border-0">
                                <td className="py-3 px-4 font-medium text-text-primary">
                                  {WALLET_FRIENDLY_NAMES[tx.code] || tx.description}
                                </td>
                                <td className="py-3 px-4 text-right text-text-secondary">{formatNumber(tx.count)}</td>
                                <td className={`py-3 px-4 text-right font-semibold ${isEntry ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {isEntry ? '' : '-'}{formatCurrency(tx.total)}
                                </td>
                                <td className="py-3 px-4 text-right text-text-secondary">
                                  {walletTotal > 0 ? formatPct((tx.total / walletTotal) * 100) : '0.0%'}
                                </td>
                              </tr>
                            )
                          })
                        ) : (
                          /* ── Estimado (fallback sin wallet) ── */
                          [{
                            label: 'Recaudo de venta',
                            count: orderData.confirmed_count,
                            amount: orderData.revenue,
                            positive: true,
                          },
                          {
                            label: 'Costo de mercancia',
                            count: orderData.confirmed_count,
                            amount: -orderData.cost_merchandise,
                            positive: false,
                          },
                          {
                            label: 'Costo de envio',
                            count: orderData.confirmed_count,
                            amount: -orderData.cost_shipping,
                            positive: false,
                          },
                          {
                            label: 'Envio devoluciones',
                            count: orderData.cancelled_count,
                            amount: -orderData.cost_return_shipping,
                            positive: false,
                          }].map((row, i) => (
                            <tr key={i} className="border-b border-border/50 last:border-0">
                              <td className="py-3 px-4 font-medium text-text-primary">{row.label}</td>
                              <td className="py-3 px-4 text-right text-text-secondary">{formatNumber(row.count)}</td>
                              <td className={`py-3 px-4 text-right font-semibold ${row.positive ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(Math.abs(row.amount))}
                              </td>
                              <td className="py-3 px-4 text-right text-text-secondary">
                                {orderData.revenue > 0 ? formatPct((Math.abs(row.amount) / orderData.revenue) * 100) : '0.0%'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50/80">
                          <td className="py-3 px-4 font-bold text-text-primary">UTILIDAD BRUTA</td>
                          <td className="py-3 px-4"></td>
                          <td className={`py-3 px-4 text-right font-bold text-lg ${utilidadActual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(utilidadActual)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-text-secondary">
                            {orderData.revenue > 0 ? formatPct((utilidadActual / orderData.revenue) * 100) : '0.0%'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Warning when wallet is not available */}
                {!orderData.wallet?.available && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mt-4">
                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Datos estimados</p>
                      <p className="text-sm text-amber-700 mt-0.5">
                        {orderData.wallet?.error
                          ? `No se pudo obtener la cartera de Dropi: ${orderData.wallet.error}`
                          : 'Conecta tu cuenta de Dropi para ver transacciones reales del wallet.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Omitted wallet transactions */}
                {orderData.wallet?.available && orderData.wallet.omitted.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowOmitted(!showOmitted)}
                      className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                    >
                      {showOmitted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <span>Movimientos omitidos ({orderData.wallet!.omitted.length})</span>
                    </button>
                    {showOmitted && (
                      <div className="mt-2 bg-gray-50 rounded-xl border border-border overflow-hidden">
                        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
                          <p className="text-xs text-amber-700">
                            Estos movimientos no se incluyen en el calculo de utilidad (mantenimientos, retiros, transferencias, etc.)
                          </p>
                        </div>
                        <table className="w-full text-sm">
                          <tbody>
                            {orderData.wallet!.omitted.map((tx, i) => (
                              <tr key={`omitted-${tx.code}-${i}`} className="border-b border-border/50 last:border-0">
                                <td className="py-2 px-4 text-text-secondary">
                                  {WALLET_FRIENDLY_NAMES[tx.code] || tx.description}
                                </td>
                                <td className="py-2 px-4 text-right text-text-secondary">{formatNumber(tx.count)}</td>
                                <td className={`py-2 px-4 text-right font-medium ${tx.type === 'ENTRADA' ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {tx.type === 'ENTRADA' ? '' : '-'}{formatCurrency(tx.total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {/* ─── Inversion Publicitaria (Meta) ────────────────────────── */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-4">Inversion Publicitaria</h2>
            {metaData?.has_meta ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-surface rounded-xl shadow-sm border border-border p-5">
                  <p className="text-xs text-text-secondary uppercase font-medium">Gasto total</p>
                  <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(metaData.total_spend ?? metaData.spend ?? 0)}</p>
                </div>
                <div className="bg-surface rounded-xl shadow-sm border border-border p-5">
                  <p className="text-xs text-text-secondary uppercase font-medium">Impresiones</p>
                  <p className="text-xl font-bold text-text-primary mt-1">{formatNumber(metaData.total_impressions ?? metaData.impressions ?? 0)}</p>
                </div>
                <div className="bg-surface rounded-xl shadow-sm border border-border p-5">
                  <p className="text-xs text-text-secondary uppercase font-medium">Clicks</p>
                  <p className="text-xl font-bold text-text-primary mt-1">{formatNumber(metaData.total_clicks ?? metaData.clicks ?? 0)}</p>
                </div>
                <div className="bg-surface rounded-xl shadow-sm border border-border p-5">
                  <p className="text-xs text-text-secondary uppercase font-medium">CPC</p>
                  <p className="text-xl font-bold text-text-primary mt-1">{formatCurrency(metaData.accounts?.[0]?.cpc ?? metaData.cpc ?? 0)}</p>
                </div>
              </div>
            ) : (
              <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">Meta Ads no conectado</p>
                    <p className="text-sm text-text-secondary mt-1">
                      Conecta tu cuenta de Meta en Settings para ver el gasto publicitario automaticamente.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ─── Otros Gastos / Ingresos ──────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-primary">Otros Gastos e Ingresos</h2>
              <button
                onClick={() => setShowExpenseForm(!showExpenseForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>

            {/* Inline form */}
            {showExpenseForm && (
              <div className="bg-surface rounded-xl shadow-sm border border-border p-4 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Categoria</label>
                    <select
                      value={expenseForm.category}
                      onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      {EXPENSE_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Descripcion</label>
                    <input
                      type="text"
                      value={expenseForm.description}
                      onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Ej: Facebook Ads semana 1"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Monto (COP)</label>
                    <input
                      type="number"
                      value={expenseForm.amount}
                      onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="50000"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Fecha</label>
                    <input
                      type="date"
                      value={expenseForm.date}
                      onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={addExpense}
                      disabled={savingExpense || !expenseForm.description.trim() || !expenseForm.amount}
                      className="w-full px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                    >
                      {savingExpense ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Table */}
            {expenses.length > 0 ? (
              <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-gray-50/50">
                        <th className="text-left py-3 px-4 font-semibold text-text-secondary">Categoria</th>
                        <th className="text-left py-3 px-4 font-semibold text-text-secondary">Descripcion</th>
                        <th className="text-left py-3 px-4 font-semibold text-text-secondary">Fecha</th>
                        <th className="text-right py-3 px-4 font-semibold text-text-secondary">Monto</th>
                        <th className="text-center py-3 px-4 font-semibold text-text-secondary w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map(exp => (
                        <tr key={exp.id} className="border-b border-border/50 last:border-0">
                          <td className="py-3 px-4 text-text-primary">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              exp.type === 'income'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'
                            }`}>
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-text-secondary">{exp.description}</td>
                          <td className="py-3 px-4 text-text-secondary">{exp.date}</td>
                          <td className={`py-3 px-4 text-right font-semibold ${exp.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {exp.type === 'income' ? '+' : '-'}{formatCurrency(exp.amount)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => deleteExpense(exp.id)}
                              disabled={deletingId === exp.id}
                              className="p-1.5 text-text-secondary hover:text-red-500 transition-colors disabled:opacity-50"
                            >
                              {deletingId === exp.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-surface rounded-xl shadow-sm border border-border p-6 text-center">
                <p className="text-sm text-text-secondary">No hay gastos o ingresos registrados para este periodo.</p>
              </div>
            )}
          </section>

          {/* ─── Utilidad ─────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-4">Resumen de Utilidad</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  <p className="text-sm font-medium text-text-secondary">Utilidad bruta</p>
                </div>
                <p className={`text-2xl font-bold ${utilidadActual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(utilidadActual)}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  {orderData?.wallet?.available ? 'Datos reales del wallet de Dropi' : 'Ventas - costos de mercancia y envio'}
                </p>
              </div>

              <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  <p className="text-sm font-medium text-text-secondary">Gastos totales</p>
                </div>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(metaSpend + totalExpenses)}
                </p>
                <div className="text-xs text-text-secondary mt-1 space-y-0.5">
                  {metaSpend > 0 && <p>Meta Ads: {formatCurrency(metaSpend)}</p>}
                  {totalExpenses > 0 && <p>Otros gastos: {formatCurrency(totalExpenses)}</p>}
                  {totalIncome > 0 && <p className="text-emerald-600">Otros ingresos: +{formatCurrency(totalIncome)}</p>}
                </div>
              </div>

              <div className={`rounded-xl shadow-sm border p-6 ${utilidadFinal >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className={`w-5 h-5 ${utilidadFinal >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                  <p className="text-sm font-medium text-text-secondary">Utilidad final</p>
                </div>
                <p className={`text-2xl font-bold ${utilidadFinal >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatCurrency(utilidadFinal)}
                </p>
                <p className="text-xs text-text-secondary mt-1">Utilidad bruta - publicidad - gastos + ingresos</p>
              </div>
            </div>
          </section>

          {/* ─── KPIs ─────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-bold text-text-primary mb-4">Indicadores Clave</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-surface rounded-xl shadow-sm border border-border p-5">
                <p className="text-xs text-text-secondary uppercase font-medium">CPA</p>
                <p className="text-xl font-bold text-text-primary mt-1">{cpa > 0 ? formatCurrency(cpa) : '--'}</p>
                <p className="text-[11px] text-text-secondary mt-0.5">Costo por adquisicion</p>
              </div>
              <div className="bg-surface rounded-xl shadow-sm border border-border p-5">
                <p className="text-xs text-text-secondary uppercase font-medium">ROI</p>
                <p className={`text-xl font-bold mt-1 ${roi >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {metaSpend > 0 ? formatPct(roi) : '--'}
                </p>
                <p className="text-[11px] text-text-secondary mt-0.5">Retorno sobre inversion</p>
              </div>
              <div className="bg-surface rounded-xl shadow-sm border border-border p-5">
                <p className="text-xs text-text-secondary uppercase font-medium">Ticket promedio</p>
                <p className="text-xl font-bold text-text-primary mt-1">{confirmedOrders > 0 ? formatCurrency(ticketPromedio) : '--'}</p>
                <p className="text-[11px] text-text-secondary mt-0.5">Venta promedio por orden</p>
              </div>
              <div className="bg-surface rounded-xl shadow-sm border border-border p-5">
                <p className="text-xs text-text-secondary uppercase font-medium">Utilidad/venta</p>
                <p className={`text-xl font-bold mt-1 ${utilidadPorVenta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {confirmedOrders > 0 ? formatCurrency(utilidadPorVenta) : '--'}
                </p>
                <p className="text-[11px] text-text-secondary mt-0.5">Ganancia neta por venta</p>
              </div>
              <div className="bg-surface rounded-xl shadow-sm border border-border p-5">
                <p className="text-xs text-text-secondary uppercase font-medium">Ventas/dia</p>
                <p className="text-xl font-bold text-text-primary mt-1">{confirmedOrders > 0 ? ventasDiarias.toFixed(1) : '--'}</p>
                <p className="text-[11px] text-text-secondary mt-0.5">Promedio diario confirmadas</p>
              </div>
            </div>
          </section>
        </>
      )}

      {/* No data yet */}
      {!loading && !generated && !orderError && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center max-w-md">
            <DollarSign className="w-12 h-12 text-text-secondary/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">Selecciona un rango de fechas</h3>
            <p className="text-sm text-text-secondary">
              Elige las fechas y haz clic en &quot;Generar informe&quot; para ver tu analisis financiero completo.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
