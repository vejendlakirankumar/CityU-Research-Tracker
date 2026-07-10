/**
 * APA 7th Edition Reference Formatting Engine
 * Pure TypeScript — zero external dependencies.
 *
 * Implements:
 *  - Author list formatting (inversion, initials, 21+ ellipsis rule)
 *  - Sentence case  → article/chapter titles, thesis titles
 *  - Title case     → journal names, book titles, conference names
 *  - Full reference string for: article, book, chapter, website,
 *    conference, report, thesis, misc
 *  - In-text citation
 *  - Markdown-style italics (*text*) for downstream HTML rendering
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Author {
  last: string
  first: string   // full first/middle or already-initialised (e.g. "J. A.")
  suffix?: string // "Jr.", "III", etc.
  isOrg?: boolean // true → treat whole `last` as corporate author
}

export interface RefMeta {
  type: 'article' | 'book' | 'chapter' | 'website' | 'conference' | 'report' | 'thesis' | 'misc'
  authors: Author[]
  year: string            // four-digit year or "n.d."
  month?: string          // full month name, e.g. "March"
  day?: string            // day of month as string, e.g. "15"

  title: string

  // Article / conference
  journal?: string
  volume?: string
  issue?: string
  pages?: string          // will be normalised to en-dash
  doi?: string

  // Book / chapter
  edition?: string        // numeric string, e.g. "2" → "2nd ed."
  publisher?: string
  place?: string          // publisher location (APA7 omits it but some styles need it)
  isbn?: string

  // Chapter only
  editors?: Author[]
  bookTitle?: string
  chapterPages?: string   // pages within the book

  // Website
  siteName?: string
  url?: string
  retrievedDate?: string  // "April 23, 2026" — set when no pub date; triggers "Retrieved X, from URL" (APA7 §9.33)

  // Conference
  conference?: string     // proceedings / conference name
  conferencePages?: string

  // Thesis
  institution?: string
  thesisType?: string     // "Doctoral dissertation" | "Master's thesis" | custom

  // Report
  reportNumber?: string
  reportType?: string     // "Technical report" | custom

  // Provenance — which engine supplied the metadata (e.g. "Crossref", "OpenAlex")
  source?: string
}

// ── Case helpers ──────────────────────────────────────────────────────────────

/** Words never capitalised in title case (unless first/last). */
const LOWER_WORDS = new Set([
  'a', 'an', 'the',
  'and', 'but', 'or', 'nor', 'for', 'so', 'yet',
  'as', 'at', 'by', 'in', 'of', 'on', 'to', 'up',
  'via', 'with', 'from', 'into', 'onto', 'over',
  'than', 'that', 'upon', 'per',
])

/**
 * Title Case — used for journal names, book titles, conference names.
 * Capitalises every significant word; lowercases articles, prepositions etc.
 */
export function toTitleCase(str: string): string {
  if (!str) return ''
  const words = str.split(/\s+/)
  return words
    .map((word, i) => {
      // Always capitalise first and last word
      if (i === 0 || i === words.length - 1) {
        return capitaliseWord(word)
      }
      const lower = word.toLowerCase()
      return LOWER_WORDS.has(lower) ? lower : capitaliseWord(word)
    })
    .join(' ')
}

/**
 * Languages, nationalities and proper linguistic/geographic adjectives that are
 * ALWAYS capitalised in English, even mid-sentence. Sentence-casing a title must
 * not lower-case these (e.g. "…reference to Hungarian)" must stay "Hungarian").
 */
const PROPER_NOUNS = new Set<string>([
  'english', 'french', 'german', 'germanic', 'spanish', 'italian', 'portuguese',
  'dutch', 'flemish', 'russian', 'polish', 'czech', 'slovak', 'slovenian',
  'croatian', 'serbian', 'bulgarian', 'romanian', 'hungarian', 'finnish',
  'estonian', 'latvian', 'lithuanian', 'turkish', 'greek', 'latin', 'hebrew',
  'arabic', 'persian', 'chinese', 'mandarin', 'cantonese', 'japanese', 'korean',
  'vietnamese', 'thai', 'indonesian', 'malay', 'hindi', 'urdu', 'bengali',
  'tamil', 'swahili', 'basque', 'catalan', 'galician', 'welsh', 'irish', 'gaelic',
  'scottish', 'icelandic', 'norwegian', 'swedish', 'danish', 'romance', 'slavic',
  'semitic', 'celtic', 'baltic', 'european', 'american', 'african', 'asian',
  'british', 'australian', 'canadian', 'mexican', 'brazilian', 'roman', 'greco',
])

