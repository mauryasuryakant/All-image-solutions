# PixelForge — All Image Solutions

A browser-first image workspace built with plain HTML, CSS and JavaScript. The experience is split into three intentionally separate sections:

- **Convert** — change image formats and export with a quality setting.
- **Resolution** — resize images by exact pixel dimensions, optionally keeping the aspect ratio.
- **Studio** — a small editor for brightness, contrast, saturation and rotation.

## Run locally

Open `index.html` in a modern browser. No build step, package manager or backend is required. For the best browser compatibility, serve the directory with any static file server.

## Privacy

Image decoding, canvas processing and exports happen locally in the browser. Images are not sent to an application server.

## Current scope

Browser support determines which formats can be decoded/encoded. JPEG exports do not support transparency. AI upscaling, HEIC decoding and true raster-to-vector tracing are not included in this first pass.
