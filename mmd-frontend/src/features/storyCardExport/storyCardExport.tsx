import React, { useLayoutEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import html2canvas from 'html2canvas'
import JSZip from 'jszip'
import { jsPDF } from 'jspdf'
import { adaptGeneratedStoryRunToRuntime } from '../../data/adapters/generatedStoryAdapter'
import { portraitDataUrl } from '../../utils/portrait'

export const CARD_WIDTH = 1440
export const CARD_HEIGHT = 810
const EXPORT_BATCH_SIZE = 20
let activeStoryCardExport: Promise<void> | null = null

type GeneratedCard = {
  card_id?: unknown
  card_type?: unknown
  card_title?: unknown
  card_contents?: unknown
  act?: unknown
  linked_character?: unknown
  linked_character_id?: unknown
  [key: string]: unknown
}

type GeneratedStoryRun = {
  cards?: unknown
  [key: string]: unknown
}

export interface PrintableCardModel {
  id: string
  cardType: string
  sortAct: number
  title: string
  text: string
  tableRows?: { label: string; value: string }[]
  linkedCharacter?: string
  image?: string
  fileStem: string
  storyTitle: string
}

export interface PrintableCardBatch {
  cards: PrintableCardModel[]
  batchIndex: number
}

export interface StoryCardExportOptions {
  storyId: string
  storyTitle: string
  raw: unknown
  onProgress?: (completed: number, total: number) => void
}

const PRINTABLE_CARD_TYPE_ORDER = [
  'story_meta',
  'story_act',
  'character',
  'person',
  'location',
  'item',
  'secret',
  'clue',
  'puzzle',
  'game_card',
  'host_speech',
  'treasure',
  'solution',
] as const

const CARD_TYPE_RANK = new Map<string, number>(
  PRINTABLE_CARD_TYPE_ORDER.map((value, index) => [value, index]),
)

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'card'
}

function imageFromCard(card: GeneratedCard): string | null {
  return asString(card.image)
    ?? asString(card.image_url)
    ?? asString(card.imageUrl)
    ?? asString(card.card_image)
    ?? null
}

function stringifyContents(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function displayValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string') return value.trim() || '—'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function storyImageFromRun(raw: unknown, runtime: ReturnType<typeof adaptGeneratedStoryRunToRuntime>): string | undefined {
  const anyRun = (raw ?? {}) as any
  return asString(anyRun.storyImage)
    ?? asString(anyRun.story_image)
    ?? asString(anyRun.image)
    ?? asString(runtime.storyListItem.image)
    ?? undefined
}

function storySettingsCard(raw: unknown, storyTitle: string, runtime: ReturnType<typeof adaptGeneratedStoryRunToRuntime>): PrintableCardModel {
  const anyRun = (raw ?? {}) as any
  const rows: { label: string; value: string }[] = [
    { label: 'Prompt', value: displayValue(anyRun.userPrompt) },
    { label: 'Style', value: displayValue(anyRun.storyStyle) },
    { label: 'Cards', value: displayValue(anyRun.cardsPerPlayer * anyRun.playerCount) },
    { label: 'Clues', value: displayValue(anyRun.cluesPerPlayer * anyRun.playerCount) },
    { label: 'Puzzles', value: displayValue(anyRun.puzzleCount) },
    { label: 'Traits', value: displayValue(anyRun.profileCardsPerCharacter * anyRun.playerCount) },
  ]

  return {
    id: 'story-settings',
    cardType: 'story_meta',
    sortAct: 0,
    title: 'Story Settings',
    text: '',
    tableRows: rows,
    linkedCharacter: undefined,
    image: storyImageFromRun(raw, runtime),
    fileStem: '000_act-0_story_meta_story-settings',
    storyTitle,
  }
}

function sortKeyForCardType(cardType: string): number {
  return CARD_TYPE_RANK.get(cardType) ?? PRINTABLE_CARD_TYPE_ORDER.length + 1
}

function normalizeAct(card: GeneratedCard): number {
  return asNumber(card.act) ?? 0
}

function getCardLabel(cardType: string): string {
  return cardType.replace(/_/g, ' ').trim() || 'card'
}