/**
 * Sentence Case — used for article titles, chapter titles, thesis titles.
 * Rules:
 *   • Only the first word of the title is capitalised.
 *   • The first word after a colon ( : ), em-dash (—/–), or question mark is capitalised.
 *   • Everything else is lowercased — EXCEPT words that carry meaningful
 *     capitalisation (acronyms / brand names) such as "mRNA", "DNA", "iOS",
 *     "COVID-19", "U.S.". These keep their original casing so e.g.
 *     "Dendritic mRNA: transport" → "Dendritic mRNA: Transport".
 *
 * ⚠ Proper nouns written in ordinary case (e.g. "France", "N-movement") cannot
 *   be auto-detected — users should review after applying.
 */
export function toSentenceCase(str: string): string {
  if (!str) return ''

  // Split on whitespace but keep the separators so spacing is preserved.
  const tokens = str.split(/(\s+)/)
  let capitaliseNext = true   // first significant word starts capitalised

  const out = tokens.map(tok => {
    if (tok === '' || /^\s+$/.test(tok)) return tok

    // Languages / nationalities (Hungarian, English, Germanic…) are always
    // capitalised in English, even mid-sentence — restore proper case.
    const lowerCore = tok.replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9]+$/, '').toLowerCase()
    if (PROPER_NOUNS.has(lowerCore)) {
      const w = tok.toLowerCase().replace(/[a-z]/, c => c.toUpperCase())
      capitaliseNext = /[:—–?]$/.test(tok)
      return w
    }

    const preserve = preserveWordCase(tok)
    let w = preserve ? tok : tok.toLowerCase()

    // Capitalise the first alphabetic character of the word when required,
    // unless the word carries its own meaningful casing (acronym/brand).
    if (capitaliseNext && !preserve) {
      w = w.replace(/[a-z]/, c => c.toUpperCase())
    }

    // The next word is capitalised when this token ends a sub-clause.
    capitaliseNext = /[:—–?]$/.test(tok)
    return w
  })

  return out.join('')
}

/**
 * Decide whether a word should keep its original capitalisation rather than be
 * lower-cased. True for acronyms and mixed-case brand/technical terms.
 */
function preserveWordCase(word: string): boolean {  // Strip surrounding punctuation (quotes, brackets, trailing colon/period…)
  const core = word.replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9]+$/, '')
  if (core.length < 2) return false
  // Uppercase letter anywhere after the first char → mixed case (mRNA, iOS, McDonald, U.S.)
  if (/[A-Z]/.test(core.slice(1))) return true
  // Entirely uppercase (optionally with digits/hyphens) → acronym (DNA, HIV, COVID-19)
  if (/^[A-Z0-9-]+$/.test(core) && /[A-Z]/.test(core)) return true
  return false
}

/** Capitalise first letter of a word; preserve rest as-is (for acronyms). */
function capitaliseWord(word: string): string {
  if (!word) return word
  return word.charAt(0).toUpperCase() + word.slice(1)
}

// ── Ordinal suffix for edition numbers ────────────────────────────────────────

function ordinal(n: string | number): string {
  const num = parseInt(String(n), 10)
  if (isNaN(num)) return String(n)
  const s = ['th', 'st', 'nd', 'rd']
  const v = num % 100
  return num + (s[(v - 20) % 10] || s[v] || s[0])
}

// ── Author formatting ─────────────────────────────────────────────────────────

/**
 * Convert a first-name string into APA-style initials.
 * Handles:
 *   "John Andrew"   → "J. A."
 *   "J. A."         → "J. A."  (already formatted)
 *   "J"             → "J."
 *   ""              → ""
 */
function toInitials(first: string): string {
  if (!first.trim()) return ''
  // Already looks like initials: one or more "X." patterns
  if (/^[A-Z][.](\s[A-Z][.])*$/.test(first.trim())) return first.trim()
  return first
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(n => n.charAt(0).toUpperCase() + '.')
    .join(' ')
}

/** Format a single author for the reference list: "Last, F. M." */
function formatSingleAuthor(a: Author): string {
  if (a.isOrg) return a.last
  const initials = toInitials(a.first)
  const suffix   = a.suffix ? `, ${a.suffix}` : ''
  return initials ? `${a.last}, ${initials}${suffix}` : `${a.last}${suffix}`
}

