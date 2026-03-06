/**
 * Response metadata utilities for Colombian Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
  note?: string;
  query_strategy?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Sistema Único de Información Normativa (suin-juriscol.gov.co) — Colombian Ministry of Justice',
    jurisdiction: 'CO',
    disclaimer:
      'This data is sourced from SUIN-Juriscol, the Colombian government unified legal information system. ' +
      'The authoritative versions are maintained by the Colombian Ministry of Justice. ' +
      'Always verify with the official portal (suin-juriscol.gov.co).',
    freshness,
  };
}
