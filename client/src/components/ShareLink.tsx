import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Link } from "lucide-react";

interface ShareLinkProps {
  roomId: string;
}

export default function ShareLink({ roomId }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/room/${roomId}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="action-button action-outline share-button"
    >
      {copied ? (
        <>
          <Check className="copy-check" aria-hidden="true" />
          Copied!
        </>
      ) : (
        <>
          <Link aria-hidden="true" />
          Share Link
        </>
      )}
    </Button>
  );
}
