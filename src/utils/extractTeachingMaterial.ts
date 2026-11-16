import { extractRawText } from "mammoth";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();
export const MAX_MATERIAL_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 12000;
type Result = { ok: true; text: string; scope: string } | { ok: false; error: string };

export async function extractTeachingMaterial(
  file: File,
  options: { firstPage: number; lastPage: number; signal: AbortSignal },
): Promise<Result> {
  const { signal, firstPage, lastPage } = options;
  const cancelled = (): Result => ({
    ok: false,
    error: "Import cancelled. Existing text was not replaced.",
  });
  if (signal.aborted) return cancelled();
  if (file.size > MAX_MATERIAL_FILE_BYTES)
    return { ok: false, error: "Choose a file smaller than 8 MB, or paste the relevant excerpt." };
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["pdf", "docx", "txt", "md"].includes(extension ?? "")) {
    return {
      ok: false,
      error:
        "Use a text-based PDF, DOCX, TXT or MD file. Photos and scanned pages need OCR, which is not supported yet.",
    };
  }
  try {
    let text = "",
      scope = "";
    if (extension === "pdf") {
      if (
        !Number.isInteger(firstPage) ||
        !Number.isInteger(lastPage) ||
        firstPage < 1 ||
        lastPage < firstPage ||
        lastPage - firstPage >= 10
      ) {
        return { ok: false, error: "Choose a valid PDF file-page range of at most 10 pages." };
      }
      const buffer = await file.arrayBuffer();
      if (signal.aborted) return cancelled();
      const task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false });
      const abort = () => {
        void task.destroy().catch(() => {});
      };
      signal.addEventListener("abort", abort, { once: true });
      try {
        if (signal.aborted) return cancelled();
        const pdf = await task.promise;
        if (lastPage > pdf.numPages)
          return {
            ok: false,
            error: `This PDF has ${pdf.numPages} file pages. Choose a range within it.`,
          };
        const pages: string[] = [];
        for (let pageNumber = firstPage; pageNumber <= lastPage; pageNumber++) {
          if (signal.aborted) return cancelled();
          const page = await pdf.getPage(pageNumber);
          try {
            const content = await page.getTextContent();
            const pageText = content.items
              .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
              .join("")
              .trim();
            if (!pageText)
              return {
                ok: false,
                error: `PDF file page ${pageNumber} has no readable text. It may be scanned or blank. Choose other pages or paste text; images and diagrams are not read.`,
              };
            pages.push(`[PDF file page ${pageNumber}]\n${pageText}`);
            if (pages.join("\n\n").length > MAX_TEXT_CHARS)
              return {
                ok: false,
                error:
                  "The selected pages contain too much text. Choose fewer pages or paste a shorter excerpt. Nothing was shortened.",
              };
          } finally {
            page.cleanup();
          }
        }
        text = pages.join("\n\n");
        scope = `PDF file pages ${firstPage}-${lastPage} (file positions, not printed book page numbers)`;
      } finally {
        signal.removeEventListener("abort", abort);
        await task.destroy().catch(() => {});
      }
    } else if (extension === "docx") {
      const buffer = await file.arrayBuffer();
      if (signal.aborted) return cancelled();
      text = (await extractRawText({ arrayBuffer: buffer })).value;
    } else {
      text = await file.text();
    }
    if (signal.aborted) return cancelled();
    text = text.trim();
    if (!text)
      return { ok: false, error: "No readable text was found. Paste the relevant text instead." };
    if (text.length > MAX_TEXT_CHARS)
      return {
        ok: false,
        error:
          "This file contains too much text. Export a smaller selection or paste an excerpt. Nothing was shortened.",
      };
    return { ok: true, text, scope };
  } catch {
    return signal.aborted
      ? cancelled()
      : {
          ok: false,
          error:
            "Could not read this file. It may be protected, damaged or unsupported. Try a permitted text export or paste the excerpt.",
        };
  }
}
