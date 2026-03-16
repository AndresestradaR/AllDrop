'use client'

import { useState, useMemo } from 'react'
import { ArrowLeft, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ── Country configs ──────────────────────────────────────
interface CountryConfig {
  code: string
  name: string
  flag: string
  currency: string
  symbol: string
  defaultCost: number
  defaultShipping: number
  defaultPrice: number
  shippingHint: string
  formatNumber: (n: number) => string
}

const COUNTRIES: CountryConfig[] = [
  {
    code: 'CO', name: 'Colombia', flag: '🇨🇴', currency: 'COP', symbol: '$',
    defaultCost: 30000, defaultShipping: 20000, defaultPrice: 100000,
    shippingHint: 'Aprox. $18.000–$20.000',
    formatNumber: (n) => n.toLocaleString('es-CO'),
  },
  {
    code: 'MX', name: 'México', flag: '🇲🇽', currency: 'MXN', symbol: '$',
    defaultCost: 250, defaultShipping: 150, defaultPrice: 899,
    shippingHint: 'Aprox. $120–$180',
    formatNumber: (n) => n.toLocaleString('es-MX'),
  },
  {
    code: 'PE', name: 'Perú', flag: '🇵🇪', currency: 'PEN', symbol: 'S/',
    defaultCost: 30, defaultShipping: 15, defaultPrice: 99,
    shippingHint: 'Aprox. S/12–S/18',
    formatNumber: (n) => n.toLocaleString('es-PE'),
  },
  {
    code: 'EC', name: 'Ecuador', flag: '🇪🇨', currency: 'USD', symbol: '$',
    defaultCost: 8, defaultShipping: 5, defaultPrice: 30,
    shippingHint: 'Aprox. $4–$6',
    formatNumber: (n) => n.toLocaleString('en-US'),
  },
  {
    code: 'CL', name: 'Chile', flag: '🇨🇱', currency: 'CLP', symbol: '$',
    defaultCost: 10000, defaultShipping: 5000, defaultPrice: 39900,
    shippingHint: 'Aprox. $4.000–$6.000',
    formatNumber: (n) => n.toLocaleString('es-CL'),
  },
  {
    code: 'GT', name: 'Guatemala', flag: '🇬🇹', currency: 'GTQ', symbol: 'Q',
    defaultCost: 80, defaultShipping: 40, defaultPrice: 299,
    shippingHint: 'Aprox. Q35–Q50',
    formatNumber: (n) => n.toLocaleString('es-GT'),
  },
]

// ── Shared components ────────────────────────────────────
function CurrencyInput({
  label, value, onChange, hint, symbol,
}: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; symbol: string
}) {
  return (
    <div className="flex-1 min-w-[140px]">
      <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">{label}</label>
      <div className="flex items-center bg-[#1a1a2e] rounded-lg border border-border overflow-hidden">
        <span className="pl-3 pr-1 text-text-secondary text-sm font-medium">{symbol}</span>
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full bg-transparent px-2 py-2.5 text-text-primary font-semibold text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
      {hint && <p className="text-[11px] text-text-secondary mt-1">{hint}</p>}
    </div>
  )
}

function SliderInput({
  label, value, onChange, min = 0, max = 60,
}: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <div className="flex-1 min-w-[180px]">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">{label}</label>
        <span className="text-sm font-bold text-text-primary">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-amber-500"
        style={{
          background: `linear-gradient(to right, #d97706 0%, #d97706 ${(value / max) * 100}%, #333 ${(value / max) * 100}%, #333 100%)`,
        }}
      />
    </div>
  )
}

