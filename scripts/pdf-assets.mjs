import { cp, mkdir } from 'node:fs/promises';

export async function preparePdfAssets() {
  const source = new URL('../node_modules/pdfjs-dist/', import.meta.url);
  const target = new URL('../public/pdfjs/', import.meta.url);
  await mkdir(target, { recursive: true });
  await Promise.all(['cmaps', 'standard_fonts', 'wasm', 'iccs', 'LICENSE'].map(name =>
    cp(new URL(name, source), new URL(name, target), { recursive: true }),
  ));
}
