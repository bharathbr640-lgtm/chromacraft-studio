/**
 * ChromaCraft Studio — Palette Generator & Harmony Visualization
 * Implements: Harmony algorithms (Complementary, Analogous, Triadic, Tetradic,
 * Split-Complementary, Monochromatic), visual geometric harmony canvas, and swatch cards.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'));
  } else {
    root.ColorPalette = factory(root.ColorCore);
  }
})(typeof self !== 'undefined' ? self : this, function (ColorCore) {
  'use strict';

  class PaletteGeneratorComponent {
    constructor(containerEl, store = ColorCore.store) {
      this.container = typeof containerEl === 'string' ? document.querySelector(containerEl) : containerEl;
      this.store = store;

      this.currentHarmony = 'complementary';
      this.spreadAngle = 30; // degrees for analogous/tetradic/split

      this._initDOMElements();
      this._setupHarmonyCanvas();
      this._bindEvents();

      this.store.subscribe((state) => {
        this.renderHarmony(state);
      });
    }

    _initDOMElements() {
      this.harmonySelect = this.container.querySelector('#harmony-type-select');
      this.spreadSlider = this.container.querySelector('#harmony-spread-slider');
      this.spreadValBadge = this.container.querySelector('#harmony-spread-val');
      this.canvas = this.container.querySelector('#harmony-visualizer-canvas');
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.paletteGrid = this.container.querySelector('#harmony-swatches-grid');
    }

    _setupHarmonyCanvas() {
      if (!this.canvas || !this.ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      const size = rect.width || 220;

      this.canvas.width = Math.round(size * dpr);
      this.canvas.height = Math.round(size * dpr);
      this.dpr = dpr;
      this.canvasSize = size;
      this.radius = size / 2;
    }

    _bindEvents() {
      if (this.harmonySelect) {
        this.harmonySelect.addEventListener('change', (e) => {
          this.currentHarmony = e.target.value;
          this.renderHarmony(this.store.get());
        });
      }

      if (this.spreadSlider) {
        this.spreadSlider.addEventListener('input', (e) => {
          this.spreadAngle = parseInt(e.target.value, 10);
          if (this.spreadValBadge) {
            this.spreadValBadge.textContent = `${this.spreadAngle}°`;
          }
          this.renderHarmony(this.store.get());
        });
      }

      // Swatch clicks (delegated)
      if (this.paletteGrid) {
        this.paletteGrid.addEventListener('click', (e) => {
          const card = e.target.closest('.palette-card');
          if (!card) return;

          const hex = card.getAttribute('data-hex');
          if (e.target.closest('.card-copy-btn')) {
            navigator.clipboard.writeText(hex).then(() => {
              this._showToast(`Copied ${hex} to clipboard!`);
            });
          } else if (e.target.closest('.card-apply-btn')) {
            this.store.setFromHex(hex, 'palette-select');
            this._showToast(`Selected ${hex} as primary`);
          }
        });
      }
    }

    /**
     * Generate harmony color set based on current base HSL
     */
    generateHarmonies(baseHsl) {
      const h = baseHsl.h;
      const s = baseHsl.s;
      const l = baseHsl.l;
      const spread = this.spreadAngle;

      const wrapHue = (deg) => ((deg % 360) + 360) % 360;

      let hues = [];

      switch (this.currentHarmony) {
        case 'complementary':
          hues = [
            { h: h, role: 'Base' },
            { h: wrapHue(h + 180), role: 'Complement' }
          ];
          break;

        case 'analogous':
          hues = [
            { h: wrapHue(h - spread), role: 'Analogous -' },
            { h: h, role: 'Base' },
            { h: wrapHue(h + spread), role: 'Analogous +' }
          ];
          break;

        case 'triadic':
          hues = [
            { h: h, role: 'Base' },
            { h: wrapHue(h + 120), role: 'Triad 1' },
            { h: wrapHue(h + 240), role: 'Triad 2' }
          ];
          break;

        case 'tetradic':
          hues = [
            { h: h, role: 'Base' },
            { h: wrapHue(h + spread), role: 'Accent 1' },
            { h: wrapHue(h + 180), role: 'Complement' },
            { h: wrapHue(h + 180 + spread), role: 'Accent 2' }
          ];
          break;

        case 'split-complementary':
          hues = [
            { h: h, role: 'Base' },
            { h: wrapHue(h + 180 - spread), role: 'Split 1' },
            { h: wrapHue(h + 180 + spread), role: 'Split 2' }
          ];
          break;

        case 'monochromatic':
          // Same hue, varying lightness & saturation scales
          return [
            { h, s: Math.max(s - 30, 15), l: Math.min(l + 35, 92), role: 'Tint High' },
            { h, s: Math.max(s - 15, 20), l: Math.min(l + 18, 78), role: 'Tint Soft' },
            { h, s, l, role: 'Base' },
            { h, s: Math.min(s + 10, 100), l: Math.max(l - 18, 22), role: 'Shade Deep' },
            { h, s: Math.min(s + 20, 100), l: Math.max(l - 35, 10), role: 'Shade Dark' }
          ].map(item => this._formatPaletteEntry(item.h, item.s, item.l, item.role));

        default:
          hues = [{ h, role: 'Base' }];
      }

      return hues.map(item => this._formatPaletteEntry(item.h, s, l, item.role));
    }

    _formatPaletteEntry(h, s, l, role) {
      const rgb = ColorCore.hslToRgb(h, s, l);
      const hex = ColorCore.rgbaToHex(rgb.r, rgb.g, rgb.b);
      const name = ColorCore.getPerceptualColorName(rgb.r, rgb.g, rgb.b);
      const contrastOnWhite = ColorCore.getContrastRatio(rgb, { r: 255, g: 255, b: 255 });
      const contrastOnBlack = ColorCore.getContrastRatio(rgb, { r: 0, g: 0, b: 0 });

      return {
        h, s, l,
        rgb,
        hex,
        name,
        role,
        contrastOnWhite,
        contrastOnBlack,
        badgeBg: contrastOnWhite > contrastOnBlack ? '#FFFFFF' : '#000000',
        badgeText: contrastOnWhite > contrastOnBlack ? '#000000' : '#FFFFFF'
      };
    }

    renderHarmony(state) {
      this._setupHarmonyCanvas();
      const palette = this.generateHarmonies(state.hsl);
      this.drawHarmonyWheel(palette, state.hsl.h);
      this.renderPaletteCards(palette);
    }

    /**
     * Draw geometric diagram on canvas linking the harmony angles
     */
    drawHarmonyWheel(palette, baseHue) {
      if (!this.ctx || !this.canvas) return;
      const ctx = this.ctx;
      const dpr = this.dpr || 1;
      const size = this.canvasSize;
      const r = this.radius;
      const innerR = r - 26;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // Background wheel ring
      ctx.lineWidth = 14;
      for (let i = 0; i < 360; i += 2) {
        ctx.beginPath();
        const startAngle = ((i - 90) * Math.PI) / 180;
        const endAngle = ((i + 3 - 90) * Math.PI) / 180;
        ctx.arc(r, r, innerR, startAngle, endAngle);
        ctx.strokeStyle = `hsl(${i}, 75%, 50%)`;
        ctx.stroke();
      }

      // Draw connecting geometric polygon
      const points = palette.map(color => {
        const rad = ((color.h - 90) * Math.PI) / 180;
        return {
          x: r + innerR * Math.cos(rad),
          y: r + innerR * Math.sin(rad),
          color: color.hex,
          isBase: color.h === baseHue
        };
      });

      if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fill();
      }

      // Draw node pins
      points.forEach(p => {
        // Line to center
        ctx.beginPath();
        ctx.moveTo(r, r);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Pin circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.isBase ? 9 : 6.5, 0, 2 * Math.PI);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.strokeStyle = p.isBase ? '#FFFFFF' : 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = p.isBase ? 2.5 : 1.5;
        ctx.stroke();
      });

      // Center hub
      ctx.beginPath();
      ctx.arc(r, r, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.restore();
    }

    renderPaletteCards(palette) {
      if (!this.paletteGrid) return;
      this.paletteGrid.innerHTML = '';

      palette.forEach(color => {
        const card = document.createElement('div');
        card.className = 'palette-card';
        card.setAttribute('data-hex', color.hex);

        card.innerHTML = `
          <div class="palette-swatch-box" style="background-color: ${color.hex};">
            <span class="palette-role-badge" style="background: ${color.badgeBg}; color: ${color.badgeText};">
              ${color.role}
            </span>
          </div>
          <div class="palette-card-body">
            <div class="palette-card-title">${color.name}</div>
            <div class="palette-card-hex">${color.hex}</div>
            <div class="palette-card-meta">
              <span>H: ${color.h}°</span>
              <span>S: ${color.s}%</span>
              <span>L: ${color.l}%</span>
            </div>
            <div class="palette-card-actions">
              <button type="button" class="btn btn-xs card-copy-btn" title="Copy HEX">Copy</button>
              <button type="button" class="btn btn-xs btn-primary card-apply-btn" title="Set as Active">Apply</button>
            </div>
          </div>
        `;

        this.paletteGrid.appendChild(card);
      });
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

  return PaletteGeneratorComponent;
});
