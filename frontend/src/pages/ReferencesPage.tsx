import { useState, useRef, useEffect } from 'react'
import {
  BookOpen, Link, Hash, Barcode, FileText, Atom,
  Copy, Trash2, Check, Loader2, AlertCircle,
  Plus, Download, ChevronDown, Info, Pencil, Search,
} from 'lucide-react'
import { clsx } from 'clsx'
import api from '../lib/axios'
import type { RefMeta, Author } from '../lib/apa7'
import {
  formatReference, formatInTextCitation,
  referenceToHtml, referencePlainText,
} from '../lib/apa7'
import { bibtexToMetas } from '../lib/bibtex-parser'

// ── Types ─────────────────────────────────────────────────────────────────────

type InputMode = 'doi' | 'isbn' | 'url' | 'bibtex' | 'arxiv' | 'title' | 'manual'

interface RefEntry {
  id: string
  meta: RefMeta
  reference: string   // with *italic* markers
  citation: string    // in-text citation
}

// ── Clipboard hook ────────────────────────────────────────────────────────────

function useCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 2500)
    })
  }
  return { copiedId, copy }
}

// ── Mode tab definitions ──────────────────────────────────────────────────────

const MODES: {
  id: InputMode
  label: string
  icon: React.ElementType
  placeholder: string
  hint: string
  multiline: boolean
}[] = [
  {
    id: 'doi',
    label: 'DOI',
    icon: Hash,
    placeholder: '10.1037/0033-295X.84.2.231  or  https://doi.org/10.1037/…',
    hint: 'Fetches metadata from CrossRef (free, no API key).',
    multiline: false,
  },
  {
    id: 'isbn',
    label: 'ISBN',
    icon: Barcode,
    placeholder: '978-0-06-112008-4  or  9780061120084',
    hint: 'Fetches metadata from Open Library & Google Books (free, no API key).',
    multiline: false,
  },
  {
    id: 'url',
    label: 'Web URL',
    icon: Link,
    placeholder: 'https://www.apa.org/monitor/2022/01/some-article',
    hint: 'Extracts title, author, and publication date from the page.',
    multiline: false,
  },
  {
    id: 'arxiv',
    label: 'arXiv',
    icon: Atom,
    placeholder: '2301.00001  or  hep-ph/9902242  or  https://arxiv.org/abs/2301.00001',
    hint: 'Fetches metadata from the arXiv API (free, no API key). Supports new format (2301.00001) and legacy (hep-ph/0001001).',
    multiline: false,
  },
  {
    id: 'title',
    label: 'Title',
    icon: Search,
    placeholder: 'Dendritic mRNA: transport, translation and function',
    hint: 'Searches CrossRef by title and fetches the best-matching work (free, no API key). Verify the result — the closest match is returned.',
    multiline: false,
  },
  {
    id: 'bibtex',
    label: 'BibTeX',
    icon: FileText,
    placeholder: `@article{smith2020,\n  author  = {Smith, John A.},\n  title   = {The role of context in understanding},\n  journal = {Psychological Review},\n  year    = {2020},\n  volume  = {127},\n  number  = {3},\n  pages   = {411--430},\n  doi     = {10.1037/rev0000186}\n}`,
    hint: 'Processed entirely offline — no network request made.',
    multiline: true,
  },
  {
    id: 'manual',
    label: 'Manual',
    icon: Pencil,
    placeholder: '',
    hint: 'Enter the reference details by hand — useful for sources that cannot be fetched automatically (e.g. JSTOR, print-only works, or items without a DOI).',
    multiline: false,
  },
]

// ── Reference card component ──────────────────────────────────────────────────

