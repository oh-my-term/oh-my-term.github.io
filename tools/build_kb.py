#!/usr/bin/env python3
"""Extract the real Soft Keyboard v3 component from an omta checkout and
build minified assets for the landing page.

The keyboard ships to users only in minified form (omta assemble pipeline),
so this page publishes it the same way it ships — no readable source.

Anchor-based extraction (never line numbers): the DOM block runs from the
"Soft Keyboard v3" comment to the "FAB removed" comment in omta's body.html;
the CSS block from the "Soft Keyboard v3" comment to "#loginView" in
styles.css. Both are validated against the ids the component requires.

Usage:
  python3 tools/build_kb.py --omta <path-to-omta-checkout>/web/src
  python3 tools/build_kb.py --omta ... --inject   # also re-inject DOM fragments
"""
import argparse, json, os, pathlib, re, shutil, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_ESBUILD = pathlib.Path.home() / 'tmp/esbuild-bin/node_modules/.bin/esbuild'

REQUIRED_IDS = ['softKeyboard', 'kbCollapsed', 'kbFull', 'qwertyLayer', 'symbolLayer',
                'keyPopup', 'keyHint', 'flickBadge', 'layoutMenu', 'kbSettingsPanel',
                'snippetPanel']


def find_esbuild():
    env = os.environ.get('ESBUILD')
    if env:
        return pathlib.Path(env)
    which = shutil.which('esbuild')
    if which:
        return pathlib.Path(which)
    if DEFAULT_ESBUILD.exists():
        return DEFAULT_ESBUILD
    sys.exit('esbuild not found: set $ESBUILD, put esbuild on PATH, or npm i -g esbuild')


def run_esbuild(code, loader):
    r = subprocess.run([str(find_esbuild()), f'--loader={loader}', '--minify'],
                       input=code, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f'esbuild failed:\n{r.stderr}')
    return r.stdout


def slice_between(text, start_marker, end_marker, what):
    i = text.find(start_marker)
    j = text.find(end_marker, i)
    if i < 0 or j < 0:
        sys.exit(f'anchor not found for {what}: {start_marker!r} .. {end_marker!r}')
    return text[i:j]


def extract_i18n(i18n_src):
    pat = re.compile(
        r"^\s*([A-Za-z0-9_]+):\s*\{\s*en:\s*('(?:[^'\\]|\\.)*')\s*,\s*zh:\s*('(?:[^'\\]|\\.)*')\s*,?\s*\}",
        re.M)
    out = {}
    for m in pat.finditer(i18n_src):
        key, en, zh = m.groups()
        if re.match(r'(softkey_|snippets_|snippet_|sym_|kb_layout|paste_)', key):
            def unq(lit):
                return json.loads(lit if lit.startswith('"') else lit.replace("'", '"'))
            out[key] = {'en': unq(en), 'zh': unq(zh)}
    return out


def inject_markers(path, dom):
    """Replace the text between <!--KB:START--> and <!--KB:END--> with dom."""
    text = path.read_text()
    m = re.search(r'<!--KB:START-->\n(.*?)\n?<!--KB:END-->', text, re.S)
    if not m:
        sys.exit(f'{path.name}: KB:START/END markers missing')
    text = text[:m.start()] + '<!--KB:START-->\n' + dom + '\n<!--KB:END-->' + text[m.end():]
    path.write_text(text)
    print(f'  reinjected {path.name}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--omta', required=True, help='path to omta web/src')
    ap.add_argument('--inject', action='store_true',
                    help='re-inject the DOM fragment into demo-phone.html and og.html')
    args = ap.parse_args()
    src = pathlib.Path(args.omta).expanduser()

    # --- DOM fragment ---
    body = (src / 'body.html').read_text()
    dom = slice_between(body, '<!-- Soft Keyboard v3', '<!-- FAB removed', 'kb DOM')
    dom = dom[:dom.rstrip().rfind('</div>') + len('</div>')]  # drop trailing blank lines
    # published artifacts stay minified/clean: drop internal comments entirely
    dom = re.sub(r'[ \t]*<!--.*?-->[ \t]*\n?', '', dom, flags=re.S)
    dom = re.sub(r'\n{3,}', '\n\n', dom)
    for rid in REQUIRED_IDS:
        if f'id="{rid}"' not in dom:
            sys.exit(f'extracted DOM is missing id="{rid}" — anchors drifted, aborting')
    (HERE / 'partials').mkdir(exist_ok=True)
    (HERE / 'partials/kb.dom.html').write_text(dom + '\n')
    (HERE / 'partials/kb.dom.js').write_text(
        'document.write(' + json.dumps(dom) + ');\n')
    print(f'partials/kb.dom.html: {len(dom)} bytes')

    # --- CSS ---
    styles = (src / 'styles.css').read_text()
    css = slice_between(styles, '/* Soft Keyboard v3 */', '#loginView {', 'kb CSS')
    if '#softKeyboard' not in css or '#keyPopup' not in css:
        sys.exit('extracted CSS looks wrong — anchors drifted, aborting')
    css_min = run_esbuild(css, loader='css')
    (HERE / 'assets/kb.css').write_text(css_min)
    print(f'assets/kb.css: {len(css_min)} bytes')

    # --- JS ---
    js = (src / 'js/soft_keyboard.js').read_text()
    js = js.replace('export class SoftKeyboard', 'class SoftKeyboard', 1)
    cfg = (src / 'kb-config.json').read_text().strip()
    json.loads(cfg)
    js = f'const KB_CONFIG = {cfg};\n' + js + '\nwindow.SoftKeyboard = SoftKeyboard;\n'
    js_min = run_esbuild(js, loader='js')
    (HERE / 'assets/kb.js').write_text(js_min)
    print(f'assets/kb.js: {len(js_min)} bytes')

    # --- i18n bridge data ---
    i18n = extract_i18n((src / 'js/i18n.js').read_text())
    js_i18n = 'window.OMT_KB_I18N = ' + json.dumps(i18n, ensure_ascii=False, separators=(',', ':')) + ';\n'
    (HERE / 'assets/kb-i18n.js').write_text(js_i18n)
    print(f'assets/kb-i18n.js: {len(js_i18n)} bytes ({len(i18n)} keys)')

    # --- reinjection ---
    if args.inject:
        for name in ('demo-phone.html', 'og.html'):
            inject_markers(HERE / name, dom)


if __name__ == '__main__':
    main()
