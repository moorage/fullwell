import { useEffect, useState } from "react";
import { Check, Copy, Mail, MessageSquare, Share2 } from "lucide-react";
import { Button } from "./ui.js";

type ShareActionsProps = {
  url: string;
  title: string;
};

export function ShareActions({ url, title }: ShareActionsProps) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const shareText = `Take a look at ${title} on Fullwell.`;

  useEffect(() => {
    setCanShare(Reflect.has(navigator, "share"));
  }, []);

  async function copyLink() {
    try {
      if (navigator.clipboard === undefined) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setFailure(null);
    } catch {
      setFailure("Copy failed. Select the link below instead.");
    }
  }

  async function share() {
    if (navigator.share === undefined) return;
    try {
      await navigator.share({ title, text: shareText, url });
      setFailure(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFailure("Sharing failed. Use email, text, or the link below.");
    }
  }

  function requestCopy(): void {
    copyLink().catch(() => setFailure("Copy failed. Select the link below instead."));
  }

  function requestShare(): void {
    share().catch(() => setFailure("Sharing failed. Use email, text, or the link below."));
  }

  return (
    <div className="share-actions" role="group" aria-label="Share collection">
      {canShare ? (
        <Button type="button" variant="secondary" onClick={requestShare}>
          <Share2 aria-hidden="true" size={18} /> Share
        </Button>
      ) : null}
      <Button type="button" variant="secondary" onClick={requestCopy}>
        {copied ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
        {copied ? "Copied" : "Copy link"}
      </Button>
      <a
        className="button button--quiet"
        href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${shareText} ${url}`)}`}
      >
        <Mail aria-hidden="true" size={18} /> Email
      </a>
      <a className="button button--quiet" href={`sms:?&body=${encodeURIComponent(`${shareText} ${url}`)}`}>
        <MessageSquare aria-hidden="true" size={18} /> Text
      </a>
      <label className="share-url"><span className="visually-hidden">Collection link</span><input readOnly value={url} /></label>
      <span className="share-failure" role="status">{failure}</span>
    </div>
  );
}
