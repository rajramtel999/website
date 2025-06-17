let totalSales = 0;

document.getElementById("sales-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const name = document.getElementById("product-name").value.trim();
  const price = parseFloat(document.getElementById("price").value);
  const quantity = parseInt(document.getElementById("quantity").value);

  if (!name || isNaN(price) || isNaN(quantity)) {
    alert("Please enter valid product details.");
    return;
  }

  const saleAmount = price * quantity;
  totalSales += saleAmount;

  const listItem = document.createElement("li");
  listItem.textContent = `${name} - Rs. ${price} × ${quantity} = Rs. ${saleAmount.toFixed(2)}`;

  document.getElementById("sales-list").appendChild(listItem);
  document.getElementById("total-sales").textContent = totalSales.toFixed(2);

  // Clear inputs
  document.getElementById("product-name").value = "";
  document.getElementById("price").value = "";
  document.getElementById("quantity").value = "";
});

// Service Worker

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/MiniVyapar/1.0/sw.js')
    .then(registration => {
      console.log('Service Worker registered with scope:', registration.scope);

      // Optional: register periodic sync (needs user permission and browser support)
      if ('periodicSync' in registration) {
        registration.periodicSync.register('content-sync', {
          minInterval: 24 * 60 * 60 * 1000, // once a day
        }).catch(err => {
          console.warn('Periodic Sync could not be registered', err);
        });
      }
    })
    .catch(error => {
      console.error('Service Worker registration failed:', error);
    });
}