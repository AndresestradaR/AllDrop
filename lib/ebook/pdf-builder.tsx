import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { EbookTemplate, EbookOutline, EbookChapter } from './types'

// ============================================
// PROFESSIONAL EBOOK PDF BUILDER
// Uses @react-pdf/renderer for server-side PDF generation
// ============================================

// PDF label translations (used inside the PDF itself)
const PDF_LABELS: Record<string, { badge: string; toc: string; intro: string; chapter: string; conclusion: string; backCover: string }> = {
  es: { badge: 'Guia Completa', toc: 'Contenido', intro: 'Introduccion', chapter: 'Capitulo', conclusion: 'Conclusion', backCover: 'Gracias por leer esta guia. Esperamos que la informacion te sea de gran utilidad para aprovechar al maximo tu producto.' },
  en: { badge: 'Complete Guide', toc: 'Contents', intro: 'Introduction', chapter: 'Chapter', conclusion: 'Conclusion', backCover: 'Thank you for reading this guide. We hope the information is useful for getting the most out of your product.' },
  fr: { badge: 'Guide Complet', toc: 'Sommaire', intro: 'Introduction', chapter: 'Chapitre', conclusion: 'Conclusion', backCover: 'Merci d\'avoir lu ce guide. Nous esperons que les informations vous seront utiles pour profiter au maximum de votre produit.' },
  it: { badge: 'Guida Completa', toc: 'Indice', intro: 'Introduzione', chapter: 'Capitolo', conclusion: 'Conclusione', backCover: 'Grazie per aver letto questa guida. Speriamo che le informazioni ti siano utili per sfruttare al meglio il tuo prodotto.' },
  pt: { badge: 'Guia Completo', toc: 'Conteudo', intro: 'Introducao', chapter: 'Capitulo', conclusion: 'Conclusao', backCover: 'Obrigado por ler este guia. Esperamos que as informacoes sejam uteis para aproveitar ao maximo seu produto.' },
  de: { badge: 'Kompletter Leitfaden', toc: 'Inhalt', intro: 'Einleitung', chapter: 'Kapitel', conclusion: 'Fazit', backCover: 'Vielen Dank fur das Lesen dieses Leitfadens. Wir hoffen, dass die Informationen Ihnen helfen, das Beste aus Ihrem Produkt herauszuholen.' },
}

function getPdfLabels(language?: string) {
  return PDF_LABELS[language || 'es'] || PDF_LABELS.es
}

// Register default fonts (system fonts available in @react-pdf)
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
    { src: 'Helvetica-Oblique', fontStyle: 'italic' },
  ],
})

