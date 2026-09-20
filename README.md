# ohmyterm.com

The [oh-my-term](https://github.com/oh-my-term) landing page, served via GitHub Pages.

Static site: no build step, no framework. Bilingual (中文 / English) — language is
detected from the browser and switchable in the nav (persisted in `localStorage`).

## Notable

- The mobile soft keyboard on the hero phone is the **real Soft Keyboard v3
  component** from the product, published in the same minified form it ships to
  users. It runs inside `demo-phone.html` (a same-origin iframe) so the
  component keeps its own viewport and its own memory-backed storage.
  `tools/build_kb.py` re-extracts and minifies it from an omta checkout
  (anchor-based, validates required ids, regenerates `assets/` and re-injects
  the DOM into `demo-phone.html` / `og.html`):

  ```bash
  python3 tools/build_kb.py --omta <path-to-omta-checkout>/web/src --inject
  ```

- `test-kb.html` drives the iframe demo headlessly and asserts the full chain
  (expand-by-default, Esc / Ctrl+C through the pointer shim, buffer handoff,
  storage isolation, i18n bridge): all 15 checks print PASS.
- Fonts are self-hosted latin subsets (IBM Plex Mono, Instrument Serif — both
  OFL, license texts in `fonts/`).
- Deploy: push to `master`, Pages serves from the branch root (`.nojekyll` set).
  Custom domain `ohmyterm.com` via the `CNAME` file.

## License

Site content: Apache-2.0, matching oh-my-term. Product screenshots are CSS-drawn;
the embedded keyboard component is the product's own minified distribution.
