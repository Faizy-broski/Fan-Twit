"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Share2, Link2, } from "lucide-react";
import {
  FaWhatsapp,
  FaTelegram,
  FaFacebook,
  FaReddit,
} from "react-icons/fa";
import {
  FaXTwitter,
} from "react-icons/fa6";
import {
  MdEmail,
} from "react-icons/md";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function shareOptions(url: string, text: string) {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);

  return [
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: FaWhatsapp,
      className: "bg-[#25D366]",
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    },
    {
      key: "telegram",
      label: "Telegram",
      icon: FaTelegram,
      className: "bg-[#229ED9]",
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    },
    {
      key: "x",
      label: "X",
      icon: FaXTwitter,
      className: "bg-foreground",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: FaFacebook,
      className: "bg-[#1877F2]",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      key: "reddit",
      label: "Reddit",
      icon: FaReddit,
      className: "bg-[#FF4500]",
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`,
    },
    {
      key: "email",
      label: "Email",
      icon: MdEmail,
      className: "bg-muted-foreground",
      href: `mailto:?subject=${encodedText}&body=${encodedUrl}`,
    },
  ];
}

export function ShareDialog({
  open,
  onClose,
  url,
  text,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  text: string;
}) {
  const [copied, setCopied] = useState(false);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copyLink = () => {
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        toast.success("Link copied");
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Could not copy link"),
    );
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: text, text, url });
      onClose();
    } catch {
      // User cancelled the native share sheet — nothing to do.
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="w-full max-w-sm gap-4">
        <DialogHeader>
          <DialogTitle className="text-base">Share post</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
          <Link2 className="size-4 shrink-0 text-muted-foreground" />
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
          />
          <button
            type="button"
            onClick={copyLink}
            className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {shareOptions(url, text).map((option) => (
            <a
              key={option.key}
              href={option.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <span
                className={`flex size-12 items-center justify-center rounded-full text-white ${option.className}`}
              >
                <option.icon className="size-5" />
              </span>
              <span className="text-xs text-muted-foreground">{option.label}</span>
            </a>
          ))}

          {canNativeShare && (
            <button
              type="button"
              onClick={nativeShare}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Share2 className="size-5" />
              </span>
              <span className="text-xs text-muted-foreground">More</span>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
