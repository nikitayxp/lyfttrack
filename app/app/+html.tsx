import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

const BASE_WEB_BG_STYLE = `
  html, body, #root {
    background: #000000;
    width: 100%;
    min-height: 100%;
    height: 100%;
    margin: 0;
    overflow-x: hidden;
  }

  /* Constrain only RN Web modal portals inside the desktop phone mockup. */
  body.desktop-mockup-active > div:has([aria-modal="true"]),
  body.desktop-mockup-active > div:has([role="dialog"]) {
    position: absolute !important;
    width: 393px !important;
    height: 852px !important;
    max-height: 95vh !important;
    left: 50% !important;
    top: 50% !important;
    right: auto !important;
    bottom: auto !important;
    transform: translate(-50%, -50%) !important;
    border-radius: 40px !important;
    overflow: hidden !important;
    pointer-events: none !important;
  }

  body.desktop-mockup-active > div:has([aria-modal="true"]) > *,
  body.desktop-mockup-active > div:has([role="dialog"]) > * {
    pointer-events: auto !important;
  }

  body.desktop-mockup-active input:not([type="hidden"]),
  body.desktop-mockup-active textarea,
  body.desktop-mockup-active [contenteditable=""],
  body.desktop-mockup-active [contenteditable="true"],
  body.desktop-mockup-active [role="textbox"] {
    cursor: text !important;
  }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <title>LyftTrack</title>
        <meta
          name="description"
          content="Official LyftTrack website experience with app showcase, bilingual blog and interactive training previews."
        />
        <meta name="application-name" content="LyftTrack" />
        <meta
          name="keywords"
          content="fitness, workout tracker, gym app, LyftTrack, blog, training"
        />
        <meta property="og:title" content="LyftTrack" />
        <meta
          property="og:description"
          content="Official LyftTrack website experience with app showcase, bilingual blog and interactive training previews."
        />
        <meta property="og:site_name" content="LyftTrack" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="LyftTrack" />
        <meta
          name="twitter:description"
          content="Official LyftTrack website experience with app showcase, bilingual blog and interactive training previews."
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <link rel="icon" href="/logo.jpg" type="image/jpeg" />
        <link rel="shortcut icon" href="/logo.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/logo.jpg" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BASE_WEB_BG_STYLE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
