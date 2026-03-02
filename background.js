// background.js — CartAnywhere service worker

const CARTANYWHERE_APP_URL = 'https://cartanywhere.app';

// ─── Badge ───
async function updateExtensionBadge() {
  const { cart = [] } = await chrome.storage.local.get('cart');
  const count = cart.length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#FF3D57' });
  chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
}

// ─── Context Menu ───
chrome.runtime.onInstalled.addListener(() => {
  updateExtensionBadge();

  // Right-click context menu: "Add to CartAnywhere"
  chrome.contextMenus.create({
    id: 'cartanywhere-add',
    title: 'Add to CartAnywhere',
    contexts: ['page', 'link', 'image']
  });

  // Right-click: "Open CartAnywhere App"
  chrome.contextMenus.create({
    id: 'cartanywhere-open-app',
    title: 'Open CartAnywhere App',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'cartanywhere-add') {
    const pageInfo = {
      title: tab.title || 'Untitled Page',
      url: info.linkUrl || tab.url,
      source: new URL(info.linkUrl || tab.url).hostname,
      price: null,
      favicon: '🛒',
      addedAt: Date.now()
    };

    const { cart = [] } = await chrome.storage.local.get('cart');
    if (!cart.some(item => item.url === pageInfo.url)) {
      cart.unshift(pageInfo);
      await chrome.storage.local.set({ cart });
    }
  }

  if (info.menuItemId === 'cartanywhere-open-app') {
    chrome.tabs.create({ url: CARTANYWHERE_APP_URL });
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.cart) {
    updateExtensionBadge();
  }
});

chrome.runtime.onStartup.addListener(updateExtensionBadge);
