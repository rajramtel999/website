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
