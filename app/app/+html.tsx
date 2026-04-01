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
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <title>LyftTrack - App</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BASE_WEB_BG_STYLE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
