import { extractRawText } from "mammoth";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

const MAX_EXTRACTED_CHARS = 12000;

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type ExtractSuccess = {
  ok: true;
  text: string;
  truncated: boolean;
};

type ExtractFailure = {
  ok: false;
  message: string;
};

export async function extractTextFromFile(file: File): Promise<ExtractSuccess | ExtractFailure> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "doc") {
    return {
      ok: false,
      message:
        "Old Word format (.doc) isn't supported — open it in Word and Save As .docx, then attach that.",
    };
  }

  try {
    let extractedText = "";

    if (extension === "pdf") {
      extractedText = await extractPdfText(file);
    } else if (extension === "docx") {
      extractedText = await extractDocxText(file);
    } else if (extension === "txt" || extension === "md") {
      extractedText = await file.text();
    } else {
      return {
        ok: false,
        message: "Unsupported file type. Please attach a PDF, .docx, .txt, or .md file.",
      };
    }

    const normalizedText = extractedText.trim();
    if (!normalizedText) {
      return { ok: false, message: "That file appears to be empty." };
    }

    const truncated = normalizedText.length > MAX_EXTRACTED_CHARS;
    const text = truncated ? normalizedText.slice(0, MAX_EXTRACTED_CHARS) : normalizedText;
    return { ok: true, text, truncated };
  } catch {
    return {
      ok: false,
      message: "Couldn't read that file. Try exporting it as .docx, .txt, or .md and attaching again.",
    };
  }
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => {
        if (typeof item === "object" && item !== null && "str" in item) {
          const text = item.str;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .filter((segment) => segment.length > 0)
      .join(" ");
    pages.push(pageText);
  }

  return pages.join("\n\n");
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await extractRawText({ arrayBuffer });
  return result.value;
}
