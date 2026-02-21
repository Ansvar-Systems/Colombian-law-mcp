/**
 * Parser and law catalog for real Colombian legislation ingestion.
 *
 * Source pages:
 *   https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i={ID}
 */

export interface TargetLaw {
  id: string;
  fileName: string;
  portalId: number;
  docTypeId: number;
  number: string;
  year: number;
  shortName: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en?: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date?: string;
  in_force_date?: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

const ARTICLE_RE = /^(?:ART[IÍ]CULO|Art[ií]culo)\s+([0-9]+(?:\.[0-9]+)*(?:-[0-9]+)?[A-Za-z]?)(?:\s*[°º])?(?:\.)?\s*(.*)$/u;
const CHAPTER_RE = /^(?:CAP[IÍ]TULO|T[IÍ]TULO|SECCI[ÓO]N)\s+[A-Z0-9IVXLCM.-]+/i;

const MONTHS_ES: Record<string, string> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
};

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ');
}

function decodeHtmlEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: '\'',
    '#39': '\'',
    quot: '"',
    nbsp: ' ',
    lt: '<',
    gt: '>',
    iacute: 'í',
    Iacute: 'Í',
    aacute: 'á',
    Aacute: 'Á',
    eacute: 'é',
    Eacute: 'É',
    oacute: 'ó',
    Oacute: 'Ó',
    uacute: 'ú',
    Uacute: 'Ú',
    ntilde: 'ñ',
    Ntilde: 'Ñ',
    ordm: 'º',
    deg: '°',
    iquest: '¿',
    mdash: '-',
    ndash: '-',
    rsquo: '\'',
    lsquo: '\'',
    rdquo: '"',
    ldquo: '"',
    bull: '•',
  };

  return text
    .replace(/&#(\d+);/g, (_, dec) => {
      const num = Number(dec);
      return Number.isFinite(num) ? String.fromCodePoint(num) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const num = Number.parseInt(hex, 16);
      return Number.isFinite(num) ? String.fromCodePoint(num) : '';
    })
    .replace(/&([A-Za-z0-9#]+);/g, (full, entity) => named[entity] ?? full);
}

function extractClassBlock(html: string, className: string): string | null {
  const openRe = new RegExp(
    `<div[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`,
    'i',
  );
  const openMatch = openRe.exec(html);
  if (!openMatch || openMatch.index < 0) return null;

  const start = openMatch.index;
  const openTagEnd = start + openMatch[0].length;
  const divTagRe = /<\/?div\b[^>]*>/gi;
  divTagRe.lastIndex = openTagEnd;
  let depth = 1;
  let match: RegExpExecArray | null;

  while ((match = divTagRe.exec(html)) !== null) {
    const tag = match[0].toLowerCase();
    if (tag.startsWith('</div')) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(openTagEnd, match.index);
      }
    } else {
      depth += 1;
    }
  }

  return null;
}

function extractParagraphs(contentHtml: string): string[] {
  const matches = [...contentHtml.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)];
  if (matches.length === 0) return [];
  return matches.map(match => {
    const decoded = decodeHtmlEntities(stripTags(match[0]));
    return normalizeWhitespace(decoded);
  }).filter(Boolean);
}

function normalizeSection(section: string): string {
  return section
    .replace(/[°º]/g, '')
    .replace(/\s+/g, '')
    .replace(/\.$/, '');
}

function toProvisionRef(section: string): string {
  return `art${section.toLowerCase().replace(/[^0-9a-z]+/g, '-')}`;
}

