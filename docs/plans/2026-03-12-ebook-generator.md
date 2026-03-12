# Generador de Ebooks IA — Plan de Implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Nueva herramienta en Studio IA (Dropshipping) que genera ebooks/PDFs profesionales de 20-50 páginas como complemento digital para productos físicos.

**Architecture:** Wizard de 4 pasos en el Studio IA. Usa servicios centralizados existentes (ai-text.ts para contenido, image-providers para portada+ilustraciones). PDFs compilados server-side con @react-pdf/renderer. Guardado en Supabase Storage + R2 vía tabla generations.

**Tech Stack:** Next.js 14 API Routes, @react-pdf/renderer, generateAIText(), generateImage(), Supabase Storage, SSE streaming.

---

## Task 1: Instalar dependencias y configurar infra

**Files:**
- Modify: `package.json`
- Modify: `vercel.json`

**Step 1: Instalar @react-pdf/renderer**
```bash
cd C:/Users/Asus/Downloads/estrategas-landing-generator
npm install @react-pdf/renderer
```

**Step 2: Agregar maxDuration en vercel.json para ruta de generación**
```json
"app/api/studio/ebook/generate/route.ts": {
  "maxDuration": 300
}
```

**Step 3: Commit**
```bash
git add package.json package-lock.json vercel.json
git commit -m "feat(ebook): install @react-pdf/renderer and configure maxDuration"
```

---

## Task 2: Crear tipos y definiciones de plantillas

**Files:**
- Create: `lib/ebook/types.ts`
- Create: `lib/ebook/templates.ts`

### types.ts
```typescript
// Interfaces: EbookConfig, EbookChapter, EbookTemplate, EbookIdea,
// ProductSource ('dropkiller' | 'landing' | 'droppage' | 'manual'),
// ProductInput, GenerationProgress
```

### templates.ts
```typescript
// 6 plantillas temáticas:
// salud-bienestar, belleza-cuidado, tecnologia, hogar-cocina, moda-estilo, universal
// Cada una define: name, colors (primary, secondary, accent, bg, text),
// fontFamily, coverStyle, headerStyle, imageStyle
```

**Step: Commit**
```bash
git add lib/ebook/
git commit -m "feat(ebook): add types and 6 thematic templates"
```

---

## Task 3: Crear PDF builder con @react-pdf/renderer

**Files:**
- Create: `lib/ebook/pdf-builder.tsx`

Componentes React PDF:
- `EbookDocument` — documento raíz
- `CoverPage` — portada profesional con imagen, título, subtítulo, logo
- `TableOfContents` — índice con números de página
- `ChapterPage` — página de capítulo con header, contenido, imagen
- `BackCover` — contraportada con resumen

Cada componente acepta template (colores, fuentes) y adapta el diseño.

**Step: Commit**
```bash
git add lib/ebook/pdf-builder.tsx
git commit -m "feat(ebook): create professional PDF builder with @react-pdf"
```

---

## Task 4: API Route — Analyze (analizar producto y sugerir ideas)

**Files:**
- Create: `app/api/studio/ebook/analyze/route.ts`

```
POST /api/studio/ebook/analyze
Body: { productName, productDescription, productImages[] }
Auth: Supabase user required
Uses: generateAIText() con system prompt para análisis de producto
Returns: { analysis, ideas: [{title, subtitle, description, category}], suggestedTemplate }
```

**Step: Commit**
```bash
git add app/api/studio/ebook/analyze/
git commit -m "feat(ebook): add analyze route — AI suggests 3 ebook ideas per product"
```

---

## Task 5: API Route — Outline (generar estructura de capítulos)

**Files:**
- Create: `app/api/studio/ebook/outline/route.ts`

```
POST /api/studio/ebook/outline
Body: { productName, productDescription, selectedIdea, template, chaptersCount? }
Auth: Supabase user required
Uses: generateAIText() con system prompt para estructura de ebook
Returns: { title, subtitle, chapters: [{number, title, summary, imageKeyword}] }
```

**Step: Commit**
```bash
git add app/api/studio/ebook/outline/
git commit -m "feat(ebook): add outline route — generates chapter structure"
```

---

## Task 6: API Route — Generate (generar contenido + imágenes + PDF vía SSE)

**Files:**
- Create: `app/api/studio/ebook/generate/route.ts`

