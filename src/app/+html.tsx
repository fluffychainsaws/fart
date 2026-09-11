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
          Content Security Policy. GitHub Pages can't send response headers, so
          this ships in the document instead. It matters here because the
          Supabase session token lives in localStorage, where any injected
          script could read it — this policy is what stops one from running.

          script-src allows NO inline code except the two hashes below; anything
          injected into the page is refused. If you edit the inline script in
          this file, its hash changes and it will stop executing — rebuild and
          update the hash (see supabase/README.md, "Content Security Policy").
            1st hash: the install-prompt + frame-guard script at the bottom.
            2nd hash: Expo Router's one-line hydration flag.

          The jsdelivr / HuggingFace entries are for the optional neural voice
          engine, which fetches its ONNX runtime and model weights on first use.
          Everything else is same-origin.

          Two limits worth knowing: a policy delivered by meta tag cannot use
          frame-ancestors (hence the frame guard in script) and cannot be run in
          report-only mode. Moving these to real headers via a proxy in front of
          Pages would fix both and add HSTS.
        */}
        <meta
          httpEquiv="Content-Security-Policy"
          content={[
            "default-src 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "form-action 'self'",
            "script-src 'self' 'wasm-unsafe-eval' 'sha256-9HBDvcmYS37mNhwxZM/Vxu6qE3pRrxAzG8UTjDc14tE=' 'sha256-67fhrP0+BkBqmgGGXTtgiVO/9EQs3QruYNU/7fnRkI8=' https://cdn.jsdelivr.net",
            // react-native-web injects component styles as inline <style> at
            // runtime, so style hashing isn't possible here.
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "media-src 'self' data: blob:",
            "worker-src 'self' blob:",
            "connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://*.hf.co",
          ].join('; ')}
        />

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
            component reads window.__bipEvent and listens for __bipReady.

            Also carries the frame guard: a meta-tag CSP can't use
            frame-ancestors, so this is what stops the app being framed for
            clickjacking. Blanking the document first means the content isn't
            clickable even when the escape is blocked cross-origin.

            EDITING THIS SCRIPT CHANGES ITS HASH — update the matching
            'sha256-...' in the Content-Security-Policy above or it won't run. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(window.top!==window.self){document.documentElement.style.display='none';window.top.location=window.self.location;}}catch(e){document.documentElement.style.display='none';}" +
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
