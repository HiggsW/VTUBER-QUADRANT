/* Export the actual card DOM: layout, typography and visibility have one source. */
(() => {
  'use strict';

  async function inlineImage(source, target) {
    if (getComputedStyle(source).display === 'none') { target.removeAttribute('src'); return; }
    if (!source.complete) { try { await source.decode(); } catch {} }
    if (!source.naturalWidth) { target.removeAttribute('src'); return; }
    if (source.currentSrc.startsWith('data:')) { target.src = source.currentSrc; return; }
    const url = new URL(source.currentSrc);
    const bundledId = url.pathname.match(/\/avatars\/([a-z]+-\d+)\.webp$/)?.[1];
    if (url.protocol === 'file:' && bundledId) {
      target.src = await window.loadBundledAvatar(bundledId);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    canvas.getContext('2d').drawImage(source, 0, 0);
    target.src = canvas.toDataURL('image/png');
  }

  window.captureCardPreview = async function(source, outputWidth) {
    await document.fonts.ready;
    const clone = source.cloneNode(true);
    const originals = [source, ...source.querySelectorAll('*')];
    const copies = [clone, ...clone.querySelectorAll('*')];
    const images = [];

    originals.forEach((element, index) => {
      const copy = copies[index];
      const style = getComputedStyle(element);
      for (const property of style) copy.style.setProperty(property, style.getPropertyValue(property));
      // Transient editing cues are not part of the printed card.
      copy.style.caretColor = 'transparent';
      copy.style.outline = 'none';
      copy.removeAttribute('contenteditable');
      copy.removeAttribute('title');
      if (element.matches('[data-remove-tag]')) copy.style.visibility = 'hidden';
      if (element instanceof HTMLImageElement) images.push(inlineImage(element, copy));
      if (element instanceof HTMLTextAreaElement) {
        const text = document.createElement('div');
        text.style.cssText = copy.style.cssText;
        text.style.whiteSpace = 'pre-wrap';
        text.style.overflowWrap = 'anywhere';
        text.textContent = element.value;
        copy.replaceWith(text);
      }
    });
    await Promise.all(images);

    const size = getComputedStyle(source);
    const width = parseFloat(size.width);
    const height = parseFloat(size.height);
    clone.style.width = width + 'px';
    clone.style.height = height + 'px';
    clone.style.margin = '0';
    clone.style.transform = 'none';
    // Keep optical highlights inside the glass edge; omit the surrounding UI shadow.
    clone.style.boxShadow = size.boxShadow.split(/,(?![^(]*\))/).filter(shadow => /\binset\b/.test(shadow)).join(',') || 'none';
    clone.style.position = 'relative';
    const serialized = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
    const image = new Image();
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = Math.round(outputWidth * height / width);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  };
})();
