import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import { DEVICE_SCREEN, PHONE_OVERLAY_ATTRIBUTE } from '@/constants/deviceFrame';
import { Spacing } from '@/constants/Styles';
import { MINIMIZED_WORKOUT_BAR_GAP, TAB_BAR_ROW_HEIGHT } from '@/constants/tabBar';

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
const MOBILE_PORTALS = [
  'body:not(.desktop-mockup-active) > div:not(#root):has([aria-modal="true"])',
  'body:not(.desktop-mockup-active) > div:not(#root):has([role="dialog"])',
  `body:not(.desktop-mockup-active) > [${PHONE_OVERLAY_ATTRIBUTE}]`,
].join(',\n  ');

const BASE_WEB_BG_STYLE = `
  body {
    --app-safe-area-top: env(safe-area-inset-top, 0px);
    --app-safe-area-right: env(safe-area-inset-right, 0px);
    --app-safe-area-bottom: env(safe-area-inset-bottom, 0px);
    --app-safe-area-left: env(safe-area-inset-left, 0px);
  }

  body.desktop-mockup-active {
    --app-safe-area-top: 0px;
    --app-safe-area-right: 0px;
    --app-safe-area-bottom: 0px;
    --app-safe-area-left: 0px;
  }

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

  [data-testid="app-safe-area"],
  [data-testid="app-modal-safe-area"] {
    box-sizing: border-box;
    padding-top: var(--app-safe-area-top, 0px) !important;
    padding-right: var(--app-safe-area-right, 0px) !important;
    padding-bottom: var(--app-safe-area-bottom, 0px) !important;
    padding-left: var(--app-safe-area-left, 0px) !important;
  }

  [data-testid="app-bottom-sheet"] {
    margin-bottom: calc(${Spacing.lg}px + var(--app-safe-area-bottom, 0px)) !important;
  }

  [data-testid="app-toast"] {
    bottom: calc(max(12px, var(--app-safe-area-bottom, 0px)) + 12px) !important;
  }

  [data-testid="app-toast-above-tabs"] {
    bottom: calc(${TAB_BAR_ROW_HEIGHT + 12}px + var(--app-safe-area-bottom, 0px)) !important;
  }

  [data-testid="app-minimized-workout-bar"] {
    bottom: calc(${TAB_BAR_ROW_HEIGHT + MINIMIZED_WORKOUT_BAR_GAP}px + var(--app-safe-area-bottom, 0px)) !important;
  }

  [data-testid="comments-header"] {
    padding-top: calc(10px + var(--app-safe-area-top, 0px)) !important;
  }

  [data-testid="comments-composer"] {
    padding-bottom: max(10px, var(--app-safe-area-bottom, 0px)) !important;
  }

  ${MOBILE_PORTALS} {
    position: fixed !important;
    top: var(--app-visible-viewport-top, 0px) !important;
    left: 0 !important;
    right: 0 !important;
    bottom: auto !important;
    width: 100% !important;
    height: var(--app-visible-viewport-height, 100dvh) !important;
    overflow: hidden !important;
    /* Keep RN Web's fixed modal content inside the visible viewport. */
    transform: translateZ(0);
  }

  ${PHONE_OVERLAYS} {
    position: absolute !important;
    width: ${DEVICE_SCREEN.width}px !important;
    height: ${DEVICE_SCREEN.height}px !important;
    max-height: ${DEVICE_SCREEN.maxHeightCss} !important;
    left: 50% !important;
    top: calc(var(--app-visible-viewport-top, 0px) + var(--app-visible-viewport-height, 100vh) / 2) !important;
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
  const { headNodes, bodyNodes, htmlAttributes, bodyAttributes } = useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
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
        {headNodes}
      </head>
      <body {...bodyAttributes}>{children}{bodyNodes}</body>
    </html>
  );
}