// ============================================
// SHARED STYLES FACTORY
// ============================================
function createStyles(template: EbookTemplate) {
  const { colors } = template
  return StyleSheet.create({
    // Page defaults
    page: {
      fontFamily: 'Helvetica',
      fontSize: 11,
      color: colors.text,
      backgroundColor: '#FFFFFF',
      paddingTop: 50,
      paddingBottom: 60,
      paddingHorizontal: 50,
    },

    // ---- COVER PAGE ----
    coverPage: {
      fontFamily: 'Helvetica',
      backgroundColor: colors.primary,
      padding: 0,
      position: 'relative',
    },
    coverOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    coverImage: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      objectFit: 'cover',
    },
    coverContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 60,
      zIndex: 1,
    },
    coverBadge: {
      backgroundColor: colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 20,
      marginBottom: 24,
    },
    coverBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
    coverTitle: {
      fontSize: 36,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 12,
      lineHeight: 1.2,
    },
    coverSubtitle: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.85)',
      textAlign: 'center',
      marginBottom: 40,
      lineHeight: 1.4,
    },
    coverDivider: {
      width: 60,
      height: 3,
      backgroundColor: colors.secondary,
      marginBottom: 40,
    },
    coverLogo: {
      width: 80,
      height: 80,
      objectFit: 'contain',
      marginTop: 20,
    },
    coverGradientTop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 200,
      backgroundColor: colors.primary,
      opacity: 0.9,
    },
    coverGradientBottom: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 200,
      backgroundColor: colors.accent,
      opacity: 0.7,
    },

    // ---- TABLE OF CONTENTS ----
    tocPage: {
      fontFamily: 'Helvetica',
      backgroundColor: colors.background,
      paddingTop: 60,
      paddingBottom: 60,
      paddingHorizontal: 60,
    },
    tocHeader: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 8,
    },
    tocDivider: {
      width: 50,
      height: 3,
      backgroundColor: colors.primary,
      marginBottom: 30,
    },
    tocItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
    },
    tocItemNumber: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    tocItemNumberText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: 'bold',
    },
    tocItemTitle: {
      fontSize: 13,
      color: colors.text,
      flex: 1,
    },
    tocItemDots: {
      flex: 1,
      borderBottomWidth: 1,
      borderBottomColor: colors.secondary,
      borderStyle: 'dotted',
      marginHorizontal: 8,
    },

    // ---- CHAPTER PAGE ----
    chapterHeader: {
      backgroundColor: colors.chapterBg,
      marginHorizontal: -50,
      marginTop: -50,
      paddingTop: 40,
      paddingBottom: 30,
      paddingHorizontal: 50,
      marginBottom: 30,
    },
    chapterNumber: {
      fontSize: 12,
      fontWeight: 'bold',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 3,
      marginBottom: 8,
    },
    chapterTitle: {
      fontSize: 26,
      fontWeight: 'bold',
      color: colors.text,
      lineHeight: 1.3,
    },
    chapterDivider: {
      width: 40,
      height: 3,
      backgroundColor: colors.primary,
      marginTop: 12,
    },
    chapterContent: {
      fontSize: 11,
      lineHeight: 1.7,
      color: colors.text,
      textAlign: 'justify',
    },
    chapterImage: {
      width: '100%',
      height: 280,
      objectFit: 'cover',
      borderRadius: 8,
      marginVertical: 20,
    },
    chapterImageCaption: {
      fontSize: 9,
      color: colors.textLight,
      textAlign: 'center',
      marginTop: -12,
      marginBottom: 16,
      fontStyle: 'italic',
    },

    // ---- INTRO / CONCLUSION ----
    introTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 16,
    },
    introContent: {
      fontSize: 12,
      lineHeight: 1.8,
      color: colors.text,
      textAlign: 'justify',
    },

    // ---- HIGHLIGHT BOX ----
    highlightBox: {
      backgroundColor: colors.chapterBg,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      padding: 16,
      marginVertical: 16,
      borderRadius: 4,
    },
    highlightText: {
      fontSize: 11,
      lineHeight: 1.6,
      color: colors.text,
      fontStyle: 'italic',
    },

    // ---- FOOTER ----
    footer: {
      position: 'absolute',
      bottom: 25,
      left: 50,
      right: 50,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    footerLine: {
      position: 'absolute',
      bottom: 45,
      left: 50,
      right: 50,
      height: 1,
      backgroundColor: colors.secondary,
    },
    footerText: {
      fontSize: 8,
      color: colors.textLight,
    },
    footerPage: {
      fontSize: 9,
      color: colors.primary,
      fontWeight: 'bold',
    },

    // ---- BACK COVER ----
    backCoverPage: {
      fontFamily: 'Helvetica',
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 60,
    },
    backCoverTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 16,
    },
    backCoverText: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.8)',
      textAlign: 'center',
      lineHeight: 1.6,
      maxWidth: 350,
    },
    backCoverLogo: {
      width: 60,
      height: 60,
      objectFit: 'contain',
      marginTop: 40,
    },
  })
}