```
POST /api/studio/ebook/generate
Body: { outline, template, logoUrl?, productImages[], productName }
Auth: Supabase user required
maxDuration: 300s (vercel.json)
Streaming: SSE con progreso por paso

Pipeline:
1. Genera portada con generateImage() → SSE progress
2. Por cada capítulo:
   a. generateAIText() → contenido → SSE progress
   b. generateImage() → ilustración → SSE progress
3. Compila PDF con @react-pdf/renderer (renderToBuffer)
4. Sube PDF a Supabase Storage
5. Intenta subir a R2 del usuario (tryUploadToR2)
6. Guarda en tabla generations: product_name='Ebook: {título}'
7. SSE final con URL del PDF
```

**Step: Commit**
```bash
git add app/api/studio/ebook/generate/
git commit -m "feat(ebook): add generate route — SSE pipeline for content+images+PDF"
```

---

## Task 7: API Route — Download

**Files:**
- Create: `app/api/studio/ebook/download/route.ts`

```
GET /api/studio/ebook/download?id={generationId}
Auth: Supabase user required
Returns: Signed URL del PDF o redirect
```

**Step: Commit**
```bash
git add app/api/studio/ebook/download/
git commit -m "feat(ebook): add download route with signed URL"
```

---

## Task 8: Componente ProductSelector (multi-fuente)

**Files:**
- Create: `components/studio/ebook/ProductSelector.tsx`

Tabs: Catálogo (DropKiller) | Mis Productos (Landing Gen) | Mi Tienda (DropPage) | Manual
- Catálogo: mini buscador que llama a product-intelligence-dropi API
- Mis Productos: carga de tabla products del usuario en Supabase
- Mi Tienda: carga productos de DropPage API (si tiene tienda)
- Manual: form con nombre, descripción, upload de fotos

Output: { productName, productDescription, productImages[] }

**Step: Commit**
```bash
git add components/studio/ebook/ProductSelector.tsx
git commit -m "feat(ebook): add multi-source ProductSelector component"
```

---

## Task 9: Componentes IdeaSelector, TemplateSelector, OutlineEditor

**Files:**
- Create: `components/studio/ebook/IdeaSelector.tsx`
- Create: `components/studio/ebook/TemplateSelector.tsx`
- Create: `components/studio/ebook/OutlineEditor.tsx`

- IdeaSelector: muestra 3 cards con ideas, opción de escribir idea propia
- TemplateSelector: grid visual de 6 templates + upload de logo
- OutlineEditor: lista editable de capítulos, reordenar, editar títulos

**Step: Commit**
```bash
git add components/studio/ebook/
git commit -m "feat(ebook): add IdeaSelector, TemplateSelector, OutlineEditor"
```

---

## Task 10: Componentes GenerationProgress y EbookPreview

**Files:**
- Create: `components/studio/ebook/GenerationProgress.tsx`
- Create: `components/studio/ebook/EbookPreview.tsx`

- GenerationProgress: barra de progreso + mensajes SSE en tiempo real
- EbookPreview: muestra PDF embedido + botones descargar/galería

**Step: Commit**
```bash
git add components/studio/ebook/
git commit -m "feat(ebook): add GenerationProgress and EbookPreview components"
```

---

## Task 11: EbookGenerator.tsx — Componente principal (wizard)

**Files:**
- Create: `components/studio/ebook/EbookGenerator.tsx`

Wizard de 4 pasos:
1. ProductSelector → obtiene producto
2. IdeaSelector + TemplateSelector → config del ebook
3. OutlineEditor → confirma estructura
4. GenerationProgress → genera → EbookPreview → resultado

**Step: Commit**
```bash
git add components/studio/ebook/EbookGenerator.tsx
git commit -m "feat(ebook): add EbookGenerator wizard component"
```

---

## Task 12: Integrar en DropshippingGrid.tsx

**Files:**
- Modify: `components/studio/DropshippingGrid.tsx`

- Agregar tool 'ebook-generator' al array DROPSHIPPING_TOOLS
- Importar EbookGenerator
- Agregar case en el render

**Step: Commit + Push**
```bash
git add components/studio/DropshippingGrid.tsx
git commit -m "feat(ebook): integrate Ebook Generator in Studio IA grid"
git push origin developers
```
