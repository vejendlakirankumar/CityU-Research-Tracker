import { useState } from 'react'
import {
  BookOpen, Link, Hash, Barcode, FileText, Atom,
  Copy, Trash2, Check, Loader2, AlertCircle,
  Plus, Download, ChevronDown, Info,
} from 'lucide-react'
import { clsx } from 'clsx'
import api from '../lib/axios'
import type { RefMeta } from '../lib/apa7'
import {
  formatReference, formatInTextCitation,
  referenceToHtml, referencePlainText,
} from '../lib/apa7'
import { bibtexToMetas } from '../lib/bibtex-parser'

// ── Types ─────────────────────────────────────────────────────────────────────

type InputMode = 'doi' | 'isbn' | 'url' | 'bibtex' | 'arxiv'

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
    id: 'bibtex',
    label: 'BibTeX',
    icon: FileText,
    placeholder: `@article{smith2020,\n  author  = {Smith, John A.},\n  title   = {The role of context in understanding},\n  journal = {Psychological Review},\n  year    = {2020},\n  volume  = {127},\n  number  = {3},\n  pages   = {411--430},\n  doi     = {10.1037/rev0000186}\n}`,
    hint: 'Processed entirely offline — no network request made.',
    multiline: true,
  },
]

// ── Reference card component ──────────────────────────────────────────────────

function RefCard({
  index,
  entry,
  onDelete,
  copiedId,
  onCopy,
}: {
  index: number
  entry: RefEntry
  onDelete: () => void
  copiedId: string | null
  onCopy: (text: string, id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReferencesPage() {
  const [mode, setMode]       = useState<InputMode>('doi')
  const [value, setValue]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [refs, setRefs]       = useState<RefEntry[]>([])
  const { copiedId, copy }    = useCopy()

  const currentMode = MODES.find(m => m.id === mode)!

  const addMeta = (meta: RefMeta) => {
    setRefs(prev => [
      ...prev,
      {
        id:        crypto.randomUUID(),
        meta,
        reference: formatReference(meta),
        citation:  formatInTextCitation(meta),
      },
    ])
  }

  const deleteRef = (id: string) => setRefs(prev => prev.filter(r => r.id !== id))

  const clearAll = () => {
    if (refs.length > 0 && confirm('Remove all references?')) setRefs([])
  }

  const resolve = async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    setError(''); setLoading(true)
    try {
      if (mode === 'bibtex') {
        const metas = bibtexToMetas(trimmed)
        if (metas.length === 0) {
          setError('No valid BibTeX entries found. Check the format and try again.')
          return
        }
        metas.forEach(addMeta)
        setValue('')
      } else if (mode === 'arxiv') {
        const r = await api.post('/references/resolve', { type: 'arxiv', value: trimmed })
        addMeta(r.data as RefMeta)
        setValue('')
      } else {
        const r = await api.post('/references/resolve', { type: mode, value: trimmed })
        addMeta(r.data as RefMeta)
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
            Generate correctly formatted APA 7th edition citations and references from DOI, ISBN, URL, or BibTeX.
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
              onClick={() => { setMode(tab.id); setValue(''); setError('') }}
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