function RefCard({
  index,
  entry,
  onDelete,
  copiedId,
  onCopy,
  highlighted,
}: {
  index: number
  entry: RefEntry
  onDelete: () => void
  copiedId: string | null
  onCopy: (text: string, id: string) => void
  highlighted: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Bring a freshly added / duplicate-matched card into view.
  useEffect(() => {
    if (highlighted) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlighted])

  const refHtml  = referenceToHtml(entry.reference)
  const refPlain = referencePlainText(entry.reference)

  const CopyBtn = ({
    text, id, label,
  }: { text: string; id: string; label: string }) => {
    const copied = copiedId === id
    return (
      <button
        onClick={() => onCopy(text, id)}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-colors',
          copied
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700',
        )}
        title={label}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied' : label}
      </button>
    )
  }

  return (
    <div
      ref={cardRef}
      className={clsx(
        'rounded-xl shadow-sm overflow-hidden transition-all duration-700',
        highlighted
          ? 'bg-yellow-50 border border-yellow-300 ring-2 ring-yellow-300'
          : 'bg-white border border-gray-200',
      )}
    >
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          {/* Number */}
          <span className="text-xs font-bold text-gray-400 mt-0.5 w-5 flex-shrink-0 select-none">
            [{index}]
          </span>

          {/* Reference text with hanging indent */}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm text-gray-900 leading-relaxed"
              style={{ textIndent: '-1.5em', paddingLeft: '1.5em' }}
              dangerouslySetInnerHTML={{ __html: refHtml }}
            />

            {/* In-text citation pill */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-400">In-text:</span>
              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-mono">
                {entry.citation}
              </code>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onCopy(refPlain, `ref-${entry.id}`)}
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
              title="Copy reference"
            >
              {copiedId === `ref-${entry.id}`
                ? <Check className="w-4 h-4 text-green-500" />
                : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              title="Details"
            >
              <ChevronDown
                className={clsx('w-4 h-4 transition-transform duration-150', expanded && 'rotate-180')}
              />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
              title="Remove this reference"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
          {/* In-text citation */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">In-text citation</p>
            <div className="flex items-center justify-between gap-3">
              <code className="text-sm text-gray-700 font-mono">{entry.citation}</code>
              <CopyBtn text={entry.citation} id={`cit-${entry.id}`} label="Copy" />
            </div>
          </div>

          {/* Full reference plain text */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Reference (plain text)</p>
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-gray-600 font-mono leading-relaxed break-all">{refPlain}</p>
              <div className="flex-shrink-0">
                <CopyBtn text={refPlain} id={`refplain-${entry.id}`} label="Copy" />
              </div>
            </div>
          </div>

          {/* Type badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Detected type:</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium capitalize">
              {entry.meta.type}
            </span>
            {entry.meta.source && (
              <>
                <span className="text-xs text-gray-400 ml-2">Source:</span>
                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                  {entry.meta.source}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Manual entry ──────────────────────────────────────────────────────────────

/** Parse a free-text author list into Author[]. */
function parseAuthorsInput(raw: string): Author[] {
  return raw
    .split(/\r?\n|;/)
    .map(s => s.trim())
    .filter(Boolean)
    .map<Author>(line => {
      const idx = line.indexOf(',')
      if (idx >= 0) {
        // "Last, First M." → inverted personal author
        return { last: line.slice(0, idx).trim(), first: line.slice(idx + 1).trim() }
      }
      // No comma → group / organisation author (kept whole, not inverted)
      return { last: line, first: '', isOrg: true }
    })
}

const TYPE_OPTIONS: { value: RefMeta['type']; label: string }[] = [
  { value: 'article',    label: 'Journal article' },
  { value: 'book',       label: 'Book' },
  { value: 'chapter',    label: 'Book chapter' },
  { value: 'website',    label: 'Web page' },
  { value: 'conference', label: 'Conference paper' },
  { value: 'report',     label: 'Report' },
  { value: 'thesis',     label: 'Thesis / dissertation' },
  { value: 'misc',       label: 'Other' },
]

const EMPTY_FORM = {
  type: 'article' as RefMeta['type'],
  authors: '', year: '', title: '',
  journal: '', volume: '', issue: '', pages: '',
  doi: '', url: '',
  edition: '', publisher: '',
  editors: '', bookTitle: '', chapterPages: '',
  siteName: '', month: '', day: '',
  conference: '', conferencePages: '',
  institution: '', thesisType: '',
  reportNumber: '', reportType: '',
}

type FormState = typeof EMPTY_FORM

function ManualForm({ onAdd }: { onAdd: (meta: RefMeta) => 'added' | 'duplicate' }) {
  const [f, setF]     = useState<FormState>({ ...EMPTY_FORM })
  const [err, setErr] = useState('')
  const [added, setAdded] = useState(false)

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setF(prev => ({ ...prev, [k]: e.target.value }))

  // Rendered as a function (not a nested component) so inputs keep focus on re-render.
  const field = (label: string, k: keyof FormState, placeholder = '', full = false) => (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={placeholder}
        value={f[k]}
        onChange={set(k)}
      />
    </div>
  )

  const submit = () => {
    if (!f.title.trim()) { setErr('Title is required.'); return }

    const meta: RefMeta = {
      type:    f.type,
      authors: parseAuthorsInput(f.authors),
      year:    f.year.trim() || 'n.d.',
      title:   f.title.trim(),
    }
    const put = (k: keyof RefMeta, v: string) => {
      const t = v.trim()
      if (t) (meta as unknown as Record<string, unknown>)[k] = t
    }
    const eds = parseAuthorsInput(f.editors)
    if (eds.length) meta.editors = eds

    switch (f.type) {
      case 'article':
        put('journal', f.journal); put('volume', f.volume); put('issue', f.issue)
        put('pages', f.pages); put('doi', f.doi); put('url', f.url)
        break
      case 'book':
        put('edition', f.edition); put('publisher', f.publisher)
        put('doi', f.doi); put('url', f.url)
        break
      case 'chapter':
        put('bookTitle', f.bookTitle); put('chapterPages', f.chapterPages)
        put('publisher', f.publisher); put('doi', f.doi); put('url', f.url)
        break
      case 'website':
        put('siteName', f.siteName); put('month', f.month); put('day', f.day)
        put('url', f.url)
        break
      case 'conference':
        put('conference', f.conference); put('conferencePages', f.conferencePages)
        put('publisher', f.publisher); put('doi', f.doi); put('url', f.url)
        break
      case 'report':
        put('reportType', f.reportType); put('reportNumber', f.reportNumber)
        put('institution', f.institution); put('doi', f.doi); put('url', f.url)
        break
      case 'thesis':
        put('thesisType', f.thesisType); put('institution', f.institution)
        put('doi', f.doi); put('url', f.url)
        break
      case 'misc':
        put('publisher', f.publisher); put('url', f.url)
        break
    }

    if (onAdd(meta) === 'duplicate') {
      setErr('This reference is already in your list — highlighted in the list below.')
      return
    }
    setF({ ...EMPTY_FORM, type: f.type })   // keep the chosen type for repeated entry
    setErr('')
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Type + common fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Reference type</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={f.type}
            onChange={set('type')}
          >
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {field('Year', 'year', 'e.g. 1994  (blank → n.d.)')}

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Authors</label>
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[64px]"
            placeholder={'Longobardi, Giuseppe\nSmith, Jane A.'}
            value={f.authors}
            onChange={set('authors')}
          />
          <p className="text-xs text-gray-400 mt-1">
            One author per line as <code className="bg-gray-100 px-1 rounded">Last, First M.</code> ·
            for a group/organisation, type the full name with no comma.
          </p>
        </div>

        {field('Title', 'title', 'Title of the work', true)}
      </div>

      {/* Type-specific fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-gray-100">
        {f.type === 'article' && (<>
          {field('Journal', 'journal', 'e.g. Linguistic Inquiry', true)}
          {field('Volume', 'volume', 'e.g. 25')}
          {field('Issue', 'issue', 'e.g. 4')}
          {field('Pages', 'pages', 'e.g. 609-665')}
          {field('DOI', 'doi', 'e.g. 10.1037/rev0000186')}
          {field('URL (if no DOI)', 'url', 'e.g. http://www.jstor.org/stable/4178880', true)}
        </>)}

        {f.type === 'book' && (<>
          {field('Editors (if edited)', 'editors', 'Sternberg, Robert J.', true)}
          {field('Edition', 'edition', 'e.g. 2')}
          {field('Publisher', 'publisher', 'e.g. Harvard University Press')}
          {field('DOI', 'doi')}
          {field('URL (if no DOI)', 'url', '', true)}
        </>)}

        {f.type === 'chapter' && (<>
          {field('Editors', 'editors', 'Sternberg, Robert J.; Kaufman, Scott B.', true)}
          {field('Book title', 'bookTitle', 'Title of the edited book', true)}
          {field('Chapter pages', 'chapterPages', 'e.g. 45-67')}
          {field('Publisher', 'publisher')}
          {field('DOI', 'doi')}
          {field('URL (if no DOI)', 'url')}
        </>)}

        {f.type === 'website' && (<>
          {field('Site name', 'siteName', 'e.g. World Health Organization', true)}
          {field('Month', 'month', 'e.g. March')}
          {field('Day', 'day', 'e.g. 15')}
          {field('URL', 'url', 'https://…', true)}
        </>)}

        {f.type === 'conference' && (<>
          {field('Proceedings / conference name', 'conference', '', true)}
          {field('Pages', 'conferencePages', 'e.g. 12-20')}
          {field('Publisher', 'publisher')}
          {field('DOI', 'doi')}
          {field('URL (if no DOI)', 'url')}
        </>)}

        {f.type === 'report' && (<>
          {field('Report type', 'reportType', 'e.g. Technical report')}
          {field('Report number', 'reportNumber', 'e.g. 42')}
          {field('Institution', 'institution', '', true)}
          {field('DOI', 'doi')}
          {field('URL (if no DOI)', 'url')}
        </>)}

        {f.type === 'thesis' && (<>
          {field('Thesis type', 'thesisType', "e.g. Doctoral dissertation")}
          {field('Institution', 'institution', 'e.g. University of California')}
          {field('DOI', 'doi')}
          {field('URL (if no DOI)', 'url')}
        </>)}

        {f.type === 'misc' && (<>
          {field('Publisher', 'publisher', '', true)}
          {field('URL', 'url', '', true)}
        </>)}
      </div>

      {err && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-gray-400 flex-1">
          Sentence case, author inversion, and italics are applied automatically.
        </p>
        <button
          onClick={submit}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 whitespace-nowrap"
        >
          {added
            ? <><Check className="w-4 h-4" /> Added</>
            : <><Plus className="w-4 h-4" /> Add Reference</>}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

/** Stable key for detecting duplicate references (by DOI, else title+year). */
function dedupKey(meta: RefMeta): string {
  if (meta.doi) {
    return 'doi:' + meta.doi.toLowerCase()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
      .trim()
  }
  const t = (meta.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return 'ttl:' + t + '|' + (meta.year || '')
}

export default function ReferencesPage() {
  const [mode, setMode]       = useState<InputMode>('doi')
  const [value, setValue]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [notice, setNotice]   = useState('')
  const [refs, setRefs]       = useState<RefEntry[]>([])
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightTimer = useRef<number | null>(null)
  const { copiedId, copy }    = useCopy()

  const currentMode = MODES.find(m => m.id === mode)!

  // Flash a card yellow for a few seconds, then fade.
  const flash = (id: string) => {
    setHighlightId(id)
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current)
    highlightTimer.current = window.setTimeout(() => setHighlightId(null), 4000)
  }

  /** Add a reference unless an identical one already exists. */
  const addMeta = (meta: RefMeta): 'added' | 'duplicate' => {
    const key      = dedupKey(meta)
    const existing = refs.find(r => dedupKey(r.meta) === key)
    if (existing) {
      flash(existing.id)
      return 'duplicate'
    }
    const id = crypto.randomUUID()
    setRefs(prev => [
      ...prev,
      {
        id,
        meta,
        reference: formatReference(meta),
        citation:  formatInTextCitation(meta),
      },
    ])
    flash(id)
    return 'added'
  }

  const deleteRef = (id: string) => setRefs(prev => prev.filter(r => r.id !== id))

  const clearAll = () => {
    if (refs.length > 0 && confirm('Remove all references?')) setRefs([])
  }

  const resolve = async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    setError(''); setNotice(''); setLoading(true)
    try {
      if (mode === 'bibtex') {
        const metas = bibtexToMetas(trimmed)
        if (metas.length === 0) {
          setError('No valid BibTeX entries found. Check the format and try again.')
          return
        }
        let added = 0, dup = 0
        metas.forEach(m => { addMeta(m) === 'added' ? added++ : dup++ })
        setValue('')
        if (dup > 0) setNotice(`${added} added · ${dup} already in your list.`)
      } else if (mode === 'arxiv') {
        const r = await api.post('/references/resolve', { type: 'arxiv', value: trimmed })
        if (addMeta(r.data as RefMeta) === 'duplicate') {
          setNotice('This reference is already in your list — highlighted below.')
        }
        setValue('')
      } else {
        const r = await api.post('/references/resolve', { type: mode, value: trimmed })
        if (addMeta(r.data as RefMeta) === 'duplicate') {
          setNotice('This reference is already in your list — highlighted below.')
        }
        setValue('')
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Could not retrieve reference metadata. Please check your input.')
    } finally {
      setLoading(false)
    }
  }

  // Alphabetical sort for display, copy, and export (APA reference lists are A-Z)
  const sortedRefs = [...refs].sort((a, b) =>
    referencePlainText(a.reference).localeCompare(referencePlainText(b.reference))
  )

  const exportAll = () => {
    if (refs.length === 0) return
    const lines = sortedRefs.map((r, i) => `[${i + 1}] ${referencePlainText(r.reference)}`).join('\n\n')
    const blob  = new Blob([lines], { type: 'text/plain;charset=utf-8' })
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement('a')
    a.href = url; a.download = 'references-apa7.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  const copyAll = () => {
    const text = sortedRefs.map((r, i) => `[${i + 1}] ${referencePlainText(r.reference)}`).join('\n\n')
    copy(text, 'all')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">APA7 Reference Formatter</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Generate correctly formatted APA 7th edition citations and references from DOI, ISBN, URL, title search, BibTeX, or manual entry.
          </p>
        </div>
      </div>

      {/* Beta notice */}
      <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          <strong>Beta feature.</strong> Please verify generated references before submission — proper nouns
          may need manual capitalisation after sentence case is applied.
        </span>
      </div>

      {/* Input card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Mode tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {MODES.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setMode(tab.id); setValue(''); setError(''); setNotice('') }}
              className={clsx(
                'flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                mode === tab.id
                  ? 'border-blue-600 text-blue-700 bg-blue-50/40'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50',
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {mode === 'manual' ? (
            <ManualForm onAdd={addMeta} />
          ) : (
            <>
              {currentMode.multiline ? (
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[160px]"
                  placeholder={currentMode.placeholder}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                />
              ) : (
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={currentMode.placeholder}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !loading && resolve()}
                />
              )}

              {/* Error message */}
              {error && (
                <div className="mt-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Informational notice (duplicates, batch results) */}
              {notice && (
                <div className="mt-3 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              {/* Footer row */}
              <div className="mt-4 flex items-center justify-between gap-4">
                <p className="text-xs text-gray-400 flex-1">{currentMode.hint}</p>
                <button
                  onClick={resolve}
                  disabled={loading || !value.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Resolving…</>
                    : <><Plus className="w-4 h-4" /> {mode === 'bibtex' ? 'Parse BibTeX' : 'Get Reference'}</>
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reference list */}
      {refs.length > 0 && (
        <div className="space-y-3">
          {/* List header */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              References ({refs.length})
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={copyAll}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
              >
                {copiedId === 'all'
                  ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied</>
                  : <><Copy className="w-3.5 h-3.5" /> Copy all</>}
              </button>
              <button
                onClick={exportAll}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
              >
                <Download className="w-3.5 h-3.5" /> Export .txt
              </button>
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-500 text-sm rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear all
              </button>
            </div>
          </div>

          {/* Ref cards */}
          {sortedRefs.map((ref, idx) => (
            <RefCard
              key={ref.id}
              index={idx + 1}
              entry={ref}
              onDelete={() => deleteRef(ref.id)}
              copiedId={copiedId}
              onCopy={copy}
              highlighted={ref.id === highlightId}
            />
          ))}
        </div>
      )}

      {/* APA7 formatting rules reminder */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs text-gray-500 space-y-1.5">
        <p className="font-semibold text-gray-600">APA 7th Edition rules applied</p>
        <ul className="list-disc list-inside space-y-0.5 leading-relaxed">
          <li>
            <strong>Sentence case</strong> for article titles, chapter titles, thesis titles
            (first word + first word after colon capitalised)
          </li>
          <li>
            <strong>Title Case</strong> for journal names, book titles, conference names (italicised)
          </li>
          <li>
            Authors inverted — Last, F. M. · 2 authors joined with &amp; · 3–20 all listed ·
            21+ first 19 then <em>. . .</em> then last
          </li>
          <li>Page ranges use en-dash (–) · DOIs formatted as https://doi.org/…</li>
          <li>⚠ Proper nouns (country names, people, brands) may need manual capitalisation review</li>
        </ul>
      </div>

    </div>
  )
}
