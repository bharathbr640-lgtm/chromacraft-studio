/**
 * ChromaCraft Studio — Core Color Engine & State Architecture
 * Designed by a Senior Design Systems Architect (Figma/Adobe veteran)
 * 
 * High-performance color mathematical operations, gamut clamping,
 * perceptual delta calculations, colorimetric conversions, and state reactivity.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ColorCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // =========================================================================
  // 1. MATHEMATICAL UTILITIES & CONVERSION FORMULAS
  // =========================================================================

  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
  const round = (val, decimals = 2) => {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  };

  /**
   * Convert HEX string to RGBA object
   * Supports: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
   */
  function hexToRgba(hex) {
    if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0, a: 1 };
    let cleanHex = hex.trim().replace(/^#/, '');

    // Expand shorthand formats (#369 -> #336699)
    if (cleanHex.length === 3 || cleanHex.length === 4) {
      cleanHex = cleanHex.split('').map(char => char + char).join('');
    }

    if (cleanHex.length === 6) {
      const num = parseInt(cleanHex, 16);
      if (isNaN(num)) return { r: 0, g: 0, b: 0, a: 1 };
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
        a: 1
      };
    } else if (cleanHex.length === 8) {
      const num = parseInt(cleanHex, 16);
      if (isNaN(num)) return { r: 0, g: 0, b: 0, a: 1 };
      return {
        r: (num >> 24) & 255,
        g: (num >> 16) & 255,
        b: (num >> 8) & 255,
        a: round((num & 255) / 255, 3)
      };
    }

    return { r: 0, g: 0, b: 0, a: 1 };
  }

  /**
   * Convert RGBA object to HEX or HEX8 string
   */
  function rgbaToHex(r, g, b, a = 1, includeAlpha = false) {
    r = clamp(Math.round(r), 0, 255);
    g = clamp(Math.round(g), 0, 255);
    b = clamp(Math.round(b), 0, 255);
    a = clamp(a, 0, 1);

    const rHex = r.toString(16).padStart(2, '0');
    const gHex = g.toString(16).padStart(2, '0');
    const bHex = b.toString(16).padStart(2, '0');

    if (includeAlpha && a < 1) {
      const aHex = Math.round(a * 255).toString(16).padStart(2, '0');
      return `#${rHex}${gHex}${bHex}${aHex}`.toUpperCase();
    }

    return `#${rHex}${gHex}${bHex}`.toUpperCase();
  }

  /**
   * Convert RGB to HSL
   * R, G, B in [0, 255] -> H in [0, 360], S in [0, 100], L in [0, 100]
   */
  function rgbToHsl(r, g, b) {
    r = clamp(r, 0, 255) / 255;
    g = clamp(g, 0, 255) / 255;
    b = clamp(b, 0, 255) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;

    if (max === min) {
      h = 0; // achromatic
      s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: round(s * 100, 1),
      l: round(l * 100, 1)
    };
  }

  /**
   * Convert HSL to RGB
   * H in [0, 360], S in [0, 100], L in [0, 100] -> R, G, B in [0, 255]
   */
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    s = clamp(s, 0, 100) / 100;
    l = clamp(l, 0, 100) / 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  /**
   * Convert RGB to HSV / HSB
   * Used for visual 2D color picker coordinates
   */
  function rgbToHsv(r, g, b) {
    r = clamp(r, 0, 255) / 255;
    g = clamp(g, 0, 255) / 255;
    b = clamp(b, 0, 255) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h;
    const v = max;
    const d = max - min;
    const s = max === 0 ? 0 : d / max;

    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: round(s * 100, 1),
      v: round(v * 100, 1)
    };
  }

  /**
   * Convert HSV to RGB
   */
  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360 / 60;
    s = clamp(s, 0, 100) / 100;
    v = clamp(v, 0, 100) / 100;

    const i = Math.floor(h);
    const f = h - i;
    const p = v * (1 - s);
    const q = v * (1 - s * f);
    const t = v * (1 - s * (1 - f));

    let r = 0, g = 0, b = 0;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  /**
   * Convert RGB to CMYK
   * Standard prepress formula (0 - 100%)
   */
  function rgbToCmyk(r, g, b) {
    r = clamp(r, 0, 255) / 255;
    g = clamp(g, 0, 255) / 255;
    b = clamp(b, 0, 255) / 255;

    const k = 1 - Math.max(r, g, b);
    if (k === 1) {
      return { c: 0, m: 0, y: 0, k: 100 };
    }

    const c = (1 - r - k) / (1 - k);
    const m = (1 - g - k) / (1 - k);
    const y = (1 - b - k) / (1 - k);

    return {
      c: Math.round(c * 100),
      m: Math.round(m * 100),
      y: Math.round(y * 100),
      k: Math.round(k * 100)
    };
  }

  /**
   * Convert CMYK to RGB
   */
  function cmykToRgb(c, m, y, k) {
    c = clamp(c, 0, 100) / 100;
    m = clamp(m, 0, 100) / 100;
    y = clamp(y, 0, 100) / 100;
    k = clamp(k, 0, 100) / 100;

    const r = Math.round(255 * (1 - c) * (1 - k));
    const g = Math.round(255 * (1 - m) * (1 - k));
    const b = Math.round(255 * (1 - y) * (1 - k));

    return { r, g, b };
  }

  // =========================================================================
  // 2. WCAG 2.1 CONTRAST & RELATIVE LUMINANCE
  // =========================================================================

  /**
   * Calculate relative luminance according to WCAG 2.1 spec
   */
  function getRelativeLuminance(r, g, b) {
    const srgb = [r, g, b].map(val => {
      val = clamp(val, 0, 255) / 255;
      return val <= 0.04045
        ? val / 12.92
        : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }

  /**
   * Calculate contrast ratio between two RGB colors (1:1 to 21:1)
   */
  function getContrastRatio(rgb1, rgb2) {
    const lum1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return round((brightest + 0.05) / (darkest + 0.05), 2);
  }

  /**
   * WCAG Compliance Level evaluation
   */
  function evaluateWcag(ratio) {
    return {
      ratio,
      aaNormal: ratio >= 4.5,
      aaLarge: ratio >= 3.0,
      aaaNormal: ratio >= 7.0,
      aaaLarge: ratio >= 4.5,
      uiComponents: ratio >= 3.0
    };
  }

  // =========================================================================
  // 3. COLORBLINDNESS SIMULATION (LMS Confusion Matrix - Machado / Brettel)
  // =========================================================================

  /**
   * Simulate color vision deficiencies via linearized RGB -> LMS transformation
   */
  function simulateColorblind(r, g, b, type = 'normal') {
    if (type === 'normal') return { r, g, b };

    // Achromatopsia / Monochromacy
    if (type === 'achromatopsia') {
      const gray = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
      return { r: gray, g: gray, b: gray };
    }

    // Gamma expand sRGB to linear RGB
    const toLinear = (c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const toSrgb = (v) => {
      v = clamp(v, 0, 1);
      const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
      return clamp(Math.round(c * 255), 0, 255);
    };

    const linR = toLinear(r);
    const linG = toLinear(g);
    const linB = toLinear(b);

    // Machado 2009 / Brettel 1997 transformation matrices for linear RGB
    let trR = linR, trG = linG, trB = linB;

    switch (type) {
      case 'protanopia': // Red-blind (missing L-cones)
        trR = 0.56667 * linR + 0.43333 * linG + 0.00000 * linB;
        trG = 0.55833 * linR + 0.44167 * linG + 0.00000 * linB;
        trB = 0.00000 * linR + 0.24242 * linG + 0.75758 * linB;
        break;
      case 'protanomaly': // Red-weak
        trR = 0.81667 * linR + 0.18333 * linG + 0.00000 * linB;
        trG = 0.33333 * linR + 0.66667 * linG + 0.00000 * linB;
        trB = 0.00000 * linR + 0.12500 * linG + 0.87500 * linB;
        break;
      case 'deuteranopia': // Green-blind (missing M-cones)
        trR = 0.62500 * linR + 0.37500 * linG + 0.00000 * linB;
        trG = 0.70000 * linR + 0.30000 * linG + 0.00000 * linB;
        trB = 0.00000 * linR + 0.30000 * linG + 0.70000 * linB;
        break;
      case 'deuteranomaly': // Green-weak
        trR = 0.80000 * linR + 0.20000 * linG + 0.00000 * linB;
        trG = 0.25833 * linR + 0.74167 * linG + 0.00000 * linB;
        trB = 0.00000 * linR + 0.14167 * linG + 0.85833 * linB;
        break;
      case 'tritanopia': // Blue-blind (missing S-cones)
        trR = 0.95000 * linR + 0.05000 * linG + 0.00000 * linB;
        trG = 0.00000 * linR + 0.43333 * linG + 0.56667 * linB;
        trB = 0.00000 * linR + 0.47500 * linG + 0.52500 * linB;
        break;
      case 'tritanomaly': // Blue-weak
        trR = 0.96667 * linR + 0.03333 * linG + 0.00000 * linB;
        trG = 0.00000 * linR + 0.73333 * linG + 0.26667 * linB;
        trB = 0.00000 * linR + 0.18333 * linG + 0.81667 * linB;
        break;
    }

    return {
      r: toSrgb(trR),
      g: toSrgb(trG),
      b: toSrgb(trB)
    };
  }

  // =========================================================================
  // 4. INTELLIGENT COLOR NAMING ALGORITHM
  // =========================================================================

  // Curated dictionary of design system benchmark colors
  const COLOR_DICTIONARY = [
    { name: 'Pure White', hex: '#FFFFFF' },
    { name: 'Pure Black', hex: '#000000' },
    { name: 'Slate Gray', hex: '#708090' },
    { name: 'Charcoal', hex: '#36454F' },
    { name: 'Cool Gray', hex: '#94A3B8' },
    { name: 'Neutral Gray', hex: '#71717A' },
    { name: 'Silver Mist', hex: '#D1D5DB' },
    { name: 'Crimson Red', hex: '#DC2626' },
    { name: 'Ruby Scarlet', hex: '#E11D48' },
    { name: 'Rose Petal', hex: '#F43F5E' },
    { name: 'Coral Sunrise', hex: '#FF6F61' },
    { name: 'Tangerine', hex: '#F97316' },
    { name: 'Amber Gold', hex: '#F59E0B' },
    { name: 'Honey Dijon', hex: '#D97706' },
    { name: 'Sunburst Yellow', hex: '#EAB308' },
    { name: 'Canary Yellow', hex: '#FACC15' },
    { name: 'Lime Zest', hex: '#84CC16' },
    { name: 'Emerald Green', hex: '#10B981' },
    { name: 'Mint Meadow', hex: '#34D399' },
    { name: 'Forest Moss', hex: '#059669' },
    { name: 'Deep Olive', hex: '#4D7C0F' },
    { name: 'Teal Lagoon', hex: '#14B8A6' },
    { name: 'Cyan Breeze', hex: '#06B6D4' },
    { name: 'Sky Cerulean', hex: '#0EA5E9' },
    { name: 'Figma Blue', hex: '#18A0FB' },
    { name: 'Royal Azure', hex: '#2563EB' },
    { name: 'Cobalt Navy', hex: '#1D4ED8' },
    { name: 'Midnight Navy', hex: '#0F172A' },
    { name: 'Indigo Dream', hex: '#6366F1' },
    { name: 'Electric Violet', hex: '#7C3AED' },
    { name: 'Purple Iris', hex: '#8B5CF6' },
    { name: 'Fuchsia Neon', hex: '#D946EF' },
    { name: 'Hot Magenta', hex: '#EC4899' },
    { name: 'Champagne Sand', hex: '#FDE68A' },
    { name: 'Espresso Bean', hex: '#3B2F2F' },
    { name: 'Warm Terracotta', hex: '#C2410C' },
    { name: 'Lavender Haze', hex: '#C084FC' },
    { name: 'Deep Amethyst', hex: '#581C87' },
    { name: 'Aqua Marine', hex: '#2DD4BF' },
    { name: 'Bordeaux Wine', hex: '#881337' }
  ];

  /**
   * Algorithmic perceptual color naming based on Euclidean distance
   * and HSL descriptive qualifiers
   */
  function getPerceptualColorName(r, g, b) {
    let minDistance = Infinity;
    let closestName = 'Custom Tone';

    // Weighted RGB Euclidean distance (closer to human eye sensitivity: 2R + 4G + 3B)
    for (const entry of COLOR_DICTIONARY) {
      const entryRgb = hexToRgba(entry.hex);
      const dr = r - entryRgb.r;
      const dg = g - entryRgb.g;
      const db = b - entryRgb.b;
      const distance = Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);

      if (distance < minDistance) {
        minDistance = distance;
        closestName = entry.name;
      }
    }

    // If exact or very close match, return name
    if (minDistance < 25) {
      return closestName;
    }

    // Procedural modifier generation
    const hsl = rgbToHsl(r, g, b);
    let lightnessMod = '';
    if (hsl.l < 15) lightnessMod = 'Very Dark ';
    else if (hsl.l < 30) lightnessMod = 'Dark ';
    else if (hsl.l > 85) lightnessMod = 'Very Light ';
    else if (hsl.l > 70) lightnessMod = 'Light ';

    let satMod = '';
    if (hsl.s < 10) satMod = 'Achromatic ';
    else if (hsl.s < 25) satMod = 'Muted ';
    else if (hsl.s > 80) satMod = 'Vibrant ';

    return `${lightnessMod}${satMod}${closestName}`.trim();
  }

  // =========================================================================
  // 5. CENTRAL REACTIVE STATE STORE
  // =========================================================================

  class ColorStore {
    constructor(initialHex = '#3B82F6') {
      const initialRgba = hexToRgba(initialHex);
      this._state = {
        r: initialRgba.r,
        g: initialRgba.g,
        b: initialRgba.b,
        a: 1.0,
        hex: initialHex.toUpperCase(),
        hsl: rgbToHsl(initialRgba.r, initialRgba.g, initialRgba.b),
        hsv: rgbToHsv(initialRgba.r, initialRgba.g, initialRgba.b),
        cmyk: rgbToCmyk(initialRgba.r, initialRgba.g, initialRgba.b),
        name: getPerceptualColorName(initialRgba.r, initialRgba.g, initialRgba.b),
        previousHex: initialHex.toUpperCase(),
        history: [initialHex.toUpperCase()]
      };
      this._subscribers = new Set();
    }

    get() {
      return { ...this._state };
    }

    subscribe(callback) {
      if (typeof callback === 'function') {
        this._subscribers.add(callback);
        // Dispatch current state immediately
        callback(this.get());
        return () => this._subscribers.delete(callback);
      }
    }

    _notify(source) {
      const currentState = this.get();
      this._subscribers.forEach(cb => {
        try {
          cb(currentState, source);
        } catch (err) {
          console.error('[ColorStore] Subscriber callback error:', err);
        }
      });
    }

    setFromRgb(r, g, b, a = this._state.a, source = 'system') {
      r = clamp(Math.round(r), 0, 255);
      g = clamp(Math.round(g), 0, 255);
      b = clamp(Math.round(b), 0, 255);
      a = clamp(round(a, 3), 0, 1);

      this._state.previousHex = this._state.hex;
      this._state.r = r;
      this._state.g = g;
      this._state.b = b;
      this._state.a = a;
      this._state.hex = rgbaToHex(r, g, b, a, a < 1);
      this._state.hsl = rgbToHsl(r, g, b);
      this._state.hsv = rgbToHsv(r, g, b);
      this._state.cmyk = rgbToCmyk(r, g, b);
      this._state.name = getPerceptualColorName(r, g, b);

      this._updateHistory(this._state.hex);
      this._notify(source);
    }

    setFromHsl(h, s, l, a = this._state.a, source = 'system') {
      const rgb = hslToRgb(h, s, l);
      this.setFromRgb(rgb.r, rgb.g, rgb.b, a, source);
    }

    setFromHsv(h, s, v, a = this._state.a, source = 'system') {
      const rgb = hsvToRgb(h, s, v);
      this.setFromRgb(rgb.r, rgb.g, rgb.b, a, source);
    }

    setFromHex(hex, source = 'system') {
      const rgba = hexToRgba(hex);
      this.setFromRgb(rgba.r, rgba.g, rgba.b, rgba.a, source);
    }

    setFromCmyk(c, m, y, k, a = this._state.a, source = 'system') {
      const rgb = cmykToRgb(c, m, y, k);
      this.setFromRgb(rgb.r, rgb.g, rgb.b, a, source);
    }

    setAlpha(a, source = 'slider') {
      this.setFromRgb(this._state.r, this._state.g, this._state.b, a, source);
    }

    _updateHistory(hex) {
      if (this._state.history[this._state.history.length - 1] !== hex) {
        this._state.history.push(hex);
        if (this._state.history.length > 30) {
          this._state.history.shift();
        }
      }
    }
  }

  // Create global singleton instance
  const store = new ColorStore('#3B82F6');

  return {
    clamp,
    round,
    hexToRgba,
    rgbaToHex,
    rgbToHsl,
    hslToRgb,
    rgbToHsv,
    hsvToRgb,
    rgbToCmyk,
    cmykToRgb,
    getRelativeLuminance,
    getContrastRatio,
    evaluateWcag,
    simulateColorblind,
    getPerceptualColorName,
    ColorStore,
    store
  };
});
