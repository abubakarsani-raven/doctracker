import { isPdfFile, isRichTextFile, isSignableFile } from './signable-file';

describe('signable file detection', () => {
  it('accepts PDFs by extension, short type, and MIME type', () => {
    expect(isPdfFile({ fileType: 'pdf' })).toBe(true);
    expect(isPdfFile({ fileType: 'application/pdf' })).toBe(true);
    expect(
      isPdfFile({ fileType: 'application/octet-stream', fileName: 'nda.PDF' }),
    ).toBe(true);
  });

  it('accepts rich-text documents by relation or type', () => {
    expect(isRichTextFile({ richTextDoc: { id: 'doc-1' } })).toBe(true);
    expect(isRichTextFile({ fileType: 'html' })).toBe(true);
    expect(isRichTextFile({ fileType: 'text/html' })).toBe(true);
    expect(isRichTextFile({ richTextDoc: null, fileType: 'docx' })).toBe(false);
  });

  it('rejects DOCX and other office formats — there is no stamping path', () => {
    const docx = {
      fileType: 'docx',
      fileName: 'nda-vantage-ironleaf.docx',
      richTextDoc: null,
    };
    expect(isSignableFile(docx)).toBe(false);
    expect(
      isSignableFile({
        fileType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: 'contract.docx',
      }),
    ).toBe(false);
    expect(isSignableFile({ fileType: 'xlsx', fileName: 'budget.xlsx' })).toBe(
      false,
    );
    expect(isSignableFile({ fileType: 'png', fileName: 'scan.png' })).toBe(
      false,
    );
  });

  it('does not mistake a .pdf substring in the middle of a name for a PDF', () => {
    expect(
      isSignableFile({ fileType: 'docx', fileName: 'notes.pdf.docx' }),
    ).toBe(false);
  });

  it('accepts signable files', () => {
    expect(isSignableFile({ fileType: 'pdf', fileName: 'nda.pdf' })).toBe(true);
    expect(isSignableFile({ fileType: 'html' })).toBe(true);
  });
});
