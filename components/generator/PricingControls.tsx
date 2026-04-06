'use client'

import { DollarSign, Tag, Package, Info } from 'lucide-react'
import { Input } from '@/components/ui'
import { useI18n } from '@/lib/i18n'

export interface PricingData {
  currencySymbol: string
  priceAfter: string // Precio oferta (principal)
  priceBefore: string // Precio antes (tachado)
  priceCombo2: string // Precio 2 unidades
  priceCombo3: string // Precio 3 unidades
}

interface PricingControlsProps {
  value: PricingData
  onChange: (data: PricingData) => void
  disabled?: boolean
}

export default function PricingControls({ value, onChange, disabled }: PricingControlsProps) {
  const { t } = useI18n()
  const updateField = (field: keyof PricingData, newValue: string) => {
    onChange({ ...value, [field]: newValue })
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <DollarSign className="w-4 h-4 text-accent" />
        {t.editor.productPrices}
      </label>

      {/* Currency Symbol */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-text-secondary">{t.editor.currencySymbol}</label>
        <Input
          type="text"
          value={value.currencySymbol}
          onChange={(e) => updateField('currencySymbol', e.target.value)}
          disabled={disabled}
          className="w-24 text-center"
          placeholder="$"
        />
        <p className="text-xs text-text-tertiary">
          {t.editor.currencyHint}
        </p>
      </div>

      {/* Main Prices */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
            <Tag className="w-3.5 h-3.5 text-green-500" />
            {t.editor.offerPrice}
          </label>
          <div className="flex">
            <span className="px-3 py-2.5 bg-surface border border-r-0 border-border rounded-l-xl text-text-secondary text-sm">
              {value.currencySymbol || '$'}
            </span>
            <Input
              type="text"
              value={value.priceAfter}
              onChange={(e) => updateField('priceAfter', e.target.value)}
              disabled={disabled}
              placeholder="89900"
              className="rounded-l-none flex-1"
            />
          </div>
          <p className="text-xs text-text-tertiary">{t.editor.offerPriceHint}</p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
            <Tag className="w-3.5 h-3.5 text-red-500" />
            {t.editor.previousPrice}
          </label>
          <div className="flex">
            <span className="px-3 py-2.5 bg-surface border border-r-0 border-border rounded-l-xl text-text-secondary text-sm">
              {value.currencySymbol || '$'}
            </span>
            <Input
              type="text"
              value={value.priceBefore}
              onChange={(e) => updateField('priceBefore', e.target.value)}
              disabled={disabled}
              placeholder="109900"
              className="rounded-l-none flex-1"
            />
          </div>
          <p className="text-xs text-text-tertiary">{t.editor.previousPriceHint}</p>
        </div>
      </div>

      {/* Combo Prices */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
            <Package className="w-3.5 h-3.5 text-blue-500" />
            {t.editor.price2Units}
          </label>
          <div className="flex">
            <span className="px-3 py-2.5 bg-surface border border-r-0 border-border rounded-l-xl text-text-secondary text-sm">
              {value.currencySymbol || '$'}
            </span>
            <Input
              type="text"
              value={value.priceCombo2}
              onChange={(e) => updateField('priceCombo2', e.target.value)}
              disabled={disabled}
              placeholder="139900"
              className="rounded-l-none flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
            <Package className="w-3.5 h-3.5 text-purple-500" />
            {t.editor.price3Units}
          </label>
          <div className="flex">
            <span className="px-3 py-2.5 bg-surface border border-r-0 border-border rounded-l-xl text-text-secondary text-sm">
              {value.currencySymbol || '$'}
            </span>
            <Input
              type="text"
              value={value.priceCombo3}
              onChange={(e) => updateField('priceCombo3', e.target.value)}
              disabled={disabled}
              placeholder="179900"
              className="rounded-l-none flex-1"
            />
          </div>
        </div>
      </div>

      {/* Info Note */}
      <div className="flex items-start gap-2 p-3 bg-surface rounded-xl border border-border">
        <Info className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
        <p className="text-xs text-text-secondary">
          {t.editor.pricingNote}
        </p>
      </div>
    </div>
  )
}

// Compact version for smaller spaces
export function PricingControlsCompact({
  value,
  onChange,
  disabled,
}: PricingControlsProps) {
  const { t } = useI18n()
  const updateField = (field: keyof PricingData, newValue: string) => {
    onChange({ ...value, [field]: newValue })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <DollarSign className="w-4 h-4 text-accent" />
          {t.editor.prices}
        </label>
        <Input
          type="text"
          value={value.currencySymbol}
          onChange={(e) => updateField('currencySymbol', e.target.value)}
          disabled={disabled}
          className="w-16 text-center text-sm"
          placeholder="$"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          type="text"
          value={value.priceAfter}
          onChange={(e) => updateField('priceAfter', e.target.value)}
          disabled={disabled}
          placeholder={t.editor.offerPrice}
          className="text-sm"
        />
        <Input
          type="text"
          value={value.priceBefore}
          onChange={(e) => updateField('priceBefore', e.target.value)}
          disabled={disabled}
          placeholder={t.editor.previousPrice}
          className="text-sm"
        />
        <Input
          type="text"
          value={value.priceCombo2}
          onChange={(e) => updateField('priceCombo2', e.target.value)}
          disabled={disabled}
          placeholder={t.editor.price2Units}
          className="text-sm"
        />
        <Input
          type="text"
          value={value.priceCombo3}
          onChange={(e) => updateField('priceCombo3', e.target.value)}
          disabled={disabled}
          placeholder={t.editor.price3Units}
          className="text-sm"
        />
      </div>
    </div>
  )
}

// Helper function to check if pricing is empty
export function hasPricing(pricing: PricingData): boolean {
  return !!(
    pricing.priceAfter ||
    pricing.priceBefore ||
    pricing.priceCombo2 ||
    pricing.priceCombo3
  )
}

// Helper function to build pricing prompt section
export function buildPricingPrompt(pricing: PricingData): string {
  if (!hasPricing(pricing)) {
    return 'NO incluir precios en este banner - es solo para branding/awareness.'
  }

  const symbol = pricing.currencySymbol || '$'
  const lines: string[] = ['PRECIOS EXACTOS (usar estos valores, NO inventar):']

  if (pricing.priceAfter) {
    lines.push(`- Precio OFERTA: ${symbol}${pricing.priceAfter} (grande, destacado)`)
  }
  if (pricing.priceBefore) {
    lines.push(`- Precio ANTES: ${symbol}${pricing.priceBefore} (tachado, mas pequeno)`)
  }
  if (pricing.priceCombo2) {
    lines.push(`- Precio 2 UNIDADES: ${symbol}${pricing.priceCombo2}`)
  }
  if (pricing.priceCombo3) {
    lines.push(`- Precio 3 UNIDADES: ${symbol}${pricing.priceCombo3}`)
  }

  return lines.join('\n')
}

// Default empty pricing data
export function getDefaultPricingData(currencySymbol: string = '$'): PricingData {
  return {
    currencySymbol,
    priceAfter: '',
    priceBefore: '',
    priceCombo2: '',
    priceCombo3: '',
  }
}
