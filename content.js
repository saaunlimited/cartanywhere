// content.js — Injects floating "Add to Cart" button + mini-menu on every page

(function () {
  if (
    window.location.protocol === 'chrome:' ||
    window.location.protocol === 'chrome-extension:' ||
    window.location.protocol === 'about:'
  ) return;

  // ─── CONFIG ───
  const CARTANYWHERE_APP_URL = 'https://cartanywhere.app';

  // ─── FAB ───
  const fab = document.createElement('button');
  fab.id = 'cartanywhere-fab';
  fab.title = 'Add to CartAnywhere';
  fab.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  `;

  // ─── TOAST ───
  const toast = document.createElement('div');
  toast.id = 'cartanywhere-toast';

  // ─── MINI MENU (shows on hover) ───
  const menu = document.createElement('div');
  menu.id = 'cartanywhere-menu';
  menu.innerHTML = `
    <button id="ca-add-btn" class="ca-menu-btn">
      <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span>Add to Cart</span>
    </button>
    <button id="ca-app-btn" class="ca-menu-btn">
      <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      <span>Open App</span>
    </button>
    <div class="ca-menu-count" id="ca-menu-count">0 items saved</div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(toast);
  document.body.appendChild(menu);

  let menuOpen = false;

  // Toggle menu
  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  function openMenu() {
    menu.classList.add('open');
    menuOpen = true;
    updateMenuCount();
  }

  function closeMenu() {
    menu.classList.remove('open');
    menuOpen = false;
  }

  // Close menu when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (menuOpen && !menu.contains(e.target) && e.target !== fab) {
      closeMenu();
    }
  });

  // ─── Add to cart button in menu ───
  document.getElementById('ca-add-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    await addCurrentPage();
    closeMenu();
  });

  // ─── Open App button in menu ───
  document.getElementById('ca-app-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    window.open(CARTANYWHERE_APP_URL, '_blank');
    closeMenu();
  });

  // ─── Badge ───
  async function updateBadge() {
    try {
      const { cart = [] } = await chrome.storage.local.get('cart');
      let badge = fab.querySelector('.ca-badge');
      if (cart.length > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'ca-badge';
          fab.appendChild(badge);
        }
        badge.textContent = cart.length;
      } else if (badge) {
        badge.remove();
      }
    } catch (e) {}
  }

  async function updateMenuCount() {
    try {
      const { cart = [] } = await chrome.storage.local.get('cart');
      const el = document.getElementById('ca-menu-count');
      if (el) el.textContent = `${cart.length} item${cart.length !== 1 ? 's' : ''} saved`;
    } catch (e) {}
  }

  function showToast(message, isError = false) {
    toast.innerHTML = isError
      ? `<span style="color:#FF6B6B;">✕</span> ${message}`
      : `<span class="ca-check">✓</span> ${message}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function extractInfo() {
    const info = {
      title: document.title,
      url: window.location.href,
      source: window.location.hostname,
      price: null,
      favicon: null,
      addedAt: Date.now()
    };

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle?.content) info.title = ogTitle.content;

    const priceSelectors = [
      '[itemprop="price"]', '[data-price]', '.a-price .a-offscreen',
      '.price-characteristic', '#priceblock_ourprice', '.product-price',
      '.price', '#price', '.sale-price', '.current-price',
    ];

    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const attr = el.getAttribute('data-price') || el.getAttribute('content');
      if (attr) {
        const p = parseFloat(attr);
        if (!isNaN(p) && p > 0 && p < 100000) { info.price = p; break; }
      }
      const text = el.textContent.trim();
      const match = text.match(/[\$£€]?\s?(\d{1,6}[.,]\d{2})/);
      if (match) {
        const p = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(p) && p > 0) { info.price = p; break; }
      }
    }

    const domain = window.location.hostname;
    if (domain.includes('amazon')) info.favicon = '📦';
    else if (domain.includes('ebay')) info.favicon = '🏷️';
    else if (domain.includes('walmart')) info.favicon = '🏪';
    else if (domain.includes('target')) info.favicon = '🎯';
    else if (domain.includes('etsy')) info.favicon = '🎨';
    else if (domain.includes('bestbuy')) info.favicon = '💻';
    else if (domain.includes('nike') || domain.includes('adidas')) info.favicon = '👟';
    else info.favicon = '🛒';

    return info;
  }

  async function addCurrentPage() {
    try {
      const pageInfo = extractInfo();
      const { cart = [] } = await chrome.storage.local.get('cart');

      if (cart.some(item => item.url === pageInfo.url)) {
        showToast('Already in your cart!', true);
        return;
      }

      cart.unshift(pageInfo);
      await chrome.storage.local.set({ cart });

      showToast('Added to CartAnywhere');
      updateBadge();
      updateMenuCount();

      fab.style.transform = 'scale(0.85)';
      setTimeout(() => { fab.style.transform = ''; }, 150);
    } catch (e) {
      showToast('Could not add item', true);
    }
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.cart) {
      updateBadge();
      updateMenuCount();
    }
  });

  updateBadge();
})();
