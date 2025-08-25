// -----------------------------
// SAMPLE DATA
// -----------------------------
let products = [
  { id: 1, name: "Milk", price: 80, stock: 15, category: "Dairy", icon: "🥛", favorite: true, sold: 20 },
  { id: 2, name: "Bread", price: 50, stock: 10, category: "Bakery", icon: "🍞", favorite: true, sold: 15 },
  { id: 3, name: "Rice", price: 1200, stock: 25, category: "Grains", icon: "🍚", favorite: false, sold: 30 },
  { id: 4, name: "Sugar", price: 90, stock: 5, category: "Essentials", icon: "🧂", favorite: false, sold: 10 },
  { id: 5, name: "Eggs", price: 12, stock: 40, category: "Poultry", icon: "🥚", favorite: false, sold: 50 },
  { id: 6, name: "Cooking Oil", price: 250, stock: 8, category: "Essentials", icon: "🛢️", favorite: true, sold: 25 }
];

let expenses = [
  { id: 1, name: "Electricity Bill", amount: 1200 },
  { id: 2, name: "Transport", amount: 500 }
];

let salesHistory = [];
let cart = [];

// Product categories
const productCategories = [
  "Dairy", "Bakery", "Grains", "Essentials", "Poultry", "Fruits", "Vegetables", 
  "Beverages", "Snacks", "Cleaning", "Personal Care", "Other"
];

// -----------------------------
// TOAST
// -----------------------------
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

// -----------------------------
// CART FUNCTIONS
// -----------------------------
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product || product.stock <= 0) {
    showToast("Out of stock!");
    return;
  }
  let item = cart.find(i => i.id === productId);
  if (item) {
    if (item.qty < product.stock) {
      item.qty++;
    } else {
      showToast("Reached maximum stock!");
    }
  } else {
    cart.push({ ...product, qty: 1 });
  }
  updateCart();
  showToast(`${product.name} added to cart`);
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  updateCart();
}

function updateQuantity(productId, newQty) {
  if (newQty <= 0) {
    removeFromCart(productId);
    return;
  }
  
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  if (newQty > product.stock) {
    showToast("Quantity exceeds available stock!");
    return;
  }
  
  const item = cart.find(i => i.id === productId);
  if (item) {
    item.qty = newQty;
  }
  
  updateCart();
}

