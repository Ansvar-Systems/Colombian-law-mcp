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


---

## Important Disclaimers

### Not Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official government publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Coverage may be incomplete** — verify critical provisions against primary sources
> - **Verify all citations** against the official legal portal before relying on them professionally
> - Laws change — check the `about` tool for database freshness date

### Client Confidentiality

When using the remote endpoint, queries are processed by third-party infrastructure
(Vercel, Claude API). For privileged or confidential legal matters, use the local
npm package or on-premise deployment.

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

---

## Open Law

This server is part of **Ansvar Open Law** — free, structured access to legislation
from 70+ jurisdictions worldwide via the Model Context Protocol.

**Browse all jurisdictions ->** [ansvar.eu/open-law](https://ansvar.eu/open-law)

## Ansvar MCP Network

Ansvar Open Law is part of the broader **Ansvar MCP Network** — 80+ servers covering
global legislation, EU/US compliance frameworks, and cybersecurity standards.

| Category | Coverage |
|----------|----------|
| **Legislation** | 70+ jurisdictions worldwide |
| **EU Compliance** | 49 regulations, 2,693 articles |
| **US Compliance** | 15 federal & state regulations |
| **Security Frameworks** | 261 frameworks, 1,451 controls |
| **Cybersecurity** | 200K+ CVEs, STRIDE patterns, sanctions |

**Explore the full network ->** [ansvar.ai/mcp](https://ansvar.ai/mcp)

---

Built by [Ansvar Systems](https://ansvar.eu) | [ansvar.eu/open-law](https://ansvar.eu/open-law)
