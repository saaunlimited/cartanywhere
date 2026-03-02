// In your popup.js, when the popup opens:
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, { action: 'extractProduct' }, (data) => {
    if (data) {
      document.getElementById('name').value = data.name || '';
      document.getElementById('price').value = data.price || '';
      document.getElementById('image').value = data.imageUrl || '';
      document.getElementById('url').value = data.url || '';
    }
  });
});
