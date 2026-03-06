# Privacy & Client Confidentiality

**IMPORTANT READING FOR LEGAL PROFESSIONALS**

This document addresses privacy and confidentiality considerations when using this Tool, with particular attention to professional obligations under Colombian bar and judicial authority rules.

---

## Executive Summary

**Key Risks:**
- Queries through Claude API flow via Anthropic cloud infrastructure
- Query content may reveal client matters and privileged information
- Colombian bar rules (Consejo Superior de la Judicatura) require strict confidentiality (secreto profesional) and data processing controls

**Safe Use Options:**
1. **General Legal Research**: Use Tool for non-client-specific queries
2. **Local npm Package**: Install `@ansvar/colombian-law-mcp` locally — database queries stay on your machine
3. **Remote Endpoint**: Vercel Streamable HTTP endpoint — queries transit Vercel infrastructure
4. **On-Premise Deployment**: Self-host with local LLM for privileged matters

---

## Data Flows and Infrastructure

### MCP (Model Context Protocol) Architecture

This Tool uses the **Model Context Protocol (MCP)** to communicate with AI clients:

```
User Query -> MCP Client (Claude Desktop/Cursor/API) -> Anthropic Cloud -> MCP Server -> Database
```

### Deployment Options

#### 1. Local npm Package (Most Private)

```bash
npx @ansvar/colombian-law-mcp
```

- Database is local SQLite file on your machine
- No data transmitted to external servers (except to AI client for LLM processing)
- Full control over data at rest

#### 2. Remote Endpoint (Vercel)

```
Endpoint: https://colombian-law-mcp.vercel.app/mcp
```

- Queries transit Vercel infrastructure
- Tool responses return through the same path
- Subject to Vercel's privacy policy

### What Gets Transmitted

When you use this Tool through an AI client:

- **Query Text**: Your search queries and tool parameters
- **Tool Responses**: Statute text (texto normativo), provision content, search results
- **Metadata**: Timestamps, request identifiers

**What Does NOT Get Transmitted:**
- Files on your computer
- Your full conversation history (depends on AI client configuration)

---

## Professional Obligations (Colombia)

### Colombian Bar and Disciplinary Rules

Colombian lawyers (abogados y abogadas) are bound by strict confidentiality rules under the Código Disciplinario del Abogado (Ley 1123 de 2007) and regulated by the Consejo Superior de la Judicatura.

#### Secreto Profesional (Duty of Confidentiality)

- All client communications are privileged under the Código Disciplinario del Abogado
- Client identity may be confidential in sensitive matters
- Case strategy and legal analysis are protected
- Information that could identify clients or matters must be safeguarded
- Breach of confidentiality may result in disciplinary proceedings before the Consejo Superior de la Judicatura

### Colombian Data Protection Law (Ley 1581 de 2012 / Habeas Data)

Under **Ley 1581 de 2012** and its regulatory decrees, and the **Habeas Data** framework:

- You are the **Responsable del Tratamiento** (Data Controller) when using AI tools on client matters
- AI service providers may be **Encargados del Tratamiento** (Data Processors)
- Authorization (autorización) from data subjects may be required for processing personal data
- The **Superintendencia de Industria y Comercio (SIC)** oversees data protection compliance
- Register your data processing activities with the SIC's National Registry (Registro Nacional de Bases de Datos — RNBD)

---

## Risk Assessment by Use Case

### LOW RISK: General Legal Research

**Safe to use through any deployment:**

```
Example: "What does Article 90 of the Constitución Política say about state liability?"
```

- No client identity involved
- No case-specific facts
- Publicly available legal information

### MEDIUM RISK: Anonymized Queries

**Use with caution:**

```
Example: "What are the criminal penalties for money laundering under Colombian law (Ley 599 de 2000)?"
```

- Query pattern may reveal you are working on a specific matter
- Anthropic/Vercel logs may link queries to your API key

### HIGH RISK: Client-Specific Queries

**DO NOT USE through cloud AI services:**

- Remove ALL identifying details
- Use the local npm package with a self-hosted LLM
- Or use commercial legal databases (Legis, Ámbito Jurídico) with proper data processing agreements

---

## Data Collection by This Tool

### What This Tool Collects

**Nothing.** This Tool:

- Does NOT log queries
- Does NOT store user data
- Does NOT track usage
- Does NOT use analytics
- Does NOT set cookies

The database is read-only. No user data is written to disk.

### What Third Parties May Collect

- **Anthropic** (if using Claude): Subject to [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)
- **Vercel** (if using remote endpoint): Subject to [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy)

---

## Recommendations

### For Solo Practitioners / Small Firms (Abogados Independientes / Firmas Pequeñas)

1. Use local npm package for maximum privacy
2. General research: Cloud AI is acceptable for non-client queries
3. Client matters: Use commercial legal databases (Legis, Ámbito Jurídico) with proper data processing agreements

### For Large Firms / Corporate Legal (Grandes Firmas / Departamentos Jurídicos)

1. Negotiate data processing agreements with AI service providers
2. Consider on-premise deployment with self-hosted LLM
3. Train staff on safe vs. unsafe query patterns
4. Update your data processing policies and RNBD registration if necessary

### For Government / Public Sector (Entidades Públicas)

1. Use self-hosted deployment, no external APIs
2. Follow Colombian government cybersecurity guidelines (MinTIC / ColCERT)
3. Air-gapped option available for classified matters

---

## Questions and Support

- **Privacy Questions**: Open issue on [GitHub](https://github.com/Ansvar-Systems/Colombian-law-mcp/issues)
- **Anthropic Privacy**: Contact privacy@anthropic.com
- **SIC Guidance**: Consult the Superintendencia de Industria y Comercio (sic.gov.co) for data protection guidance
- **Bar Ethics**: Consult the Consejo Superior de la Judicatura for ethics guidance on AI tool use

---

**Last Updated**: 2026-03-06
**Tool Version**: 1.0.0