function buildPrintableCards(input: {
  storyTitle: string
  raw: unknown
}): PrintableCardModel[] {
  const runtime = adaptGeneratedStoryRunToRuntime(input.raw)
  const storyTitle = runtime.storyListItem.title || input.storyTitle
  const run = (input.raw ?? {}) as GeneratedStoryRun
  const cards = Array.isArray(run.cards) ? (run.cards as GeneratedCard[]) : []
  if (!cards.length) throw new Error('Story export failed: no cards found in story JSON.')

  const mappedCards = cards.map((card, index): PrintableCardModel => {
      const id = asString(card.card_id) ?? `card-${index + 1}`
      const cardType = asString(card.card_type) ?? 'unknown'
      const title = asString(card.card_title)?.trim() || `${getCardLabel(cardType)} ${index + 1}`
      const text = stringifyContents(card.card_contents)
      const act = normalizeAct(card)
      const linkedCharacter =
        asString(card.linked_character)?.trim()
        ?? asString(card.linked_character_id)?.trim()
        ?? undefined
      const image =
        imageFromCard(card)
        ?? ((cardType === 'character' || cardType === 'person') ? portraitDataUrl(title) : undefined)
      const fileStem = [
        String(index + 1).padStart(3, '0'),
        `act-${act}`,
        sanitizeFilename(cardType),
        sanitizeFilename(id),
      ].join('_')

      return {
        id,
        cardType,
        sortAct: act,
        title,
        text,
        linkedCharacter,
        image,
        fileStem,
        storyTitle,
      }
    })

  return [storySettingsCard(input.raw, storyTitle, runtime), ...mappedCards]
    .sort((a, b) =>
      a.sortAct - b.sortAct
      || sortKeyForCardType(a.cardType) - sortKeyForCardType(b.cardType)
      || a.title.localeCompare(b.title)
      || a.id.localeCompare(b.id),
    )
    .map((card, index) => ({
      ...card,
      fileStem: [
        String(index + 1).padStart(3, '0'),
        `act-${card.sortAct}`,
        sanitizeFilename(card.cardType),
        sanitizeFilename(card.id),
      ].join('_'),
    }))
}

function chunkCards(cards: PrintableCardModel[], size: number): PrintableCardBatch[] {
  const batches: PrintableCardBatch[] = []
  for (let i = 0; i < cards.length; i += size) {
    batches.push({
      cards: cards.slice(i, i + size),
      batchIndex: batches.length,
    })
  }
  return batches
}

function storyFilePrefix(storyTitle: string, storyId: string): string {
  return sanitizeFilename(storyTitle || storyId)
}

function waitForFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

async function waitForBatchGcPause() {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

async function waitForTextFit(container: HTMLElement) {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>('[data-fit-text]'))
  if (!nodes.length) return
  for (let i = 0; i < 90; i++) {
    const allReady = nodes.every(node => node.dataset.fitReady === '1')
    if (allReady) return
    await waitForFrame()
  }
}

async function waitForFonts() {
  const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts
  if (fonts?.ready) await fonts.ready
}

function waitForImageLoad(img: HTMLImageElement) {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const done = () => {
      img.removeEventListener('load', done)
      img.removeEventListener('error', done)
      resolve()
    }
    img.addEventListener('load', done)
    img.addEventListener('error', done)
  })
}

async function waitForBatchAssets(container: HTMLElement) {
  await waitForFonts()
  const images = Array.from(container.querySelectorAll('img'))
  await Promise.all(images.map(waitForImageLoad))
  await waitForFrame()
}

