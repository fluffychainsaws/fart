// Learn more https://docs.expo.dev/router/reference/static-rendering/#root-html
// Extends Expo's default root HTML (see @expo/cli/static/template/+html.tsx)
// to add a web-app manifest and iOS home-screen meta tags, so "Add to Home
// Screen" installs FART as a standalone app instead of a browser tab.

import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  // This is only required for server-side rendering.
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {headNodes}

        {/* SEO + social share previews (Open Graph / Twitter cards) */}
        <meta
          name="description"
          content="Self Tape Buddy — your pocket AI scene partner. It reads every other character's lines out loud while you rehearse your audition sides. Free, no sign-up, works on any phone."
        />
        <link rel="canonical" href="https://selftapebuddy.com/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Self Tape Buddy" />
        <meta property="og:title" content="Self Tape Buddy — your pocket AI scene partner" />
        <meta
          property="og:description"
          content="An AI reader that speaks every other role out loud while you rehearse your audition sides. Free, no sign-up, works on any phone."
        />
        <meta property="og:url" content="https://selftapebuddy.com/" />
        <meta property="og:image" content="https://selftapebuddy.com/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Self Tape Buddy — Friendly AI Reader To-Go!" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Self Tape Buddy — your pocket AI scene partner" />
        <meta
          name="twitter:description"
          content="An AI reader that speaks every other role out loud while you rehearse your audition sides. Free, no sign-up, works on any phone."
        />
        <meta name="twitter:image" content="https://selftapebuddy.com/og-image.png" />

        {/* PWA / "Add to Home Screen" support */}
        <link rel="manifest" href="manifest.json" />
        <meta name="theme-color" content="#0FA47A" />
        <link rel="apple-touch-icon" href="icon-180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FART" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Capture the install prompt as early as possible — Chrome can fire
            beforeinstallprompt before the app mounts. The InstallPrompt
            component reads window.__bipEvent and listens for __bipReady. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bipEvent=e;window.dispatchEvent(new Event('__bipReady'));});" +
              "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}",
          }}
        />
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