function parseDateFromMedioPublicacion(html: string): string | undefined {
  const plain = normalizeWhitespace(decodeHtmlEntities(stripTags(html)));

  const pattern1 = plain.match(
    /Medio de Publicación:\s*Diario Oficial[^.]*?\bde\s+([a-záéíóú]+)\s+(\d{1,2})\s+de\s+(\d{4})/i,
  );
  if (pattern1) {
    const month = MONTHS_ES[pattern1[1].toLowerCase()];
    if (!month) return undefined;
    const day = pattern1[2].padStart(2, '0');
    return `${pattern1[3]}-${month}-${day}`;
  }

  const pattern2 = plain.match(
    /Medio de Publicación:\s*Diario Oficial[^.]*?\bdel?\s+(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i,
  );
  if (pattern2) {
    const month = MONTHS_ES[pattern2[2].toLowerCase()];
    if (!month) return undefined;
    const day = pattern2[1].padStart(2, '0');
    return `${pattern2[3]}-${month}-${day}`;
  }

  return undefined;
}

function extractTitle(html: string): string {
  const match = html.match(/<h2[^>]*class=["']titulo-norma["'][^>]*>\s*<strong>([\s\S]*?)<\/strong>/i);
  if (match) {
    return normalizeWhitespace(decodeHtmlEntities(stripTags(match[1])));
  }

  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"]+)["']/i);
  if (ogTitle) {
    return normalizeWhitespace(decodeHtmlEntities(ogTitle[1].replace(/\s*-\s*Gestor Normativo\s*$/i, '')));
  }

  return 'Norma sin título';
}

function extractDescription(html: string): string | undefined {
  const matchA = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"]+)["']/i);
  const matchB = html.match(/<meta[^>]*content=["']([^"]+)["'][^>]*property=["']og:description["']/i);
  const text = matchA?.[1] ?? matchB?.[1];
  if (!text) return undefined;
  return normalizeWhitespace(decodeHtmlEntities(text));
}

function extractProvisions(contentHtml: string): ParsedProvision[] {
  const paragraphs = extractParagraphs(contentHtml);
  const provisions: ParsedProvision[] = [];
  let currentChapter: string | undefined;
  let active: { section: string; chapter?: string; blocks: string[] } | null = null;

  const flush = (): void => {
    if (!active) return;
    const content = normalizeWhitespace(active.blocks.join('\n\n'));
    if (content.length < 20) {
      active = null;
      return;
    }
    provisions.push({
      provision_ref: toProvisionRef(active.section),
      chapter: active.chapter,
      section: active.section,
      title: `Artículo ${active.section}`,
      content,
    });
    active = null;
  };

  for (const paragraph of paragraphs) {
    if (CHAPTER_RE.test(paragraph) && paragraph.length <= 140) {
      currentChapter = paragraph;
      continue;
    }

    const article = paragraph.match(ARTICLE_RE);
    if (article) {
      flush();
      const section = normalizeSection(article[1]);
      active = {
        section,
        chapter: currentChapter,
        blocks: [paragraph],
      };
      continue;
    }

    if (active) {
      active.blocks.push(paragraph);
    }
  }

  flush();

  const bySection = new Map<string, ParsedProvision>();
  for (const provision of provisions) {
    const existing = bySection.get(provision.section);
    if (!existing || provision.content.length > existing.content.length) {
      bySection.set(provision.section, provision);
    }
  }

  return Array.from(bySection.values());
}

function extractDefinitions(provisions: ParsedProvision[]): ParsedDefinition[] {
  const definitions: ParsedDefinition[] = [];
  const seen = new Set<string>();

  for (const provision of provisions) {
    const lower = provision.content.toLowerCase();
    if (!lower.includes('se entiende por') && !lower.includes('definiciones')) {
      continue;
    }

    const byLiteral = /(?:^|\n)\s*([a-zñ])\)\s*([^:;\n]{2,120}?)\s*:\s*([^\n]+?)(?=(?:\n\s*[a-zñ]\)\s)|$)/gim;
    let literalMatch: RegExpExecArray | null;
    while ((literalMatch = byLiteral.exec(provision.content)) !== null) {
      const term = normalizeWhitespace(literalMatch[2]).replace(/[. ]+$/, '');
      const definition = normalizeWhitespace(literalMatch[3]).replace(/[; ]+$/, '');
      const key = term.toLowerCase();

      if (term.length < 2 || term.length > 120) continue;
      if (definition.length < 8) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      definitions.push({
        term,
        definition,
        source_provision: provision.provision_ref,
      });
    }
  }

  return definitions.slice(0, 80);
}

