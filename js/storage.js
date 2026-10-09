/**
 * ChromaCraft Studio — Storage & Library Management
 * Manages LocalStorage persistence for favorite colors, project collections,
 * custom naming, tags, and JSON backup/restore.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'));
  } else {
    root.ColorStorage = factory(root.ColorCore);
  }
})(typeof self !== 'undefined' ? self : this, function (ColorCore) {
  'use strict';

  const STORAGE_KEY = 'chromacraft_library_v1';
  const PREFS_KEY = 'chromacraft_preferences_v1';

  class StorageComponent {
    constructor(containerEl, store = ColorCore.store) {
      this.container = typeof containerEl === 'string' ? document.querySelector(containerEl) : containerEl;
      this.store = store;

      this.data = this._loadData();
      this.activeCollection = 'Default Collection';

      this._initDOMElements();
      this._bindEvents();
      this.render();
    }

    _loadData() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch (e) {
        console.warn('Could not read from localStorage:', e);
      }

      // Default initial seed data
      return {
        collections: {
          'Default Collection': [
            { id: 'fav_1', hex: '#3B82F6', name: 'Brand Royal Blue', date: Date.now() },
            { id: 'fav_2', hex: '#10B981', name: 'Success Emerald', date: Date.now() },
            { id: 'fav_3', hex: '#F59E0B', name: 'Warning Amber', date: Date.now() },
            { id: 'fav_4', hex: '#EF4444', name: 'Destructive Red', date: Date.now() }
          ],
          'Design System Accent': [
            { id: 'fav_5', hex: '#8B5CF6', name: 'Electric Purple', date: Date.now() },
            { id: 'fav_6', hex: '#EC4899', name: 'Neon Magenta', date: Date.now() }
          ]
        }
      };
    }

    _saveData() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (e) {
        console.error('Failed to save library to localStorage:', e);
      }
    }

    _initDOMElements() {
      this.collectionSelect = this.container.querySelector('#library-collection-select');
      this.newCollectionBtn = this.container.querySelector('#library-new-collection-btn');
      this.saveCurrentBtn = this.container.querySelector('#library-save-current-btn');
      this.customNameInput = this.container.querySelector('#library-custom-name-input');
      this.swatchesList = this.container.querySelector('#library-swatches-list');
      this.exportJsonBtn = this.container.querySelector('#library-export-json');
      this.importJsonInput = this.container.querySelector('#library-import-json-input');
      this.importJsonBtn = this.container.querySelector('#library-import-json-btn');
    }

    _bindEvents() {
      // Collection select
      if (this.collectionSelect) {
        this.collectionSelect.addEventListener('change', (e) => {
          this.activeCollection = e.target.value;
          this.render();
        });
      }

      // New collection
      if (this.newCollectionBtn) {
        this.newCollectionBtn.addEventListener('click', () => {
          const name = prompt('Enter new collection name:');
          if (name && name.trim()) {
            const cleanName = name.trim();
            if (!this.data.collections[cleanName]) {
              this.data.collections[cleanName] = [];
              this.activeCollection = cleanName;
              this._saveData();
              this.render();
              this._showToast(`Created collection "${cleanName}"`);
            } else {
              this._showToast('A collection with this name already exists.', 'warning');
            }
          }
        });
      }

      // Save Current Color
      if (this.saveCurrentBtn) {
        this.saveCurrentBtn.addEventListener('click', () => {
          const current = this.store.get();
          const customName = this.customNameInput && this.customNameInput.value.trim()
            ? this.customNameInput.value.trim()
            : current.name;

          if (!this.data.collections[this.activeCollection]) {
            this.data.collections[this.activeCollection] = [];
          }

          const newFav = {
            id: 'fav_' + Date.now(),
            hex: current.hex,
            name: customName,
            date: Date.now()
          };

          this.data.collections[this.activeCollection].unshift(newFav);
          this._saveData();
          if (this.customNameInput) this.customNameInput.value = '';
          this.render();
          this._showToast(`Saved "${customName}" to ${this.activeCollection}!`);
        });
      }

      // Swatch list click delegation
      if (this.swatchesList) {
        this.swatchesList.addEventListener('click', (e) => {
          const card = e.target.closest('.library-card');
          if (!card) return;
          const id = card.getAttribute('data-id');
          const hex = card.getAttribute('data-hex');

          // Delete favorite
          if (e.target.closest('.library-delete-btn')) {
            e.stopPropagation();
            const list = this.data.collections[this.activeCollection] || [];
            this.data.collections[this.activeCollection] = list.filter(item => item.id !== id);
            this._saveData();
            this.render();
            this._showToast('Color removed from library');
            return;
          }

          // Apply color to store
          this.store.setFromHex(hex, 'library-select');
          this._showToast(`Loaded ${hex} into studio`);
        });
      }

      // Export JSON backup
      if (this.exportJsonBtn) {
        this.exportJsonBtn.addEventListener('click', () => {
          const json = JSON.stringify(this.data, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `chromacraft-library-backup.json`;
          a.click();
          URL.revokeObjectURL(url);
          this._showToast('Exported library backup JSON');
        });
      }

      // Import JSON backup
      if (this.importJsonBtn && this.importJsonInput) {
        this.importJsonBtn.addEventListener('click', () => {
          this.importJsonInput.click();
        });

        this.importJsonInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              const parsed = JSON.parse(evt.target.result);
              if (parsed && parsed.collections) {
                this.data = parsed;
                this._saveData();
                this.activeCollection = Object.keys(this.data.collections)[0] || 'Default Collection';
                this.render();
                this._showToast('Library imported successfully!');
              } else {
                throw new Error('Invalid JSON format');
              }
            } catch (err) {
              this._showToast('Failed to import JSON file.', 'error');
            }
          };
          reader.readAsText(file);
        });
      }
    }

    render() {
      // Render collection select dropdown
      if (this.collectionSelect) {
        const collections = Object.keys(this.data.collections);
        this.collectionSelect.innerHTML = collections.map(col => {
          const isSelected = col === this.activeCollection ? 'selected' : '';
          return `<option value="${col}" ${isSelected}>${col} (${this.data.collections[col].length})</option>`;
        }).join('');
      }

      // Render swatches
      if (this.swatchesList) {
        const items = this.data.collections[this.activeCollection] || [];
        if (items.length === 0) {
          this.swatchesList.innerHTML = `<div class="library-empty">No colors in this collection yet. Add your first favorite above!</div>`;
          return;
        }

        this.swatchesList.innerHTML = items.map(item => `
          <div class="library-card" data-id="${item.id}" data-hex="${item.hex}">
            <div class="library-swatch" style="background-color: ${item.hex};"></div>
            <div class="library-info">
              <div class="library-name">${item.name}</div>
              <div class="library-hex">${item.hex}</div>
            </div>
            <button type="button" class="library-delete-btn" title="Remove Color">&times;</button>
          </div>
        `).join('');
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

  return StorageComponent;
});
