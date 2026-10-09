/**
 * ChromaCraft Studio — Gradient Generator & Visual Stop Editor
 * Supports Linear, Radial, and Conic gradients with multi-stop interactive timeline,
 * angle dials, CSS code generation, and professional presets.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'));
  } else {
    root.ColorGradient = factory(root.ColorCore);
  }
})(typeof self !== 'undefined' ? self : this, function (ColorCore) {
  'use strict';

  class GradientGeneratorComponent {
    constructor(containerEl, store = ColorCore.store) {
      this.container = typeof containerEl === 'string' ? document.querySelector(containerEl) : containerEl;
      this.store = store;

      this.gradientType = 'linear';
      this.angle = 90;
      this.radialShape = 'circle';
      this.activeStopIndex = 0;

      this.stops = [
        { color: '#3B82F6', position: 0 },
        { color: '#8B5CF6', position: 50 },
        { color: '#EC4899', position: 100 }
      ];

      this._initDOMElements();
      this._bindEvents();
      this.render();
    }

    _initDOMElements() {
      this.previewBox = this.container.querySelector('#gradient-preview-box');
      this.track = this.container.querySelector('#gradient-stop-track');
      this.typeRadios = this.container.querySelectorAll('input[name="gradient-type"]');
      this.angleSlider = this.container.querySelector('#gradient-angle-slider');
      this.angleInput = this.container.querySelector('#gradient-angle-input');
      this.angleControlGroup = this.container.querySelector('#gradient-angle-group');
      this.cssOutput = this.container.querySelector('#gradient-css-code');
      this.copyBtn = this.container.querySelector('#gradient-copy-css');

      this.stopColorInput = this.container.querySelector('#stop-color-input');
      this.stopPosSlider = this.container.querySelector('#stop-pos-slider');
      this.stopPosInput = this.container.querySelector('#stop-pos-input');
      this.useCurrentColorBtn = this.container.querySelector('#stop-use-current-btn');
      this.deleteStopBtn = this.container.querySelector('#stop-delete-btn');
      this.presetContainer = this.container.querySelector('#gradient-presets-container');
    }

    _bindEvents() {
      // Type switcher
      this.typeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.gradientType = e.target.value;
          if (this.angleControlGroup) {
            this.angleControlGroup.style.display = this.gradientType === 'radial' ? 'none' : 'flex';
          }
          this.render();
        });
      });

      // Angle controls
      if (this.angleSlider) {
        this.angleSlider.addEventListener('input', (e) => {
          this.angle = parseInt(e.target.value, 10);
          if (this.angleInput) this.angleInput.value = this.angle;
          this.render();
        });
      }

      if (this.angleInput) {
        this.angleInput.addEventListener('input', (e) => {
          let val = parseInt(e.target.value, 10) || 0;
          val = ((val % 360) + 360) % 360;
          this.angle = val;
          if (this.angleSlider) this.angleSlider.value = val;
          this.render();
        });
      }

      // Track click to add stop
      if (this.track) {
        this.track.addEventListener('click', (e) => {
          if (e.target.closest('.gradient-stop-handle')) return;
          const rect = this.track.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const pos = ColorCore.clamp(Math.round((clickX / rect.width) * 100), 0, 100);

          // Sample color from current store or interpolate
          const newColor = this.store.get().hex;
          this.stops.push({ color: newColor, position: pos });
          this.stops.sort((a, b) => a.position - b.position);
          this.activeStopIndex = this.stops.findIndex(s => s.position === pos);
          this.render();
        });
      }

      // Stop color input
      if (this.stopColorInput) {
        this.stopColorInput.addEventListener('input', (e) => {
          if (this.stops[this.activeStopIndex]) {
            this.stops[this.activeStopIndex].color = e.target.value;
            this.render();
          }
        });
      }

      // Stop position controls
      if (this.stopPosSlider) {
        this.stopPosSlider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          if (this.stopPosInput) this.stopPosInput.value = val;
          this._updateActiveStopPosition(val);
        });
      }

      if (this.stopPosInput) {
        this.stopPosInput.addEventListener('input', (e) => {
          const val = ColorCore.clamp(parseInt(e.target.value, 10) || 0, 0, 100);
          if (this.stopPosSlider) this.stopPosSlider.value = val;
          this._updateActiveStopPosition(val);
        });
      }

      // Use active palette color
      if (this.useCurrentColorBtn) {
        this.useCurrentColorBtn.addEventListener('click', () => {
          if (this.stops[this.activeStopIndex]) {
            this.stops[this.activeStopIndex].color = this.store.get().hex;
            this.render();
          }
        });
      }

      // Delete stop
      if (this.deleteStopBtn) {
        this.deleteStopBtn.addEventListener('click', () => {
          if (this.stops.length <= 2) {
            this._showToast('Gradients require at least 2 color stops.', 'warning');
            return;
          }
          this.stops.splice(this.activeStopIndex, 1);
          this.activeStopIndex = Math.max(0, this.activeStopIndex - 1);
          this.render();
        });
      }

      // Copy CSS
      if (this.copyBtn) {
        this.copyBtn.addEventListener('click', () => {
          const css = this.generateCssString();
          navigator.clipboard.writeText(css).then(() => {
            this._showToast('Gradient CSS copied to clipboard!');
          });
        });
      }

      // Presets click
      if (this.presetContainer) {
        this.presetContainer.addEventListener('click', (e) => {
          const presetBtn = e.target.closest('[data-preset]');
          if (!presetBtn) return;
          const presetName = presetBtn.getAttribute('data-preset');
          this.loadPreset(presetName);
        });
      }
    }

    _updateActiveStopPosition(pos) {
      if (this.stops[this.activeStopIndex]) {
        this.stops[this.activeStopIndex].position = pos;
        this.stops.sort((a, b) => a.position - b.position);
        this.activeStopIndex = this.stops.findIndex(s => s.position === pos);
        this.render();
      }
    }

    generateCssString() {
      const stopList = this.stops
        .map(s => `${s.color} ${s.position}%`)
        .join(', ');

      switch (this.gradientType) {
        case 'linear':
          return `background: linear-gradient(${this.angle}deg, ${stopList});`;
        case 'radial':
          return `background: radial-gradient(circle at center, ${stopList});`;
        case 'conic':
          return `background: conic-gradient(from ${this.angle}deg at 50% 50%, ${stopList});`;
        default:
          return `background: linear-gradient(90deg, ${stopList});`;
      }
    }

    render() {
      const css = this.generateCssString();
      const rawGradient = css.replace(/^background:\s*/, '').replace(/;$/, '');

      // Update Preview
      if (this.previewBox) {
        this.previewBox.style.background = rawGradient;
      }

      // Update Track background (horizontal linear representation)
      if (this.track) {
        const trackStops = this.stops.map(s => `${s.color} ${s.position}%`).join(', ');
        this.track.style.background = `linear-gradient(to right, ${trackStops})`;
        this._renderStopHandles();
      }

      // Update CSS code display
      if (this.cssOutput) {
        this.cssOutput.textContent = css;
      }

      // Update Active Stop Controls
      const currentStop = this.stops[this.activeStopIndex];
      if (currentStop) {
        if (this.stopColorInput) this.stopColorInput.value = currentStop.color;
        if (this.stopPosSlider) this.stopPosSlider.value = currentStop.position;
        if (this.stopPosInput) this.stopPosInput.value = currentStop.position;
      }
    }

    _renderStopHandles() {
      // Clear existing handles
      this.track.querySelectorAll('.gradient-stop-handle').forEach(h => h.remove());

      this.stops.forEach((stop, index) => {
        const handle = document.createElement('div');
        handle.className = `gradient-stop-handle ${index === this.activeStopIndex ? 'active' : ''}`;
        handle.style.left = `${stop.position}%`;
        handle.style.backgroundColor = stop.color;
        handle.setAttribute('data-index', index);
        handle.setAttribute('title', `Stop ${index + 1}: ${stop.color} (${stop.position}%)`);

        // Drag handling
        let isDragging = false;
        handle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          this.activeStopIndex = index;
          this.render();
          isDragging = true;

          const onMove = (moveEvt) => {
            if (!isDragging) return;
            const rect = this.track.getBoundingClientRect();
            const posX = moveEvt.clientX - rect.left;
            const pos = ColorCore.clamp(Math.round((posX / rect.width) * 100), 0, 100);
            stop.position = pos;
            this.stops.sort((a, b) => a.position - b.position);
            this.activeStopIndex = this.stops.indexOf(stop);
            this.render();
          };

          const onUp = () => {
            isDragging = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };

          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        });

        this.track.appendChild(handle);
      });
    }

    loadPreset(name) {
      const PRESETS = {
        sunset: [
          { color: '#F97316', position: 0 },
          { color: '#EC4899', position: 50 },
          { color: '#8B5CF6', position: 100 }
        ],
        aurora: [
          { color: '#10B981', position: 0 },
          { color: '#06B6D4', position: 50 },
          { color: '#3B82F6', position: 100 }
        ],
        cyberpunk: [
          { color: '#FF007A', position: 0 },
          { color: '#7928CA', position: 50 },
          { color: '#00F0FF', position: 100 }
        ],
        ocean: [
          { color: '#0F172A', position: 0 },
          { color: '#1E3A8A', position: 40 },
          { color: '#0284C7', position: 100 }
        ],
        mesh: [
          { color: '#FDE68A', position: 0 },
          { color: '#F43F5E', position: 50 },
          { color: '#6366F1', position: 100 }
        ]
      };

      if (PRESETS[name]) {
        this.stops = JSON.parse(JSON.stringify(PRESETS[name]));
        this.activeStopIndex = 0;
        this.render();
        this._showToast(`Loaded ${name} preset`);
      }
    }

    _showToast(msg, type = 'info') {
      const toast = document.getElementById('global-toast');
      if (!toast) return;
      toast.textContent = msg;
      toast.className = `toast toast-visible ${type}`;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        toast.className = 'toast';
      }, 2400);
    }
  }

  return GradientGeneratorComponent;
});
