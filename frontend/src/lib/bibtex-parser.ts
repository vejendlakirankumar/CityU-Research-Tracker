/**
 * Minimal BibTeX Parser
 *
 * Supports entry types:
 *   @article, @book, @incollection, @inbook, @inproceedings, @conference,
 *   @phdthesis, @mastersthesis, @thesis, @techreport, @misc
 *
 * Handles:
 *   - Brace-delimited {value} and quote-delimited "value" fields
 *   - Nested braces (one level deep) for protected capitalization
 *   - Basic LaTeX accent escape decoding (é → e, ü → u, etc.)
 *   - "Last, First and Last, First" author format
 *   - "First Last" author format
 *   - Multiple entries in one string
 */

import type { Author, RefMeta } from './apa7'

// ── Raw BibTeX entry ──────────────────────────────────────────────────────────

interface BibEntry {
  type: string
  key: string
  fields: Record<string, string>
}

// ── LaTeX unescape ────────────────────────────────────────────────────────────

/** Map common LaTeX escape sequences to their Unicode equivalents */
const LATEX_MAP: Record<string, string> = {
  '\\"a': 'ä', '\\"e': 'ë', '\\"i': 'ï', '\\"o': 'ö', '\\"u': 'ü',
  '\\"A': 'Ä', '\\"E': 'Ë', '\\"I': 'Ï', '\\"O': 'Ö', '\\"U': 'Ü',
  "\\`a": 'à', "\\`e": 'è', "\\`i": 'ì', "\\`o": 'ò', "\\`u": 'ù',
  "\\'a": 'á', "\\'e": 'é', "\\'i": 'í', "\\'o": 'ó', "\\'u": 'ú',
  "\\'A": 'Á', "\\'E": 'É', "\\'I": 'Í', "\\'O": 'Ó', "\\'U": 'Ú',
  '\\^a': 'â', '\\^e': 'ê', '\\^i': 'î', '\\^o': 'ô', '\\^u': 'û',
  '\\~a': 'ã', '\\~n': 'ñ', '\\~o': 'õ',
  '\\c{c}': 'ç', '\\c{C}': 'Ç',
  '{\\ss}': 'ß', '\\ss': 'ß',
  '\\&': '&', '\\$': '$', '\\%': '%', '\\#': '#',
  '--': '\u2013', '---': '\u2014',
}

function unescapeLatex(raw: string): string {
  let s = raw
  // Apply named replacements
  for (const [key, val] of Object.entries(LATEX_MAP)) {
    s = s.split(key).join(val)
  }
  // Remove remaining LaTeX commands (e.g., \emph{}, \textit{})
  s = s.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
  // Remove remaining LaTeX commands without arguments
  s = s.replace(/\\[a-zA-Z]+\s*/g, '')
  // Remove surrounding braces (BibTeX uses {Word} to force capitalisation)
  s = s.replace(/\{([^{}]*)\}/g, '$1')
  // Normalise whitespace
  return s.replace(/\s+/g, ' ').trim()
}

// ── Author string parsing ─────────────────────────────────────────────────────

function parseAuthorString(raw: string): Author[] {
  if (!raw.trim()) return []
  return raw
    .split(/\s+and\s+/i)
    .map(a => unescapeLatex(a).trim())
    .filter(Boolean)
    .map(parseOneName)
}

function parseOneName(name: string): Author {
  name = name.trim()

  // Detect corporate / organization author (wrapped in extra braces in source,
  // or contains "." suggesting it's already an abbreviation without comma)
  // We treat names with NO comma and NO space as an org (e.g. "NASA", "WHO")
  if (!name.includes(',') && !name.includes(' ')) {
    return { last: name, first: '', isOrg: true }
  }

  // "Last, Suffix, First" or "Last, First" (BibTeX canonical)
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim())
    const last  = parts[0]
    // parts[1] may be suffix (Jr., II) with further first name in parts[2]
    if (parts.length >= 3 && /^(Jr|Sr|II|III|IV)\.?$/i.test(parts[1])) {
      return { last, suffix: parts[1], first: parts[2] }
    }
    return { last, first: parts.slice(1).join(' ').trim() }
  }

  // "First Middle Last" format
  const tokens = name.split(/\s+/)
  if (tokens.length === 1) return { last: tokens[0], first: '' }
  const last  = tokens[tokens.length - 1]
  const first = tokens.slice(0, -1).join(' ')
  return { last, first }
}

// ── BibTeX tokeniser / parser ─────────────────────────────────────────────────

/**
 * Extracts a field value that may contain nested braces (one level).
 * Returns [value, endIndex].
 */
function extractBraceValue(body: string, startAfterOpen: number): [string, number] {
  let depth = 1
  let i     = startAfterOpen
  while (i < body.length && depth > 0) {
    if (body[i] === '{') depth++
    else if (body[i] === '}') depth--
    i++
  }
  return [body.slice(startAfterOpen, i - 1), i]
}

function parseFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {}
  // Regex finds:  fieldname  =  {  or  "  or digits
  const fieldStart = /(\w+)\s*=\s*/g
  let m: RegExpExecArray | null

  while ((m = fieldStart.exec(body)) !== null) {
    const name = m[1].toLowerCase()
    const pos  = m.index + m[0].length

    if (pos >= body.length) break
    const ch = body[pos]

    if (ch === '{') {
      const [val, end] = extractBraceValue(body, pos + 1)
      fields[name]     = unescapeLatex(val)
      fieldStart.lastIndex = end
    } else if (ch === '"') {
      const end = body.indexOf('"', pos + 1)
      if (end === -1) break
      fields[name]     = unescapeLatex(body.slice(pos + 1, end))
      fieldStart.lastIndex = end + 1
    } else {
      // Numeric value (year = 2023)
      const numMatch = body.slice(pos).match(/^(\d+)/)
      if (numMatch) {
        fields[name]     = numMatch[1]
        fieldStart.lastIndex = pos + numMatch[1].length
      }
    }
  }

  return fields
}

export function parseBibtex(input: string): BibEntry[] {
  const entries: BibEntry[] = []

  // Match @type{key, body}  — body may span multiple lines
  // We scan character by character to handle nested braces correctly.
  const entryRe = /@(\w+)\s*\{\s*([^,\s]*)\s*,/g
  let match: RegExpExecArray | null

  while ((match = entryRe.exec(input)) !== null) {
    const type  = match[1].toLowerCase()
    const key   = match[2].trim()
    const start = match.index + match[0].length

    // Find matching closing brace for the whole entry
    let depth = 1
    let i     = start
    while (i < input.length && depth > 0) {
      if (input[i] === '{') depth++
      else if (input[i] === '}') depth--
      i++
    }

    const body   = input.slice(start, i - 1)
    const fields = parseFields(body)
    entries.push({ type, key, fields })

    entryRe.lastIndex = i
  }

  return entries
}

// ── BibEntry → RefMeta conversion ─────────────────────────────────────────────

export function bibtexEntryToMeta(entry: BibEntry): RefMeta {
  const f       = entry.fields
  const authors = parseAuthorString(f.author ?? '')
  const editors = parseAuthorString(f.editor ?? '')
  const year    = f.year ?? 'n.d.'
  const title   = f.title ?? ''
  const doi     = f.doi   || undefined
  const url     = f.url   || undefined
  const pages   = f.pages || undefined
  const volume  = f.volume || undefined
  const issue   = f.number || undefined          // BibTeX uses `number` for issue
  const publisher = f.publisher || undefined
  const place     = f.address   || undefined
  const month     = normaliseMonth(f.month)

  switch (entry.type) {

    case 'article':
      return {
        type: 'article', authors, year, month, title,
        journal: f.journal ?? f.journaltitle,
        volume, issue, pages, doi, url,
      }

    case 'book':
      return {
        type: 'book',
        authors: authors.length ? authors : editors,
        editors: authors.length ? undefined : editors,
        year, month, title,
        edition: f.edition,
        publisher, place, isbn: f.isbn, doi, url,
      }

    case 'incollection':
    case 'inbook':
      return {
        type: 'chapter', authors, year, month, title,
        editors: editors.length ? editors : undefined,
        bookTitle: f.booktitle,
        chapterPages: pages,
        publisher, place, doi, url,
      }

    case 'inproceedings':
    case 'conference':
      return {
        type: 'conference', authors, year, month, title,
        conference: f.booktitle,
        conferencePages: pages,
        publisher, place, doi, url,
      }

    case 'phdthesis':
      return {
        type: 'thesis', authors, year, title,
        thesisType: 'Doctoral dissertation',
        institution: f.school ?? f.institution,
        url,
      }

    case 'mastersthesis':
      return {
        type: 'thesis', authors, year, title,
        thesisType: "Master's thesis",
        institution: f.school ?? f.institution,
        url,
      }

    case 'thesis':
      return {
        type: 'thesis', authors, year, title,
        thesisType: f.type,
        institution: f.school ?? f.institution,
        url,
      }

    case 'techreport':
      return {
        type: 'report', authors, year, title,
        reportType: f.type ?? 'Technical report',
        reportNumber: f.number,
        institution: f.institution,
        doi, url,
      }

    case 'misc':
    default: {
      const isWebLike = url?.startsWith('http') ||
        f.howpublished?.startsWith('http') ||
        f.howpublished?.startsWith('www')
      return {
        type: isWebLike ? 'website' : 'misc',
        authors, year, month, title,
        publisher,
        url: url ?? (f.howpublished?.startsWith('http') ? f.howpublished : undefined),
        doi,
      }
    }
  }
}

/** Normalise BibTeX month strings to full English month names */
function normaliseMonth(raw?: string): string | undefined {
  if (!raw) return undefined
  const months: Record<string, string> = {
    jan: 'January', feb: 'February', mar: 'March',    apr: 'April',
    may: 'May',     jun: 'June',     jul: 'July',     aug: 'August',
    sep: 'September', oct: 'October', nov: 'November', dec: 'December',
  }
  const key = raw.toLowerCase().replace(/[^a-z]/g, '').slice(0, 3)
  return months[key] ?? raw
}

/** Parse a full BibTeX string and return all RefMeta objects */
export function bibtexToMetas(raw: string): RefMeta[] {
  return parseBibtex(raw).map(bibtexEntryToMeta)
}
