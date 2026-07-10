<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ReferenceController extends Controller
{
    /**
     * Resolve a DOI, ISBN, or URL to normalised reference metadata.
     * Returns a RefMeta-compatible JSON object that the frontend APA7 engine can format.
     */
    public function resolve(Request $request): JsonResponse
    {
        $request->validate([
            'type'  => 'required|in:doi,isbn,url,arxiv,title',
            'value' => 'required|string|max:2048',
        ]);

        $type  = $request->input('type');
        $value = trim((string) $request->input('value'));

        try {
            return match ($type) {
                'doi'   => $this->resolveDoi($value),
                'isbn'  => $this->resolveIsbn($value),
                'url'   => $this->resolveUrl($value),
                'arxiv' => $this->resolveArxiv($value),
                'title' => $this->resolveTitle($value),
            };
        } catch (\Throwable $e) {
            Log::warning("Reference resolve failed [{$type}]: " . $e->getMessage());
            return response()->json(
                ['error' => 'Could not retrieve metadata. Please verify the value and try again.'],
                422,
            );
        }
    }

    /**
     * Build the final metadata JSON response: strip null/empty fields and decode
     * any HTML/XML entities (e.g. CrossRef returns "Computers &amp; Industrial
     * Engineering") so the frontend receives clean text rather than escaped markup.
     */
    private function cleanMeta(array $meta): JsonResponse
    {
        $filtered = array_filter($meta, fn($v) => $v !== null && $v !== '');

        return response()->json($this->decodeEntities($filtered));
    }

    /** Recursively HTML-entity-decode every string value in a structure. */
    private function decodeEntities(mixed $value): mixed
    {
        if (is_array($value)) {
            return array_map(fn($v) => $this->decodeEntities($v), $value);
        }
        if (is_string($value)) {
            return html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        return $value;
    }

    // ── DOI → Crossref → DataCite → OpenAlex ──────────────────────────────────

    private function resolveDoi(string $doi): JsonResponse
    {
        // Strip URL prefix if user pasted https://doi.org/10.xxx
        $doi = preg_replace('#^https?://(?:dx\.)?doi\.org/#i', '', $doi);
        $doi = ltrim($doi, '/');

        // Crossref is primary; DataCite covers datasets/software DOIs and
        // OpenAlex is a broad aggregated fallback when Crossref lacks the work.
        $meta = $this->fetchCrossrefByDoi($doi)
            ?? $this->fetchDataciteByDoi($doi)
            ?? $this->fetchOpenAlexByDoi($doi);

        if ($meta === null) {
            return response()->json(
                ['error' => 'DOI not found in Crossref, DataCite, or OpenAlex.'],
                404,
            );
        }

        // Crossref/DataCite sometimes register a work (esp. book chapters)
        // without author metadata. OpenAlex frequently has the authors, so
        // enrich rather than show an author-less reference.
        $meta = $this->enrichAuthorsFromOpenAlex($meta);

        return $this->cleanMeta($meta);
    }

    /**
     * If a mapped record has no authors but carries a DOI, try to fill the
     * author list from OpenAlex (which aggregates many sources). Leaves the
     * record untouched when it already has authors or has no DOI to look up.
     */
    private function enrichAuthorsFromOpenAlex(array $meta): array
    {
        if (!empty($meta['authors'])) return $meta;
        if (($meta['source'] ?? '') === 'OpenAlex') return $meta;
        if (empty($meta['doi'])) return $meta;

        $oa = $this->fetchOpenAlexByDoi($meta['doi']);
        if ($oa !== null && !empty($oa['authors'])) {
            $meta['authors'] = $oa['authors'];
            $meta['source']  = trim(($meta['source'] ?? '') . ' + OpenAlex (authors)');
        }

        return $meta;
    }

    /** Look up a DOI in Crossref. Returns mapped meta or null. */
    private function fetchCrossrefByDoi(string $doi): ?array
    {
        try {
            $response = Http::withHeaders([
                // Crossref polite pool — includes mailto for higher rate limits
                'User-Agent' => 'CityU-RRP/1.0 (mailto:support@cityu.edu.hk)',
            ])->timeout(12)->get('https://api.crossref.org/works/' . rawurlencode($doi));

            if (!$response->successful()) return null;
            $work = $response->json('message');
            if (empty($work)) return null;

            $meta = $this->mapCrossrefWork($work, $doi);
            $meta['source'] = 'Crossref';
            return $meta;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Look up a DOI in DataCite (datasets, software, repositories). */
    private function fetchDataciteByDoi(string $doi): ?array
    {
        try {
            $response = Http::withHeaders(['Accept' => 'application/vnd.api+json'])
                ->timeout(12)->get('https://api.datacite.org/dois/' . rawurlencode($doi));

            if (!$response->successful()) return null;
            $attr = $response->json('data.attributes');
            if (empty($attr)) return null;

            $meta = $this->mapDataciteWork($attr, $doi);
            $meta['source'] = 'DataCite';
            return $meta;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Look up a DOI in OpenAlex (large aggregated index). */
    private function fetchOpenAlexByDoi(string $doi): ?array
    {
        try {
            $response = Http::timeout(12)->get(
                'https://api.openalex.org/works/doi:' . rawurlencode($doi),
                ['mailto' => 'support@cityu.edu.hk'],
            );

            if (!$response->successful()) return null;
            $work = $response->json();
            if (empty($work) || empty($work['id'])) return null;

            $meta = $this->mapOpenAlexWork($work);
            $meta['source'] = 'OpenAlex';
            return $meta;
        } catch (\Throwable $e) {
            return null;
        }
    }

    // ── Title → Crossref → OpenAlex → Semantic Scholar → PubMed ────────────────

    private function resolveTitle(string $title): JsonResponse
    {
        if (mb_strlen($title) < 6) {
            return response()->json(['error' => 'Please enter a longer / more specific title.'], 422);
        }

        $meta = $this->searchCrossrefByTitle($title)
            ?? $this->searchOpenAlexByTitle($title)
            ?? $this->searchSemanticScholarByTitle($title)
            ?? $this->searchPubmedByTitle($title);

        if ($meta === null) {
            return response()->json(['error' => 'No matching work found for that title.'], 404);
        }

        $meta = $this->enrichAuthorsFromOpenAlex($meta);

        return $this->cleanMeta($meta);
    }

    /** Title search via Crossref bibliographic query. */
    private function searchCrossrefByTitle(string $title): ?array
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => 'CityU-RRP/1.0 (mailto:support@cityu.edu.hk)',
            ])->timeout(12)->get('https://api.crossref.org/works', [
                'query.bibliographic' => $title,
                'rows'                => 5,
                'select' => 'DOI,title,author,editor,container-title,volume,issue,page,published,issued,type,publisher,ISBN',
            ]);

            if (!$response->successful()) return null;
            $items = $response->json('message.items') ?? [];
            if (empty($items)) return null;

            // Crossref ranks by relevance, but re-rank by title similarity so a
            // close textual match wins over a merely keyword-relevant result.
            $best = $this->pickBestTitleMatch($items, $title);
            $meta = $this->mapCrossrefWork($best);
            $meta['source'] = 'Crossref';
            return $meta;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Title search via OpenAlex. */
    private function searchOpenAlexByTitle(string $title): ?array
    {
        try {
            $response = Http::timeout(12)->get('https://api.openalex.org/works', [
                'search'   => $title,
                'per_page' => 5,
                'mailto'   => 'support@cityu.edu.hk',
            ]);

            if (!$response->successful()) return null;
            $items = $response->json('results') ?? [];
            if (empty($items)) return null;

            $titles = array_map(fn($w) => $w['display_name'] ?? ($w['title'] ?? ''), $items);
            $bestIdx = $this->bestMatchIndex($titles, $title);
            $meta = $this->mapOpenAlexWork($items[$bestIdx]);
            $meta['source'] = 'OpenAlex';
            return $meta;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Title search via Semantic Scholar (good keyword matching). */
    private function searchSemanticScholarByTitle(string $title): ?array
    {
        try {
            $response = Http::timeout(12)->get(
                'https://api.semanticscholar.org/graph/v1/paper/search',
                [
                    'query'  => $title,
                    'limit'  => 5,
                    'fields' => 'title,year,authors,venue,journal,externalIds,publicationTypes',
                ],
            );

            if (!$response->successful()) return null;
            $items = $response->json('data') ?? [];
            if (empty($items)) return null;

            $titles = array_map(fn($p) => $p['title'] ?? '', $items);
            $bestIdx = $this->bestMatchIndex($titles, $title);
            $meta = $this->mapSemanticScholarWork($items[$bestIdx]);
            $meta['source'] = 'Semantic Scholar';
            return $meta;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Title search via PubMed E-utilities (specialised medical metadata). */
    private function searchPubmedByTitle(string $title): ?array
    {
        try {
            $search = Http::timeout(12)->get(
                'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
                ['db' => 'pubmed', 'term' => $title, 'retmode' => 'json', 'retmax' => 1],
            );
            if (!$search->successful()) return null;
            $id = $search->json('esearchresult.idlist.0');
            if (empty($id)) return null;

            $summary = Http::timeout(12)->get(
                'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi',
                ['db' => 'pubmed', 'id' => $id, 'retmode' => 'json'],
            );
            if (!$summary->successful()) return null;
            $doc = $summary->json("result.{$id}");
            if (empty($doc)) return null;

            $meta = $this->mapPubmedWork($doc);
            $meta['source'] = 'PubMed';
            return $meta;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Index of the candidate title most similar to the query. */
    private function bestMatchIndex(array $titles, string $query): int
    {
        $normQuery = $this->normaliseForMatch($query);
        $bestIdx   = 0;
        $bestScore = -1.0;
        foreach ($titles as $i => $t) {
            $score = 0.0;
            similar_text($normQuery, $this->normaliseForMatch((string) $t), $score);
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestIdx   = $i;
            }
        }
        return $bestIdx;
    }

    /** Choose the CrossRef item whose title most closely matches the query. */
    private function pickBestTitleMatch(array $items, string $query): array
    {
        $normQuery = $this->normaliseForMatch($query);
        $best      = $items[0];
        $bestScore = -1.0;

        foreach ($items as $item) {
            $itemTitle = $item['title'][0] ?? '';
            $score = 0.0;
            similar_text($normQuery, $this->normaliseForMatch($itemTitle), $score);
            if ($score > $bestScore) {
                $bestScore = $score;
                $best      = $item;
            }
        }

        return $best;
    }

    /** Lower-case and strip punctuation for fuzzy title comparison. */
    private function normaliseForMatch(string $s): string
    {
        $s = mb_strtolower($s);
        $s = preg_replace('/[^a-z0-9]+/', ' ', $s);
        return trim($s);
    }

    /** Map a CrossRef "work" object into our reference-metadata array. */
    private function mapCrossrefWork(array $work, ?string $doi = null): array
    {
        $doi = $doi ?? ($work['DOI'] ?? null);

        $authors = collect($work['author'] ?? [])
            ->map(fn($a) => [
                'last'  => $a['family'] ?? ($a['name'] ?? ''),
                'first' => $a['given']  ?? '',
                'isOrg' => !isset($a['family']) && isset($a['name']),
            ])
            ->filter(fn($a) => !empty($a['last']))
            ->values()
            ->toArray();

        $type  = $this->crossrefTypeToMeta($work['type'] ?? '');

        // Crossref frequently tags book chapters with the generic type "other"
        // (which we map to "misc"). When such a record sits inside a container
        // (the book) and carries a page range, it is almost certainly a chapter,
        // so promote it to get proper "In ... (Eds.), *Book* (pp. x–y)" output.
        if ($type === 'misc'
            && !empty($work['container-title'][0])
            && !empty($work['page'])
        ) {
            $type = 'chapter';
        }

        $year  = (string) ($work['published']['date-parts'][0][0]
            ?? $work['issued']['date-parts'][0][0]
            ?? 'n.d.');
        $monthNum = $work['published']['date-parts'][0][1]
            ?? $work['issued']['date-parts'][0][1]
            ?? null;
        $month = $monthNum ? date('F', mktime(0, 0, 0, (int) $monthNum, 1)) : null;

        $pages = isset($work['page'])
            ? str_replace('-', "\u{2013}", $work['page'])
            : null;

        $meta = [
            'type'      => $type,
            'authors'   => $authors,
            'year'      => $year,
            'month'     => $month,
            'title'     => $work['title'][0] ?? '',
            'journal'   => $work['container-title'][0] ?? null,
            'volume'    => $work['volume'] ?? null,
            'issue'     => $work['issue']  ?? null,
            'pages'     => $pages,
            'doi'       => $doi,
            'publisher' => $work['publisher'] ?? null,
            'isbn'      => !empty($work['ISBN']) ? $work['ISBN'][0] : null,
        ];

        // Conference proceedings: remap journal → conference
        if ($type === 'conference') {
            $meta['conference']       = $meta['journal'];
            $meta['conferencePages']  = $pages;
            $meta['journal']          = null;
        }

        // Book chapter: remap journal → bookTitle
        if ($type === 'chapter') {
            $meta['bookTitle']      = $meta['journal'];
            $meta['chapterPages']   = $pages;
            $meta['journal']        = null;

            // Editors from CrossRef `editor` field
            $meta['editors'] = collect($work['editor'] ?? [])
                ->map(fn($e) => ['last' => $e['family'] ?? '', 'first' => $e['given'] ?? ''])
                ->filter(fn($e) => !empty($e['last']))
                ->values()
                ->toArray();
        }

        return $meta;
    }

    /** Map an OpenAlex "work" object into our reference-metadata array. */
    private function mapOpenAlexWork(array $w): array
    {
        $authors = collect($w['authorships'] ?? [])
            ->map(function ($a) {
                $name = $a['author']['display_name'] ?? ($a['raw_author_name'] ?? '');
                return $this->parseName((string) $name);
            })
            ->filter(fn($a) => !empty($a['last']))
            ->values()
            ->toArray();

        $biblio = $w['biblio'] ?? [];
        $pages  = null;
        if (!empty($biblio['first_page'])) {
            $pages = $biblio['first_page']
                . (!empty($biblio['last_page']) ? "\u{2013}{$biblio['last_page']}" : '');
        }

        $journal = $w['primary_location']['source']['display_name']
            ?? $w['host_venue']['display_name']
            ?? null;

        $doi = $w['doi'] ?? null;
        if ($doi) $doi = preg_replace('#^https?://(?:dx\.)?doi\.org/#i', '', $doi);

        $type = $this->crossrefTypeToMeta($w['type_crossref'] ?? $w['type'] ?? '');

        $meta = [
            'type'      => $type,
            'authors'   => $authors,
            'year'      => (string) ($w['publication_year'] ?? 'n.d.'),
            'title'     => $w['title'] ?? ($w['display_name'] ?? ''),
            'journal'   => $journal,
            'volume'    => $biblio['volume'] ?? null,
            'issue'     => $biblio['issue']  ?? null,
            'pages'     => $pages,
            'doi'       => $doi,
            'publisher' => $w['primary_location']['source']['host_organization_name'] ?? null,
        ];

        if ($type === 'conference') {
            $meta['conference']      = $journal;
            $meta['conferencePages'] = $pages;
            $meta['journal']         = null;
        }
        if ($type === 'chapter') {
            $meta['bookTitle']    = $journal;
            $meta['chapterPages'] = $pages;
            $meta['journal']      = null;
        }

        return $meta;
    }

    /** Map a DataCite DOI attributes object (datasets / software / data). */
    private function mapDataciteWork(array $attr, string $doi): array
    {
        $authors = collect($attr['creators'] ?? [])
            ->map(function ($c) {
                if (!empty($c['familyName'])) {
                    return ['last' => $c['familyName'], 'first' => $c['givenName'] ?? ''];
                }
                // "name" may be "Last, First" or an organisation
                $name = $c['name'] ?? '';
                if (($c['nameType'] ?? '') === 'Organizational') {
                    return ['last' => $name, 'first' => '', 'isOrg' => true];
                }
                return $this->parseName((string) $name);
            })
            ->filter(fn($a) => !empty($a['last']))
            ->values()
            ->toArray();

        $title = '';
        if (!empty($attr['titles'][0]['title'])) $title = $attr['titles'][0]['title'];

        // DataCite mostly describes datasets/software — format as a generic work.
        return [
            'type'      => 'misc',
            'authors'   => $authors,
            'year'      => (string) ($attr['publicationYear'] ?? 'n.d.'),
            'title'     => $title,
            'publisher' => $attr['publisher'] ?? null,
            'doi'       => $doi,
        ];
    }

    /** Map a Semantic Scholar paper object into our reference-metadata array. */
    private function mapSemanticScholarWork(array $p): array
    {
        $authors = collect($p['authors'] ?? [])
            ->map(fn($a) => $this->parseName((string) ($a['name'] ?? '')))
            ->filter(fn($a) => !empty($a['last']))
            ->values()
            ->toArray();

        $journal = $p['journal']['name'] ?? ($p['venue'] ?? null);
        $pages   = $p['journal']['pages'] ?? null;
        if ($pages) $pages = str_replace('-', "\u{2013}", $pages);

        return [
            'type'    => 'article',
            'authors' => $authors,
            'year'    => (string) ($p['year'] ?? 'n.d.'),
            'title'   => $p['title'] ?? '',
            'journal' => $journal,
            'volume'  => $p['journal']['volume'] ?? null,
            'pages'   => $pages,
            'doi'     => $p['externalIds']['DOI'] ?? null,
        ];
    }

    /** Map a PubMed esummary document into our reference-metadata array. */
    private function mapPubmedWork(array $doc): array
    {
        // PubMed authors are "Last FM" (e.g. "Wang DO"); split surname + initials.
        $authors = collect($doc['authors'] ?? [])
            ->filter(fn($a) => ($a['authtype'] ?? 'Author') === 'Author' && !empty($a['name']))
            ->map(function ($a) {
                $name  = trim($a['name']);
                $parts = preg_split('/\s+/', $name);
                $inits = array_pop($parts);            // trailing token = initials "DO"
                $last  = implode(' ', $parts) ?: $inits;
                // Expand concatenated initials "DO" → "D O" for proper formatting
                $first = $parts ? trim(preg_replace('/([A-Z])/', '$1 ', $inits)) : '';
                return ['last' => $last, 'first' => $first];
            })
            ->filter(fn($a) => !empty($a['last']))
            ->values()
            ->toArray();

        $year = 'n.d.';
        if (!empty($doc['pubdate']) && preg_match('/(\d{4})/', $doc['pubdate'], $m)) {
            $year = $m[1];
        }

        $pages = $doc['pages'] ?? null;
        if ($pages) $pages = str_replace('-', "\u{2013}", $pages);

        $doi = null;
        foreach ($doc['articleids'] ?? [] as $aid) {
            if (($aid['idtype'] ?? '') === 'doi') { $doi = $aid['value']; break; }
        }

        return [
            'type'    => 'article',
            'authors' => $authors,
            'year'    => $year,
            'title'   => rtrim($doc['title'] ?? '', '.'),
            'journal' => $doc['fulljournalname'] ?? ($doc['source'] ?? null),
            'volume'  => $doc['volume'] ?? null,
            'issue'   => $doc['issue']  ?? null,
            'pages'   => $pages,
            'doi'     => $doi,
        ];
    }

    private function crossrefTypeToMeta(string $type): string
    {
        return match ($type) {
            // Crossref + OpenAlex journal-article vocabularies
            'journal-article', 'article', 'review',
            'preprint', 'editorial', 'letter'          => 'article',
            'book', 'monograph', 'edited-book',
            'reference-book', 'book-set', 'book-series' => 'book',
            'book-chapter', 'reference-entry',
            'book-part', 'book-section'                 => 'chapter',
            'proceedings-article', 'proceedings'        => 'conference',
            'report', 'report-series',
            'report-component'                         => 'report',
            'dissertation', 'thesis'                   => 'thesis',
            default                                    => 'misc',
        };
    }

    // ── arXiv ID → arXiv API ────────────────────────────────────────────────

    private function resolveArxiv(string $id): JsonResponse
    {
        // Strip URL prefix: https://arxiv.org/abs/2301.00001 or .../pdf/2301.00001v2.pdf
        $id = preg_replace('#^https?://(?:www\.)?arxiv\.org/(?:abs|pdf)/#i', '', $id);
        $id = preg_replace('#\.pdf$#i', '', $id);
        // Strip "arxiv:" prefix
        $id = preg_replace('#^arxiv:\s*#i', '', $id);
        $id = trim($id);

        // Validate: new format 2301.00001[v2] or legacy hep-ph/0001001[v2]
        $newFormat    = '/^\d{4}\.\d{4,5}(v\d+)?$/';
        $legacyFormat = '/^[a-z][a-z\-]*(\.[A-Z]+)?\/\d{7}(v\d+)?$/i';
        if (!preg_match($newFormat, $id) && !preg_match($legacyFormat, $id)) {
            return response()->json(
                ['error' => 'Invalid arXiv ID. Examples: 2301.00001, hep-ph/9902242, or a full arxiv.org URL.'],
                422,
            );
        }

        $response = Http::withHeaders([
            'User-Agent' => 'CityU-RRP/1.0 (mailto:support@cityu.edu.hk)',
        ])->timeout(12)->get('https://export.arxiv.org/api/query', [
            'id_list'    => $id,
            'max_results' => 1,
        ]);

        if ($response->failed()) {
            return response()->json(['error' => 'arXiv API lookup failed. Please try again.'], 502);
        }

        $xml = @simplexml_load_string($response->body());
        if ($xml === false) {
            return response()->json(['error' => 'Failed to parse arXiv response.'], 502);
        }

        $namespaces = $xml->getNamespaces(true);
        // Atom entries live directly under the feed root
        $entry = $xml->entry ?? null;
        if (!$entry) {
            return response()->json(['error' => 'arXiv ID not found.'], 404);
        }

        // ---- Authors
        $authors = [];
        foreach ($entry->author as $author) {
            $parsed = $this->parseName((string) $author->name);
            if (!empty($parsed['last'])) {
                $authors[] = $parsed;
            }
        }

        // ---- Date (first submitted)
        $year = $month = $day = null;
        $publishedRaw = (string) ($entry->published ?? '');
        if (preg_match('/(\d{4})-(\d{2})-(\d{2})/', $publishedRaw, $m)) {
            $year  = $m[1];
            $month = date('F', mktime(0, 0, 0, (int) $m[2], 1));
            $day   = ltrim($m[3], '0');
        }

        // ---- Title (collapse whitespace, arXiv wraps long titles)
        $title = preg_replace('/\s+/', ' ', trim((string) $entry->title));

        // ---- DOI from arxiv namespace
        $doi = null;
        if (!empty($namespaces['arxiv'])) {
            $arxivChildren = $entry->children($namespaces['arxiv']);
            if (isset($arxivChildren->doi)) {
                $doi = trim((string) $arxivChildren->doi);
            }
        }

        // New-format arXiv IDs (YYMM.NNNNN) always have a 10.48550 DOI
        $baseId = preg_replace('/v\d+$/', '', $id);
        if (!$doi && preg_match('/^\d{4}\.\d{4,5}$/', $baseId)) {
            $doi = "10.48550/arXiv.{$baseId}";
        }

        // Canonical URL (versionless)
        $url = "https://arxiv.org/abs/{$baseId}";

        return $this->cleanMeta([
            'type'        => 'report',
            'authors'     => $authors,
            'year'        => $year ?? 'n.d.',
            'month'       => $month,
            'day'         => $day,
            'title'       => $title,
            'institution' => 'arXiv',
            'doi'         => $doi,
            // Only include url if there is no DOI (APA7 prefers DOI)
            'url'         => $doi ? null : $url,
        ]);
    }

    // ── ISBN → Open Library ───────────────────────────────────────────────────

    private function resolveIsbn(string $isbn): JsonResponse
    {
        // Strip non-alphanumeric chars (dashes, spaces)
        $isbn = preg_replace('/[^0-9Xx]/', '', $isbn);
        $isbn = strtoupper($isbn);

        if (strlen($isbn) !== 10 && strlen($isbn) !== 13) {
            return response()->json(['error' => 'ISBN must be 10 or 13 digits (hyphens are fine).'], 422);
        }

        $response = Http::timeout(12)->get('https://openlibrary.org/api/books', [
            'bibkeys' => "ISBN:{$isbn}",
            'format'  => 'json',
            'jscmd'   => 'data',
        ]);

        if ($response->failed()) {
            return response()->json(['error' => 'Open Library lookup failed. Please try again.'], 502);
        }

        $data = $response->json("ISBN:{$isbn}");

        if (empty($data)) {
            // Open Library didn't have it — try Google Books
            return $this->resolveIsbnGoogleBooks($isbn);
        }

        $authors = collect($data['authors'] ?? [])
            ->map(fn($a) => $this->parseName($a['name'] ?? ''))
            ->filter(fn($a) => !empty($a['last']))
            ->values()
            ->toArray();

        $year = null;
        if (!empty($data['publish_date'])) {
            preg_match('/\d{4}/', $data['publish_date'], $m);
            $year = $m[0] ?? null;
        }

        $publisher = collect($data['publishers'] ?? [])->pluck('name')->implode('; ');
        $place     = collect($data['publish_places'] ?? [])->pluck('name')->implode('; ');

        return $this->cleanMeta([
            'type'      => 'book',
            'authors'   => $authors,
            'year'      => $year ?? 'n.d.',
            'title'     => $data['title'] ?? '',
            'publisher' => $publisher ?: null,
            'place'     => $place     ?: null,
            'isbn'      => $isbn,
            'url'       => $data['url'] ?? null,
        ]);
    }

    // ── ISBN → Google Books (fallback) ────────────────────────────────────────

    private function resolveIsbnGoogleBooks(string $isbn): JsonResponse
    {
        $response = Http::timeout(12)->get('https://www.googleapis.com/books/v1/volumes', [
            'q'          => "isbn:{$isbn}",
            'maxResults' => 1,
        ]);

        if ($response->failed()) {
            return response()->json(['error' => 'ISBN not found in Open Library or Google Books.'], 404);
        }

        $items = $response->json('items');
        if (empty($items)) {
            return response()->json(['error' => 'ISBN not found in Open Library or Google Books.'], 404);
        }

        $info    = $items[0]['volumeInfo'] ?? [];
        $authors = collect($info['authors'] ?? [])
            ->map(fn($name) => $this->parseName($name))
            ->filter(fn($a) => !empty($a['last']))
            ->values()
            ->toArray();

        $year = null;
        if (!empty($info['publishedDate'])) {
            preg_match('/\d{4}/', $info['publishedDate'], $m);
            $year = $m[0] ?? null;
        }

        // Prefer ISBN-13 identifier from response if present
        $isbnFinal = $isbn;
        foreach ($info['industryIdentifiers'] ?? [] as $id) {
            if ($id['type'] === 'ISBN_13') {
                $isbnFinal = $id['identifier'];
                break;
            }
        }

        return $this->cleanMeta([
            'type'      => 'book',
            'authors'   => $authors,
            'year'      => $year ?? 'n.d.',
            'title'     => $info['title'] ?? '',
            'publisher' => $info['publisher'] ?? null,
            'isbn'      => $isbnFinal,
        ]);
    }

    // ── URL → HTML meta scrape ────────────────────────────────────────────────

    private function resolveUrl(string $url): JsonResponse
    {
        // Validate URL structure and scheme
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            return response()->json(['error' => 'Invalid URL.'], 422);
        }
        if (!preg_match('#^https?://#i', $url)) {
            return response()->json(['error' => 'Only HTTP/HTTPS URLs are supported.'], 422);
        }

        // SSRF guard: block requests to private/loopback/link-local addresses.
        // This prevents the server from being used as a proxy to internal services
        // (e.g. cloud metadata endpoints, intranet hosts, localhost).
        if ($this->isPrivateUrl($url)) {
            return response()->json(['error' => 'The requested URL is not publicly reachable.'], 422);
        }

        $response = Http::withHeaders([
            'User-Agent'      => 'Mozilla/5.0 (compatible; CityU-RRP/1.0)',
            'Accept'          => 'text/html,application/xhtml+xml',
            'Accept-Language' => 'en-US,en;q=0.9',
        ])->timeout(12)->get($url);

        if ($response->failed()) {
            return response()->json(['error' => 'Could not fetch the URL. The site may be unreachable.'], 422);
        }

        $html = $response->body();

        // ── 0. Scholarly article? ─────────────────────────────────────────────
        // Journal/publisher landing pages (JSTOR, Springer, Wiley, PubMed,
        // university repositories, etc.) embed Highwire/Google-Scholar
        // "citation_*" meta tags. When present, build a journal-article
        // reference instead of a generic website.
        $scholarly = $this->resolveScholarlyArticle($html, $url);
        if ($scholarly !== null) {
            return $scholarly;
        }

        // ── 1. JSON-LD (most reliable for modern news/editorial sites) ────────
        $ld = $this->extractJsonLd($html);

        // ── 2. Title ──────────────────────────────────────────────────────────
        $title = $ld['headline'] ?? $ld['name']
            ?? $this->extractMeta($html, 'og:title')
            ?? $this->extractMeta($html, 'twitter:title')
            ?? $this->extractHtmlTitle($html)
            ?? 'Untitled page';

        // ── 3. Authors ────────────────────────────────────────────────────────
        $authors = [];

        if (!empty($ld['authorNames'])) {
            // JSON-LD gave us a list of name strings
            foreach ($ld['authorNames'] as $name) {
                $parsed = $this->parseName($name);
                if (!empty($parsed['last'])) $authors[] = $parsed;
            }
        } else {
            // Fall back to meta tags
            $authorRaw = $this->extractMeta($html, 'author')
                ?? $this->extractMeta($html, 'article:author');

            if ($authorRaw && !str_starts_with($authorRaw, 'http')) {
                // Some sites put multiple authors as "A, B and C" or "A and B"
                $nameStrings = preg_split('/\s+and\s+|;\s*/', $authorRaw);
                foreach ($nameStrings as $name) {
                    $parsed = $this->parseName(trim($name));
                    if (!empty($parsed['last'])) $authors[] = $parsed;
                }
            }
        }

        // ── 4. Publication date ───────────────────────────────────────────────
        // APA7 §9.15: cite the date of the version you used. For a page that has
        // been updated/revised, prefer the most recent "updated/modified" date
        // over the original publication date. (A "last reviewed" date is ignored
        // because a review does not necessarily mean the content changed — sites
        // do not expose that distinctly, so only true modified timestamps count.)
        $updatedDate = $ld['dateModified']
            ?? $this->extractMeta($html, 'article:modified_time')
            ?? $this->extractMeta($html, 'og:updated_time')
            ?? $this->extractMeta($html, 'dateModified');

        $publishedDate = $ld['datePublished']
            ?? $this->extractMeta($html, 'article:published_time')
            ?? $this->extractMeta($html, 'datePublished')
            ?? $this->extractMeta($html, 'publish_date')
            ?? $this->extractMeta($html, 'DC.date');

        // Use the updated date only when it is a valid date at or after the
        // published date; otherwise fall back to published, then the URL path.
        $pubDate = $this->pickCitationDate($updatedDate, $publishedDate)
            ?? $this->extractDateFromUrl($url);   // last resort: /YYYY/MM/DD/ in URL

        $year  = null;
        $month = null;
        $day   = null;
        if ($pubDate) {
            if (preg_match('/(\d{4})-(\d{2})-(\d{2})/', $pubDate, $m)) {
                $year  = $m[1];
                $month = date('F', mktime(0, 0, 0, (int) $m[2], 1));
                $day   = ltrim($m[3], '0');
            } elseif (preg_match('/(\d{4})/', $pubDate, $m)) {
                $year = $m[1];
            }
        }

        // ── 5. Site name ──────────────────────────────────────────────────────
        $host     = parse_url($url, PHP_URL_HOST) ?? '';
        $siteName = $ld['publisherName']
            ?? $this->extractMeta($html, 'og:site_name')
            ?? $host;

        // Strip a trailing " | Site", " - Site", " — Site" suffix that many
        // HTML <title>/og:title tags append — APA7 work titles omit the site brand.
        $title = $this->stripSiteSuffix($title, $siteName, $host);

        // ── 6. Retrieved date (APA7 §9.33) ───────────────────────────────────
        // Only when no publication date is known — content that may change over time
        $retrievedDate = ($year === null) ? now()->format('F j, Y') : null;

        return $this->cleanMeta([
            'type'          => 'website',
            'authors'       => $authors ?: [],
            'year'          => $year ?? 'n.d.',
            'month'         => $month,
            'day'           => $day,
            'title'         => $title,
            'siteName'      => $siteName,
            'url'           => $url,
            'retrievedDate' => $retrievedDate,
        ]);
    }

    /**
     * Detect a scholarly journal article from Highwire/Google-Scholar
     * "citation_*" meta tags (used by JSTOR, Springer, Wiley, PubMed,
     * university repositories, etc.) and build an APA7 journal-article
     * reference. Returns null when the page is not an article so the caller
     * can fall back to generic website handling.
     */
    private function resolveScholarlyArticle(string $html, string $url): ?JsonResponse
    {
        $journal = $this->extractMeta($html, 'citation_journal_title');
        $title   = $this->extractMeta($html, 'citation_title');

        // Require at least a title plus a journal name to treat it as an article.
        if (!$title || !$journal) {
            return null;
        }

        // Authors — citation_author repeats once per author ("Last, First" or
        // "First Last"); parseName handles both forms.
        $authors = [];
        foreach ($this->extractAllMeta($html, 'citation_author') as $name) {
            $parsed = $this->parseName($name);
            if (!empty($parsed['last'])) $authors[] = $parsed;
        }

        // Pages — combine first/last page when both are present.
        $firstPage = $this->extractMeta($html, 'citation_firstpage');
        $lastPage  = $this->extractMeta($html, 'citation_lastpage');
        $pages = $firstPage;
        if ($firstPage && $lastPage) $pages = "{$firstPage}-{$lastPage}";

        // Date — citation_publication_date / citation_date / citation_year.
        $dateRaw = $this->extractMeta($html, 'citation_publication_date')
            ?? $this->extractMeta($html, 'citation_date')
            ?? $this->extractMeta($html, 'citation_year');
        $year = 'n.d.';
        if ($dateRaw && preg_match('/(\d{4})/', $dateRaw, $ym)) {
            $year = $ym[1];
        }

        $doi = $this->extractMeta($html, 'citation_doi');

        return $this->cleanMeta([
            'type'    => 'article',
            'authors' => $authors ?: [],
            'year'    => $year,
            'title'   => $title,
            'journal' => $journal,
            'volume'  => $this->extractMeta($html, 'citation_volume'),
            'issue'   => $this->extractMeta($html, 'citation_issue'),
            'pages'   => $pages,
            'doi'     => $doi,
            // APA7 §9.34: when there is no DOI, include the stable URL (e.g. JSTOR).
            'url'     => $doi ? null : $url,
        ]);
    }

    /** Extract all <meta name="..."> content values for a repeated tag */
    private function extractAllMeta(string $html, string $name): array
    {
        $n = preg_quote($name, '#');
        $values = [];
        $patterns = [
            "#<meta[^>]+name=[\"']{$n}[\"'][^>]+content=[\"'](.*?)[\"']#is",
            "#<meta[^>]+content=[\"'](.*?)[\"'][^>]+name=[\"']{$n}[\"']#is",
        ];
        foreach ($patterns as $pattern) {
            if (preg_match_all($pattern, $html, $m)) {
                foreach ($m[1] as $v) {
                    $values[] = html_entity_decode(trim($v), ENT_QUOTES, 'UTF-8');
                }
            }
        }
        return array_values(array_unique(array_filter($values)));
    }

    /**
     * Parse JSON-LD blocks from HTML.
     * Returns a flat array with keys: headline, name, datePublished,
     * authorNames (string[]), publisherName.
     */
    private function extractJsonLd(string $html): array
    {
        preg_match_all(
            '#<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>#is',
            $html,
            $matches,
        );

        $articleTypes = ['Article', 'NewsArticle', 'BlogPosting', 'ReportageNewsArticle',
                         'WebPage', 'WebContent', 'TechArticle'];

        foreach ($matches[1] as $jsonStr) {
            $data = json_decode(trim($jsonStr), true);
            if (!is_array($data)) continue;

            // Unwrap @graph arrays (Google's preferred LD+JSON structure)
            $candidates = [$data];
            if (isset($data['@graph']) && is_array($data['@graph'])) {
                $candidates = $data['@graph'];
            }

            foreach ($candidates as $item) {
                if (!is_array($item)) continue;
                $type = is_array($item['@type'] ?? null)
                    ? ($item['@type'][0] ?? '')
                    : ($item['@type'] ?? '');
                if (!in_array($type, $articleTypes)) continue;

                return $this->flattenJsonLdItem($item);
            }
        }

        return [];
    }

    private function flattenJsonLdItem(array $item): array
    {
        $result = [];

        // Safely coerce a JSON-LD value to string: arrays take the first element.
        $str = static function (mixed $v): string {
            if (is_array($v)) {
                $v = reset($v); // first element
            }
            return is_scalar($v) ? (string) $v : '';
        };

        // Title
        if (!empty($item['headline'])) $result['headline'] = $str($item['headline']);
        if (!empty($item['name']))     $result['name']     = $str($item['name']);

        // Date
        if (!empty($item['datePublished'])) {
            $result['datePublished'] = $str($item['datePublished']);
        }
        if (!empty($item['dateModified'])) {
            $result['dateModified'] = $str($item['dateModified']);
        }

        // Author(s) — can be: string | {"@type":"Person","name":"X"} | [{"name":"X"},...]
        if (!empty($item['author'])) {
            $raw   = $item['author'];
            $names = [];

            if (is_string($raw)) {
                $names[] = $raw;
            } elseif (is_array($raw)) {
                // Single author object {"name":"X"}
                if (isset($raw['name'])) {
                    $names[] = $str($raw['name']);
                } else {
                    // Array of author objects
                    foreach ($raw as $a) {
                        if (is_array($a) && !empty($a['name'])) {
                            $names[] = $str($a['name']);
                        } elseif (is_string($a)) {
                            $names[] = $a;
                        }
                    }
                }
            }

            if (!empty($names)) $result['authorNames'] = array_filter($names);
        }

        // Publisher name
        if (!empty($item['publisher'])) {
            $pub = $item['publisher'];
            if (is_string($pub)) {
                $result['publisherName'] = $pub;
            } elseif (is_array($pub) && !empty($pub['name'])) {
                $result['publisherName'] = $str($pub['name']);
            }
        }

        return $result;
    }

    /**
     * Choose the date to cite for a webpage per APA7 §9.15: prefer the most
     * recent update/modified date over the original publication date, but only
     * when the updated value is a valid date that is not earlier than the
     * published date (guards against malformed or template-default timestamps).
     */
    private function pickCitationDate(?string $updated, ?string $published): ?string
    {
        $u = $this->parseDateOrNull($updated);
        $p = $this->parseDateOrNull($published);

        if ($u !== null && ($p === null || $u >= $p)) {
            return $updated;
        }

        return $published ?: $updated;
    }

    /** Parse a loose date string to a Unix timestamp, or null if unparseable. */
    private function parseDateOrNull(?string $value): ?int
    {
        if ($value === null || trim($value) === '') return null;
        $ts = strtotime($value);
        return $ts === false ? null : $ts;
    }

    /**
     * Extract a date from URL path patterns like /2025/05/20/ or /20250520/
     */
    private function extractDateFromUrl(string $url): ?string
    {
        // /YYYY/MM/DD/ pattern (NPR, CNN, BBC, etc.)
        if (preg_match('#/(\d{4})/(\d{2})/(\d{2})/#', $url, $m)) {
            return "{$m[1]}-{$m[2]}-{$m[3]}";
        }
        // /YYYYMMDD pattern
        if (preg_match('#/(\d{4})(\d{2})(\d{2})[/_-]#', $url, $m)) {
            return "{$m[1]}-{$m[2]}-{$m[3]}";
        }
        return null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Parse "First Last", "Last, First", or single-token names */
    private function parseName(string $name): array
    {
        $name = trim($name);
        if (empty($name)) return ['last' => '', 'first' => ''];

        if (str_contains($name, ',')) {
            [$last, $first] = explode(',', $name, 2);
            return ['last' => trim($last), 'first' => trim($first)];
        }

        $parts = preg_split('/\s+/', $name);
        if (count($parts) === 1) {
            return ['last' => $parts[0], 'first' => ''];
        }

        $last  = array_pop($parts);
        $first = implode(' ', $parts);
        return ['last' => $last, 'first' => $first];
    }

    /** Extract a <meta name/property="..."> content value from raw HTML */
    private function extractMeta(string $html, string $name): ?string
    {
        $n = preg_quote($name, '#');
        $patterns = [
            // <meta property="og:title" content="...">
            "#<meta[^>]+property=[\"']{$n}[\"'][^>]+content=[\"'](.*?)[\"']#is",
            // <meta content="..." property="og:title">
            "#<meta[^>]+content=[\"'](.*?)[\"'][^>]+property=[\"']{$n}[\"']#is",
            // <meta name="author" content="...">
            "#<meta[^>]+name=[\"']{$n}[\"'][^>]+content=[\"'](.*?)[\"']#is",
            // <meta content="..." name="author">
            "#<meta[^>]+content=[\"'](.*?)[\"'][^>]+name=[\"']{$n}[\"']#is",
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $html, $m)) {
                return html_entity_decode(trim($m[1]), ENT_QUOTES, 'UTF-8');
            }
        }
        return null;
    }

    /** Extract the <title>…</title> text */
    private function extractHtmlTitle(string $html): ?string
    {
        if (preg_match('#<title[^>]*>(.*?)</title>#is', $html, $m)) {
            return html_entity_decode(trim(strip_tags($m[1])), ENT_QUOTES, 'UTF-8');
        }
        return null;
    }

    /**
     * Remove a trailing site/brand suffix from a page title, e.g.
     * "Headline text | CNN" → "Headline text". Only strips the final segment when
     * it matches the site name or the host brand, so legitimate titles that merely
     * contain a dash (e.g. "Self-care - a guide") are preserved.
     */
    private function stripSiteSuffix(string $title, ?string $siteName, string $host): string
    {
        $title = trim($title);
        if ($title === '') return $title;

        $brands = [];
        if ($siteName !== null && trim($siteName) !== '') {
            $brands[] = mb_strtolower(trim($siteName));
        }
        $hostBrand = preg_replace('/^www\./i', '', $host);
        $hostBrand = strtolower(explode('.', $hostBrand)[0] ?? '');
        if ($hostBrand !== '') $brands[] = $hostBrand;

        if (empty($brands)) return $title;

        // Match "<head> <sep> <tail>" where sep is | – — · • or a spaced hyphen,
        // and <tail> is the final segment (no further separators).
        $sep = '\x{007C}\x{2013}\x{2014}\x{00B7}\x{2022}';
        if (preg_match('/^(.*\S)\s*[' . $sep . ']\s*([^' . $sep . ']+?)\s*$/u', $title, $m)
            || preg_match('/^(.*\S)\s+-\s+([^-]+?)\s*$/u', $title, $m)) {
            $head = trim($m[1]);
            $tail = mb_strtolower(trim($m[2]));
            foreach ($brands as $b) {
                if ($b !== '' && ($tail === $b || str_contains($tail, $b) || str_contains($b, $tail))) {
                    return $head !== '' ? $head : $title;
                }
            }
        }

        return $title;
    }

    /**
     * SSRF guard: returns true if the URL resolves to a private/loopback/
     * link-local address or is otherwise not safe to fetch server-side.
     * Mirrors the same logic used in WebhookController::isPrivateUrl().
     */
    private function isPrivateUrl(string $url): bool
    {
        $host = parse_url($url, PHP_URL_HOST);
        if (!$host) {
            return true;
        }

        // If the host is a bare IP address, check ranges directly
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return !filter_var($host, FILTER_VALIDATE_IP,
                FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
        }

        // Block known internal/metadata hostnames
        $lower = strtolower($host);
        $blockedHosts = ['localhost', 'metadata.google.internal', 'instance-data'];
        if (in_array($lower, $blockedHosts, true)) {
            return true;
        }

        $blockedSuffixes = ['.local', '.internal', '.localdomain', '.localhost'];
        foreach ($blockedSuffixes as $suffix) {
            if (str_ends_with($lower, $suffix)) {
                return true;
            }
        }

        // Resolve hostname and verify the resulting IP is public
        $ip = gethostbyname($host);
        if ($ip === $host) {
            // DNS resolution failed — treat as private to be safe
            return true;
        }

        return !filter_var($ip, FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    }
}
