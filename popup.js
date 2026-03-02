// popup.js — CartAnywhere popup logic

// ─── CONFIG ───
// Replace this with your actual app/landing page URL in production
const CARTANYWHERE_APP_URL = 'https://cartanywhere.app';

document.addEventListener('DOMContentLoaded', async () => {
  const cartList = document.getElementById('cartList');
  const emptyState = document.getElementById('emptyState');
  const footer = document.getElementById('footer');
  const itemCount = document.getElementById('itemCount');
  const totalPrice = document.getElementById('totalPrice');
  const addCurrentBtn = document.getElementById('addCurrentBtn');
  const currentPageUrl = document.getElementById('currentPageUrl');
  const clearBtn = document.getElementById('clearBtn');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const openAppBtn = document.getElementById('openAppBtn');

  // ─── Open App / Landing Page ───
  openAppBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: CARTANYWHERE_APP_URL });
  });

  // Get current tab info
  let currentTab = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    currentPageUrl.textContent = new URL(tab.url).hostname;
  } catch (e) {
    currentPageUrl.textContent = 'Unable to read page';
  }

  // Load and render cart
  async function loadCart() {
    const { cart = [] } = await chrome.storage.local.get('cart');
    renderCart(cart);
  }

  function renderCart(cart) {
    cartList.innerHTML = '';

    if (cart.length === 0) {
      emptyState.style.display = 'flex';
      footer.style.display = 'none';
      itemCount.textContent = '0 items';
      return;
    }

    emptyState.style.display = 'none';
    footer.style.display = 'block';
    itemCount.textContent = `${cart.length} item${cart.length !== 1 ? 's' : ''}`;

    let total = 0;

    cart.forEach((item, index) => {
      if (item.price) total += item.price;

      const el = document.createElement('div');
      el.className = 'cart-item';
      el.innerHTML = `
        <div class="item-thumb">${item.favicon || '🛒'}</div>
        <div class="item-details">
          <div class="item-name">${escapeHtml(item.title)}</div>
          <div class="item-source">${escapeHtml(item.source)}</div>
          ${item.price ? `<div class="item-price">$${item.price.toFixed(2)}</div>` : ''}
        </div>
        <button class="item-remove" data-index="${index}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;

      // Click item to open its URL
      el.addEventListener('click', (e) => {
        if (e.target.closest('.item-remove')) return;
        chrome.tabs.create({ url: item.url });
      });

      cartList.appendChild(el);
    });

    totalPrice.textContent = total > 0 ? `$${total.toFixed(2)}` : '—';

    // Remove handlers
    document.querySelectorAll('.item-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        const { cart = [] } = await chrome.storage.local.get('cart');
        cart.splice(idx, 1);
        await chrome.storage.local.set({ cart });
        renderCart(cart);
      });
    });
  }

  // Add current page
  addCurrentBtn.addEventListener('click', async () => {
    if (!currentTab) return;

    let pageInfo = {
      title: currentTab.title || 'Untitled Page',
      url: currentTab.url,
      source: new URL(currentTab.url).hostname,
      price: null,
      favicon: null,
      addedAt: Date.now()
    };

    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: extractPageInfo
      });
      if (result?.result) {
        pageInfo = { ...pageInfo, ...result.result };
      }
    } catch (e) { /* fallback to basic info */ }

    const { cart = [] } = await chrome.storage.local.get('cart');

    if (cart.some(item => item.url === pageInfo.url)) {
      addCurrentBtn.querySelector('.add-text').textContent = 'Already added!';
      setTimeout(() => { addCurrentBtn.querySelector('.add-text').textContent = 'Add this page'; }, 1500);
      return;
    }

    cart.unshift(pageInfo);
    await chrome.storage.local.set({ cart });
    renderCart(cart);

    addCurrentBtn.querySelector('.add-text').textContent = 'Added!';
    setTimeout(() => { addCurrentBtn.querySelector('.add-text').textContent = 'Add this page'; }, 1500);
  });

  clearBtn.addEventListener('click', async () => {
    if (confirm('Remove all items from your cart?')) {
      await chrome.storage.local.set({ cart: [] });
      renderCart([]);
    }
  });

  checkoutBtn.addEventListener('click', () => {
    // Opens the CartAnywhere app with all items — in production this could
    // pass cart data via URL params or the app reads from shared storage
    chrome.tabs.create({ url: CARTANYWHERE_APP_URL });
  });

  loadCart();
});

// Runs inside the active tab to extract product info
function extractPageInfo() {
  const info = {};

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) info.title = ogTitle.content;

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

  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) info.image = ogImage.content;

  return info;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
