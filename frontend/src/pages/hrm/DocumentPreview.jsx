import { useEffect, useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { documentBlob } from "./employeeShared";

// Shows an HR document (image or PDF) in a pop-up on the same page instead of a new tab.
// The file is fetched with the session token and shown from a blob URL that is released on close.
export function DocumentPreview({ token, doc, onClose }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const isImage = String(doc?.mimeType || "").startsWith("image/");
  const title = doc?.title || doc?.category || "Document";

  useEffect(() => {
    if (!doc) return undefined;
    let objectUrl = "";
    let active = true;
    setUrl("");
    setError("");
    documentBlob(token, doc.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: doc.mimeType }));
        setUrl(objectUrl);
      })
      .catch((e) => active && setError(e.message || "Could not open the document"));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, doc]);

  if (!doc) return null;
  const extension = isImage ? (doc.mimeType === "image/png" ? ".png" : ".jpg") : ".pdf";
  const fileName = doc.fileName || `${title}${extension}`;

  return (
    <Modal
      open
      title={title}
      subtitle={doc.expiresOn ? `Expires ${doc.expiresOn}` : undefined}
      onClose={onClose}
      width="min(1000px, 96vw)"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={!url} onClick={() => window.open(url, "_blank", "noopener")}>
            <ExternalLink size={15} /> Open in new tab
          </Button>
          <Button as="a" href={url || undefined} download={fileName} disabled={!url}>
            <Download size={15} /> Download
          </Button>
        </div>
      }
    >
      <div className="flex min-h-[40vh] items-center justify-center rounded-xl bg-[var(--surface-2)] p-2">
        {error ? (
          <p role="alert" className="p-6 text-sm text-rose-600">{error}</p>
        ) : !url ? (
          <span className="flex items-center gap-2 text-sm text-[var(--text-muted)]" role="status">
            <Loader2 size={16} className="animate-spin" /> Loading document…
          </span>
        ) : isImage ? (
          <img src={url} alt={title} className="max-h-[65vh] w-auto max-w-full rounded-lg object-contain" />
        ) : (
          <iframe src={url} title={title} className="h-[65vh] w-full rounded-lg border-0 bg-white" />
        )}
      </div>
    </Modal>
  );
}
