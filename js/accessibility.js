/**
 * ChromaCraft Studio — Accessibility & Inclusive Design Suite
 * Implements: WCAG 2.1 Contrast Ratio Calculator, APCA / AA / AAA compliance matrix,
 * interactive typography preview, and 7-type Colorblindness Simulation engine.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'));
  } else {
    root.ColorAccessibility = factory(root.ColorCore);
  }
})(typeof self !== 'undefined' ? self : this, function (ColorCore) {
  'use strict';

  class AccessibilityComponent {
    constructor(containerEl, store = ColorCore.store) {
      this.container = typeof containerEl === 'string' ? document.querySelector(containerEl) : containerEl;
      this.store = store;

      this.customBgColor = '#FFFFFF';
      this.activeMode = 'fg-is-color'; // 'fg-is-color' or 'bg-is-color'

      this._initDOMElements();
      this._bindEvents();

      this.store.subscribe((state) => {
        this.render(state);
      });
    }

    _initDOMElements() {
      // Contrast ratios
      this.ratioOnWhiteEl = this.container.querySelector('#wcag-ratio-white');
      this.ratioOnBlackEl = this.container.querySelector('#wcag-ratio-black');
      this.ratioOnCustomEl = this.container.querySelector('#wcag-ratio-custom');
      this.customBgInput = this.container.querySelector('#wcag-custom-bg-input');

      // Badges
      this.badgeAaNormal = this.container.querySelector('#badge-aa-normal');
      this.badgeAaLarge = this.container.querySelector('#badge-aa-large');
      this.badgeAaaNormal = this.container.querySelector('#badge-aaa-normal');
      this.badgeAaaLarge = this.container.querySelector('#badge-aaa-large');
      this.badgeUiComp = this.container.querySelector('#badge-ui-comp');

      // Typography Preview
      this.previewCard = this.container.querySelector('#accessibility-preview-card');
      this.toggleModeBtn = this.container.querySelector('#a11y-toggle-mode-btn');

      // Colorblindness Grid
      this.colorblindGrid = this.container.querySelector('#colorblind-simulation-grid');
    }

    _bindEvents() {
      if (this.customBgInput) {
        this.customBgInput.addEventListener('input', (e) => {
          this.customBgColor = e.target.value;
          this.render(this.store.get());
        });
      }

      if (this.toggleModeBtn) {
        this.toggleModeBtn.addEventListener('click', () => {
          this.activeMode = this.activeMode === 'fg-is-color' ? 'bg-is-color' : 'fg-is-color';
          this.toggleModeBtn.textContent = this.activeMode === 'fg-is-color'
            ? 'Mode: Color as Text'
            : 'Mode: Color as Background';
          this.render(this.store.get());
        });
      }
    }

    render(state) {
      const activeRgb = { r: state.r, g: state.g, b: state.b };
      const whiteRgb = { r: 255, g: 255, b: 255 };
      const blackRgb = { r: 0, g: 0, b: 0 };
      const customRgb = ColorCore.hexToRgba(this.customBgColor);

      // Contrast ratios
      const ratioWhite = ColorCore.getContrastRatio(activeRgb, whiteRgb);
      const ratioBlack = ColorCore.getContrastRatio(activeRgb, blackRgb);
      const ratioCustom = ColorCore.getContrastRatio(activeRgb, customRgb);

      if (this.ratioOnWhiteEl) this.ratioOnWhiteEl.textContent = `${ratioWhite}:1`;
      if (this.ratioOnBlackEl) this.ratioOnBlackEl.textContent = `${ratioBlack}:1`;
      if (this.ratioOnCustomEl) this.ratioOnCustomEl.textContent = `${ratioCustom}:1`;

      // Evaluate against custom background (or white by default)
      const evalResult = ColorCore.evaluateWcag(ratioCustom);
      this._updateBadge(this.badgeAaNormal, evalResult.aaNormal);
      this._updateBadge(this.badgeAaLarge, evalResult.aaLarge);
      this._updateBadge(this.badgeAaaNormal, evalResult.aaaNormal);
      this._updateBadge(this.badgeAaaLarge, evalResult.aaaLarge);
      this._updateBadge(this.badgeUiComp, evalResult.uiComponents);

      // Update Typography Preview
      this._renderTypographyPreview(state, this.customBgColor);

      // Update Colorblindness Simulation Grid
      this._renderColorblindGrid(state);
    }

    _updateBadge(badgeEl, isPass) {
      if (!badgeEl) return;
      if (isPass) {
        badgeEl.textContent = 'PASS';
        badgeEl.className = 'a11y-badge a11y-pass';
      } else {
        badgeEl.textContent = 'FAIL';
        badgeEl.className = 'a11y-badge a11y-fail';
      }
    }

    _renderTypographyPreview(state, bgHex) {
      if (!this.previewCard) return;

      if (this.activeMode === 'fg-is-color') {
        this.previewCard.style.backgroundColor = bgHex;
        this.previewCard.style.color = state.hex;
        const btn = this.previewCard.querySelector('.preview-action-btn');
        if (btn) {
          btn.style.backgroundColor = state.hex;
          // Calculate high contrast text for inside the button
          const btnRgb = { r: state.r, g: state.g, b: state.b };
          const whiteRatio = ColorCore.getContrastRatio(btnRgb, { r: 255, g: 255, b: 255 });
          const blackRatio = ColorCore.getContrastRatio(btnRgb, { r: 0, g: 0, b: 0 });
          btn.style.color = whiteRatio >= blackRatio ? '#FFFFFF' : '#000000';
        }
      } else {
        this.previewCard.style.backgroundColor = state.hex;
        this.previewCard.style.color = bgHex;
        const btn = this.previewCard.querySelector('.preview-action-btn');
        if (btn) {
          btn.style.backgroundColor = bgHex;
          btn.style.color = state.hex;
        }
      }
    }

    _renderColorblindGrid(state) {
      if (!this.colorblindGrid) return;

      const types = [
        { id: 'normal', name: 'Standard Vision', desc: 'Typical trichromatic vision' },
        { id: 'protanopia', name: 'Protanopia', desc: 'Missing L-cones (Red-blind ~1%)' },
        { id: 'protanomaly', name: 'Protanomaly', desc: 'Anomalous L-cones (Red-weak ~1%)' },
        { id: 'deuteranopia', name: 'Deuteranopia', desc: 'Missing M-cones (Green-blind ~1%)' },
        { id: 'deuteranomaly', name: 'Deuteranomaly', desc: 'Anomalous M-cones (Green-weak ~5%)' },
        { id: 'tritanopia', name: 'Tritanopia', desc: 'Missing S-cones (Blue-blind ~0.003%)' },
        { id: 'tritanomaly', name: 'Tritanomaly', desc: 'Anomalous S-cones (Blue-weak ~0.01%)' },
        { id: 'achromatopsia', name: 'Achromatopsia', desc: 'Complete absence of color cones' }
      ];

      this.colorblindGrid.innerHTML = '';

      types.forEach(t => {
        const sim = ColorCore.simulateColorblind(state.r, state.g, state.b, t.id);
        const simHex = ColorCore.rgbaToHex(sim.r, sim.g, sim.b);

        const card = document.createElement('div');
        card.className = 'colorblind-card';
        card.innerHTML = `
          <div class="colorblind-swatch-split">
            <div class="colorblind-swatch-half" style="background-color: ${state.hex};" title="Original: ${state.hex}"></div>
            <div class="colorblind-swatch-half" style="background-color: ${simHex};" title="Simulated: ${simHex}"></div>
          </div>
          <div class="colorblind-info">
            <div class="colorblind-name">${t.name}</div>
            <div class="colorblind-hex">${simHex}</div>
            <div class="colorblind-desc">${t.desc}</div>
          </div>
        `;
        this.colorblindGrid.appendChild(card);
      });
    }
  }

  return AccessibilityComponent;
});