/**
 * Format the full author list per APA7 rules:
 *   1 author        → "Smith, J. A."
 *   2 authors       → "Smith, J. A., & Jones, B. C."
 *   3–20 authors    → all listed, last preceded by ", & "
 *   21+ authors     → first 19, " . . . " (literal), last author
 */
export function formatAuthorList(authors: Author[]): string {
  if (authors.length === 0) return ''
  if (authors.length === 1) return formatSingleAuthor(authors[0])
  if (authors.length === 2) {
    return `${formatSingleAuthor(authors[0])}, & ${formatSingleAuthor(authors[1])}`
  }
  if (authors.length <= 20) {
    const formatted = authors.map(formatSingleAuthor)
    const last = formatted.pop()!
    return `${formatted.join(', ')}, & ${last}`
  }
  // 21+ : first 19 . . . last (APA7 §9.8)
  const first19 = authors.slice(0, 19).map(formatSingleAuthor).join(', ')
  const last    = formatSingleAuthor(authors[authors.length - 1])
  return `${first19}, . . . ${last}`
}

/**
 * Format an editor list: "Smith, J. A. (Ed.)" or "Smith, J. A., & Jones, B. B. (Eds.)"
 */
function formatEditorList(editors: Author[]): string {
  if (editors.length === 0) return ''
  const formatted = editors.map(formatSingleAuthor)
  const label     = editors.length === 1 ? 'Ed.' : 'Eds.'
  if (formatted.length === 1) return `${formatted[0]} (${label})`
  const last = formatted.pop()!
  return `${formatted.join(', ')}, & ${last} (${label})`
}

/** Format a name in standard (non-inverted) order: "F. M. Last". */
function formatNameStandard(a: Author): string {
  if (a.isOrg) return a.last
  const initials = toInitials(a.first)
  const suffix   = a.suffix ? ` ${a.suffix}` : ''
  return initials ? `${initials} ${a.last}${suffix}` : `${a.last}${suffix}`
}

/**
 * Editors in the "In … (Eds.)," position of a chapter reference — names are NOT
 * inverted per APA7 §10.3, e.g. "R. J. Sternberg & S. B. Kaufman (Eds.)".
 */
function formatEditorsInline(editors: Author[]): string {
  if (editors.length === 0) return ''
  const formatted = editors.map(formatNameStandard)
  const label     = editors.length === 1 ? 'Ed.' : 'Eds.'
  if (formatted.length === 1) return `${formatted[0]} (${label})`
  const last = formatted.pop()!
  return `${formatted.join(', ')}, & ${last} (${label})`
}

// ── In-text citation ──────────────────────────────────────────────────────────

/**
 * Generate an APA7 parenthetical in-text citation.
 *   1 author  → (Smith, 2020)
 *   2 authors → (Smith & Jones, 2020)
 *   3+        → (Smith et al., 2020)
 *   No author → (First words of title, Year)
 */
export function formatInTextCitation(meta: RefMeta): string {
  const { authors, year } = meta

  let authorPart: string
  if (authors.length === 0) {
    // APA7 §8.14: cite the first few words of the title. Italicise titles that
    // are italic in the reference (books, reports, webpages, theses,
    // proceedings); use quotation marks for those that are not (journal
    // articles, book chapters).
    const shortTitle  = toTitleCase(meta.title.split(/\s+/).slice(0, 4).join(' '))
    const italicTitle = meta.type !== 'article' && meta.type !== 'chapter'
    authorPart = italicTitle ? `*${shortTitle}*` : `"${shortTitle}"`
  } else if (authors.length === 1) {
    authorPart = authors[0].isOrg ? authors[0].last : authors[0].last
  } else if (authors.length === 2) {
    authorPart = `${authors[0].last} & ${authors[1].last}`
  } else {
    authorPart = `${authors[0].last} et al.`
  }

  return `(${authorPart}, ${year})`
}

// ── DOI / URL / pages formatting ──────────────────────────────────────────────

/** Normalise DOI to https://doi.org/xxx format */
function normaliseDoi(doi: string): string {
  const clean = doi
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim()
  return `https://doi.org/${clean}`
}

/** Replace hyphens with en-dash (–) in page ranges per APA7 */
function normalisePages(pages: string): string {
  return pages.replace(/\s*--\s*|\s*-\s*/g, '\u2013')
}

// ── Reference builders ────────────────────────────────────────────────────────

