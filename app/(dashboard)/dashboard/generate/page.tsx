'use client'

import { useState } from 'react'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { useI18n } from '@/lib/i18n'
import { Sparkles, Download, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export const dynamic = 'force-dynamic'

export default function GeneratePage() {
  const { t } = useI18n()
  const [productName, setProductName] = useState('')
  const [notes, setNotes] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null)

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!productName.trim()) {
      toast.error(t.generate.nameRequired)
      return
    }

    setIsGenerating(true)
    setGeneratedImage(null)
    setEnhancedPrompt(null)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: productName.trim(),
          notes: notes.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t.generate.generateError)
      }

      setGeneratedImage(data.imageUrl)
      setEnhancedPrompt(data.enhancedPrompt)
      toast.success(t.generate.imageGenerated)
    } catch (error: any) {
      toast.error(error.message || t.generate.generateError)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async () => {
    if (!generatedImage) return

    try {
      const response = await fetch(generatedImage)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${productName.replace(/\s+/g, '-').toLowerCase()}-landing.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success(t.generate.imageDownloaded)
    } catch (error) {
      toast.error(t.generate.downloadError)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">{t.generate.title}</h1>
        <p className="text-text-secondary mt-1">
          {t.generate.subtitle}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t.generate.productDetails}</CardTitle>
            <CardDescription>
              {t.generate.describeProduct}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerate} className="space-y-4">
              <Input
                label={t.generate.productName}
                placeholder={t.generate.productPlaceholder}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
              />
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  {t.generate.additionalNotes}
                </label>
                <textarea
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors resize-none"
                  rows={3}
                  placeholder={t.generate.notesPlaceholder}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                isLoading={isGenerating}
                disabled={isGenerating}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {isGenerating ? t.generate.generating : t.generate.generateImage}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>{t.generate.preview}</CardTitle>
            <CardDescription>
              {t.generate.previewDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-[9/16] bg-background border border-border rounded-lg overflow-hidden flex items-center justify-center">
              {isGenerating ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-3" />
                  <p className="text-text-secondary text-sm">{t.generate.generatingImage}</p>
                  <p className="text-text-secondary text-xs mt-1">{t.generate.generatingTime}</p>
                </div>
              ) : generatedImage ? (
                <img
                  src={generatedImage}
                  alt={productName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center px-4">
                  <Sparkles className="w-12 h-12 text-border mx-auto mb-3" />
                  <p className="text-text-secondary text-sm">
                    {t.generate.fillForm}
                  </p>
                </div>
              )}
            </div>

            {generatedImage && (
              <div className="mt-4 space-y-3">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t.generate.downloadImage}
                </Button>

                {enhancedPrompt && (
                  <div className="p-3 bg-background rounded-lg border border-border">
                    <p className="text-xs text-text-secondary mb-1">{t.generate.promptUsed}</p>
                    <p className="text-xs text-text-primary">{enhancedPrompt}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
