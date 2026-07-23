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
