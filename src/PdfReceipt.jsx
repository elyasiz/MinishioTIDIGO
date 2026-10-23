import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCw } from 'lucide-react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfReceipt({ blob, description }) {
  const [pdf, setPdf] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(640);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');
  const container = useRef(null), canvas = useRef(null);

  useEffect(() => {
    let active = true, task;
    setLoading(true); setError(''); setPdf(null); setPageNumber(1);
    blob.arrayBuffer().then(data => {
      if (!active) return;
      task = getDocument({
        data: new Uint8Array(data), cMapUrl: '/pdfjs/cmaps/', cMapPacked: true,
        standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/', iccUrl: '/pdfjs/iccs/',
        enableXfa: false,
      });
      return task.promise;
    }).then(document => {
      if (active && document) { setPdf(document); setLoading(false); }
    }).catch(error => {
      if (!active) return;
      setLoading(false);
      setError(error.name === 'PasswordException' ? 'PDF ini dilindungi kata sandi. Buka atau unduh file aslinya untuk melihat bukti.' : 'PDF belum dapat ditampilkan. Anda tetap dapat membuka atau mengunduh file aslinya.');
    });
    return () => { active = false; task?.destroy().catch(() => {}); };
  }, [blob]);

  useEffect(() => {
    const el = container.current;
    const update = () => setWidth(Math.max(200, el.clientWidth - 32));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf) return;
    let active = true, task;
    setRendering(true); setError('');
    pdf.getPage(pageNumber).then(async page => {
      if (!active) return;
      const element = canvas.current;
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width * zoom / original.width });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(12_000_000 / (viewport.width * viewport.height)));
      element.width = Math.ceil(viewport.width * pixelRatio);
      element.height = Math.ceil(viewport.height * pixelRatio);
      element.style.width = viewport.width + 'px';
      element.style.height = viewport.height + 'px';
      task = page.render({ canvas: element, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
      await task.promise;
      if (active) setRendering(false);
    }).catch(error => {
      if (!active || error.name === 'RenderingCancelledException') return;
      setRendering(false); setError('Halaman PDF belum dapat ditampilkan. Coba halaman lain atau unduh file aslinya.');
    });
    return () => { active = false; task?.cancel(); };
  }, [pdf, pageNumber, width, zoom]);

  return <div className="pdf-receipt">
    <div className="pdf-toolbar">
      <div><button className="icon-button" aria-label="Halaman sebelumnya" disabled={!pdf || pageNumber <= 1} onClick={() => setPageNumber(value => value - 1)}><ChevronLeft size={18}/></button><span aria-live="polite">Halaman {pdf ? pageNumber : '-'} / {pdf?.numPages || '-'}</span><button className="icon-button" aria-label="Halaman berikutnya" disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber(value => value + 1)}><ChevronRight size={18}/></button></div>
      <div><button className="icon-button" aria-label="Perkecil PDF" disabled={zoom <= 1} onClick={() => setZoom(value => value - .25)}><Minus size={16}/></button><span>{Math.round(zoom * 100)}%</span><button className="icon-button" aria-label="Perbesar PDF" disabled={zoom >= 2} onClick={() => setZoom(value => value + .25)}><Plus size={16}/></button></div>
    </div>
    <div className="pdf-canvas-container" ref={container} aria-busy={loading || rendering}>
      {(loading || rendering) && <p className="pdf-rendering" role="status"><RotateCw size={16} className="receipt-spinner"/>Memuat halaman PDF…</p>}
      {error && <p className="pdf-render-error" role="alert">{error}</p>}
      <canvas key={`${pageNumber}-${width}-${zoom}`} ref={canvas} role="img" aria-label={`Halaman ${pageNumber} bukti PDF: ${description}`} style={{ display: pdf && !error ? 'block' : 'none' }}/>
    </div>
  </div>;
}
