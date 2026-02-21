#!/usr/bin/env tsx
/**
 * Colombian Law MCP - Real ingestion pipeline.
 *
 * Source:
 *   Función Pública - Gestor Normativo
 *   https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i={ID}
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchNormaHtml } from './lib/fetcher.js';
import { parseNormaHtml, TARGET_LAWS, type ParsedAct, type TargetLaw } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

interface CliArgs {
  limit: number | null;
  skipFetch: boolean;
}

interface IngestResult {
  law: TargetLaw;
  status: 'ok' | 'failed';
  seedFile?: string;
  provisions?: number;
  definitions?: number;
  error?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--limit' && args[i + 1]) {
      limit = Number.parseInt(args[i + 1], 10);
      i += 1;
      continue;
    }
    if (arg === '--skip-fetch') {
      skipFetch = true;
    }
  }

  return { limit, skipFetch };
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

    if (!html.includes('descripcion-contenido')) {
      return {
        law,
        status: 'failed',
        error: 'No se encontró bloque descripcion-contenido',
      };
    }

    const parsed = parseNormaHtml(html, law);
    if (parsed.provisions.length === 0) {
      return {
        law,
        status: 'failed',
        error: 'No se extrajeron artículos',
      };
    }

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

function printHeader(args: CliArgs, laws: TargetLaw[]): void {
  console.log('Colombian Law MCP - Real Ingestion');
  console.log('==================================');
  console.log('Portal: https://www.funcionpublica.gov.co/eva/gestornormativo');
  console.log('Método: HTML scrape (norma.php)');
  console.log(`Objetivo: ${laws.length} normas`);
  if (args.limit) console.log(`--limit ${args.limit}`);
  if (args.skipFetch) console.log('--skip-fetch');
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
  console.log('');

  console.log(`${'Norma'.padEnd(34)} ${'Portal ID'.padEnd(10)} ${'Art.'.padStart(6)} ${'Def.'.padStart(6)}  Estado`);
  console.log(`${'-'.repeat(34)} ${'-'.repeat(10)} ${'-'.repeat(6)} ${'-'.repeat(6)}  ${'-'.repeat(20)}`);
  for (const row of results) {
    if (row.status === 'ok') {
      console.log(
        `${row.law.id.padEnd(34)} ${String(row.law.portalId).padEnd(10)} ${String(row.provisions ?? 0).padStart(6)} ${String(row.definitions ?? 0).padStart(6)}  OK`,
      );
    } else {
      console.log(
        `${row.law.id.padEnd(34)} ${String(row.law.portalId).padEnd(10)} ${'0'.padStart(6)} ${'0'.padStart(6)}  FAIL: ${row.error ?? 'error'}`,
      );
    }
  }
  console.log('');
}

async function main(): Promise<void> {
  const args = parseArgs();
  const laws = args.limit ? TARGET_LAWS.slice(0, args.limit) : TARGET_LAWS;

  ensureDirs();
  clearSeedDirectory();
  printHeader(args, laws);

  const results: IngestResult[] = [];
  for (const law of laws) {
    process.stdout.write(`Descargando ${law.shortName} (i=${law.portalId})... `);
    const result = await ingestLaw(law, args.skipFetch);
    results.push(result);
    if (result.status === 'ok') {
      console.log(`OK (${result.provisions} artículos)`);
    } else {
      console.log(`FAIL (${result.error})`);
    }
  }

  printResults(results);

  if (results.some(r => r.status === 'failed')) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('Fatal error during ingestion:', error);
  process.exit(1);
});
