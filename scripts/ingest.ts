#!/usr/bin/env tsx
/**
 * Colombian Law MCP - Real ingestion pipeline.
 *
 * Sources:
 *   - Curated mode: fixed critical laws/decrees (TARGET_LAWS)
 *   - Full mode: all "Ley" records from Gestor Normativo search endpoint
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchNormaHtml, fetchWithRateLimit } from './lib/fetcher.js';
import { parseNormaHtml, TARGET_LAWS, type ParsedAct, type TargetLaw } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const LAW_SEARCH_URL =
  'https://www.funcionpublica.gov.co/eva/gestornormativo/gestion/funphp/funajax.php?t=ejecuta_busqueda_avanzada2&tipdoc=18&pagina=1';

type IngestionMode = 'curated' | 'full_laws';

interface CliArgs {
  limit: number | null;
  start: number;
  skipFetch: boolean;
  fullLaws: boolean;
  append: boolean;
}

interface IngestResult {
  law: TargetLaw;
  status: 'ok' | 'failed';
  seedFile?: string;
  provisions?: number;
  definitions?: number;
  error?: string;
}

interface SearchLawEntry {
  portalId: number;
  title: string;
}

interface BuildLawResult {
  laws: TargetLaw[];
  mode: IngestionMode;
  sourceCount?: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let start = 0;
  let skipFetch = false;
  let fullLaws = false;
  let append = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--limit' && args[i + 1]) {
      limit = Number.parseInt(args[i + 1], 10);
      i += 1;
      continue;
    }
    if (arg === '--skip-fetch') {
      skipFetch = true;
      continue;
    }
    if (arg === '--full-laws') {
      fullLaws = true;
      continue;
    }
    if (arg === '--start' && args[i + 1]) {
      start = Math.max(0, Number.parseInt(args[i + 1], 10));
      i += 1;
      continue;
    }
    if (arg === '--append') {
      append = true;
    }
  }

  return { limit, start, skipFetch, fullLaws, append };
}

function ensureDirs(): void {
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });
}

function clearSeedDirectory(): void {
  const files = fs.readdirSync(SEED_DIR).filter(file => file.endsWith('.json'));
  for (const file of files) {
    fs.unlinkSync(path.join(SEED_DIR, file));
  }
}

function readSourceIfExists(filePath: string): string | null {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null;
}

function saveParsedSeed(parsed: ParsedAct, fileName: string): string {
  const fullPath = path.join(SEED_DIR, fileName);
  fs.writeFileSync(fullPath, JSON.stringify(parsed, null, 2));
  return fullPath;
}

function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseSearchCount(html: string): number | null {
  const match = html.match(/Número de documentos encontrados:\s*([0-9.]+)/i);
  if (!match) return null;
  return Number.parseInt(match[1].replace(/\./g, ''), 10);
}

function extractLawIndexFromSearchHtml(html: string): SearchLawEntry[] {
  const out: SearchLawEntry[] = [];
  const seen = new Set<number>();

  const re = /<a[^>]*href="norma\.php\?i=(\d+)"[^>]*>[\s\S]*?<h5[^>]*>([^<]+)<\/h5>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const portalId = Number.parseInt(match[1], 10);
    if (!Number.isFinite(portalId)) continue;
    if (seen.has(portalId)) continue;
    seen.add(portalId);

    const title = match[2].replace(/\s+/g, ' ').trim();
    if (!/^Ley\s+/i.test(title)) continue;

    out.push({ portalId, title });
  }

  return out;
}

function buildDynamicLawId(entry: SearchLawEntry, usedIds: Set<string>): string {
  const m = entry.title.match(/Ley\s+([0-9A-Za-z.-]+)\s+de\s+(\d{4})/i);
  let base = `co-ley-i${entry.portalId}`;
  if (m) {
    const number = slugify(m[1]);
    const year = m[2];
    base = `co-ley-${number}-${year}`;
  }

  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }

  const withPortal = `${base}-i${entry.portalId}`;
  usedIds.add(withPortal);
  return withPortal;
}

function buildDynamicTargetLaws(entries: SearchLawEntry[]): TargetLaw[] {
  const laws: TargetLaw[] = [];
  const usedIds = new Set<string>();

  entries.forEach((entry, idx) => {
    const id = buildDynamicLawId(entry, usedIds);
    const safeTitle = slugify(entry.title);
    laws.push({
      id,
      fileName: `${String(idx + 1).padStart(4, '0')}-${safeTitle || `ley-i${entry.portalId}`}.json`,
      portalId: entry.portalId,
      docTypeId: 18,
      shortName: entry.title,
      status: 'in_force',
    });
  });

  return laws;
}

async function fetchFullLawIndex(): Promise<{ entries: SearchLawEntry[]; sourceCount: number | null }> {
  const fetched = await fetchWithRateLimit(LAW_SEARCH_URL, { accept: 'text/html, */*' });
  if (fetched.status !== 200) {
    throw new Error(`No se pudo obtener índice completo de leyes (HTTP ${fetched.status})`);
  }

  const sourceCount = parseSearchCount(fetched.body);
  const entries = extractLawIndexFromSearchHtml(fetched.body);

  fs.writeFileSync(path.join(SOURCE_DIR, 'law-index-tipdoc18.html'), fetched.body);
  fs.writeFileSync(
    path.join(SOURCE_DIR, 'law-index-tipdoc18.json'),
    JSON.stringify(
      {
        fetched_at: new Date().toISOString(),
        source_count: sourceCount,
        extracted_count: entries.length,
        entries,
      },
      null,
      2,
    ),
  );

  return { entries, sourceCount };
}

