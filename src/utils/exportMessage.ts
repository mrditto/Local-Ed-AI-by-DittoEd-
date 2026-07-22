import {
  AlignmentType,
  HeadingLevel,
  LevelFormat,
  Paragraph,
  TextRun,
  type INumberingOptions,
} from "docx";
import { jsPDF } from "jspdf";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { writeText as writeTauriClipboardText } from "@tauri-apps/plugin-clipboard-manager";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// ---------------------------------------------------------------------------
// Filenames
// ---------------------------------------------------------------------------

const MAX_FILENAME_LENGTH = 60;

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_FILENAME_LENGTH)
    .replace(/-+$/g, "");
  return slug || "untitled";
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Base filename (no extension) from a chat/session title, falling back to a snippet of the response itself. */
export function buildDefaultFilename(opts: { title?: string; fallbackText: string; date?: Date }): string {
  const source = opts.title?.trim() || opts.fallbackText.trim().slice(0, 40);
  return `${slugify(source)}-${formatDate(opts.date ?? new Date())}`;
}

// ---------------------------------------------------------------------------
// Save-to-disk mechanics — shared by IEP export and chat export
// ---------------------------------------------------------------------------

export interface SaveFileResult {
  ok: boolean;
  savedTo?: string;
  cancelled?: boolean;
}

export async function saveGeneratedFile(
  bytes: Uint8Array,
  opts: { baseFilename: string; extension: "docx" | "pdf"; dialogTitle: string; mimeType: string },
): Promise<SaveFileResult> {
  const fileName = `${opts.baseFilename}.${opts.extension}`;

  if (isTauriRuntime()) {
    const filePath = await save({
      title: opts.dialogTitle,
      defaultPath: fileName,
      filters: [{ name: opts.extension === "docx" ? "Word" : "PDF", extensions: [opts.extension] }],
    });
    if (!filePath) return { ok: false, cancelled: true };
    await writeFile(filePath, bytes);
    return { ok: true, savedTo: filePath };
  }

  const blob = new Blob([bytes], { type: opts.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (isTauriRuntime()) {
      await writeTauriClipboardText(text);
      return true;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Minimal markdown model — headings, bold, and (un)ordered lists only.
// Not a full CommonMark parser: no links, code, italics, tables, or nesting.
// ---------------------------------------------------------------------------

export interface MdRun {
  text: string;
  bold: boolean;
}

export type MdBlock =
  | { kind: "heading"; level: 1 | 2 | 3; runs: MdRun[] }
  | { kind: "paragraph"; runs: MdRun[] }
  | { kind: "list"; ordered: boolean; items: MdRun[][] };

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const UNORDERED_ITEM_PATTERN = /^[-*+]\s+(.*)$/;
const ORDERED_ITEM_PATTERN = /^\d+\.\s+(.*)$/;
const BOLD_PATTERN = /\*\*(.+?)\*\*/g;

function parseInlineRuns(text: string): MdRun[] {
  const runs: MdRun[] = [];
  let lastIndex = 0;
  BOLD_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BOLD_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    runs.push({ text: match[1], bold: true });
    lastIndex = BOLD_PATTERN.lastIndex;
  }
  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex), bold: false });
  }
  return runs.length > 0 ? runs : [{ text: "", bold: false }];
}

export function parseMarkdownBlocks(markdown: string): MdBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: MdRun[][] = [];
  let listOrdered = false;
  let inList = false;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ kind: "paragraph", runs: parseInlineRuns(paragraphLines.join(" ")) });
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ kind: "list", ordered: listOrdered, items: listItems });
    listItems = [];
    inList = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = HEADING_PATTERN.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = Math.min(headingMatch[1].length, 3) as 1 | 2 | 3;
      blocks.push({ kind: "heading", level, runs: parseInlineRuns(headingMatch[2]) });
      continue;
    }

    const unorderedMatch = UNORDERED_ITEM_PATTERN.exec(line);
    const orderedMatch = unorderedMatch ? null : ORDERED_ITEM_PATTERN.exec(line);
    if (unorderedMatch || orderedMatch) {
      flushParagraph();
      const ordered = Boolean(orderedMatch);
      if (inList && listOrdered !== ordered) {
        flushList();
      }
      listOrdered = ordered;
      inList = true;
      listItems.push(parseInlineRuns((unorderedMatch ?? orderedMatch)![1]));
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

// ---------------------------------------------------------------------------
// docx builder (chat-only — IEP builds its own structured-field paragraphs)
// ---------------------------------------------------------------------------

const ORDERED_LIST_REFERENCE = "chat-ordered-list";

const HEADING_LEVEL_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
} as const;

function toTextRuns(runs: MdRun[]): TextRun[] {
  return runs.map((run) => new TextRun({ text: run.text, bold: run.bold }));
}