function ResultCard({
  title, value, subtitle, variant = 'default', highlight = false,
}: {
  title: string; value: string; subtitle?: string; variant?: 'default' | 'success' | 'danger' | 'warning'; highlight?: boolean
}) {
  const colors = {
    default: 'border-border',
    success: 'border-emerald-500/30 bg-emerald-500/5',
    danger: 'border-red-500/30 bg-red-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
  }
  return (
    <div className={cn(
      'rounded-xl border p-4 transition-all',
      colors[variant],
      highlight && 'ring-1 ring-amber-500/40'
    )}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1">{title}</p>
      <p className={cn(
        'text-lg font-bold',
        variant === 'success' ? 'text-emerald-400' :
        variant === 'danger' ? 'text-red-400' :
        variant === 'warning' ? 'text-amber-400' :
        'text-text-primary'
      )}>{value}</p>
      {subtitle && <p className="text-[11px] text-text-secondary mt-0.5">{subtitle}</p>}
    </div>
  )
}

function FlowArrow({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-1">
      <div className="flex items-center gap-2 text-[11px] text-text-secondary">
        <div className="h-px w-8 bg-border" />
        <span>{text}</span>
        <div className="h-px w-8 bg-border" />
      </div>
    </div>
  )
}

function SectionHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
      <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
        {step}
      </div>
      <div>
        <h3 className="font-bold text-text-primary text-sm">{title}</h3>
        <p className="text-xs text-text-secondary">{subtitle}</p>
      </div>
    </div>
  )
}

