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
            'type'  => 'required|in:doi,isbn,url,arxiv',
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
            };
        } catch (\Throwable $e) {
            Log::warning("Reference resolve failed [{$type}]: " . $e->getMessage());
            return response()->json(
                ['error' => 'Could not retrieve metadata. Please verify the value and try again.'],
                422,
            );
        }
    }

    // ── DOI → CrossRef ────────────────────────────────────────────────────────

    private function resolveDoi(string $doi): JsonResponse
    {
        // Strip URL prefix if user pasted https://doi.org/10.xxx
        $doi = preg_replace('#^https?://(?:dx\.)?doi\.org/#i', '', $doi);
        $doi = ltrim($doi, '/');

        $response = Http::withHeaders([
            // CrossRef polite pool — includes mailto for higher rate limits
            'User-Agent' => 'CityU-RRP/1.0 (mailto:support@cityu.edu.hk)',
        ])->timeout(12)->get('https://api.crossref.org/works/' . rawurlencode($doi));

        if ($response->status() === 404) {
            return response()->json(['error' => 'DOI not found in CrossRef.'], 404);
        }
        if ($response->failed()) {
            return response()->json(['error' => 'CrossRef lookup failed. Please try again.'], 502);
        }

        $work = $response->json('message') ?? [];

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

        return response()->json(array_filter($meta, fn($v) => $v !== null && $v !== ''));
    }

    private function crossrefTypeToMeta(string $type): string
    {
        return match ($type) {
            'journal-article'                          => 'article',
            'book', 'monograph', 'edited-book',
            'reference-book', 'book-set', 'book-series' => 'book',
            'book-chapter', 'reference-entry'          => 'chapter',
            'proceedings-article'                      => 'conference',
            'report', 'report-series',
            'report-component'                         => 'report',
            'dissertation'                             => 'thesis',
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

        return response()->json(array_filter([
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
        ], fn($v) => $v !== null && $v !== ''));
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

        return response()->json(array_filter([
            'type'      => 'book',
            'authors'   => $authors,
            'year'      => $year ?? 'n.d.',
            'title'     => $data['title'] ?? '',
            'publisher' => $publisher ?: null,
            'place'     => $place     ?: null,
            'isbn'      => $isbn,
            'url'       => $data['url'] ?? null,
        ], fn($v) => $v !== null && $v !== ''));
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

        return response()->json(array_filter([
            'type'      => 'book',
            'authors'   => $authors,
            'year'      => $year ?? 'n.d.',
            'title'     => $info['title'] ?? '',
            'publisher' => $info['publisher'] ?? null,
            'isbn'      => $isbnFinal,
        ], fn($v) => $v !== null && $v !== ''));
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
        $pubDate = $ld['datePublished']
            ?? $this->extractMeta($html, 'article:published_time')
            ?? $this->extractMeta($html, 'datePublished')
            ?? $this->extractMeta($html, 'publish_date')
            ?? $this->extractMeta($html, 'DC.date')
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

        // ── 6. Retrieved date (APA7 §9.33) ───────────────────────────────────
        // Only when no publication date is known — content that may change over time
        $retrievedDate = ($year === null) ? now()->format('F j, Y') : null;

        return response()->json(array_filter([
            'type'          => 'website',
            'authors'       => $authors ?: [],
            'year'          => $year ?? 'n.d.',
            'month'         => $month,
            'day'           => $day,
            'title'         => $title,
            'siteName'      => $siteName,
            'url'           => $url,
            'retrievedDate' => $retrievedDate,
        ], fn($v) => $v !== null && $v !== ''));
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
