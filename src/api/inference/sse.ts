/** Incremental SSE parser for llama-server's OpenAI-compatible chat stream. */
export class ChatStreamDecoder {
  private readonly decoder = new TextDecoder();
  private buffer = "";
  private finished = false;

  constructor(private readonly onText: (text: string) => void) {}

  get done(): boolean { return this.finished; }

  push(bytes: Uint8Array): void {
    if (this.finished) return;
    this.buffer += this.decoder.decode(bytes, { stream: true });
    this.consume();
    if (this.buffer.length > 1_048_576) throw new Error("Runtime stream event is too large.");
  }

  end(): void {
    this.buffer += this.decoder.decode();
    this.consume();
    if (!this.finished) throw new Error("Runtime stream ended before completion.");
  }

  private consume(): void {
    // SSE records may use CRLF; preserve incomplete delimiters across pushes.
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(this.buffer)) !== null) {
      const record = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);
      const data = record.split(/\r?\n/)
        .filter(line => line.startsWith("data:"))
        .map(line => line.slice(5).replace(/^ /, "")).join("\n");
      if (!data) continue;
      if (data === "[DONE]") { this.finished = true; this.buffer = ""; return; }
      const event = JSON.parse(data) as {
        error?: { message?: string };
        choices?: { delta?: { content?: unknown } }[];
      };
      if (event.error) throw new Error(event.error.message ?? "Integrated runtime generation failed.");
      const text = event.choices?.[0]?.delta?.content;
      // Reasoning and tool-call deltas are deliberately excluded from drafts.
      if (typeof text === "string") this.onText(text);
    }
  }
}