/** Numbering config to pass as `Document({ numbering: ... })` alongside these paragraphs, so ordered lists render correctly. */
export function buildDocxNumberingConfig(): INumberingOptions {
  return {
    config: [
      {
        reference: ORDERED_LIST_REFERENCE,
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.START,
          },
        ],
      },
    ],
  };
}

export function buildDocxParagraphsFromMarkdown(markdown: string): Paragraph[] {
  const blocks = parseMarkdownBlocks(markdown);
  const paragraphs: Paragraph[] = [];

  blocks.forEach((block) => {
    if (block.kind === "heading") {
      paragraphs.push(new Paragraph({ heading: HEADING_LEVEL_MAP[block.level], children: toTextRuns(block.runs) }));
      return;
    }
    if (block.kind === "paragraph") {
      paragraphs.push(new Paragraph({ children: toTextRuns(block.runs) }));
      return;
    }
    block.items.forEach((item) => {
      paragraphs.push(
        new Paragraph(
          block.ordered
            ? { children: toTextRuns(item), numbering: { reference: ORDERED_LIST_REFERENCE, level: 0 } }
            : { children: toTextRuns(item), bullet: { level: 0 } },
        ),
      );
    });
  });

  return paragraphs;
}

// ---------------------------------------------------------------------------
// PDF builder (chat-only) — jsPDF has no rich-text/list primitives, so this
// lays out words manually, tracking bold state per word and wrapping lines.
// ---------------------------------------------------------------------------

const PDF_MARGIN = 48;
const PDF_LINE_HEIGHT = 16;
const PDF_LIST_INDENT = 18;
const PDF_FONT = "helvetica";
const PDF_BODY_SIZE = 11;
const PDF_HEADING_SIZES = { 1: 18, 2: 15, 3: 13 } as const;

interface PdfWord {
  text: string;
  bold: boolean;
}

function runsToWords(runs: MdRun[]): PdfWord[] {
  const words: PdfWord[] = [];
  runs.forEach((run) => {
    run.text.split(/\s+/).forEach((token) => {
      if (token.length > 0) words.push({ text: token, bold: run.bold });
    });
  });
  return words;
}

export function buildPdfBytesFromMarkdown(markdown: string): Uint8Array {
  const blocks = parseMarkdownBlocks(markdown);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const rightEdge = pageWidth - PDF_MARGIN;
  let y = PDF_MARGIN;

  const ensureSpace = () => {
    if (y > pageHeight - PDF_MARGIN) {
      doc.addPage();
      y = PDF_MARGIN;
    }
  };

  const writeWords = (words: PdfWord[], opts: { fontSize: number; forceBold: boolean; leftMargin: number; prefix?: string }) => {
    doc.setFontSize(opts.fontSize);
    let x = opts.leftMargin;
    let firstWordOnLine = true;

    const placeToken = (token: string, bold: boolean) => {
      doc.setFont(PDF_FONT, opts.forceBold || bold ? "bold" : "normal");
      const spaceWidth = firstWordOnLine ? 0 : doc.getTextWidth(" ");
      const tokenWidth = doc.getTextWidth(token);
      if (!firstWordOnLine && x + spaceWidth + tokenWidth > rightEdge) {
        y += PDF_LINE_HEIGHT;
        ensureSpace();
        x = opts.leftMargin;
        firstWordOnLine = true;
      }
      if (!firstWordOnLine) x += spaceWidth;
      ensureSpace();
      doc.text(token, x, y);
      x += tokenWidth;
      firstWordOnLine = false;
    };

    if (opts.prefix) placeToken(opts.prefix, opts.forceBold);
    words.forEach((word) => placeToken(word.text, word.bold));

    y += PDF_LINE_HEIGHT;
  };

  blocks.forEach((block, index) => {
    if (index > 0) y += PDF_LINE_HEIGHT * 0.4;
    ensureSpace();

    if (block.kind === "heading") {
      writeWords(runsToWords(block.runs), { fontSize: PDF_HEADING_SIZES[block.level], forceBold: true, leftMargin: PDF_MARGIN });
      return;
    }

    if (block.kind === "paragraph") {
      writeWords(runsToWords(block.runs), { fontSize: PDF_BODY_SIZE, forceBold: false, leftMargin: PDF_MARGIN });
      return;
    }

    block.items.forEach((item, itemIndex) => {
      writeWords(runsToWords(item), {
        fontSize: PDF_BODY_SIZE,
        forceBold: false,
        leftMargin: PDF_MARGIN + PDF_LIST_INDENT,
        prefix: block.ordered ? `${itemIndex + 1}.` : "•",
      });
    });
  });

  return new Uint8Array(doc.output("arraybuffer"));
}
