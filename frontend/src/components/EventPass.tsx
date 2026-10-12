import { useId, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

import "./EventPass.css";

function invitationUrl(invitationCode: string): string {
  const url = new URL(window.location.origin);
  url.searchParams.set("invite", invitationCode);
  url.hash = "rsvp";
  return url.toString();
}

function safeFilename(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guest";
}

export function EventPass({
  invitationCode,
  guestName,
  partySize,
  compact = false,
}: {
  invitationCode: string;
  guestName: string;
  partySize: number;
  compact?: boolean;
}) {
  const passRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const value = invitationUrl(invitationCode);

  function downloadQr(): void {
    const svg = passRef.current?.querySelector("svg");
    if (!svg) return;
    const source = new XMLSerializer().serializeToString(svg);
    const blobUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${safeFilename(guestName)}-wedding-qr.svg`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }

  function printPass(): void {
    const svg = passRef.current?.querySelector("svg");
    const popup = window.open("", "_blank", "noopener,noreferrer,width=520,height=720");
    if (!svg || !popup) return;
    popup.document.title = `${guestName} event pass`;
    const style = popup.document.createElement("style");
    style.textContent = "body{display:grid;place-items:center;min-height:100vh;margin:0;font-family:Arial,sans-serif;color:#3e3048}.pass{text-align:center;padding:32px}.pass svg{width:300px;height:300px}.code{letter-spacing:.12em}.note{color:#6f6375}";
    popup.document.head.append(style);
    const container = popup.document.createElement("main");
    container.className = "pass";
    const heading = popup.document.createElement("h1");
    heading.textContent = "John Paul & Joyce";
    const guest = popup.document.createElement("h2");
    guest.textContent = guestName;
    const code = popup.document.createElement("p");
    code.className = "code";
    code.textContent = invitationCode;
    const note = popup.document.createElement("p");
    note.className = "note";
    note.textContent = `Event pass · Party of ${partySize}`;
    container.append(heading, guest, svg.cloneNode(true), code, note);
    popup.document.body.append(container);
    popup.focus();
    popup.print();
  }

  return (
    <section className={`event-pass${compact ? " event-pass--compact" : ""}`} aria-labelledby={titleId} ref={passRef}>
      <div className="event-pass__monogram" aria-hidden="true">JP <span>&amp;</span> J</div>
      <p className="event-pass__eyebrow">Wedding event pass</p>
      <h4 id={titleId}>{guestName}</h4>
      <div className="event-pass__divider" aria-hidden="true"><span /><b>♡</b><span /></div>
      <div className="event-pass__qr">
        <QRCodeSVG value={value} size={compact ? 200 : 230} level="M" marginSize={2} title={`Event pass for ${guestName}`} />
      </div>
      <strong>{invitationCode}</strong>
      <span>Party of {partySize}</span>
      <small>March 20, 2027 · Antipolo, Rizal</small>
      <p>Present this QR code at the venue entrance.</p>
      <div className="event-pass__actions">
        <button type="button" onClick={downloadQr}>Download QR</button>
        <button type="button" onClick={printPass}>Print pass</button>
      </div>
    </section>
  );
}