// ── Calculator mode ──────────────────────────────────────
function CalculatorMode({ country }: { country: CountryConfig }) {
  const fmt = (n: number) => `${country.symbol} ${country.formatNumber(Math.round(n))}`

  const [cost, setCost] = useState(country.defaultCost)
  const [shipping, setShipping] = useState(country.defaultShipping)
  const [price, setPrice] = useState(country.defaultPrice)
  const [ordersPerDay, setOrdersPerDay] = useState(10)
  const [cancelPct, setCancelPct] = useState(20)
  const [returnPct, setReturnPct] = useState(20)
  const [currentCPA, setCurrentCPA] = useState(0)

  const calc = useMemo(() => {
    const totalCost = cost + shipping
    const profit = price - totalCost
    const marginPct = price > 0 ? (profit / price) * 100 : 0
    const minPrice = totalCost / 0.5
    const optPrice = totalCost / 0.4

    // Simulation
    const totalOrders = ordersPerDay
    const cancelledOrders = Math.round(totalOrders * (cancelPct / 100))
    const dispatched = totalOrders - cancelledOrders
    const returnedOrders = Math.round(dispatched * (returnPct / 100))
    const delivered = dispatched - returnedOrders

    const totalRevenue = totalOrders * price
    const dispatchedRevenue = dispatched * price
    const deliveredRevenue = delivered * price

    const grossMargin = deliveredRevenue * (marginPct / 100)
    const returnShipping = returnedOrders * shipping
    const realMargin = grossMargin - returnShipping

    // Ad budget
    const budget35 = realMargin * 0.35
    const budget40 = realMargin * 0.40
    const budget50 = realMargin * 0.50
    const cpa35 = totalOrders > 0 ? budget35 / totalOrders : 0
    const cpa40 = totalOrders > 0 ? budget40 / totalOrders : 0
    const cpa50 = totalOrders > 0 ? budget50 / totalOrders : 0
    const opMargin35 = realMargin - budget35
    const opMargin40 = realMargin - budget40
    const opMargin50 = realMargin - budget50

    // CPA analysis
    const cpaTotalSpend = currentCPA * totalOrders
    const cpaOperational = realMargin - cpaTotalSpend
    const cpaROAS = cpaTotalSpend > 0 ? deliveredRevenue / cpaTotalSpend : 0

    return {
      totalCost, profit, marginPct, minPrice, optPrice,
      totalOrders, cancelledOrders, dispatched, returnedOrders, delivered,
      totalRevenue, dispatchedRevenue, deliveredRevenue,
      grossMargin, returnShipping, realMargin,
      budget35, budget40, budget50, cpa35, cpa40, cpa50,
      opMargin35, opMargin40, opMargin50,
      cpaTotalSpend, cpaOperational, cpaROAS,
    }
  }, [cost, shipping, price, ordersPerDay, cancelPct, returnPct, currentCPA])

  const marginLabel = calc.marginPct >= 60 ? 'Excelente (60%+)' :
    calc.marginPct >= 50 ? 'Aceptable (50%+)' :
    calc.marginPct >= 40 ? 'Bajo (40-50%)' : 'Peligroso (<40%)'
  const marginVariant = calc.marginPct >= 50 ? 'success' : calc.marginPct >= 40 ? 'warning' : 'danger'

  return (
    <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-280px)] pr-2 pb-6 custom-scrollbar">
      {/* Section 1: Product Costing */}
      <div className="bg-surface-secondary rounded-2xl border border-border p-5">
        <SectionHeader step={1} title="Costeo del Producto" subtitle="Precio de venta, producto y flete" />
        <div className="flex flex-wrap gap-4 mb-4">
          <CurrencyInput label="💰 Costo Producto" value={cost} onChange={setCost} hint="Lo que pagas al proveedor" symbol={country.symbol} />
          <CurrencyInput label="🚚 Flete Promedio" value={shipping} onChange={setShipping} hint={country.shippingHint} symbol={country.symbol} />
          <CurrencyInput label="🏷️ Precio de Venta" value={price} onChange={setPrice} hint="¿A cuánto lo vendes?" symbol={country.symbol} />
        </div>

        <ResultCard
          title="Tu Margen Bruto"
          value={`${calc.marginPct.toFixed(1)}% — ${marginLabel}`}
          subtitle={`Costo total: ${fmt(calc.totalCost)} · Ganancia por unidad: ${fmt(calc.profit)}`}
          variant={marginVariant as any}
        />

        <div className="grid grid-cols-2 gap-3 mt-3">
          <ResultCard title="Precio Mínimo (50%)" value={fmt(calc.minPrice)} subtitle="Margen bruto del 50%" />
          <ResultCard title="Precio Óptimo (60%) ⭐" value={fmt(calc.optPrice)} subtitle="Margen bruto del 60%" highlight />
        </div>
      </div>

      {/* Section 2: Sales Simulation */}
      <div className="bg-surface-secondary rounded-2xl border border-border p-5">
        <SectionHeader step={2} title="Simulación de Ventas" subtitle="Cancelaciones, devoluciones y margen bruto real" />

        <div className="flex flex-wrap gap-4 mb-4">
          <div className="min-w-[120px]">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">📦 Pedidos / Día</label>
            <input
              type="number"
              value={ordersPerDay || ''}
              onChange={(e) => setOrdersPerDay(Number(e.target.value) || 0)}
              className="w-full bg-[#1a1a2e] rounded-lg border border-border px-3 py-2.5 text-text-primary font-semibold text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <SliderInput label="📵 % Cancelaciones" value={cancelPct} onChange={setCancelPct} />
          <SliderInput label="↩️ % Devoluciones" value={returnPct} onChange={setReturnPct} />
        </div>

        {/* Flow visualization */}
        <div className="space-y-1">
          <ResultCard title="Ventas Totales" value={`${calc.totalOrders} pedidos · ${fmt(calc.totalRevenue)}`} />
          <FlowArrow text={`−${cancelPct}% = −${calc.cancelledOrders} pedidos cancelados`} />
          <ResultCard title="Despachados" value={`${calc.dispatched} pedidos · ${fmt(calc.dispatchedRevenue)}`} />
          <FlowArrow text={`−${returnPct}% = −${calc.returnedOrders} pedidos devueltos`} />
          <ResultCard title="Entregados ✅" value={`${calc.delivered} pedidos · ${fmt(calc.deliveredRevenue)}`} variant="success" />
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <ResultCard title={`Margen Bruto (${calc.marginPct.toFixed(0)}%)`} value={fmt(calc.grossMargin)} subtitle={`${calc.marginPct.toFixed(1)}% sobre ingresos entregados`} />
          <ResultCard title="Fletes Devueltos" value={`−${fmt(calc.returnShipping)}`} subtitle={`${calc.returnedOrders} dev. × ${fmt(shipping)}`} variant="danger" />
          <ResultCard title="Margen Bruto Real 🎯" value={fmt(calc.realMargin)} subtitle="Margen bruto − fletes devueltos" variant={calc.realMargin > 0 ? 'success' : 'danger'} />
        </div>
      </div>

      {/* Section 3: Ad Budget Calculator */}
      <div className="bg-surface-secondary rounded-2xl border border-border p-5">
        <SectionHeader step={3} title="Calculadora de Pauta" subtitle="CPA ideal y utilidad operacional" />

        <div className="bg-[#1a1a2e] rounded-xl border border-border p-3 mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1">Resumen del Escenario</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-secondary">
            <span>Precio venta: <b className="text-text-primary">{fmt(price)}</b></span>
            <span>Costo total: <b className="text-text-primary">{fmt(calc.totalCost)}</b></span>
            <span>Margen bruto: <b className="text-text-primary">{calc.marginPct.toFixed(1)}%</b></span>
            <span>Pedidos: <b className="text-text-primary">{calc.totalOrders}</b></span>
            <span>Margen neto: <b className="text-text-primary">{fmt(calc.realMargin)}</b></span>
          </div>
        </div>

        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">🎯 Presupuesto de Pauta sobre el Margen Bruto</p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { pct: 35, label: 'IDEAL', budget: calc.budget35, cpa: calc.cpa35, op: calc.opMargin35 },
            { pct: 40, label: '', budget: calc.budget40, cpa: calc.cpa40, op: calc.opMargin40 },
            { pct: 50, label: '', budget: calc.budget50, cpa: calc.cpa50, op: calc.opMargin50 },
          ].map((tier) => (
            <div key={tier.pct} className={cn(
              'rounded-xl border p-3 transition-all',
              tier.pct === 35 ? 'border-amber-500/30 bg-amber-500/5 ring-1 ring-amber-500/20' : 'border-border'
            )}>
              {tier.label && (
                <span className="inline-block px-2 py-0.5 text-[9px] font-bold uppercase bg-amber-500/20 text-amber-400 rounded mb-1.5">
                  {tier.label}
                </span>
              )}
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{tier.pct}% del Margen</p>
              <p className="text-lg font-bold text-text-primary">{fmt(tier.budget)}</p>
              <div className="mt-2 space-y-1">
                <div>
                  <p className="text-[10px] text-text-secondary">CPA máximo</p>
                  <p className="text-sm font-bold text-text-primary">{fmt(tier.cpa)}</p>
                  <p className="text-[10px] text-text-secondary">para {calc.totalOrders} pedidos</p>
                </div>
                <div className="pt-1 border-t border-border/50">
                  <p className="text-[10px] text-text-secondary">Margen operacional</p>
                  <p className="text-sm font-bold text-emerald-400">{fmt(tier.op)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Current CPA input */}
        <div className="bg-[#1a1a2e] rounded-xl border border-border p-4">
          <CurrencyInput label="📈 ¿Cuál es tu CPA actual?" value={currentCPA} onChange={setCurrentCPA} hint="Costo por adquisición en tu plataforma de pauta" symbol={country.symbol} />
          {currentCPA > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              <ResultCard title="Gasto Total en Pauta" value={fmt(calc.cpaTotalSpend)} subtitle={`${calc.totalOrders} pedidos × ${fmt(currentCPA)}`} />
              <ResultCard title="Margen Operacional" value={fmt(calc.cpaOperational)} variant={calc.cpaOperational > 0 ? 'success' : 'danger'} subtitle="Margen real − gasto pauta" />
              <ResultCard title="ROAS" value={`${calc.cpaROAS.toFixed(1)}x`} variant={calc.cpaROAS >= 3 ? 'success' : calc.cpaROAS >= 2 ? 'warning' : 'danger'} subtitle="Retorno sobre inversión" />
            </div>
          )}
        </div>
      </div>

      {/* Golden Rules */}
      <div className="bg-surface-secondary rounded-2xl border border-border p-5">
        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">📚 Reglas de Oro</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-xl bg-[#1a1a2e] border border-border">
            <span className="text-lg">🎯</span>
            <p className="text-xs font-bold text-text-primary mt-1">Regla del 50%</p>
            <p className="text-[10px] text-text-secondary mt-0.5">Costo total = máximo 50% del precio de venta.</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-[#1a1a2e] border border-border">
            <span className="text-lg">⭐</span>
            <p className="text-xs font-bold text-text-primary mt-1">Regla del 40%</p>
            <p className="text-[10px] text-text-secondary mt-0.5">Costo total = 40% del precio → margen del 60%.</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-[#1a1a2e] border border-border">
            <span className="text-lg">📢</span>
            <p className="text-xs font-bold text-text-primary mt-1">Regla del 35%</p>
            <p className="text-[10px] text-text-secondary mt-0.5">Pauta = máximo 35% del margen neto real.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Real mode ────────────────────────────────────────────
function RealMode({ country }: { country: CountryConfig }) {
  const fmt = (n: number) => `${country.symbol} ${country.formatNumber(Math.round(n))}`

  const [price, setPrice] = useState(country.defaultPrice)
  const [cost, setCost] = useState(country.defaultCost)
  const [shipping, setShipping] = useState(country.defaultShipping)
  const [adSpend, setAdSpend] = useState(country.defaultPrice * 2)
  const [totalOrders, setTotalOrders] = useState(25)
  const [days, setDays] = useState(7)
  const [cancelPct, setCancelPct] = useState(20)
  const [returnPct, setReturnPct] = useState(20)

  const calc = useMemo(() => {
    const totalCost = cost + shipping
    const profit = price - totalCost
    const marginPct = price > 0 ? (profit / price) * 100 : 0

    const cancelledOrders = Math.round(totalOrders * (cancelPct / 100))
    const dispatched = totalOrders - cancelledOrders
    const returnedOrders = Math.round(dispatched * (returnPct / 100))
    const delivered = dispatched - returnedOrders

    const totalRevenue = totalOrders * price
    const deliveredRevenue = delivered * price
    const grossMargin = deliveredRevenue * (marginPct / 100)
    const returnShipping = returnedOrders * shipping
    const realMargin = grossMargin - returnShipping

    const cpa = totalOrders > 0 ? adSpend / totalOrders : 0
    const operationalMargin = realMargin - adSpend
    const roas = adSpend > 0 ? deliveredRevenue / adSpend : 0
    const ordersPerDay = days > 0 ? totalOrders / days : 0
    const profitPerDay = days > 0 ? operationalMargin / days : 0

    // Break-even
    const breakEvenCPA = totalOrders > 0 ? realMargin / totalOrders : 0

    return {
      totalCost, profit, marginPct,
      cancelledOrders, dispatched, returnedOrders, delivered,
      totalRevenue, deliveredRevenue,
      grossMargin, returnShipping, realMargin,
      cpa, operationalMargin, roas, ordersPerDay, profitPerDay,
      breakEvenCPA,
    }
  }, [price, cost, shipping, adSpend, totalOrders, days, cancelPct, returnPct])

  const allFilled = price > 0 && cost > 0 && shipping > 0 && adSpend > 0 && totalOrders > 0

  return (
    <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-280px)] pr-2 pb-6 custom-scrollbar">
      {/* Section 1: Product */}
      <div className="bg-surface-secondary rounded-2xl border border-border p-5">
        <SectionHeader step={1} title="Tu Producto" subtitle="Precio, costo y flete" />
        <div className="flex flex-wrap gap-4">
          <CurrencyInput label="🏷️ Precio de Venta" value={price} onChange={setPrice} symbol={country.symbol} />
          <CurrencyInput label="💰 Costo Producto" value={cost} onChange={setCost} symbol={country.symbol} />
          <CurrencyInput label="🚚 Flete Promedio" value={shipping} onChange={setShipping} hint={country.shippingHint} symbol={country.symbol} />
        </div>
      </div>

      {/* Section 2: Campaign */}
      <div className="bg-surface-secondary rounded-2xl border border-border p-5">
        <SectionHeader step={2} title="Tu Campaña Real" subtitle="Inversión, pedidos y días" />
        <div className="flex flex-wrap gap-4 mb-4">
          <CurrencyInput label="💸 Inversión en Pauta" value={adSpend} onChange={setAdSpend} hint="Total invertido en ese período" symbol={country.symbol} />
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">📦 Pedidos Totales</label>
            <input
              type="number"
              value={totalOrders || ''}
              onChange={(e) => setTotalOrders(Number(e.target.value) || 0)}
              className="w-full bg-[#1a1a2e] rounded-lg border border-border px-3 py-2.5 text-text-primary font-semibold text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <p className="text-[11px] text-text-secondary mt-1">Pedidos recibidos en ese período</p>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">📅 Días de Campaña</label>
            <input
              type="number"
              value={days || ''}
              onChange={(e) => setDays(Number(e.target.value) || 0)}
              className="w-full bg-[#1a1a2e] rounded-lg border border-border px-3 py-2.5 text-text-primary font-semibold text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <p className="text-[11px] text-text-secondary mt-1">¿En cuántos días fue eso?</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <SliderInput label="📵 % Cancelaciones" value={cancelPct} onChange={setCancelPct} />
          <SliderInput label="↩️ % Devoluciones" value={returnPct} onChange={setReturnPct} />
        </div>
      </div>

      {/* Results */}
      {allFilled ? (
        <>
          {/* Section 3: Funnel */}
          <div className="bg-surface-secondary rounded-2xl border border-border p-5">
            <SectionHeader step={3} title="Tu Embudo Real" subtitle="Pedidos → Entregas → Ganancia" />
            <div className="space-y-1">
              <ResultCard title="Pedidos Totales" value={`${totalOrders} pedidos · ${fmt(calc.totalRevenue)}`} />
              <FlowArrow text={`−${cancelPct}% = −${calc.cancelledOrders} cancelados`} />
              <ResultCard title="Despachados" value={`${calc.dispatched} pedidos`} />
              <FlowArrow text={`−${returnPct}% = −${calc.returnedOrders} devueltos`} />
              <ResultCard title="Entregados ✅" value={`${calc.delivered} pedidos · ${fmt(calc.deliveredRevenue)}`} variant="success" />
            </div>
          </div>

          {/* Section 4: Real P&L */}
          <div className="bg-surface-secondary rounded-2xl border border-border p-5">
            <SectionHeader step={4} title="Tu Rentabilidad Real" subtitle="Ingresos − costos − pauta" />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <ResultCard title="Ingresos Entregados" value={fmt(calc.deliveredRevenue)} />
              <ResultCard title={`Margen Bruto (${calc.marginPct.toFixed(0)}%)`} value={fmt(calc.grossMargin)} />
              <ResultCard title="Fletes Devueltos" value={`−${fmt(calc.returnShipping)}`} variant="danger" subtitle={`${calc.returnedOrders} dev. × ${fmt(shipping)}`} />
              <ResultCard title="Margen Neto Real" value={fmt(calc.realMargin)} variant={calc.realMargin > 0 ? 'success' : 'danger'} />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <ResultCard title="Inversión en Pauta" value={`−${fmt(adSpend)}`} variant="danger" />
              <ResultCard
                title="UTILIDAD OPERACIONAL 🎯"
                value={fmt(calc.operationalMargin)}
                variant={calc.operationalMargin > 0 ? 'success' : 'danger'}
                highlight
                subtitle={calc.operationalMargin > 0 ? 'Estás ganando dinero' : '¡Estás perdiendo dinero!'}
              />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <ResultCard title="CPA Real" value={fmt(calc.cpa)} subtitle="Costo por pedido" variant={calc.cpa <= calc.breakEvenCPA ? 'success' : 'danger'} />
              <ResultCard title="CPA Break-Even" value={fmt(calc.breakEvenCPA)} subtitle="CPA máximo sin perder" />
              <ResultCard title="ROAS" value={`${calc.roas.toFixed(1)}x`} variant={calc.roas >= 3 ? 'success' : calc.roas >= 2 ? 'warning' : 'danger'} subtitle={calc.roas >= 3 ? 'Excelente' : calc.roas >= 2 ? 'Aceptable' : 'Bajo'} />
              <ResultCard title="Ganancia / Día" value={fmt(calc.profitPerDay)} variant={calc.profitPerDay > 0 ? 'success' : 'danger'} subtitle={`${calc.ordersPerDay.toFixed(1)} pedidos/día`} />
            </div>
          </div>
        </>
      ) : (
        <div className="bg-surface-secondary rounded-2xl border border-amber-500/20 p-6 text-center">
          <p className="text-amber-400 font-bold text-sm mb-2">⛔ Completa todos los campos para ver los resultados</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {price <= 0 && <span className="text-xs text-text-secondary bg-[#1a1a2e] px-2 py-1 rounded">🏷️ Precio de venta</span>}
            {cost <= 0 && <span className="text-xs text-text-secondary bg-[#1a1a2e] px-2 py-1 rounded">💰 Costo producto</span>}
            {shipping <= 0 && <span className="text-xs text-text-secondary bg-[#1a1a2e] px-2 py-1 rounded">🚚 Flete promedio</span>}
            {adSpend <= 0 && <span className="text-xs text-text-secondary bg-[#1a1a2e] px-2 py-1 rounded">💸 Inversión en pauta</span>}
            {totalOrders <= 0 && <span className="text-xs text-text-secondary bg-[#1a1a2e] px-2 py-1 rounded">📦 Pedidos totales</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────
export default function CosteoCalculator({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'calculator' | 'real'>('calculator')
  const [countryIdx, setCountryIdx] = useState(0)
  const [showCountries, setShowCountries] = useState(false)
  const country = COUNTRIES[countryIdx]

  return (
    <div className="h-[calc(100vh-200px)]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-surface-secondary rounded-lg transition-colors text-text-secondary hover:text-text-primary"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-500 to-yellow-500">
              <span className="text-xl">📊</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Calculadora de Costeo</h2>
              <p className="text-sm text-text-secondary">Rentabilidad COD · {country.currency}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode toggle */}
            <div className="flex bg-[#1a1a2e] rounded-lg border border-border p-0.5">
              <button
                onClick={() => setMode('calculator')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  mode === 'calculator' ? 'bg-amber-500/20 text-amber-400' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                📊 Calculadora
              </button>
              <button
                onClick={() => setMode('real')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  mode === 'real' ? 'bg-amber-500/20 text-amber-400' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                📈 Real
              </button>
            </div>

            {/* Country selector */}
            <div className="relative">
              <button
                onClick={() => setShowCountries(!showCountries)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a2e] rounded-lg border border-border text-xs font-medium text-text-primary hover:border-border/80 transition-colors"
              >
                <span>{country.flag}</span>
                <span>{country.name}</span>
                <span className="text-text-secondary">▾</span>
              </button>
              {showCountries && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCountries(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded-xl shadow-xl py-1 min-w-[160px]">
                    {COUNTRIES.map((c, i) => (
                      <button
                        key={c.code}
                        onClick={() => { setCountryIdx(i); setShowCountries(false) }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface-secondary transition-colors',
                          i === countryIdx ? 'text-amber-400 font-bold' : 'text-text-primary'
                        )}
                      >
                        <span>{c.flag}</span>
                        <span>{c.name}</span>
                        <span className="text-text-secondary ml-auto">{c.currency}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden">
          <div className="text-center mb-4">
            <span className="inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full">
              {country.flag} Dropshipping {country.name} · {country.currency}
            </span>
            <h3 className="text-xl font-bold text-text-primary mt-2">
              {mode === 'calculator' ? '¿Es rentable tu producto?' : '¿Cuánto te estás ganando'}
            </h3>
            <p className="text-text-secondary text-sm">
              {mode === 'calculator'
                ? 'Calcula todo en 3 pasos.'
                : 'con lo que ya inviertes?'}
            </p>
          </div>

          {mode === 'calculator'
            ? <CalculatorMode key={`calc-${countryIdx}`} country={country} />
            : <RealMode key={`real-${countryIdx}`} country={country} />
          }
        </div>
      </div>
    </div>
  )
}