// ============================================
// HELPER: Split long content into paragraphs
// ============================================
function splitIntoParagraphs(content: string): string[] {
  return content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

// ============================================
// COVER PAGE
// ============================================
function CoverPage({
  title,
  subtitle,
  coverImageUrl,
  logoUrl,
  template,
  language,
}: {
  title: string
  subtitle: string
  coverImageUrl?: string
  logoUrl?: string
  template: EbookTemplate
  language?: string
}) {
  const styles = createStyles(template)
  const labels = getPdfLabels(language)

  return (
    <Page size="A4" style={styles.coverPage}>
      {coverImageUrl && <Image src={coverImageUrl} style={styles.coverImage} />}
      {coverImageUrl && <View style={styles.coverOverlay} />}
      {!coverImageUrl && (
        <>
          <View style={styles.coverGradientTop} />
          <View style={styles.coverGradientBottom} />
        </>
      )}
      <View style={styles.coverContent}>
        <View style={styles.coverBadge}>
          <Text style={styles.coverBadgeText}>{labels.badge}</Text>
        </View>
        <Text style={styles.coverTitle}>{title}</Text>
        <View style={styles.coverDivider} />
        <Text style={styles.coverSubtitle}>{subtitle}</Text>
        {logoUrl && <Image src={logoUrl} style={styles.coverLogo} />}
      </View>
    </Page>
  )
}

// ============================================
// TABLE OF CONTENTS
// ============================================
function TableOfContents({
  chapters,
  template,
  language,
}: {
  chapters: EbookChapter[]
  template: EbookTemplate
  language?: string
}) {
  const styles = createStyles(template)
  const labels = getPdfLabels(language)

  return (
    <Page size="A4" style={styles.tocPage}>
      <Text style={styles.tocHeader}>{labels.toc}</Text>
      <View style={styles.tocDivider} />
      {chapters.map((ch) => (
        <View key={ch.number} style={styles.tocItem}>
          <View style={styles.tocItemNumber}>
            <Text style={styles.tocItemNumberText}>{ch.number}</Text>
          </View>
          <Text style={styles.tocItemTitle}>{ch.title}</Text>
        </View>
      ))}
    </Page>
  )
}

// ============================================
// INTRODUCTION PAGE
// ============================================
function IntroductionPage({
  content,
  template,
  ebookTitle,
  language,
}: {
  content: string
  template: EbookTemplate
  ebookTitle: string
  language?: string
}) {
  const styles = createStyles(template)
  const paragraphs = splitIntoParagraphs(content)
  const labels = getPdfLabels(language)

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.introTitle}>{labels.intro}</Text>
      {paragraphs.map((p, i) => (
        <Text key={i} style={styles.introContent}>
          {p}
        </Text>
      ))}
      <View style={styles.footerLine} />
      <View style={styles.footer}>
        <Text style={styles.footerText}>{ebookTitle}</Text>
        <Text style={styles.footerPage}>3</Text>
      </View>
    </Page>
  )
}

// ============================================
// CHAPTER PAGES
// ============================================
function ChapterPages({
  chapter,
  template,
  ebookTitle,
  startPage,
  language,
}: {
  chapter: EbookChapter
  template: EbookTemplate
  ebookTitle: string
  startPage: number
  language?: string
}) {
  const styles = createStyles(template)
  const labels = getPdfLabels(language)
  const content = chapter.content || chapter.summary
  const paragraphs = splitIntoParagraphs(content)

  // Split paragraphs into chunks that fit on pages (~2500 chars per page approx)
  const CHARS_PER_PAGE = 2200
  const pages: string[][] = []
  let currentPage: string[] = []
  let currentLen = 0

  for (const p of paragraphs) {
    if (currentLen + p.length > CHARS_PER_PAGE && currentPage.length > 0) {
      pages.push(currentPage)
      currentPage = [p]
      currentLen = p.length
    } else {
      currentPage.push(p)
      currentLen += p.length
    }
  }
  if (currentPage.length > 0) pages.push(currentPage)

  // If no content, at least one page
  if (pages.length === 0) pages.push([chapter.summary || ''])

  return (
    <>
      {pages.map((pageContent, pageIdx) => (
        <Page key={`ch${chapter.number}-p${pageIdx}`} size="A4" style={styles.page}>
          {/* Chapter header only on first page */}
          {pageIdx === 0 && (
            <View style={styles.chapterHeader}>
              <Text style={styles.chapterNumber}>{labels.chapter} {chapter.number}</Text>
              <Text style={styles.chapterTitle}>{chapter.title}</Text>
              <View style={styles.chapterDivider} />
            </View>
          )}

          {/* Chapter image on first page after header */}
          {pageIdx === 0 && chapter.imageUrl && (
            <>
              <Image src={chapter.imageUrl} style={styles.chapterImage} />
            </>
          )}

          {/* Content paragraphs */}
          {pageContent.map((p, i) => (
            <Text key={i} style={styles.chapterContent}>
              {p}
            </Text>
          ))}

          {/* Footer */}
          <View style={styles.footerLine} />
          <View style={styles.footer}>
            <Text style={styles.footerText}>{ebookTitle}</Text>
            <Text style={styles.footerPage}>{startPage + pageIdx}</Text>
          </View>
        </Page>
      ))}
    </>
  )
}

