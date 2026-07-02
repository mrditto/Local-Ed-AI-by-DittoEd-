/**
 * Appears under every AI-generated response. Keep the copy centralized here
 * so wording can be reviewed/changed in one place without touching layout code.
 */
const DISCLAIMER_TEXT =
  "AI-generated draft — review before use. Local Ed AI runs entirely on this computer and does not send data anywhere else.";

export function DisclaimerFooter() {
  return <p className="disclaimer-footer">{DISCLAIMER_TEXT}</p>;
}