async function waitForBatchReady(container: HTMLElement) {
  await waitForBatchAssets(container)
  await waitForTextFit(container)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Failed to encode card image.'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function exportCardSelector(cardId: string): string {
  const esc =
    typeof CSS !== 'undefined'
    && typeof (CSS as unknown as { escape?: (value: string) => string }).escape === 'function'
      ? (CSS as unknown as { escape: (value: string) => string }).escape(cardId)
      : cardId.replace(/[\\"]/g, '\\$&')

  return `[data-export-card="${esc}"]`
}

function ExportBatchView({ cards }: { cards: PrintableCardModel[] }) {
  return (
    <div className="story-card-export__batch">
      {cards.map(card => (
        <article
          key={card.id}
          className="story-card-export__card"
          data-export-card={card.id}
          data-card-type={card.cardType}
          style={{ width: `${CARD_WIDTH}px`, height: `${CARD_HEIGHT}px` }}
        >
          <div className="story-card-export__chrome" aria-hidden="true" />
          <header className="story-card-export__header">
            <div className="story-card-export__topline">
              <div className="story-card-export__subheading" title={card.storyTitle}>
                {card.storyTitle}
              </div>
              <div className="story-card-export__brand" aria-label="MMD">MMD</div>
            </div>

            <div className="story-card-export__headline">
              <div className="story-card-export__metaRow" aria-label="Card metadata">
                <span className="story-card-export__metaType">{getCardLabel(card.cardType).toUpperCase()}</span>
                <span className="story-card-export__metaSep" aria-hidden="true">•</span>
                <span className="story-card-export__metaAct">ACT {card.sortAct}</span>
                {card.linkedCharacter ? (
                  <>
                    <span className="story-card-export__metaSep" aria-hidden="true">•</span>
                    <span className="story-card-export__metaLink" title={card.linkedCharacter}>{card.linkedCharacter}</span>
                  </>
                ) : null}
              </div>
              <h2 className="story-card-export__title">{card.title}</h2>
            </div>
          </header>

           <div className="story-card-export__content story-card-export__content--with-media">
             <section className="story-card-export__body">
              {card.tableRows && card.tableRows.length ? (
                <FittedCardTable rows={card.tableRows} />
              ) : (
                <FittedCardText text={card.text || 'No card contents.'} />
              )}
             </section>

            <aside className="story-card-export__media" aria-label="Card artwork">
              <div className="story-card-export__frame">
                {card.image ? (
                  <img
                    src={card.image}
                    alt=""
                    className="story-card-export__img"
                    loading="eager"
                    decoding="sync"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div
                    className="story-card-export__mediaFallback"
                    data-card-type={card.cardType}
                    aria-hidden="true"
                  >
                    <div className="story-card-export__mediaFallbackLabel">
                      {getCardLabel(card.cardType)}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </article>
      ))}
    </div>
  )
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function FittedCardText({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const box = el.parentElement
    if (!box) return

    el.dataset.fitReady = '0'

    // Fixed typography: the media column always exists, so keep deterministic
    // min/max sizing and a constant line-height for stable export output.
    const minFont = 14
    const maxFont = 32
    const lineHeight = 1.42

    const available = box.clientHeight
    if (!available) {
      el.style.fontSize = '22px'
      el.style.lineHeight = String(lineHeight)
      el.dataset.fitReady = '1'
      return
    }

    const setSize = (px: number) => {
      el.style.fontSize = `${px}px`
      el.style.lineHeight = String(lineHeight)
    }

    // Binary search the largest size that does not overflow.
    el.style.transform = 'translateY(0px)'
    let lo = minFont
    let hi = maxFont
    let best = minFont
    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2
      setSize(mid)
      // Force layout read.
      const needed = el.scrollHeight
      if (needed <= available) {
        best = mid
        lo = mid + 0.1
      } else {
        hi = mid - 0.1
      }
    }

    const finalSize = clamp(Math.round(best * 10) / 10, minFont, maxFont)
    setSize(finalSize)

    // Vertically center when there's extra space (keeps cards feeling "filled" without top-heavy copy).
    const used = el.scrollHeight
    const slack = available - used
    el.style.transform = slack > 10 ? `translateY(${Math.floor(slack / 2)}px)` : 'translateY(0px)'
    el.dataset.fitReady = '1'
  }, [text])

  return (
    <div ref={ref} className="story-card-export__text" data-fit-text data-fit-ready="0">
      {text}
    </div>
  )
}

function FittedCardTable({ rows }: { rows: { label: string; value: string }[] }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const box = el.parentElement
    if (!box) return

    el.dataset.fitReady = '0'

    const minFont = 12
    const maxFont = 30
    const lineHeight = 1.5

    const available = box.clientHeight
    if (!available) {
      alert('no available');
      el.style.fontSize = '16px'
      el.style.lineHeight = String(lineHeight)
      el.style.transform = 'translateY(0px)'
      el.dataset.fitReady = '1'
      return
    }

    const setSize = (px: number) => {
      el.style.fontSize = `${px}px`
      el.style.lineHeight = String(lineHeight)
    }

    el.style.transform = 'translateY(0px)'
    let lo = minFont
    let hi = maxFont
    let best = minFont
    while (hi - lo > 0.35) {
      const mid = (lo + hi) / 2
      setSize(mid)
      const needed = el.scrollHeight
      if (needed <= available) {
        best = mid
        lo = mid + 0.1
      } else {
        hi = mid - 0.1
      }
    }

    const finalSize = clamp(Math.round(best * 10) / 10, minFont, maxFont)
    setSize(finalSize)

    const used = el.scrollHeight
    const slack = available - used
    el.style.transform = slack > 8 ? `translateY(${Math.floor(slack / 2)}px)` : 'translateY(0px)'
    el.dataset.fitReady = '1'
  }, [rows])

  return (
    <div ref={ref} className="story-card-export__tableWrap" data-fit-text data-fit-ready="0">
      <table className="story-card-export__table" aria-label="Story settings">
        <tbody>
          {rows.map(row => (
            <tr key={row.label}>
              <th scope="row" className="story-card-export__tableLabel">{row.label}</th>
              <td className="story-card-export__tableValue">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function mountExportHost(): { host: HTMLDivElement; stage: HTMLDivElement; root: Root } {
  const host = document.createElement('div')
  host.className = 'story-card-export'
  const stage = document.createElement('div')
  stage.className = 'story-card-export__stage'
  host.appendChild(stage)
  document.body.appendChild(host)
  const root = createRoot(stage)
  return { host, stage, root }
}

async function renderBatch(root: Root, batch: PrintableCardBatch) {
  flushSync(() => {
    root.render(<ExportBatchView cards={batch.cards} />)
  })
  await waitForFrame()
  await waitForFrame()
}

async function runStoryCardsExport(options: StoryCardExportOptions) {
  const printableCards = buildPrintableCards({
    storyTitle: options.storyTitle,
    raw: options.raw,
  })

  const batches = chunkCards(printableCards, EXPORT_BATCH_SIZE)
  const filePrefix = storyFilePrefix(options.storyTitle, options.storyId)
  const totalCards = printableCards.length
  let completedCards = 0
  const zip = new JSZip()
  const { host, stage, root } = mountExportHost()

  try {
    options.onProgress?.(completedCards, totalCards)

    for (const batch of batches) {
      await renderBatch(root, batch)
      await waitForBatchReady(stage)
      for (let index = 0; index < batch.cards.length; index++) {
        const card = batch.cards[index]
        const selector = exportCardSelector(card.id)
        const matches = stage.querySelectorAll<HTMLElement>(selector)
        if (matches.length > 1) {
          throw new Error(`Duplicate card id during export: ${card.id}`)
        }
        const node = matches[0]
        if (!node) throw new Error(`Missing export node for card ${card.id}.`)

        const canvas = await html2canvas(node, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: false,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          windowWidth: CARD_WIDTH,
          windowHeight: CARD_HEIGHT,
        })
        const blob = await canvasToBlob(canvas)
        zip.file(`${filePrefix}_${card.fileStem}.png`, blob)
        canvas.width = 0
        canvas.height = 0
        completedCards += 1
        options.onProgress?.(completedCards, totalCards)
      }

      flushSync(() => {
        root.render(null)
      })
      stage.innerHTML = ''
      await waitForFrame()
      await waitForBatchGcPause()
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const archiveName = `${sanitizeFilename(options.storyTitle || options.storyId)}_printable_cards.zip`
    downloadBlob(zipBlob, archiveName)
  } finally {
    root.unmount()
    host.remove()
  }
}

type PdfTwoUpLayout = {
  pageWidth: number
  pageHeight: number
  margin: number
  gap: number
  cardWidth: number
  cardHeight: number
  x: number
  y: number
}

function computePdfTwoUpLayout(doc: jsPDF): PdfTwoUpLayout {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  // Units are inches (Letter landscape). Keep margins consistent to avoid
  // browser/printer "fit to page" surprises.
  const margin = 0.25
  const gap = 0.25

  const availableWidth = pageWidth - margin * 2
  const availableHeight = pageHeight - margin * 2

  const aspectWOverH = 16 / 9

  // Two stacked 16:9 cards, sized from usable height first.
  let cardHeight = (availableHeight - gap) / 2
  let cardWidth = cardHeight * aspectWOverH

  // If width constrains, shrink to fit and re-derive height from aspect.
  if (cardWidth > availableWidth) {
    cardWidth = availableWidth
    cardHeight = cardWidth / aspectWOverH
  }

  const usedHeight = cardHeight * 2 + gap
  const usedWidth = cardWidth

  const x = margin + (availableWidth - usedWidth) / 2
  const y = margin + (availableHeight - usedHeight) / 2

  return {
    pageWidth,
    pageHeight,
    margin,
    gap,
    cardWidth,
    cardHeight,
    x,
    y,
  }
}

async function runStoryCardsPdfExport(options: StoryCardExportOptions) {
  const printableCards = buildPrintableCards({
    storyTitle: options.storyTitle,
    raw: options.raw,
  })

  const batches = chunkCards(printableCards, EXPORT_BATCH_SIZE)
  const totalCards = printableCards.length
  let completedCards = 0
  let globalCardIndex = 0

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: 'letter',
    compress: true,
  })
  // Improve viewer defaults; helps reduce accidental print scaling in some flows.
  try {
    pdf.setDisplayMode('fullwidth', 'continuous')
  } catch {
    // setDisplayMode availability varies by build; safe to ignore.
  }
  const layout = computePdfTwoUpLayout(pdf)
  const { host, stage, root } = mountExportHost()

  try {
    options.onProgress?.(completedCards, totalCards)

    for (const batch of batches) {
      await renderBatch(root, batch)
      await waitForBatchReady(stage)
      for (let index = 0; index < batch.cards.length; index++) {
        const card = batch.cards[index]
        const selector = exportCardSelector(card.id)
        const matches = stage.querySelectorAll<HTMLElement>(selector)
        if (matches.length > 1) {
          throw new Error(`Duplicate card id during export: ${card.id}`)
        }
        const node = matches[0]
        if (!node) throw new Error(`Missing export node for card ${card.id}.`)

        if (globalCardIndex > 0 && globalCardIndex % 2 === 0) {
          pdf.addPage()
        }

        const canvas = await html2canvas(node, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: false,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          windowWidth: CARD_WIDTH,
          windowHeight: CARD_HEIGHT,
        })

        const slot = globalCardIndex % 2
        const x = layout.x
        const y = layout.y + slot * (layout.cardHeight + layout.gap)
        const imageData = canvas.toDataURL('image/png')
        pdf.addImage(imageData, 'PNG', x, y, layout.cardWidth, layout.cardHeight, undefined, 'FAST')

        canvas.width = 0
        canvas.height = 0

        globalCardIndex += 1
        completedCards += 1
        options.onProgress?.(completedCards, totalCards)
      }

      flushSync(() => {
        root.render(null)
      })
      stage.innerHTML = ''
      await waitForFrame()
      await waitForBatchGcPause()
    }

    const pdfBlob = pdf.output('blob') as unknown as Blob
    const pdfName = `${sanitizeFilename(options.storyTitle || options.storyId)}_cards_print.pdf`
    downloadBlob(pdfBlob, pdfName)
  } finally {
    root.unmount()
    host.remove()
  }
}

export async function exportStoryCardsAsZip(options: StoryCardExportOptions) {
  if (activeStoryCardExport) {
    throw new Error('A card export is already in progress.')
  }

  const run = runStoryCardsExport(options)
  activeStoryCardExport = run
  try {
    await run
  } finally {
    activeStoryCardExport = null
  }
}

export async function exportStoryCardsAsPdf(options: StoryCardExportOptions) {
  if (activeStoryCardExport) {
    throw new Error('A card export is already in progress.')
  }

  const run = runStoryCardsPdfExport(options)
  activeStoryCardExport = run
  try {
    await run
  } finally {
    activeStoryCardExport = null
  }
}