export function parseNormaHtml(html: string, law: TargetLaw): ParsedAct {
  const title = extractTitle(html);
  const description = extractDescription(html);
  const issuedDate = parseDateFromMedioPublicacion(html);
  const contentHtml = extractClassBlock(html, 'descripcion-contenido') ?? '';
  const provisions = extractProvisions(contentHtml);
  const definitions = extractDefinitions(provisions);

  return {
    id: law.id,
    type: 'statute',
    title,
    short_name: law.shortName,
    status: law.status,
    issued_date: issuedDate,
    in_force_date: issuedDate,
    url: `https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=${law.portalId}`,
    description,
    provisions,
    definitions,
  };
}

export const TARGET_LAWS: TargetLaw[] = [
  {
    id: 'co-ley-1581-2012',
    fileName: '01-ley-1581-2012-proteccion-datos.json',
    portalId: 49981,
    docTypeId: 18,
    number: '1581',
    year: 2012,
    shortName: 'Ley 1581 de 2012',
    status: 'in_force',
  },
  {
    id: 'co-ley-1266-2008',
    fileName: '02-ley-1266-2008-habeas-data-financiero.json',
    portalId: 34488,
    docTypeId: 18,
    number: '1266',
    year: 2008,
    shortName: 'Ley 1266 de 2008',
    status: 'in_force',
  },
  {
    id: 'co-ley-1273-2009',
    fileName: '03-ley-1273-2009-delitos-informaticos.json',
    portalId: 34492,
    docTypeId: 18,
    number: '1273',
    year: 2009,
    shortName: 'Ley 1273 de 2009',
    status: 'in_force',
  },
  {
    id: 'co-ley-1341-2009',
    fileName: '04-ley-1341-2009-sector-tic.json',
    portalId: 36913,
    docTypeId: 18,
    number: '1341',
    year: 2009,
    shortName: 'Ley 1341 de 2009',
    status: 'amended',
  },
  {
    id: 'co-ley-527-1999',
    fileName: '05-ley-527-1999-comercio-electronico.json',
    portalId: 4276,
    docTypeId: 18,
    number: '527',
    year: 1999,
    shortName: 'Ley 527 de 1999',
    status: 'amended',
  },
  {
    id: 'co-ley-1712-2014',
    fileName: '06-ley-1712-2014-transparencia-acceso-informacion.json',
    portalId: 56882,
    docTypeId: 18,
    number: '1712',
    year: 2014,
    shortName: 'Ley 1712 de 2014',
    status: 'in_force',
  },
  {
    id: 'co-decreto-1078-2015',
    fileName: '07-decreto-1078-2015-sector-tic.json',
    portalId: 77888,
    docTypeId: 11,
    number: '1078',
    year: 2015,
    shortName: 'Decreto 1078 de 2015',
    status: 'amended',
  },
  {
    id: 'co-decreto-1377-2013',
    fileName: '08-decreto-1377-2013-reglamenta-ley-1581.json',
    portalId: 53646,
    docTypeId: 11,
    number: '1377',
    year: 2013,
    shortName: 'Decreto 1377 de 2013',
    status: 'amended',
  },
  {
    id: 'co-ley-1621-2013',
    fileName: '09-ley-1621-2013-inteligencia-contrainteligencia.json',
    portalId: 52706,
    docTypeId: 18,
    number: '1621',
    year: 2013,
    shortName: 'Ley 1621 de 2013',
    status: 'in_force',
  },
  {
    id: 'co-ley-1978-2019',
    fileName: '10-ley-1978-2019-modernizacion-sector-tic.json',
    portalId: 98210,
    docTypeId: 18,
    number: '1978',
    year: 2019,
    shortName: 'Ley 1978 de 2019',
    status: 'in_force',
  },
];
