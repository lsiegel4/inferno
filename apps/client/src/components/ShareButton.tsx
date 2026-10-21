import { useState } from "react";

/** Native share sheet where available, otherwise copy the link (game design §9.4). */
export function ShareButton() {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.origin;
    const data = { title: "Inferno", text: "Help the crowd down into the Inferno.", url };
    if (navigator.share) {
      await navigator.share(data).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };
  return (
    <button type="button" className="key" onClick={() => void share()}>
      {copied ? "Link copied" : "Invite friends"}
    </button>
  );
}
