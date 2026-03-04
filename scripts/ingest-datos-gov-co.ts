#!/usr/bin/env tsx
/**
 * Colombian datos.gov.co Premium Ingestion
 *
 * Source: datos.gov.co — Colombia's national open data portal (Socrata/SODA API)
 * License: Open data (Law 1712 of 2014, Colombia Transparency Law)
 * Format: JSON (SODA/Socrata API), paginated
 * Volume: ~150K records across 6 datasets
 *
 * Datasets:
 *   1. Constitutional Court decisions (29K) → case_law
 *   2. Constitutional proceedings (18K) → preparatory_works
 *   3. Senate bills (2.3K) → preparatory_works
 *   4. Normativa Nacional Presidencia (11K) → preparatory_works
 *   5. SUIN-Juriscol norms catalog (89K) → preparatory_works
 *   6. Council of State popular actions (74) → case_law
 *   7. SIC Consumer Protection (32K) → agency_guidance
 *
 * Usage:
 *   npx tsx ingest-datos-gov-co.ts
 *   npx tsx ingest-datos-gov-co.ts --db /path/to/database.db
 *   npx tsx ingest-datos-gov-co.ts --limit 5000
 *   npx tsx ingest-datos-gov-co.ts --dataset corte  (only constitutional court)
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const DB_PATH = path.resolve(process.cwd(), 'data', 'database.db');
const CUSTOM_DB = process.argv.indexOf('--db') >= 0 ? path.resolve(process.argv[process.argv.indexOf('--db') + 1]) : null;
const LIMIT = process.argv.indexOf('--limit') >= 0 ? parseInt(process.argv[process.argv.indexOf('--limit') + 1]) : 0;
const DATASET = process.argv.indexOf('--dataset') >= 0 ? process.argv[process.argv.indexOf('--dataset') + 1] : null;
const PAGE_SIZE = 1000;
const RATE_LIMIT_MS = 500;

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const doRequest = (fetchUrl: string, redirects: number) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      const parsedUrl = new URL(fetchUrl);
      https.get(fetchUrl, {
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Colombian-Law-Ingestion/1.0 (premium-law-mcp)',
        },
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return doRequest(res.headers.location!, redirects + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error('HTTP ' + res.statusCode + ' for ' + fetchUrl));
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (err: any) { reject(new Error('JSON parse error: ' + err.message)); }
        });
        res.on('error', reject);
      }).on('error', reject);
    };
    doRequest(url, 0);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SODAEndpoint {
  id: string;
  name: string;
  url: string;
  target: 'case_law' | 'preparatory_works' | 'agency_guidance';
  transform: (record: any, index: number) => any;
}

function parseSODADate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}

const ENDPOINTS: SODAEndpoint[] = [
  {
    id: 'corte',
    name: 'Constitutional Court Decisions',
    url: 'https://www.datos.gov.co/resource/v2k4-2t8s.json',
    target: 'case_law',
    transform: (r, i) => ({
      caseId: 'co-cc-' + (r.sentencia || r.expediente_numero || i),
      court: 'Corte Constitucional de Colombia',
      caseNumber: r.sentencia || r.expediente_tipo + '-' + r.expediente_numero,
      title: (r.sentencia || 'Decision') + (r.proceso ? ' (' + r.proceso + ')' : ''),
      dateDecided: parseSODADate(r.fecha_sentencia),
      summary: [
        r.proceso ? 'Proceso: ' + r.proceso : '',
        r.magistrado_a ? 'Magistrado: ' + r.magistrado_a : '',
        r.sala ? 'Sala: ' + r.sala : '',
        r.sv_spv && r.sv_spv !== 's.d.' ? 'SV/SPV: ' + r.sv_spv : '',
        r.av_apv && r.av_apv !== 's.d.' ? 'AV/APV: ' + r.av_apv : '',
      ].filter(Boolean).join(' | '),
      fullText: null,
      documentType: r.sentencia_tipo === 'T' ? 'tutela' : r.sentencia_tipo === 'C' ? 'constitutionality' : r.sentencia_tipo === 'SU' ? 'unification' : r.sentencia_tipo || 'decision',
      importance: r.sentencia_tipo === 'SU' ? 'key_case' : r.sentencia_tipo === 'C' ? 'important' : 'routine',
      url: r.sentencia ? 'https://www.corteconstitucional.gov.co/relatoria/' + (parseSODADate(r.fecha_sentencia) || '').substring(0, 4) + '/' + r.sentencia.replace('/', '-') + '.htm' : null,
      source: 'datos_gov_co_corte',
    }),
  },
  {
    id: 'proceedings',
    name: 'Constitutional Proceedings',
    url: 'https://www.datos.gov.co/resource/4akn-42rj.json',
    target: 'preparatory_works',
    transform: (r, i) => ({
      documentId: 'co-proc-' + (r.expediente_tipo || 'X') + '-' + (r.expediente_numero || i),
      type: 'constitutional_proceeding',
      title: (r.proceso || 'Proceeding') + ' ' + (r.expediente_tipo || '') + '-' + (r.expediente_numero || ''),
      billNumber: r.expediente_tipo + '-' + r.expediente_numero,
      legislativePeriod: null,
      summary: [
        r.proceso || '',
        r.asunto ? 'Re: ' + r.asunto.substring(0, 500) : '',
      ].filter(Boolean).join(' | '),
      fullText: r.asunto || null,
      dateIntroduced: parseSODADate(r.fecha),
      dateEnacted: null,
      status: 'filed',
      votingResult: null,
      url: null,
      legislature: null,
      committee: null,
      proposer: null,
      source: 'datos_gov_co_proceedings',
    }),
  },
  {
    id: 'senado',
    name: 'Senate Bills',
    url: 'https://www.datos.gov.co/resource/feim-cysj.json',
    target: 'preparatory_works',
    transform: (r, i) => ({
      documentId: 'co-senado-' + (r.n_senado || i),
      type: 'bill',
      title: r.titulo ? r.titulo.substring(0, 1000) : 'Senate Bill ' + (r.n_senado || i),
      billNumber: r.n_senado || null,
      legislativePeriod: null,
      summary: [
        r.autor ? 'Author: ' + r.autor : '',
        r.comision ? 'Commission: ' + r.comision : '',
        r.estado ? 'Status: ' + r.estado : '',
      ].filter(Boolean).join(' | '),
      fullText: r.titulo || null,
      dateIntroduced: parseSODADate(r.f_presentado),
      dateEnacted: r.estado === 'LEY' ? parseSODADate(r.f_presentado) : null,
      status: r.estado === 'LEY' ? 'enacted' : r.estado === 'ARCHIVADO' ? 'archived' : 'pending',
      votingResult: null,
      url: null,
      legislature: null,
      committee: r.comision || null,
      proposer: r.autor || null,
      source: 'datos_gov_co_senado',
    }),
  },
  {
    id: 'normativa',
    name: 'Normativa Nacional Presidencia',
    url: 'https://www.datos.gov.co/resource/88h2-dykw.json',
    target: 'preparatory_works',
    transform: (r, i) => ({
      documentId: 'co-norm-' + (r.tipo || 'X').toLowerCase().replace(/\s+/g, '') + '-' + (r.fecha || String(i)).substring(0, 10) + '-' + i,
      type: r.tipo === 'DECRETOS' || r.tipo === 'DECRETO' ? 'decree' : r.tipo === 'LEYES' || r.tipo === 'LEY' ? 'law' : r.tipo === 'RESOLUCIONES' ? 'resolution' : 'norm',
      title: r.titulo ? r.titulo.substring(0, 1000) : (r.tipo || 'Norm') + ' ' + i,
      billNumber: null,
      legislativePeriod: null,
      summary: [
        r.tipo ? 'Type: ' + r.tipo : '',
        r.descripcion ? r.descripcion.substring(0, 500) : '',
      ].filter(Boolean).join(' | '),
      fullText: r.descripcion || null,
      dateIntroduced: parseSODADate(r.fecha),
      dateEnacted: parseSODADate(r.fecha),
      status: 'enacted',
      votingResult: null,
      url: r.url || null,
      legislature: null,
      committee: null,
      proposer: null,
      source: 'datos_gov_co_normativa',
    }),
  },
  {
    id: 'suin',
    name: 'SUIN-Juriscol Norms Catalog',
    url: 'https://www.datos.gov.co/resource/fiev-nid6.json',
    target: 'preparatory_works',
    transform: (r, i) => ({
      documentId: 'co-suin-' + (r.tipo || 'X').toLowerCase().replace(/\s+/g, '').substring(0, 20) + '-' + (r.n_mero || i) + '-' + (r.a_o || '0'),
      type: r.tipo === 'LEY' ? 'law' : r.tipo === 'DECRETO' ? 'decree' : r.tipo === 'RESOLUCION' ? 'resolution' : r.tipo === 'ACTO LEGISLATIVO' ? 'constitutional_amendment' : r.tipo === 'CODIGO' ? 'code' : 'norm',
      title: (r.tipo || 'Norm') + ' ' + (r.n_mero || '') + ' de ' + (r.a_o || ''),
      billNumber: r.n_mero || null,
      legislativePeriod: r.a_o || null,
      summary: [
        r.entidad ? 'Entity: ' + r.entidad : '',
        r.sector ? 'Sector: ' + r.sector : '',
        r.materia ? 'Subject: ' + r.materia : '',
        r.vigencia ? 'Validity: ' + r.vigencia : '',
        r.art_culos ? 'Articles: ' + r.art_culos : '',
      ].filter(Boolean).join(' | '),
      fullText: null,
      dateIntroduced: r.a_o ? r.a_o + '-01-01' : null,
      dateEnacted: r.a_o ? r.a_o + '-01-01' : null,
      status: r.vigencia === 'Vigente' ? 'in_force' : r.vigencia === 'Derogado' ? 'repealed' : r.vigencia || 'unknown',
      votingResult: null,
      url: null,
      legislature: null,
      committee: null,
      proposer: r.entidad || null,
      source: 'datos_gov_co_suin',
    }),
  },
  {
    id: 'consejo',
    name: 'Council of State Popular Actions',
    url: 'https://www.datos.gov.co/resource/njuz-uxyd.json',
    target: 'case_law',
    transform: (r, i) => ({
      caseId: 'co-ce-' + (r.no_radicacion || i),
      court: 'Consejo de Estado',
      caseNumber: r.no_radicacion || String(i),
      title: (r.accion_medio_control || 'Popular Action') + ' ' + (r.no_radicacion || ''),
      dateDecided: parseSODADate(r.fecha_decision),
      summary: [
        r.accion_medio_control ? 'Action: ' + r.accion_medio_control : '',
        r.sala_de_decision ? 'Sala: ' + r.sala_de_decision : '',
        r.derecho_interes_colectivo ? 'Rights: ' + r.derecho_interes_colectivo.substring(0, 200) : '',
        r.sentido_decision ? 'Decision: ' + r.sentido_decision.substring(0, 200) : '',
      ].filter(Boolean).join(' | '),
      fullText: [
        r.hechos || '',
        r.problema_juridico ? 'Problema jurídico: ' + r.problema_juridico : '',
        r.sentido_decision || '',
      ].filter(Boolean).join('\n\n') || null,
      documentType: 'popular_action',
      importance: 'important',
      url: null,
      source: 'datos_gov_co_consejo',
    }),
  },
  {
    id: 'sic',
    name: 'SIC Consumer Protection',
    url: 'https://www.datos.gov.co/resource/3faq-g9ig.json',
    target: 'agency_guidance',
    transform: (r, i) => ({
      documentId: 'co-sic-' + (r.radicado || r.expediente || i),
      agency: 'Superintendencia de Industria y Comercio (SIC)',
      title: (r.tipo_tramite || 'Decision') + ' ' + (r.radicado || r.expediente || i),
      summary: [
        r.tipo_tramite || '',
        r.estado ? 'Status: ' + r.estado : '',
        r.materia ? 'Subject: ' + r.materia : '',
      ].filter(Boolean).join(' | '),
      fullText: r.observaciones || null,
      url: null,
    }),
  },
];

async function ingestEndpoint(
  db: Database.Database,
  endpoint: SODAEndpoint,
  maxRecords: number
): Promise<{ inserted: number; skipped: number }> {
  console.log('\n  --- ' + endpoint.name + ' (' + endpoint.id + ') ---');
  console.log('    URL: ' + endpoint.url);
  console.log('    Target: ' + endpoint.target);

  let inserted = 0;
  let skipped = 0;
  let offset = 0;
  let globalIndex = 0;

  const insertCL = endpoint.target === 'case_law' ? db.prepare(
    'INSERT OR IGNORE INTO case_law (' +
    '  document_id, court, case_number, title, decision_date, summary,' +
    '  full_text, proceeding_type, url, source' +
    ') VALUES (' +
    '  @caseId, @court, @caseNumber, @title, @dateDecided, @summary,' +
    '  @fullText, @documentType, @url, @source' +
    ')'
  ) : null;

  const insertPW = endpoint.target === 'preparatory_works' ? db.prepare(
    'INSERT OR IGNORE INTO preparatory_works (' +
    '  document_id, type, title, bill_number, legislative_period,' +
    '  summary, full_text, date_introduced, date_enacted, status,' +
    '  voting_result, url, legislature, committee, proposer, source' +
    ') VALUES (' +
    '  @documentId, @type, @title, @billNumber, @legislativePeriod,' +
    '  @summary, @fullText, @dateIntroduced, @dateEnacted, @status,' +
    '  @votingResult, @url, @legislature, @committee, @proposer, @source' +
    ')'
  ) : null;

  const insertAG = endpoint.target === 'agency_guidance' ? db.prepare(
    'INSERT OR IGNORE INTO agency_guidance (' +
    '  document_id, agency, title, summary, full_text, url' +
    ') VALUES (' +
    '  @documentId, @agency, @title, @summary, @fullText, @url' +
    ')'
  ) : null;

  while (true) {
    if (maxRecords > 0 && inserted >= maxRecords) break;

    const fetchLimit = maxRecords > 0 ? Math.min(PAGE_SIZE, maxRecords - inserted) : PAGE_SIZE;
    const url = endpoint.url + '?$limit=' + fetchLimit + '&$offset=' + offset + '&$order=:id';

    let records: any[];
    try {
      records = await fetchJSON(url);
    } catch (err: any) {
      console.error('    Error at offset ' + offset + ': ' + err.message);
      if (inserted > 0) break;
      await sleep(5000);
      continue;
    }

    if (!Array.isArray(records) || records.length === 0) break;

    const tx = db.transaction(() => {
      for (const record of records) {
        try {
          const transformed = endpoint.transform(record, globalIndex);
          globalIndex++;

          if (endpoint.target === 'case_law' && insertCL) {
            const result = insertCL.run(transformed);
            if (result.changes > 0) inserted++;
            else skipped++;
          } else if (endpoint.target === 'preparatory_works' && insertPW) {
            const result = insertPW.run(transformed);
            if (result.changes > 0) inserted++;
            else skipped++;
          } else if (endpoint.target === 'agency_guidance' && insertAG) {
            const result = insertAG.run(transformed);
            if (result.changes > 0) inserted++;
            else skipped++;
          }
        } catch (err: any) {
          if (!err.message?.includes('UNIQUE') && !err.message?.includes('NOT NULL')) {
            if (skipped < 5) console.error('    Insert error: ' + err.message);
          }
          skipped++;
          globalIndex++;
        }
      }
    });
    tx();

    offset += records.length;

    if (offset % 5000 < PAGE_SIZE || records.length < fetchLimit) {
      console.log('    Progress: ' + inserted.toLocaleString() + ' inserted, ' + skipped.toLocaleString() + ' skipped (offset ' + offset.toLocaleString() + ')');
    }

    if (records.length < fetchLimit) break;
    await sleep(RATE_LIMIT_MS);
  }

  console.log('    Done: ' + inserted.toLocaleString() + ' inserted, ' + skipped.toLocaleString() + ' skipped');
  return { inserted, skipped };
}

async function main(): Promise<void> {
  const dbPath = CUSTOM_DB || DB_PATH;
  console.log('Colombian datos.gov.co Premium Ingestion\n');
  console.log('  Database: ' + dbPath);
  console.log('  Source: datos.gov.co (Open data, Law 1712 of 2014)');
  if (LIMIT > 0) console.log('  Limit per dataset: ' + LIMIT);
  if (DATASET) console.log('  Dataset filter: ' + DATASET);

  if (!fs.existsSync(dbPath)) {
    console.error('ERROR: Database not found at ' + dbPath);
    process.exit(1);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const endpoints = DATASET
    ? ENDPOINTS.filter(e => e.id === DATASET)
    : ENDPOINTS;

  if (endpoints.length === 0) {
    console.error('ERROR: Unknown dataset "' + DATASET + '". Available: ' + ENDPOINTS.map(e => e.id).join(', '));
    db.close();
    process.exit(1);
  }

  const startTime = Date.now();
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const endpoint of endpoints) {
    const result = await ingestEndpoint(db, endpoint, LIMIT);
    totalInserted += result.inserted;
    totalSkipped += result.skipped;
  }

  if (totalInserted > 0) {
    console.log('\n  Rebuilding FTS indexes...');
    for (const ftsTable of ['case_law_fts', 'preparatory_works_fts', 'agency_guidance_fts']) {
      try {
        const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(ftsTable);
        if (exists) {
          db.exec("INSERT INTO " + ftsTable + "(" + ftsTable + ") VALUES ('rebuild')");
          console.log('    ' + ftsTable + ' rebuilt.');
        }
      } catch (err: any) {
        console.log('    ' + ftsTable + ' note: ' + err.message);
      }
    }
  }

  const caseLaw = (db.prepare('SELECT COUNT(*) as c FROM case_law').get() as { c: number }).c;
  const prepWorks = (db.prepare('SELECT COUNT(*) as c FROM preparatory_works').get() as { c: number }).c;
  let agencyGuidance = 0;
  try { agencyGuidance = (db.prepare('SELECT COUNT(*) as c FROM agency_guidance').get() as { c: number }).c; } catch {}
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

  console.log('\n=== Colombian datos.gov.co Ingestion Complete ===');
  console.log('  New records: ' + totalInserted.toLocaleString());
  console.log('  Skipped: ' + totalSkipped.toLocaleString());
  console.log('  Total case_law: ' + caseLaw.toLocaleString());
  console.log('  Total preparatory_works: ' + prepWorks.toLocaleString());
  console.log('  Total agency_guidance: ' + agencyGuidance.toLocaleString());
  console.log('  Duration: ' + elapsed + 's');

  db.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
