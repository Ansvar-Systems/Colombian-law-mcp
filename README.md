# Colombian Law MCP

Colombian law database for cybersecurity compliance via Model Context Protocol (MCP).

## Features

- **Full-text search** across legislation provisions (FTS5 with BM25 ranking)
- **Article-level retrieval** for specific legal provisions
- **Citation validation** to prevent hallucinated references
- **Currency checks** to verify if laws are still in force

## Quick Start

### Claude Code (Remote)
```bash
claude mcp add colombian-law --transport http https://colombian-law-mcp.vercel.app/mcp
```

### Local (npm)
```bash
npx @ansvar/colombian-law-mcp
```

## Data Sources

Official Colombian legislation from Función Pública Gestor Normativo (`tipdoc=18`), ingested as real data.

- Corpus coverage: `1663/1663` law documents (snapshot dated `2026-02-21`)
- Source language preserved in Spanish (`es`)
- Character-level validation performed against source for sampled provisions
- 4 laws are intentionally kept as metadata-only records (`0` provisions) because source pages did not expose parseable article text in HTML:
  - `co-ley-1737-2014` (`Ley 1737 de 2014`)
  - `co-ley-1388-2010` (`Ley 1388 de 2010`)
  - `co-ley-1388-2010-i39668` (`Ley 1388 de 2010`, alternate portal record)
  - `co-ley-188-1959` (`Ley 188 de 1959`)

No OCR text has been added for these 4 records in the canonical dataset.

## License

Apache-2.0
