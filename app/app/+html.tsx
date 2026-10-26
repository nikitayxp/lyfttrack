import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';
import { DEVICE_SCREEN, PHONE_OVERLAY_ATTRIBUTE } from '@/constants/deviceFrame';

const MODAL_PORTAL = 'body.desktop-mockup-active > div:not(#root)';
const PHONE_OVERLAYS = [
  `${MODAL_PORTAL}:has([aria-modal="true"])`,
  `${MODAL_PORTAL}:has([role="dialog"])`,
  `body.desktop-mockup-active > [${PHONE_OVERLAY_ATTRIBUTE}]`,
].join(',\n  ');
const MODAL_PORTAL_CHILDREN = [
  `${MODAL_PORTAL}:has([aria-modal="true"]) > *`,
  `${MODAL_PORTAL}:has([role="dialog"]) > *`,
].join(',\n  ');

const BASE_WEB_BG_STYLE = `
  html, body, #root {
    color-scheme: dark;
    background: #000000;
    width: 100%;
    min-height: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    overscroll-behavior: none;
  }

  body * {
    scrollbar-width: none;
  }

  body *::-webkit-scrollbar {
    display: none;
  }

  [data-testid="app-web-shell"],
  [data-testid="app-device-frame"] {
    overflow: clip !important;
  }

  ${PHONE_OVERLAYS} {
    position: absolute !important;
    width: ${DEVICE_SCREEN.width}px !important;
    height: ${DEVICE_SCREEN.height}px !important;
    max-height: ${DEVICE_SCREEN.maxHeightCss} !important;
    left: 50% !important;
    top: 50% !important;
    right: auto !important;
    bottom: auto !important;
    transform: translate(-50%, -50%) !important;
    border-radius: ${DEVICE_SCREEN.radius}px !important;
    overflow: hidden !important;
    pointer-events: none !important;
  }

  ${MODAL_PORTAL_CHILDREN} {
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
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, interactive-widget=resizes-content"
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
