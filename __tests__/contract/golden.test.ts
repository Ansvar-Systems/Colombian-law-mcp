/**
 * Golden contract tests for Colombian Law MCP.
 * Validates core tool functionality against seed data.
 *
 * Skipped automatically when data/database.db is absent (CI without DB).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../../data/database.db');
const DB_EXISTS = fs.existsSync(DB_PATH);

let db: InstanceType<typeof Database>;

beforeAll(() => {
  if (!DB_EXISTS) return;
  db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = DELETE');
});

describe.skipIf(!DB_EXISTS)('Database integrity', () => {
  it('should have full law corpus (1663 legal documents)', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_documents WHERE id != 'eu-cross-references'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(1663);
  });

  it('should have at least 49000 provisions', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM legal_provisions').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(49000);
  });

  it('should have FTS index', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH 'data'"
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(0);
  });
});

describe.skipIf(!DB_EXISTS)('Article retrieval', () => {
  it('should retrieve a provision by document_id and section', () => {
    const row = db.prepare(
      "SELECT content FROM legal_provisions WHERE document_id = 'co-ley-1581-2012' AND section = '1'"
    ).get() as { content: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.content.length).toBeGreaterThan(50);
  });
});

describe.skipIf(!DB_EXISTS)('Search', () => {
  it('should find results via FTS search', () => {
    const rows = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH 'data'"
    ).get() as { cnt: number };
    expect(rows.cnt).toBeGreaterThan(0);
  });
});

describe.skipIf(!DB_EXISTS)('Negative tests', () => {
  it('should return no results for fictional document', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_provisions WHERE document_id = 'fictional-law-2099'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });

  it('should return no results for invalid section', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_provisions WHERE document_id = 'co-ley-1581-2012' AND section = '999ZZZ-INVALID'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });
});

describe.skipIf(!DB_EXISTS)('Key laws are present', () => {
  const expectedDocs = [
    'co-ley-1581-2012',
    'co-ley-1266-2008',
    'co-ley-1273-2009',
    'co-ley-1341-2009',
    'co-ley-527-1999',
    'co-ley-1712-2014',
    'co-ley-1621-2013',
    'co-ley-1978-2019',
    'co-ley-2195-2022',
    'co-ley-2444-2025',
  ];

  for (const docId of expectedDocs) {
    it(`should contain document: ${docId}`, () => {
      const row = db.prepare(
        'SELECT id FROM legal_documents WHERE id = ?'
      ).get(docId) as { id: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.id).toBe(docId);
    });
  }
});

describe.skipIf(!DB_EXISTS)('list_sources', () => {
  it('should have db_metadata table', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM db_metadata').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });
});