// ============================================
// CONCLUSION PAGE
// ============================================
function ConclusionPage({
  content,
  template,
  ebookTitle,
  pageNumber,
  language,
}: {
  content: string
  template: EbookTemplate
  ebookTitle: string
  pageNumber: number
  language?: string
}) {
  const styles = createStyles(template)
  const paragraphs = splitIntoParagraphs(content)
  const labels = getPdfLabels(language)

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.introTitle}>{labels.conclusion}</Text>
      {paragraphs.map((p, i) => (
        <Text key={i} style={styles.introContent}>
          {p}
        </Text>
      ))}
      <View style={styles.footerLine} />
      <View style={styles.footer}>
        <Text style={styles.footerText}>{ebookTitle}</Text>
        <Text style={styles.footerPage}>{pageNumber}</Text>
      </View>
    </Page>
  )
}

// ============================================
// BACK COVER
// ============================================
function BackCover({
  title,
  logoUrl,
  template,
  language,
}: {
  title: string
  logoUrl?: string
  template: EbookTemplate
  language?: string
}) {
  const styles = createStyles(template)
  const labels = getPdfLabels(language)

  return (
    <Page size="A4" style={styles.backCoverPage}>
      <Text style={styles.backCoverTitle}>{title}</Text>
      <Text style={styles.backCoverText}>
        {labels.backCover}
      </Text>
      {logoUrl && <Image src={logoUrl} style={styles.backCoverLogo} />}
    </Page>
  )
}

// ============================================
// MAIN DOCUMENT — Assembles all pages
// ============================================
export function EbookDocument({
  outline,
  template,
  coverImageUrl,
  logoUrl,
  language,
}: {
  outline: EbookOutline
  template: EbookTemplate
  coverImageUrl?: string
  logoUrl?: string
  language?: string
}) {
  // Calculate page numbers:
  // Cover (1) + TOC (2) + Intro (3) + chapters start at 4
  let currentPage = 4

  return (
    <Document
      title={outline.title}
      author="Estrategas IA"
      subject={outline.subtitle}
      creator="Estrategas IA - Ebook Generator"
    >
      <CoverPage
        title={outline.title}
        subtitle={outline.subtitle}
        coverImageUrl={coverImageUrl}
        logoUrl={logoUrl}
        template={template}
        language={language}
      />

      <TableOfContents chapters={outline.chapters} template={template} language={language} />

      <IntroductionPage
        content={outline.introduction}
        template={template}
        ebookTitle={outline.title}
        language={language}
      />

      {outline.chapters.map((chapter) => {
        const startPage = currentPage
        // Estimate pages per chapter: ~1 page per 2200 chars + 1 for image
        const contentLen = (chapter.content || chapter.summary || '').length
        const estimatedPages = Math.max(1, Math.ceil(contentLen / 2200))
        currentPage += estimatedPages

        return (
          <ChapterPages
            key={chapter.number}
            chapter={chapter}
            template={template}
            ebookTitle={outline.title}
            startPage={startPage}
            language={language}
          />
        )
      })}

      <ConclusionPage
        content={outline.conclusion}
        template={template}
        ebookTitle={outline.title}
        pageNumber={currentPage}
        language={language}
      />

      <BackCover title={outline.title} logoUrl={logoUrl} template={template} language={language} />
    </Document>
  )
}
