import sanitizeHtml from 'sanitize-html';

/** Allowlist for TipTap / rich-text document HTML stored in the DB. */
const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    'img',
    'h1',
    'h2',
    'span',
    'div',
    'u',
    's',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'colgroup',
    'col',
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['class', 'style'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    a: ['href', 'name', 'target', 'rel'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'data'],
  allowProtocolRelative: false,
};

export function sanitizeRichTextHtml(dirty: string): string {
  if (!dirty) return '';
  return sanitizeHtml(dirty, RICH_TEXT_OPTIONS);
}
