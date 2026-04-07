# Colombian Law MCP Server

**The Secretaría del Senado alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fcolombian-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/colombian-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/Colombian-law-mcp?style=social)](https://github.com/Ansvar-Systems/Colombian-law-mcp)
[![CI](https://github.com/Ansvar-Systems/Colombian-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Colombian-law-mcp/actions/workflows/ci.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](https://github.com/Ansvar-Systems/Colombian-law-mcp)

Query Colombian legislation -- from Ley 1581 de protección de datos and the Código Penal to the Código Civil, Código de Comercio, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Colombian legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Colombian legal research means navigating secretariasenado.gov.co, funcionpublica.gov.co, and the Diario Oficial's sprawling archive. Whether you're:

- A **lawyer** validating citations before the Corte Suprema de Justicia or Corte Constitucional
- A **compliance officer** checking Ley 1581 (data protection) or SIC obligations
- A **legal tech developer** building tools on Colombian law
- A **researcher** tracing legislative history across Colombia's comprehensive code system

...you shouldn't need dozens of browser tabs and manual cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Colombian law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://mcp.ansvar.eu/law-co/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add colombian-law --transport http https://mcp.ansvar.eu/law-co/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "colombian-law": {
      "type": "url",
      "url": "https://mcp.ansvar.eu/law-co/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "colombian-law": {
      "type": "http",
      "url": "https://mcp.ansvar.eu/law-co/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/colombian-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "colombian-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/colombian-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "colombian-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/colombian-law-mcp"]
    }
  }
}
```

## Example Queries

Once connected, just ask naturally:

- *"¿Qué dice la Ley 1581 sobre el tratamiento de datos personales?"*
- *"¿Está vigente la Ley de comercio electrónico (Ley 527 de 1999)?"*
- *"Buscar provisiones sobre protección de datos en la legislación colombiana"*
- *"¿Qué marcos internacionales alinea Colombia con la Ley 1581?"*
- *"¿Qué dice el artículo 269A del Código Penal sobre acceso abusivo a sistema informático?"*
- *"Buscar requisitos de reporte de incidentes de seguridad en leyes colombianas"*
- *"Validar la cita 'artículo 15, Ley 1581 de 2012'"*
- *"Construir una posición legal sobre responsabilidad en protección de datos en Colombia"*

---

## What's Included

> **Initial release:** The statute database is currently being populated. Premium data is available now.

| Category | Count | Details |
|----------|-------|---------|
| **Statutes** | Initial release | Ingestion from secretariasenado.gov.co and funcionpublica.gov.co in progress |
| **Provisions** | Initial release | Full-text search will be available as corpus expands |
| **Premium: Case Law** | 29,284 decisions | Corte Constitucional, Corte Suprema, Consejo de Estado (Premium tier) |
| **Premium: Preparatory Works** | 119,424 documents | Gaceta del Congreso, exposiciones de motivos (Premium tier) |
| **Premium: Agency Guidance** | 31,809 documents | SIC, SFC, ANE circulares and conceptos (Premium tier) |
| **Database Size** | Pre-built SQLite | Optimized, portable |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

The premium dataset is one of the richest in the fleet: 180,517 documents covering decisions from Colombia's three high courts plus 31,809 regulatory guidance documents from the SIC, SFC, and ANE. The free statute tier is under active ingestion.

---

## Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from secretariasenado.gov.co and funcionpublica.gov.co official sources
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains statute text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by law number + article
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
secretariasenado.gov.co / funcionpublica.gov.co --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                                                     ^                        ^
                                              Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search secretariasenado.gov.co by ley number | Search by plain language: *"protección datos personales"* |
| Navigate multi-article codes manually | Get the exact provision with context |
| Manual cross-referencing between laws | `build_legal_stance` aggregates across sources |
| "¿Está vigente esta ley?" -- check manually | `check_currency` tool -- answer in seconds |
| Find international alignment -- dig through external sources | `get_eu_basis` -- linked frameworks instantly |
| No API, no integration | MCP protocol -- AI-native |

**Traditional:** Buscar en secretariasenado.gov.co --> Navegar el código --> Ctrl+F --> Cruzar referencias --> Repetir

**This MCP:** *"¿Qué obligaciones impone la Ley 1581 a los responsables del tratamiento de datos?"* --> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across provisions with BM25 ranking. Supports quoted phrases, boolean operators, prefix wildcards |
| `get_provision` | Retrieve specific provision by law number + article (e.g., "Ley 1581 de 2012" + "artículo 15") |
| `check_currency` | Check if a statute is in force, amended, or repealed |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple statutes for a legal topic |
| `format_citation` | Format citations per Colombian conventions (full/short/pinpoint) |
| `list_sources` | List all available statutes with metadata, coverage scope, and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Alignment Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU or international frameworks that a Colombian statute aligns with |
| `get_colombian_implementations` | Find Colombian laws aligning with an international framework or treaty |
| `search_eu_implementations` | Search international instruments with Colombian alignment counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Colombian statutes against international standards |

---

## International Law Alignment

Colombia is not an EU member state, but several Colombian laws have significant international alignment:

- **Ley 1581 de 2012** (Habeas Data / data protection) draws from GDPR principles and the APEC Privacy Framework. The SIC (Superintendencia de Industria y Comercio) has adopted adequacy-like frameworks for international data transfers
- **Ley 527 de 1999** (e-commerce) aligns with UNCITRAL Model Law on Electronic Commerce
- **AML/CFT legislation** aligns with FATF standards and the Egmont Group
- Colombia is an **OECD accession candidate** -- domestic legislation increasingly aligns with OECD privacy and competition standards

Colombia participates in **OAS (Organisation of American States)** legal frameworks, the **Andean Community (CAN)** supranational legal order, and Pacific Alliance trade agreements. CAN decisions have direct effect in Colombian law -- similar in structure to EU secondary legislation.

The international alignment tools allow you to explore these relationships -- checking which Colombian provisions correspond to international requirements, and vice versa.

> **Note:** Cross-references reflect alignment and treaty relationships. Colombia adopts its own legislative approach shaped by its civil law tradition, constitutional framework (particularly the Corte Constitucional's tutela jurisprudence), and participation in CAN and OAS frameworks.

---

## Data Sources & Freshness

All content is sourced from authoritative Colombian legal databases:

- **[Secretaría del Senado](https://secretariasenado.gov.co/)** -- Official consolidated legislation
- **[Función Pública](https://funcionpublica.gov.co/)** -- SUIN-Juriscol legal information system
- **[Diario Oficial](https://www.imprenta.gov.co/)** -- Official gazette for promulgated legislation

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Secretaría del Senado de la República, Función Pública |
| **Languages** | Spanish (sole official legislative language) |
| **Coverage** | Federal (national) legislation; departmental and municipal law not included |
| **Source** | secretariasenado.gov.co, funcionpublica.gov.co |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official Colombian government sources. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage** in the free tier is not yet included -- consult the Corte Constitucional, Corte Suprema, and Consejo de Estado directly for case law
> - **Verify critical citations** against primary sources before filing
> - **Departmental and municipal legislation is not included** -- this covers national legislation only
> - **Initial release:** statute coverage is being expanded; not all national laws may yet be present

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. Consult Consejo Superior de la Judicatura guidelines on AI use in legal practice.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/Colombian-law-mcp
cd Colombian-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest                    # Ingest statutes from official sources
npm run build:db                  # Rebuild SQLite database
npm run drift:detect              # Run drift detection against anchors
npm run check-updates             # Check for source updates
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Reliability:** 100% ingestion success rate

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

**70+ national law MCPs** covering Argentina, Brazil, Chile, Ecuador, Guatemala, Mexico, Panama, Peru, Venezuela, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Statute corpus expansion (secretariasenado.gov.co ingestion)
- Court case law (Corte Constitucional sentencias, Corte Suprema)
- Andean Community (CAN) decision integration
- Regulatory guidance (SIC, SFC circulares)
- Historical statute versions and amendment tracking

---

## Roadmap

- [x] Core MCP infrastructure with FTS5 search
- [x] International law alignment tools
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [x] Premium dataset: 29,284 case law decisions + 119,424 preparatory works + 31,809 guidance docs
- [ ] Free tier statute corpus ingestion (secretariasenado.gov.co)
- [ ] Court case law expansion (free tier)
- [ ] CAN (Andean Community) decision integration
- [ ] Historical statute versions (amendment tracking)
- [ ] Regulatory guidance documents (SIC, SFC, ANE)

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{colombian_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Colombian Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/Colombian-law-mcp},
  note = {Colombian federal legislation with premium case law and preparatory works dataset}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** República de Colombia (public domain government works)
- **International Metadata:** Public domain

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server started as our internal reference tool -- turns out everyone building compliance tools has the same research frustrations.

So we're open-sourcing it. Navigating Colombia's comprehensive code system shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
