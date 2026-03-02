// content.js — Auto-extract product details from any page

function extractProductData() {
  const data = {
    name: '',
    price: '',
    imageUrl: '',
    url: window.location.href,
  };

  // --- Name ---
  // Try structured data first (JSON-LD)
  const jsonLd = document.querySelector('script[type="application/ld+json"]');
  if (jsonLd) {
    try {
      const parsed = JSON.parse(jsonLd.textContent);
      const product = parsed['@type'] === 'Product' ? parsed : parsed['@graph']?.find(i => i['@type'] === 'Product');
      if (product) {
        data.name = product.name || '';
        data.imageUrl = Array.isArray(product.image) ? product.image[0] : product.image || '';
        const offer = product.offers?.[0] || product.offers;
        if (offer) data.price = offer.price ? `$${offer.price}` : '';
      }
    } catch {}
  }

  // Fallback: Open Graph / meta tags
  if (!data.name) {
    data.name = document.querySelector('meta[property="og:title"]')?.content
      || document.querySelector('h1')?.innerText?.trim()
      || document.title;
  }

  // --- Price ---
  if (!data.price) {
    // Common price selectors across major retailers
    const priceSelectors = [
      '[data-price]', '[itemprop="price"]',
      '.price', '.product-price', '.sale-price',
      '#priceblock_ourprice', '#priceblock_dealprice',
      '.a-price .a-offscreen', // Amazon
      '[data-testid="price"]',
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      const text = el?.getAttribute('data-price') || el?.getAttribute('content') || el?.innerText;
      if (text) {
        const match = text.match(/[\$\£\€]?\s?\d[\d,]*\.?\d*/);
        if (match) { data.price = match[0].trim(); break; }
      }
    }
  }

  // --- Image ---
  if (!data.imageUrl) {
    data.imageUrl = document.querySelector('meta[property="og:image"]')?.content
      || document.querySelector('[itemprop="image"]')?.src
      || document.querySelector('.product-image img, #main-image, .gallery img')?.src
      || '';
  }

  return data;
}

// Listen for message from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractProduct') {
    sendResponse(extractProductData());
  }
});
