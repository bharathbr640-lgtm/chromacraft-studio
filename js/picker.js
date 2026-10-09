/**
 * ChromaCraft Studio — Color Selection Interface & Direct Input Sync
 * Implements: Eyedropper API, Canvas Color Wheel, Precision Sliders,
 * Real-time Split Swatch, and Bidirectional Input Validation.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'));
  } else {
    root.ColorPicker = factory(root.ColorCore);
  }
})(typeof self !== 'undefined' ? self : this, function (ColorCore) {
  'use strict';

  class ColorPickerComponent {
    constructor(containerEl, store = ColorCore.store) {
      this.container = typeof containerEl === 'string' ? document.querySelector(containerEl) : containerEl;
      this.store = store;
      this.isDraggingWheel = false;

      this._initDOMElements();
      this._setupWheelCanvas();
      this._bindEvents();

      // Subscribe to store updates
      this.store.subscribe((state, source) => this._render(state, source));
    }

    _initDOMElements() {
      // Wheel Canvas
      this.wheelCanvas = this.container.querySelector('#color-wheel-canvas');
      this.wheelCtx = this.wheelCanvas ? this.wheelCanvas.getContext('2d') : null;

      // Eyedropper button
      this.eyedropperBtn = this.container.querySelector('#eyedropper-btn');

      // Swatches & Info
      this.currentSwatch = this.container.querySelector('#current-color-swatch');
      this.previousSwatch = this.container.querySelector('#previous-color-swatch');
      this.headerSwatch = document.querySelector('#selected-color-swatch-badge');
      this.colorNameEl = document.querySelector('#selected-color-name');
      this.hexValueBadge = document.querySelector('#selected-color-hex');

      // Sliders
      this.sliderHue = this.container.querySelector('#slider-hue');
      this.sliderSat = this.container.querySelector('#slider-sat');
      this.sliderLight = this.container.querySelector('#slider-light');
      this.sliderAlpha = this.container.querySelector('#slider-alpha');
      this.sliderRed = this.container.querySelector('#slider-red');
      this.sliderGreen = this.container.querySelector('#slider-green');
      this.sliderBlue = this.container.querySelector('#slider-blue');

      // Numeric Inputs
      this.inputHue = this.container.querySelector('#input-hue');
      this.inputSat = this.container.querySelector('#input-sat');
      this.inputLight = this.container.querySelector('#input-light');
      this.inputAlpha = this.container.querySelector('#input-alpha');
      this.inputRed = this.container.querySelector('#input-red');
      this.inputGreen = this.container.querySelector('#input-green');
      this.inputBlue = this.container.querySelector('#input-blue');
      this.inputHex = this.container.querySelector('#input-hex');

      // Format Copy Elements
      this.formatInputs = {
        hex: this.container.querySelector('#format-hex-val'),
        rgb: this.container.querySelector('#format-rgb-val'),
        rgba: this.container.querySelector('#format-rgba-val'),
        hsl: this.container.querySelector('#format-hsl-val'),
        hsla: this.container.querySelector('#format-hsla-val'),
        cmyk: this.container.querySelector('#format-cmyk-val')
      };
    }

    _setupWheelCanvas() {
      if (!this.wheelCanvas || !this.wheelCtx) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = this.wheelCanvas.getBoundingClientRect();
      const cssSize = rect.width || 240;

      this.wheelCanvas.width = Math.round(cssSize * dpr);
      this.wheelCanvas.height = Math.round(cssSize * dpr);
      this.cssSize = cssSize;
      this.dpr = dpr;

      this.drawWheel();
    }

    drawWheel() {
      if (!this.wheelCtx) return;
      const ctx = this.wheelCtx;
      const physSize = this.wheelCanvas.width;
      const physRadius = physSize / 2;

      ctx.clearRect(0, 0, physSize, physSize);

      // Draw HSL color wheel in physical pixel buffer
      const imgData = ctx.createImageData(physSize, physSize);
      const data = imgData.data;
      const currentLight = this.store.get().hsl.l;

      for (let y = 0; y < physSize; y++) {
        for (let x = 0; x < physSize; x++) {
          const dx = x - physRadius;
          const dy = y - physRadius;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const index = (y * physSize + x) * 4;

          if (dist <= physRadius) {
            let angle = Math.atan2(dy, dx) * (180 / Math.PI);
            if (angle < 0) angle += 360;

            const sat = (dist / physRadius) * 100;
            const rgb = ColorCore.hslToRgb(angle, sat, currentLight);

            // Antialiased edge
            const edgeDelta = physRadius - dist;
            const alpha = edgeDelta < 1.5 ? Math.max(0, Math.min(255, edgeDelta / 1.5 * 255)) : 255;

            data[index] = rgb.r;
            data[index + 1] = rgb.g;
            data[index + 2] = rgb.b;
            data[index + 3] = alpha;
          } else {
            data[index + 3] = 0;
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Draw handle for current active color
      this.drawWheelHandle();
    }

    drawWheelHandle() {
      if (!this.wheelCtx) return;
      const ctx = this.wheelCtx;
      const physSize = this.wheelCanvas.width;
      const physRadius = physSize / 2;
      const dpr = this.dpr || 1;
      const state = this.store.get();

      const angleRad = (state.hsl.h * Math.PI) / 180;
      const distance = (state.hsl.s / 100) * (physRadius - 8 * dpr);

      const hx = physRadius + distance * Math.cos(angleRad);
      const hy = physRadius + distance * Math.sin(angleRad);

      // Outer ring
      ctx.beginPath();
      ctx.arc(hx, hy, 10 * dpr, 0, 2 * Math.PI);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3 * dpr;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 6 * dpr;
      ctx.stroke();

      // Inner color circle
      ctx.beginPath();
      ctx.arc(hx, hy, 7 * dpr, 0, 2 * Math.PI);
      ctx.fillStyle = state.hex;
      ctx.shadowBlur = 0;
      ctx.fill();
    }

    _bindEvents() {
      // 1. Eyedropper API
      if (this.eyedropperBtn) {
        if (!window.EyeDropper) {
          this.eyedropperBtn.setAttribute('title', 'EyeDropper API is supported in Chromium browsers');
        }

        this.eyedropperBtn.addEventListener('click', async () => {
          if (!window.EyeDropper) {
            this._showToast('EyeDropper API requires Chrome, Edge, or Opera.', 'warning');
            return;
          }
          try {
            const eyeDropper = new window.EyeDropper();
            const result = await eyeDropper.open();
            if (result && result.sRGBHex) {
              this.store.setFromHex(result.sRGBHex, 'eyedropper');
              this._showToast(`Sampled: ${result.sRGBHex}`);
            }
          } catch (e) {
            // User canceled eyedropper (press ESC) - silent ignore
          }
        });
      }

      // 2. Color Wheel Canvas Interactions
      if (this.wheelCanvas) {
        const handleWheelPointer = (e) => {
          const rect = this.wheelCanvas.getBoundingClientRect();
          const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
          const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
          const x = clientX - rect.left;
          const y = clientY - rect.top;

          const cssRadius = rect.width / 2;
          const dx = x - cssRadius;
          const dy = y - cssRadius;
          let angle = Math.atan2(dy, dx) * (180 / Math.PI);
          if (angle < 0) angle += 360;

          const dist = Math.min(Math.sqrt(dx * dx + dy * dy), cssRadius);
          const sat = Math.round((dist / cssRadius) * 100);

          const currentL = this.store.get().hsl.l;
          this.store.setFromHsl(Math.round(angle), sat, currentL, this.store.get().a, 'wheel');
        };

        this.wheelCanvas.addEventListener('mousedown', (e) => {
          this.isDraggingWheel = true;
          handleWheelPointer(e);
        });

        window.addEventListener('mousemove', (e) => {
          if (this.isDraggingWheel) {
            handleWheelPointer(e);
          }
        });

        window.addEventListener('mouseup', () => {
          this.isDraggingWheel = false;
        });

        // Touch support
        this.wheelCanvas.addEventListener('touchstart', (e) => {
          this.isDraggingWheel = true;
          handleWheelPointer(e);
          e.preventDefault();
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
          if (this.isDraggingWheel) {
            handleWheelPointer(e);
          }
        }, { passive: false });

        window.addEventListener('touchend', () => {
          this.isDraggingWheel = false;
        });
      }

      // 3. Revert to previous swatch
      if (this.previousSwatch) {
        this.previousSwatch.addEventListener('click', () => {
          const prev = this.store.get().previousHex;
          if (prev) {
            this.store.setFromHex(prev, 'swatch-revert');
            this._showToast(`Reverted to ${prev}`);
          }
        });
      }

      // 4. Sliders and numeric inputs
      const bindPair = (slider, input, onChange) => {
        if (slider) {
          slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (input) input.value = val;
            onChange(val);
          });
        }
        if (input) {
          input.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
              if (slider) slider.value = val;
              onChange(val);
            }
          });
        }
      };

      // HSL
      bindPair(this.sliderHue, this.inputHue, (val) => {
        const s = this.store.get().hsl;
        this.store.setFromHsl(val, s.s, s.l, this.store.get().a, 'slider-hsl');
      });

      bindPair(this.sliderSat, this.inputSat, (val) => {
        const s = this.store.get().hsl;
        this.store.setFromHsl(s.h, val, s.l, this.store.get().a, 'slider-hsl');
      });

      bindPair(this.sliderLight, this.inputLight, (val) => {
        const s = this.store.get().hsl;
        this.store.setFromHsl(s.h, s.s, val, this.store.get().a, 'slider-hsl');
        this.drawWheel(); // redraw wheel gradient based on new lightness
      });

      // Alpha
      bindPair(this.sliderAlpha, this.inputAlpha, (val) => {
        this.store.setAlpha(val / 100, 'slider-alpha');
      });

      // RGB
      bindPair(this.sliderRed, this.inputRed, (val) => {
        const s = this.store.get();
        this.store.setFromRgb(val, s.g, s.b, s.a, 'slider-rgb');
      });

      bindPair(this.sliderGreen, this.inputGreen, (val) => {
        const s = this.store.get();
        this.store.setFromRgb(s.r, val, s.b, s.a, 'slider-rgb');
      });

      bindPair(this.sliderBlue, this.inputBlue, (val) => {
        const s = this.store.get();
        this.store.setFromRgb(s.r, s.g, val, s.a, 'slider-rgb');
      });

      // Direct HEX input
      if (this.inputHex) {
        this.inputHex.addEventListener('input', (e) => {
          let val = e.target.value.trim();
          if (!val.startsWith('#')) val = '#' + val;
          if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(val)) {
            this.store.setFromHex(val, 'input-hex');
            this.inputHex.classList.remove('input-invalid');
          } else {
            this.inputHex.classList.add('input-invalid');
          }
        });
      }

      // Format Copy buttons
      this.container.querySelectorAll('[data-copy-format]').forEach(btn => {
        btn.addEventListener('click', () => {
          const format = btn.getAttribute('data-copy-format');
          const text = this._getFormatString(format);
          this._copyToClipboard(text);
        });
      });
    }

    _getFormatString(format) {
      const state = this.store.get();
      switch (format) {
        case 'hex':
          return state.hex;
        case 'rgb':
          return `rgb(${state.r}, ${state.g}, ${state.b})`;
        case 'rgba':
          return `rgba(${state.r}, ${state.g}, ${state.b}, ${state.a})`;
        case 'hsl':
          return `hsl(${state.hsl.h}, ${state.hsl.s}%, ${state.hsl.l}%)`;
        case 'hsla':
          return `hsla(${state.hsl.h}, ${state.hsl.s}%, ${state.hsl.l}%, ${state.a})`;
        case 'cmyk':
          return `cmyk(${state.cmyk.c}%, ${state.cmyk.m}%, ${state.cmyk.y}%, ${state.cmyk.k}%)`;
        default:
          return state.hex;
      }
    }

    _copyToClipboard(text) {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        this._showToast(`Copied ${text} to clipboard!`);
      }).catch(() => {
        // Fallback for non-https
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        this._showToast(`Copied ${text} to clipboard!`);
      });
    }

    _showToast(msg, type = 'info') {
      const toast = document.getElementById('global-toast');
      if (!toast) return;
      toast.textContent = msg;
      toast.className = `toast toast-visible ${type}`;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        toast.className = 'toast';
      }, 2600);
    }

    _render(state, source) {
      // Swatches
      if (this.currentSwatch) {
        this.currentSwatch.style.backgroundColor = `rgba(${state.r}, ${state.g}, ${state.b}, ${state.a})`;
      }
      if (this.headerSwatch) {
        this.headerSwatch.style.backgroundColor = `rgba(${state.r}, ${state.g}, ${state.b}, ${state.a})`;
      }
      if (this.previousSwatch) {
        this.previousSwatch.style.backgroundColor = state.previousHex;
      }
      if (this.colorNameEl) {
        this.colorNameEl.textContent = state.name;
      }
      if (this.hexValueBadge) {
        this.hexValueBadge.textContent = state.hex;
      }

      // Sync Wheel Handle
      if (source !== 'wheel') {
        this.drawWheel();
      } else {
        // Redraw only handle for ultra-fast 60fps wheel drag
        this.drawWheelHandle();
      }

      // Sync HSL
      if (source !== 'slider-hsl') {
        if (this.sliderHue) this.sliderHue.value = state.hsl.h;
        if (this.inputHue) this.inputHue.value = state.hsl.h;
        if (this.sliderSat) this.sliderSat.value = state.hsl.s;
        if (this.inputSat) this.inputSat.value = state.hsl.s;
        if (this.sliderLight) this.sliderLight.value = state.hsl.l;
        if (this.inputLight) this.inputLight.value = state.hsl.l;
      }

      // Sync Alpha
      if (source !== 'slider-alpha') {
        const pct = Math.round(state.a * 100);
        if (this.sliderAlpha) this.sliderAlpha.value = pct;
        if (this.inputAlpha) this.inputAlpha.value = pct;
      }

      // Sync RGB
      if (source !== 'slider-rgb') {
        if (this.sliderRed) this.sliderRed.value = state.r;
        if (this.inputRed) this.inputRed.value = state.r;
        if (this.sliderGreen) this.sliderGreen.value = state.g;
        if (this.inputGreen) this.inputGreen.value = state.g;
        if (this.sliderBlue) this.sliderBlue.value = state.b;
        if (this.inputBlue) this.inputBlue.value = state.b;
      }

      // Sync HEX Input
      if (source !== 'input-hex' && this.inputHex) {
        this.inputHex.value = state.hex;
        this.inputHex.classList.remove('input-invalid');
      }

      // Format cards
      if (this.formatInputs.hex) this.formatInputs.hex.value = state.hex;
      if (this.formatInputs.rgb) this.formatInputs.rgb.value = `rgb(${state.r}, ${state.g}, ${state.b})`;
      if (this.formatInputs.rgba) this.formatInputs.rgba.value = `rgba(${state.r}, ${state.g}, ${state.b}, ${state.a})`;
      if (this.formatInputs.hsl) this.formatInputs.hsl.value = `hsl(${state.hsl.h}, ${state.hsl.s}%, ${state.hsl.l}%)`;
      if (this.formatInputs.hsla) this.formatInputs.hsla.value = `hsla(${state.hsl.h}, ${state.hsl.s}%, ${state.hsl.l}%, ${state.a})`;
      if (this.formatInputs.cmyk) this.formatInputs.cmyk.value = `cmyk(${state.cmyk.c}%, ${state.cmyk.m}%, ${state.cmyk.y}%, ${state.cmyk.k}%)`;
    }
  }

  return ColorPickerComponent;
});