/**
 * Join the author element to the following segment with a single period.
 * APA7: when the author element already ends with a period (e.g. an initial
 * "K. Y." or "Inc."), do not add a second one — avoids "K. Y.. (2020)".
 */
function joinAuthorYear(authorStr: string, yearStr: string): string {
  if (!authorStr) return yearStr
  const sep = authorStr.endsWith('.') ? ' ' : '. '
  return `${authorStr}${sep}${yearStr}`
}

/** Shared: author + year opener — e.g. "Smith, J. A. (2020)." */
function opener(m: RefMeta): string {
  const authorStr = formatAuthorList(m.authors)
  const yearStr =
    m.month && m.day   ? `(${m.year}, ${m.month} ${m.day}).` :
    m.month            ? `(${m.year}, ${m.month}).` :
                         `(${m.year}).`
  return joinAuthorYear(authorStr, yearStr)
}

/** Article in a journal / periodical */
function buildArticle(m: RefMeta): string {
  const titleStr = toSentenceCase(m.title) + '.'
  // APA7 §9.12: when there is no author the title moves to the author position.
  const parts: string[] = m.authors.length ? [opener(m), titleStr] : [titleStr, opener(m)]

  if (m.journal) {
    let source = `*${toTitleCase(m.journal)}*`
    if (m.volume)  source += `, *${m.volume}*`
    if (m.issue)   source += `(${m.issue})`
    if (m.pages)   source += `, ${normalisePages(m.pages)}`
    source += '.'
    parts.push(source)
  }

  if (m.doi) parts.push(normaliseDoi(m.doi))
  else if (m.url) parts.push(m.url)

  return parts.join(' ')
}

/** Whole book */
function buildBook(m: RefMeta): string {
  const authors = m.authors.length ? m.authors : (m.editors ?? [])
  const isEdited = m.authors.length === 0 && (m.editors?.length ?? 0) > 0

  const authorStr = isEdited
    ? formatEditorList(m.editors!)
    : formatAuthorList(authors)

  const yearStr   = `(${m.year}).`
  const openerStr = joinAuthorYear(authorStr, yearStr)

  let titleStr = `*${toSentenceCase(m.title)}*`
  if (m.edition) titleStr += ` (${ordinal(m.edition)} ed.)`
  titleStr += '.'

  // APA7 §9.12: title leads when there is no author/editor name element.
  const parts = authorStr ? [openerStr, titleStr] : [titleStr, openerStr]

  const pub = [m.publisher].filter(Boolean).join('')
  if (pub) parts.push(pub + '.')

  if (m.doi) parts.push(normaliseDoi(m.doi))
  else if (m.url) parts.push(m.url)

  return parts.join(' ')
}

/** Chapter in an edited book */
function buildChapter(m: RefMeta): string {
  const titleStr = toSentenceCase(m.title) + '.'
  // APA7 §10.3: chapters in edited books use the year only (no month).
  const openerStr = joinAuthorYear(formatAuthorList(m.authors), `(${m.year}).`)
  // APA7 §9.12: title leads when there is no author.
  const parts: string[] = m.authors.length ? [openerStr, titleStr] : [titleStr, openerStr]

  let inStr = 'In '
  if (m.editors && m.editors.length > 0) {
    // APA7 §10.3: editors in the "In …" position are NOT inverted.
    inStr += `${formatEditorsInline(m.editors)}, `
  }
  inStr += `*${toSentenceCase(m.bookTitle ?? 'Unknown book')}*`
  if (m.chapterPages) inStr += ` (pp. ${normalisePages(m.chapterPages)})`
  inStr += '.'
  parts.push(inStr)

  if (m.publisher) parts.push(m.publisher + '.')

  if (m.doi) parts.push(normaliseDoi(m.doi))
  else if (m.url) parts.push(m.url)

  return parts.join(' ')
}

