/**
 * ChromaCraft Studio — Code Export & File Generation System
 * Generates copy-ready CSS, SCSS, SVG, W3C Design Token JSON,
 * and binary Adobe Swatch Exchange (.ASE) files for Figma and Adobe workflows.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'));
  } else {
    root.ColorExport = factory(root.ColorCore);
  }
})(typeof self !== 'undefined' ? self : this, function (ColorCore) {
  'use strict';

  class ExportComponent {
    constructor(containerEl, store = ColorCore.store, paletteComponent = null) {
      this.container = typeof containerEl === 'string' ? document.querySelector(containerEl) : containerEl;
      this.store = store;
      this.paletteComponent = paletteComponent;

      this.currentExportFormat = 'css';

      this._initDOMElements();
      this._bindEvents();

      this.store.subscribe(() => {
        this.render();
      });
    }

    _initDOMElements() {
      this.formatTabs = this.container.querySelectorAll('.export-tab-btn');
      this.codeOutput = this.container.querySelector('#export-code-output');
      this.copyCodeBtn = this.container.querySelector('#export-copy-btn');
      this.downloadBtn = this.container.querySelector('#export-download-btn');
      this.downloadAseBtn = this.container.querySelector('#download-ase-btn');
      this.downloadSvgBtn = this.container.querySelector('#download-svg-btn');
    }

    _bindEvents() {
      // Tab switching
      this.formatTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          this.formatTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          this.currentExportFormat = tab.getAttribute('data-format');
          this.render();
        });
      });

      // Copy Code
      if (this.copyCodeBtn) {
        this.copyCodeBtn.addEventListener('click', () => {
          const code = this.generateCode(this.currentExportFormat);
          navigator.clipboard.writeText(code).then(() => {
            this._showToast('Export code copied to clipboard!');
          });
        });
      }

      // Download Active Format
      if (this.downloadBtn) {
        this.downloadBtn.addEventListener('click', () => {
          this.downloadFile(this.currentExportFormat);
        });
      }

      // Quick ASE Download
      if (this.downloadAseBtn) {
        this.downloadAseBtn.addEventListener('click', () => {
          this.downloadAse();
        });
      }

      // Quick SVG Download
      if (this.downloadSvgBtn) {
        this.downloadSvgBtn.addEventListener('click', () => {
          this.downloadSvg();
        });
      }
    }

    getPaletteList() {
      // Get current harmony palette or default to store color
      if (this.paletteComponent && typeof this.paletteComponent.generateHarmonies === 'function') {
        return this.paletteComponent.generateHarmonies(this.store.get().hsl);
      }
      const s = this.store.get();
      return [{
        name: s.name,
        hex: s.hex,
        rgb: { r: s.r, g: s.g, b: s.b },
        role: 'Primary'
      }];
    }

    generateCode(format) {
      const palette = this.getPaletteList();
      const s = this.store.get();

      switch (format) {
        case 'css':
          return this._generateCss(palette, s);
        case 'scss':
          return this._generateScss(palette, s);
        case 'tailwind':
          return this._generateTailwind(palette, s);
        case 'tokens':
          return this._generateW3cTokens(palette, s);
        default:
          return this._generateCss(palette, s);
      }
    }

    _generateCss(palette, activeState) {
      let css = `:root {\n  /* ChromaCraft Design System Tokens */\n`;
      css += `  --color-primary: ${activeState.hex};\n`;
      css += `  --color-primary-rgb: ${activeState.r}, ${activeState.g}, ${activeState.b};\n`;
      css += `  --color-primary-hsl: ${activeState.hsl.h}, ${activeState.hsl.s}%, ${activeState.hsl.l}%;\n\n`;

      css += `  /* Active Harmony Palette */\n`;
      palette.forEach((item, index) => {
        const tokenName = item.role.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        css += `  --color-harmony-${tokenName}: ${item.hex};\n`;
      });
      css += `}\n`;
      return css;
    }

    _generateScss(palette, activeState) {
      let scss = `// ChromaCraft Design System Tokens\n`;
      scss += `$color-primary: ${activeState.hex};\n`;
      scss += `$color-primary-rgb: (${activeState.r}, ${activeState.g}, ${activeState.b});\n\n`;

      scss += `$theme-harmony-palette: (\n`;
      palette.forEach((item) => {
        const tokenName = item.role.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        scss += `  "${tokenName}": ${item.hex},\n`;
      });
      scss += `);\n`;
      return scss;
    }

    _generateTailwind(palette, activeState) {
      const paletteObj = {
        primary: activeState.hex
      };
      palette.forEach((item) => {
        const key = item.role.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        paletteObj[key] = item.hex;
      });

      return `// tailwind.config.js snippet\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: ${JSON.stringify({ chroma: paletteObj }, null, 6)}\n    }\n  }\n};`;
    }

    _generateW3cTokens(palette, activeState) {
      const tokens = {
        color: {
          primary: {
            $value: activeState.hex,
            $type: 'color',
            $description: activeState.name
          }
        }
      };

      palette.forEach((item) => {
        const key = item.role.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        tokens.color[key] = {
          $value: item.hex,
          $type: 'color',
          $description: item.name
        };
      });

      return JSON.stringify(tokens, null, 2);
    }

    render() {
      if (this.codeOutput) {
        this.codeOutput.textContent = this.generateCode(this.currentExportFormat);
      }
    }

    downloadFile(format) {
      let content = this.generateCode(format);
      let filename = `chromacraft-tokens.${format === 'tokens' ? 'json' : format === 'tailwind' ? 'js' : format}`;
      let mimeType = 'text/plain';

      if (format === 'tokens') mimeType = 'application/json';
      if (format === 'css') mimeType = 'text/css';

      this._triggerBlobDownload(new Blob([content], { type: mimeType }), filename);
    }

    /**
     * Adobe Swatch Exchange (.ASE) Binary Serializer
     * Conforms to official Adobe ASE 1.0 binary specification
     */
    generateAseBlob(palette = this.getPaletteList()) {
      // Calculate buffer size
      // Header: 'ASEF' (4 bytes) + version (4 bytes: major 1, minor 0) + block count (4 bytes) = 12 bytes
      // Each block:
      // Block type: 2 bytes (0x0001)
      // Block length: 4 bytes
      // Name length in UTF-16 code units (including \0): 2 bytes
      // Name bytes: (name.length + 1) * 2 bytes
      // Color model: 4 bytes ("RGB ")
      // Values: 3 x Float32 (12 bytes)
      // Color type: 2 bytes (0 = Global)

      let totalSize = 12;
      const blockMetadata = [];

      palette.forEach(color => {
        const name = (color.name || color.hex).replace(/[^\x20-\x7E]/g, '');
        const nameUnits = name.length + 1; // with null terminator
        const blockLen = 2 + (nameUnits * 2) + 4 + 12 + 2;
        totalSize += 2 + 4 + blockLen;
        blockMetadata.push({ name, nameUnits, blockLen, color });
      });

      const buffer = new ArrayBuffer(totalSize);
      const view = new DataView(buffer);
      let offset = 0;

      // 1. Signature 'ASEF'
      view.setUint8(offset++, 0x41);
      view.setUint8(offset++, 0x53);
      view.setUint8(offset++, 0x45);
      view.setUint8(offset++, 0x46);

      // 2. Version 1.0 (major = 1, minor = 0)
      view.setUint16(offset, 1, false); offset += 2;
      view.setUint16(offset, 0, false); offset += 2;

      // 3. Block count
      view.setUint32(offset, palette.length, false); offset += 4;

      // 4. Color Entry Blocks
      blockMetadata.forEach(meta => {
        // Block type: 0x0001 (Color entry)
        view.setUint16(offset, 0x0001, false); offset += 2;

        // Block byte length
        view.setUint32(offset, meta.blockLen, false); offset += 4;

        // Name length (in UTF-16 chars, including null)
        view.setUint16(offset, meta.nameUnits, false); offset += 2;

        // Name characters in UTF-16BE
        for (let i = 0; i < meta.name.length; i++) {
          view.setUint16(offset, meta.name.charCodeAt(i), false);
          offset += 2;
        }
        // Null terminator
        view.setUint16(offset, 0x0000, false);
        offset += 2;

        // Color model: "RGB " (ASCII: 0x52, 0x47, 0x42, 0x20)
        view.setUint8(offset++, 0x52);
        view.setUint8(offset++, 0x47);
        view.setUint8(offset++, 0x42);
        view.setUint8(offset++, 0x20);

        // Normalized RGB floats (0.0 to 1.0)
        const rgb = meta.color.rgb || ColorCore.hexToRgba(meta.color.hex);
        view.setFloat32(offset, rgb.r / 255, false); offset += 4;
        view.setFloat32(offset, rgb.g / 255, false); offset += 4;
        view.setFloat32(offset, rgb.b / 255, false); offset += 4;

        // Color type: 0 (Global swatch)
        view.setUint16(offset, 0, false); offset += 2;
      });

      return new Blob([buffer], { type: 'application/octet-stream' });
    }

    downloadAse() {
      const blob = this.generateAseBlob();
      this._triggerBlobDownload(blob, 'chromacraft-palette.ase');
      this._showToast('Adobe Swatch Exchange (.ASE) file generated!');
    }

    /**
     * Export vector SVG color swatch palette
     */
    generateSvgString(palette = this.getPaletteList()) {
      const cardWidth = 140;
      const cardHeight = 160;
      const gap = 16;
      const totalWidth = palette.length * cardWidth + (palette.length - 1) * gap + 40;
      const totalHeight = cardHeight + 40;

      let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">\n`;
      svg += `  <style>\n`;
      svg += `    .swatch-bg { rx: 12px; stroke: rgba(255,255,255,0.1); stroke-width: 1px; }\n`;
      svg += `    .text-title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; font-weight: 600; fill: #FFFFFF; }\n`;
      svg += `    .text-hex { font-family: monospace; font-size: 11px; fill: #94A3B8; }\n`;
      svg += `  </style>\n`;
      svg += `  <rect width="100%" height="100%" fill="#0F172A" rx="16"/>\n`;

      palette.forEach((item, i) => {
        const x = 20 + i * (cardWidth + gap);
        const y = 20;
        svg += `  <g transform="translate(${x}, ${y})">\n`;
        svg += `    <rect class="swatch-bg" width="${cardWidth}" height="100" fill="${item.hex}"/>\n`;
        svg += `    <text x="8" y="124" class="text-title">${item.role || 'Color'}</text>\n`;
        svg += `    <text x="8" y="142" class="text-hex">${item.hex}</text>\n`;
        svg += `  </g>\n`;
      });

      svg += `</svg>`;
      return svg;
    }

    downloadSvg() {
      const svg = this.generateSvgString();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      this._triggerBlobDownload(blob, 'chromacraft-swatches.svg');
      this._showToast('Vector SVG palette downloaded!');
    }

    _triggerBlobDownload(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    _showToast(msg) {
      const toast = document.getElementById('global-toast');
      if (!toast) return;
      toast.textContent = msg;
      toast.className = 'toast toast-visible';
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        toast.className = 'toast';
      }, 2400);
    }
  }

  return ExportComponent;
});
