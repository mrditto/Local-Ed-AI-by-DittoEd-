const MAX_PIXELS = 4_000_000;
let reading = false;

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Cancelled", "AbortError"));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

/** One English OCR worker at a time, using packaged assets only. */
export async function recognizeCanvas(
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
): Promise<string> {
  if (reading) throw new Error("Another page is being read. Try again when it finishes.");
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  if (!canvas.width || !canvas.height || canvas.width * canvas.height > MAX_PIXELS)
    throw new Error("Page is too large to read.");
  reading = true;
  let worker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | undefined;
  const cancel = () => {
    if (worker) void worker.terminate().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const { createWorker, OEM } = await import("tesseract.js");
    const local = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href;
    worker = await createWorker("eng", OEM.LSTM_ONLY, {
      workerPath: `${local}worker.min.js`,
      corePath: local,
      langPath: local,
      gzip: false,
      cacheMethod: "none",
      workerBlobURL: false,
    });
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const result = await abortable(worker.recognize(canvas), signal);
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    return result.data.text.trim();
  } finally {
    signal.removeEventListener("abort", cancel);
    if (worker) await worker.terminate().catch(() => {});
    reading = false;
  }
}

export async function recognizeImage(file: File, signal: AbortSignal): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  try {
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
    canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the image.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await recognizeCanvas(canvas, signal);
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