/** Web page / online resource */
function buildWebsite(m: RefMeta): string {
  const hasAuthor = m.authors.length > 0
  const titleStr  = `*${toSentenceCase(m.title)}*.`

  // APA7 §9.12: with no author, the title moves to the author position and
  // therefore precedes the date — "*Title*. (Year). Site Name. URL".
  const parts: string[] = hasAuthor
    ? [opener(m), titleStr]                    // Author. (Date). *Title*.
    : [titleStr, opener(m)]                    // *Title*. (Date).

  // APA7 §9.32 note: omit site name when the sole author is the same organisation
  // e.g. World Health Organization → skip "World Health Organization." as site name
  const soleOrgAuthor = m.authors.length === 1 && m.authors[0].isOrg
    ? m.authors[0].last
    : null
  const skipSiteName = soleOrgAuthor !== null &&
    m.siteName !== undefined &&
    soleOrgAuthor.toLowerCase().trim() === m.siteName.toLowerCase().trim()

  // Site name is plain text (not italicised)
  if (m.siteName && !skipSiteName) parts.push(m.siteName + '.')

  // APA7 §9.33: include retrieval date only when content may change and has no archive
  if (m.retrievedDate && m.url) {
    parts.push(`Retrieved ${m.retrievedDate}, from ${m.url}`)
  } else if (m.url) {
    parts.push(m.url)
  }

  return parts.join(' ')
}

/** Conference paper / proceedings article */
function buildConference(m: RefMeta): string {
  const titleStr = toSentenceCase(m.title) + '.'
  const parts: string[] = m.authors.length ? [opener(m), titleStr] : [titleStr, opener(m)]

  if (m.conference) {
    let confStr = `In *${toTitleCase(m.conference)}*`
    if (m.conferencePages) confStr += ` (pp. ${normalisePages(m.conferencePages)})`
    confStr += '.'
    parts.push(confStr)
  }

  if (m.publisher) parts.push(m.publisher + '.')

  if (m.doi) parts.push(normaliseDoi(m.doi))
  else if (m.url) parts.push(m.url)

  return parts.join(' ')
}

/** Technical / institutional report */
function buildReport(m: RefMeta): string {
  let titleStr = `*${toSentenceCase(m.title)}*`
  const rInfo = [m.reportType, m.reportNumber ? `No. ${m.reportNumber}` : null]
    .filter(Boolean).join(', ')
  if (rInfo) titleStr += ` (${rInfo})`
  titleStr += '.'
  // APA7 §9.12: title leads when there is no author.
  const parts: string[] = m.authors.length ? [opener(m), titleStr] : [titleStr, opener(m)]

  if (m.institution) parts.push(m.institution + '.')

  if (m.doi) parts.push(normaliseDoi(m.doi))
  else if (m.url) parts.push(m.url)

  return parts.join(' ')
}

/** PhD / Master's thesis or dissertation */
function buildThesis(m: RefMeta): string {
  let titleStr = `*${toSentenceCase(m.title)}*`
  const tInfo = [m.thesisType, m.institution].filter(Boolean).join(', ')
  if (tInfo) titleStr += ` [${tInfo}]`
  titleStr += '.'
  // APA7 §9.12: title leads when there is no author.
  const parts: string[] = m.authors.length ? [opener(m), titleStr] : [titleStr, opener(m)]

  if (m.doi) parts.push(normaliseDoi(m.doi))
  else if (m.url) parts.push(m.url)

  return parts.join(' ')
}

/** Misc / unknown type */
function buildMisc(m: RefMeta): string {
  const titleStr = toSentenceCase(m.title) + '.'
  const parts: string[] = m.authors.length ? [opener(m), titleStr] : [titleStr, opener(m)]
  if (m.publisher) parts.push(m.publisher + '.')
  if (m.doi) parts.push(normaliseDoi(m.doi))
  else if (m.url) parts.push(m.url)
  return parts.join(' ')
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Format a complete APA7 reference string.
 * Uses `*text*` for italic spans — call `referenceToHtml()` to render.
 */
export function formatReference(meta: RefMeta): string {
  switch (meta.type) {
    case 'article':    return buildArticle(meta)
    case 'book':       return buildBook(meta)
    case 'chapter':    return buildChapter(meta)
    case 'website':    return buildWebsite(meta)
    case 'conference': return buildConference(meta)
    case 'report':     return buildReport(meta)
    case 'thesis':     return buildThesis(meta)
    default:           return buildMisc(meta)
  }
}

/**
 * Convert `*italicised text*` markers to `<em>...</em>` for HTML rendering.
 * HTML-escapes the entire string first so API-returned content (titles, author
 * names, site names) cannot inject arbitrary HTML — only our own `*…*` markers
 * are converted to tags.
 */
export function referenceToHtml(ref: string): string {
  // 1. Escape all HTML special characters in the raw reference string
  const escaped = ref
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  // 2. Convert our own *italic* markers (which use safe ASCII) to <em> tags
  return escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

/** Strip all `*` markers for plain-text clipboard copy */
export function referencePlainText(ref: string): string {
  return ref.replace(/\*/g, '')
}