function updateCart() {
  const cartItems = document.getElementById("cart-items");
  cartItems.innerHTML = "";
  let subtotal = 0;

  cart.forEach(item => {
    let cartItem = document.createElement("div");
    cartItem.className = "cart-item";
    
    let itemTotal = item.price * item.qty;
    subtotal += itemTotal;
    
    cartItem.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">Rs ${item.price} × ${item.qty}</div>
      </div>
      <div class="cart-item-controls">
        <div class="quantity-control">
          <button class="quantity-btn minus-btn" onclick="updateQuantity(${item.id}, ${item.qty - 1})">−</button>
          <span class="quantity-value">${item.qty}</span>
          <button class="quantity-btn plus-btn" onclick="updateQuantity(${item.id}, ${item.qty + 1})">+</button>
        </div>
        <button class="remove-btn" onclick="removeFromCart(${item.id})">×</button>
      </div>
    `;
    
    cartItems.appendChild(cartItem);
  });

  const tax = Math.round(subtotal * 0.13);
  const total = subtotal + tax;

  document.getElementById("cart-count").innerText = `(${cart.length})`;
  document.getElementById("cart-subtotal").innerText = `Rs ${subtotal}`;
  document.getElementById("cart-tax").innerText = `Rs ${tax}`;
  document.getElementById("cart-grand-total").innerText = `Rs ${total}`;
  document.getElementById("cart-total").innerText = `Rs ${total}`;

  document.getElementById("cart-bottom-bar").dataset.state = cart.length ? "visible" : "hidden";
}

document.getElementById("btn-checkout").addEventListener("click", () => {
  if (!cart.length) return;
  let subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  let tax = Math.round(subtotal * 0.13);
  let total = subtotal + tax;

  salesHistory.push({ items: [...cart], total, date: new Date() });
  cart.forEach(item => {
    let prod = products.find(p => p.id === item.id);
    if (prod) prod.stock -= item.qty;
    prod.sold += item.qty;
  });
  cart = [];
  updateCart();
  renderQuickItems();
  renderProducts();
  renderInventory();
  renderDashboard();
  renderActivities();
  showToast("Sale completed successfully ✅");
});

// -----------------------------
// RENDER FUNCTIONS
// -----------------------------
function renderQuickItems() {
  const grid = document.getElementById("quick-items-grid");
  grid.innerHTML = "";
  products.slice(0, 4).forEach(p => {
    let div = document.createElement("div");
    div.className = "quick-item";
    div.innerHTML = `
      <div class="quick-item-image">${p.icon}</div>
      <div class="quick-item-name">${p.name}</div>
      <div class="quick-item-price">Rs ${p.price}</div>
    `;
    div.onclick = () => addToCart(p.id);
    grid.appendChild(div);
  });
}

function renderProducts(filter = "all", search = "") {
  const grid = document.getElementById("product-grid");
  grid.innerHTML = "";

  let filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (filter === "favorites") filtered = filtered.filter(p => p.favorite);
  if (filter === "top-sellers") filtered = [...filtered].sort((a, b) => b.sold - a.sold).slice(0, 5);

  filtered.forEach(p => {
    let card = document.createElement("div");
    card.className = "product-card" + (p.favorite ? " favorite" : "");
    card.innerHTML = `
      <div class="product-image">${p.icon}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-price">Rs ${p.price}</div>
      <div class="product-stock">Stock: ${p.stock}</div>
    `;
    card.onclick = () => addToCart(p.id);
    grid.appendChild(card);
  });
}

function renderInventory() {
  const list = document.getElementById("inventory-list");
  list.innerHTML = "";
  products.forEach(p => {
    let div = document.createElement("div");
    div.className = "inventory-item";
    div.innerHTML = `
      <div>
        <div class="name">${p.name}</div>
        <div class="meta">Stock: ${p.stock} • Rs ${p.price}</div>
      </div>
      <div class="tag">${p.category}</div>
    `;
    list.appendChild(div);
  });
}

function renderExpenses() {
  const list = document.getElementById("expenses-list");
  list.innerHTML = "";
  expenses.forEach(e => {
    let div = document.createElement("div");
    div.className = "expense-item";
    div.innerHTML = `
      <div>${e.name}</div>
      <div class="amount">- Rs ${e.amount}</div>
    `;
    list.appendChild(div);
  });
}

function renderDashboard() {
  const salesToday = salesHistory.reduce((s, sale) => s + sale.total, 0);
  document.getElementById("dashboard-sales").innerText = `Rs ${salesToday}`;
  document.getElementById("dashboard-alerts").innerText =
    products.filter(p => p.stock < 5).length + " items";
  const expensesToday = expenses.reduce((s, e) => s + e.amount, 0);
  document.getElementById("dashboard-expenses").innerText = `Rs ${expensesToday}`;
}

function renderActivities() {
  const feed = document.getElementById("activity-feed");
  feed.innerHTML = "";
  if (!salesHistory.length) {
    document.getElementById("empty-activity").style.display = "flex";
    return;
  }
  document.getElementById("empty-activity").style.display = "none";
  salesHistory.slice(-5).forEach(sale => {
    let li = document.createElement("li");
    li.innerHTML = `
      <span>🛒 Sale</span>
      <span class="amt">+ Rs ${sale.total}</span>
    `;
    feed.appendChild(li);
  });
}

// -----------------------------
// NAVIGATION
// -----------------------------
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById("page-" + btn.dataset.page).classList.add("active");
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Back button functionality
document.getElementById("btn-back-dashboard").addEventListener("click", () => {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("page-dashboard").classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.querySelector('[data-page="dashboard"]').classList.add("active");
});

// -----------------------------
// SEARCH & FILTERS
// -----------------------------
let currentTab = "favorites";
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentTab = tab.dataset.tab;
    renderProducts(currentTab, document.getElementById("search-products").value);
  });
});

document.getElementById("search-products").addEventListener("input", e => {
  renderProducts(currentTab, e.target.value);
});

// -----------------------------
// BOTTOM SHEETS
// -----------------------------
const sheetProduct = document.getElementById("sheet-product");
const sheetExpense = document.getElementById("sheet-expense");

document.getElementById("btn-add-product").addEventListener("click", () => {
  renderAddProductForm();
  sheetProduct.classList.add("active");
});

document.getElementById("btn-add-expense").addEventListener("click", () => {
  renderAddExpenseForm();
  sheetExpense.classList.add("active");
});

document.getElementById("cancel-product").addEventListener("click", () => {
  sheetProduct.classList.remove("active");
});

document.getElementById("cancel-expense").addEventListener("click", () => {
  sheetExpense.classList.remove("active");
});

// -----------------------------
// RENDER FORMS
// -----------------------------
function renderAddProductForm() {
  const form = document.getElementById("product-form");
  form.innerHTML = "";
  
  // Product Name
  const nameItem = document.createElement("div");
  nameItem.className = "cart-item";
  nameItem.innerHTML = `
    <div class="cart-item-info">
      <div class="cart-item-name">Product Name</div>
      <input type="text" id="new-prod-name" placeholder="Enter product name" value="">
    </div>
  `;
  form.appendChild(nameItem);
  
  // Price and Stock
  const priceStockItem = document.createElement("div");
  priceStockItem.className = "cart-item";
  priceStockItem.innerHTML = `
    <div class="cart-item-info">
      <div class="cart-item-name">Price & Stock</div>
      <div class="form-row">
        <div class="form-group">
          <input type="number" id="new-prod-price" placeholder="Price (Rs)" value="">
        </div>
        <div class="form-group">
          <input type="number" id="new-prod-stock" placeholder="Stock" value="">
        </div>
      </div>
    </div>
  `;
  form.appendChild(priceStockItem);
  
  // Category
  const categoryItem = document.createElement("div");
  categoryItem.className = "cart-item";
  let categoryOptions = productCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
  categoryItem.innerHTML = `
    <div class="cart-item-info">
      <div class="cart-item-name">Category</div>
      <select id="new-prod-category">
        <option value="">Select category</option>
        ${categoryOptions}
      </select>
    </div>
  `;
  form.appendChild(categoryItem);
  
  // Icon
  const iconItem = document.createElement("div");
  iconItem.className = "cart-item";
  iconItem.innerHTML = `
    <div class="cart-item-info">
      <div class="cart-item-name">Icon (emoji)</div>
      <input type="text" id="new-prod-icon" placeholder="e.g. 🥛, 🍞" value="">
    </div>
  `;
  form.appendChild(iconItem);
  
  // Favorite
  const favItem = document.createElement("div");
  favItem.className = "cart-item";
  favItem.innerHTML = `
    <div class="cart-item-info">
      <div class="cart-item-name">Favorite</div>
      <label class="checkbox-group">
        <input type="checkbox" id="new-prod-fav">
        <span>Add to favorites</span>
      </label>
    </div>
  `;
  form.appendChild(favItem);
}

function renderAddExpenseForm() {
  const form = document.getElementById("expense-form");
  form.innerHTML = "";
  
  // Expense Name
  const nameItem = document.createElement("div");
  nameItem.className = "cart-item";
  nameItem.innerHTML = `
    <div class="cart-item-info">
      <div class="cart-item-name">Expense Title</div>
      <input type="text" id="new-exp-name" placeholder="e.g. Electricity Bill" value="">
    </div>
  `;
  form.appendChild(nameItem);
  
  // Amount
  const amountItem = document.createElement("div");
  amountItem.className = "cart-item";
  amountItem.innerHTML = `
    <div class="cart-item-info">
      <div class="cart-item-name">Amount (Rs)</div>
      <input type="number" id="new-exp-amount" placeholder="Enter amount" value="">
    </div>
  `;
  form.appendChild(amountItem);
}

// -----------------------------
// SAVE FUNCTIONS
// -----------------------------
document.getElementById("save-product").addEventListener("click", () => {
  const name = document.getElementById("new-prod-name").value.trim();
  const price = parseFloat(document.getElementById("new-prod-price").value);
  const stock = parseInt(document.getElementById("new-prod-stock").value);
  const category = document.getElementById("new-prod-category").value.trim();
  const icon = document.getElementById("new-prod-icon").value || "📦";
  const fav = document.getElementById("new-prod-fav").checked;

  if (!name || !price || !stock || !category) {
    showToast("Please fill all required fields!");
    return;
  }

  if (price <= 0 || stock <= 0) {
    showToast("Price and stock must be greater than zero!");
    return;
  }

  products.push({
    id: Date.now(),
    name, price, stock, category, icon, favorite: fav, sold: 0
  });

  renderProducts();
  renderInventory();
  renderDashboard();
  sheetProduct.classList.remove("active");
  showToast("New product added successfully ✅");
});

document.getElementById("save-expense").addEventListener("click", () => {
  const name = document.getElementById("new-exp-name").value.trim();
  const amount = parseFloat(document.getElementById("new-exp-amount").value);

  if (!name || !amount) {
    showToast("Please fill all required fields!");
    return;
  }

  if (amount <= 0) {
    showToast("Amount must be greater than zero!");
    return;
  }

  expenses.push({
    id: Date.now(),
    name, amount
  });

  renderExpenses();
  renderDashboard();
  sheetExpense.classList.remove("active");
  showToast("New expense added successfully ✅");
});

// -----------------------------
// FLOATING ACTION BUTTON
// -----------------------------
document.getElementById("fab-add-sale").addEventListener("click", () => {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("page-sales").classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.querySelector('[data-page="sales"]').classList.add("active");
  showToast("Add new sale");
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('✅ Service worker registered', reg))
      .catch(err => console.error('❌ Service worker registration failed:', err));
  });
}

if ('serviceWorker' in navigator && 'periodicSync' in navigator.serviceWorker) {
  navigator.serviceWorker.ready.then(async (registration) => {
    try {
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync',
      });

      if (status.state === 'granted') {
        // Register periodic sync every 24 hours (can be less or more)
        await registration.periodicSync.register('content-sync', {
          minInterval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        });
        console.log('Periodic background sync registered');
      } else {
        console.log('Periodic background sync permission not granted');
      }
    } catch (error) {
      console.error('Periodic background sync could not be registered', error);
    }
  });
} else {
  console.log('Periodic background sync is not supported in this browser.');
}

// -----------------------------
// INIT
// -----------------------------
renderQuickItems();
renderProducts();
renderInventory();
renderExpenses();
renderDashboard();
renderActivities();