async function buildLawList(args: CliArgs): Promise<BuildLawResult> {
  if (!args.fullLaws) {
    const base = TARGET_LAWS.slice(args.start);
    const laws = args.limit ? base.slice(0, args.limit) : base;
    return { laws, mode: 'curated' };
  }

  const index = await fetchFullLawIndex();
  const dynamic = buildDynamicTargetLaws(index.entries);
  const sliced = dynamic.slice(args.start);
  const laws = args.limit ? sliced.slice(0, args.limit) : sliced;

  return {
    laws,
    mode: 'full_laws',
    sourceCount: index.sourceCount ?? undefined,
  };
}

async function ingestLaw(law: TargetLaw, skipFetch: boolean): Promise<IngestResult> {
  const sourceFile = path.join(SOURCE_DIR, `${law.id}.html`);

  try {
    let html = skipFetch ? readSourceIfExists(sourceFile) : null;

    if (!html) {
      const fetched = await fetchNormaHtml(law.portalId);
      if (fetched.status !== 200) {
        return {
          law,
          status: 'failed',
          error: `HTTP ${fetched.status}`,
        };
      }
      html = fetched.body;
      fs.writeFileSync(sourceFile, html);
    }

    const parsed = parseNormaHtml(html, law);
    const seedPath = saveParsedSeed(parsed, law.fileName);
    return {
      law,
      status: 'ok',
      seedFile: seedPath,
      provisions: parsed.provisions.length,
      definitions: parsed.definitions.length,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      law,
      status: 'failed',
      error: msg,
    };
  }
}

function printHeader(args: CliArgs, mode: IngestionMode, laws: TargetLaw[], sourceCount?: number): void {
  console.log('Colombian Law MCP - Real Ingestion');
  console.log('==================================');
  console.log('Portal: https://www.funcionpublica.gov.co/eva/gestornormativo');
  console.log('Método: HTML scrape (norma.php)');
  console.log(`Modo: ${mode === 'full_laws' ? 'full laws (tipdoc=18)' : 'curated'}`);
  if (sourceCount !== undefined) {
    console.log(`Leyes reportadas por portal: ${sourceCount}`);
  }
  console.log(`Objetivo: ${laws.length} normas`);
  if (args.start > 0) console.log(`--start ${args.start}`);
  if (args.limit) console.log(`--limit ${args.limit}`);
  if (args.skipFetch) console.log('--skip-fetch');
  if (args.fullLaws) console.log('--full-laws');
  if (args.append) console.log('--append');
  if (process.env.ALLOW_INSECURE_TLS === '1') {
    console.log('ALLOW_INSECURE_TLS=1 (solo para entorno local)');
  }
  console.log('');
}

function printResults(results: IngestResult[]): void {
  const ok = results.filter(r => r.status === 'ok');
  const failed = results.filter(r => r.status === 'failed');
  const totalProvisions = ok.reduce((sum, row) => sum + (row.provisions ?? 0), 0);
  const totalDefinitions = ok.reduce((sum, row) => sum + (row.definitions ?? 0), 0);

  console.log('\nResumen de ingestión');
  console.log('--------------------');
  console.log(`Normas procesadas: ${results.length}`);
  console.log(`Normas OK: ${ok.length}`);
  console.log(`Normas fallidas: ${failed.length}`);
  console.log(`Provisiones extraídas: ${totalProvisions}`);
  console.log(`Definiciones extraídas: ${totalDefinitions}`);

  if (failed.length > 0) {
    console.log('\nFallidas (máx 30):');
    for (const row of failed.slice(0, 30)) {
      console.log(`- i=${row.law.portalId} ${row.law.shortName}: ${row.error ?? 'error'}`);
    }
    if (failed.length > 30) {
      console.log(`... ${failed.length - 30} fallidas adicionales`);
    }
  }
  console.log('');
}

async function runIngestionWithRetries(laws: TargetLaw[], skipFetch: boolean): Promise<IngestResult[]> {
  const maxRounds = 3;
  const allResults = new Map<string, IngestResult>();
  let pending = laws;

  for (let round = 1; round <= maxRounds; round += 1) {
    if (pending.length === 0) break;

    console.log(`\nRonda ${round}/${maxRounds} - pendientes: ${pending.length}`);
    const roundResults: IngestResult[] = [];

    for (let i = 0; i < pending.length; i += 1) {
      const law = pending[i];
      const result = await ingestLaw(law, skipFetch);
      roundResults.push(result);
      allResults.set(law.id, result);

      const shouldLog = pending.length <= 40 || i % 25 === 0 || result.status === 'failed';
      if (shouldLog) {
        const marker = result.status === 'ok' ? 'OK' : 'FAIL';
        const details = result.status === 'ok'
          ? `${result.provisions} art.`
          : (result.error ?? 'error');
        console.log(`[${i + 1}/${pending.length}] i=${law.portalId} ${marker} - ${details}`);
      }
    }

    pending = roundResults.filter(r => r.status === 'failed').map(r => r.law);
  }

  return laws
    .map(law => allResults.get(law.id))
    .filter((row): row is IngestResult => Boolean(row));
}

async function main(): Promise<void> {
  const args = parseArgs();
  ensureDirs();
  if (!args.append) {
    clearSeedDirectory();
  }

  const lawBuild = await buildLawList(args);
  printHeader(args, lawBuild.mode, lawBuild.laws, lawBuild.sourceCount);

  const results = await runIngestionWithRetries(lawBuild.laws, args.skipFetch);
  printResults(results);

  if (results.some(r => r.status === 'failed')) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('Fatal error during ingestion:', error);
  process.exit(1);
});
