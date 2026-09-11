// Loader shim for the vendored kokoro-js build.
//
// kokoro.web.js is an ES module, so it can't be pulled in with a plain script
// tag — but Metro also can't bundle it (onnxruntime-web's internals use
// dynamic-import syntax the bundler rejects). This file bridges the two: the
// app injects it as <script type="module">, it imports the library from our
// OWN origin, and hands the exports to the app on window.
//
// Doing it this way means no new Function() / eval in the app, so the Content
// Security Policy never has to allow 'unsafe-eval'.
//
// Keep the version in this import in sync with KOKORO_SRC in
// src/lib/neuralVoice.ts.
import * as kokoro from './kokoro-1.2.1.web.js';

window.__kokoroModule = kokoro;
window.dispatchEvent(new Event('__kokoroReady'));
