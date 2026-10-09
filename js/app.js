/**
 * ChromaCraft Studio — Application Orchestrator
 * Connects Core Store, Picker, Harmonies, Gradients, Accessibility, Export, and Storage.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Core Store
  const store = window.ColorCore.store;

  // 2. Initialize Components
  const picker = new window.ColorPicker('#picker-module', store);
  const palette = new window.ColorPalette('#palette-module', store);
  const gradient = new window.ColorGradient('#gradient-module', store);
  const accessibility = new window.ColorAccessibility('#accessibility-module', store);
  const exportComp = new window.ColorExport('#export-module', store, palette);
  const storage = new window.ColorStorage('#library-module', store);

  // 3. Navigation / Tab Switching
  const navTabs = document.querySelectorAll('.nav-tab-item');
  const sections = document.querySelectorAll('.studio-section');

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-target');
      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      sections.forEach(section => {
        if (section.id === targetId) {
          section.classList.add('active-section');
        } else {
          section.classList.remove('active-section');
        }
      });

      // Redraw canvases if their tabs become visible
      if (targetId === 'tab-picker') {
        picker.drawWheel();
      } else if (targetId === 'tab-palette') {
        palette.renderHarmony(store.get());
      } else if (targetId === 'tab-gradient') {
        gradient.render();
      }
    });
  });

  // 4. Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // If typing in input or textarea, don't trigger shortcuts
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if (e.key === 'c' || e.key === 'C') {
      const hex = store.get().hex;
      navigator.clipboard.writeText(hex).then(() => {
        showGlobalToast(`Copied ${hex} to clipboard!`);
      });
    } else if (e.key === 'e' || e.key === 'E') {
      const eyeBtn = document.getElementById('eyedropper-btn');
      if (eyeBtn) eyeBtn.click();
    }
  });

  function showGlobalToast(msg, type = 'info') {
    const toast = document.getElementById('global-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast toast-visible ${type}`;
    setTimeout(() => {
      toast.className = 'toast';
    }, 2400);
  }

  console.log('ChromaCraft Studio Initialized successfully.');
});
