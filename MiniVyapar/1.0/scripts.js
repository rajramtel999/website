

// LocalStorage keys
const INVENTORY_KEY = 'mini-vyapar-inventory';
const SALES_KEY = 'mini-vyapar-sales';
const EXPENSES_KEY = 'mini-vyapar-expenses';

// DOM elements

// Inventory
const inventoryForm = document.getElementById('inventory-form');
const inventoryProductInput = document.getElementById('inventory-product');
const inventoryQuantityInput = document.getElementById('inventory-quantity');
const inventoryTableBody = document.querySelector('#inventory-table tbody');
const inventoryCancelBtn = document.getElementById('inventory-cancel-edit');
const inventoryIdInput = document.getElementById('inventory-id');
const inventorySubmitBtn = document.getElementById('inventory-submit-btn');

// Sales
const salesForm = document.getElementById('sales-form');
const saleProductInput = document.getElementById('sale-product');
const saleQuantityInput = document.getElementById('sale-quantity');
const salePriceInput = document.getElementById('sale-price');
const salesTableBody = document.querySelector('#sales-table tbody');
const salesCancelBtn = document.getElementById('sales-cancel-edit');
const saleIdInput = document.getElementById('sale-id');
const salesSubmitBtn = document.getElementById('sales-submit-btn');
const productDatalist = document.getElementById('product-list');

// Expenses
const expensesForm = document.getElementById('expenses-form');
const expenseDescInput = document.getElementById('expense-desc');
const expenseAmountInput = document.getElementById('expense-amount');
const expensesTableBody = document.querySelector('#expenses-table tbody');
const expensesCancelBtn = document.getElementById('expenses-cancel-edit');
const expenseIdInput = document.getElementById('expense-id');
const expensesSubmitBtn = document.getElementById('expenses-submit-btn');

// Utility functions for localStorage
function loadData(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// --- Inventory management ---
function renderInventory() {
  const inventory = loadData(INVENTORY_KEY);
  inventoryTableBody.innerHTML = '';
  inventory.forEach(({ id, product, quantity }) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${product}</td>
      <td>${quantity}</td>
      <td>
        <button class="actions-btn edit-btn" data-id="${id}" data-type="inventory-edit">Edit</button>
        <button class="actions-btn" data-id="${id}" data-type="inventory-delete">Delete</button>
      </td>
    `;
    inventoryTableBody.appendChild(tr);
  });
  updateProductDatalist();
}

function updateProductDatalist() {
  const inventory = loadData(INVENTORY_KEY);
  productDatalist.innerHTML = '';
  inventory.forEach(({ product }) => {
    const option = document.createElement('option');
    option.value = product;
    productDatalist.appendChild(option);
  });
}

inventoryForm.addEventListener('submit', e => {
  e.preventDefault();
  const product = inventoryProductInput.value.trim();
  const quantity = parseInt(inventoryQuantityInput.value, 10);

  if (!product || isNaN(quantity) || quantity < 0) {
    alert('Please enter valid product name and stock quantity.');
    return;
  }

  const inventory = loadData(INVENTORY_KEY);
  const existingIndex = inventory.findIndex(i => i.id === inventoryIdInput.value);

  if (existingIndex >= 0) {
    // Update existing
    inventory[existingIndex].product = product;
    inventory[existingIndex].quantity = quantity;
  } else {
    // Add new
    inventory.push({
      id: crypto.randomUUID(),
      product,
      quantity,
    });
  }

  saveData(INVENTORY_KEY, inventory);
  renderInventory();
  inventoryForm.reset();
  inventoryIdInput.value = '';
  inventoryCancelBtn.classList.add('hidden');
  inventorySubmitBtn.textContent = 'Add/Update Inventory';
});

inventoryTableBody.addEventListener('click', e => {
  const target = e.target;
  if (target.tagName !== 'BUTTON') return;
  const id = target.dataset.id;
  const type = target.dataset.type;

  if (type === 'inventory-edit') {
    const inventory = loadData(INVENTORY_KEY);
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    inventoryProductInput.value = item.product;
    inventoryQuantityInput.value = item.quantity;
    inventoryIdInput.value = item.id;
    inventorySubmitBtn.textContent = 'Update Inventory';
    inventoryCancelBtn.classList.remove('hidden');
    inventoryProductInput.focus();
  } else if (type === 'inventory-delete') {
    if (confirm('Are you sure you want to delete this inventory item?')) {
      let inventory = loadData(INVENTORY_KEY);
      inventory = inventory.filter(i => i.id !== id);
      saveData(INVENTORY_KEY, inventory);
      renderInventory();
    }
  }
});

inventoryCancelBtn.addEventListener('click', () => {
  inventoryForm.reset();
  inventoryIdInput.value = '';
  inventoryCancelBtn.classList.add('hidden');
  inventorySubmitBtn.textContent = 'Add/Update Inventory';
});

// --- Sales management ---
function renderSales() {
  const sales = loadData(SALES_KEY);
  salesTableBody.innerHTML = '';
  sales.forEach(({ id, product, quantity, price }) => {
    const total = (quantity * price).toFixed(2);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${product}</td>
      <td>${quantity}</td>
      <td>${price.toFixed(2)}</td>
      <td>${total}</td>
      <td>
        <button class="actions-btn edit-btn" data-id="${id}" data-type="sales-edit">Edit</button>
        <button class="actions-btn" data-id="${id}" data-type="sales-delete">Delete</button>
      </td>
    `;
    salesTableBody.appendChild(tr);
  });
}

salesForm.addEventListener('submit', e => {
  e.preventDefault();
  const product = saleProductInput.value.trim();
  const quantity = parseInt(saleQuantityInput.value, 10);
  const price = parseFloat(salePriceInput.value);

  if (!product || isNaN(quantity) || quantity <= 0 || isNaN(price) || price < 0) {
    alert('Please enter valid product, quantity and price.');
    return;
  }

  const sales = loadData(SALES_KEY);
  const inventory = loadData(INVENTORY_KEY);
  const invItemIndex = inventory.findIndex(i => i.product.toLowerCase() === product.toLowerCase());

  if (invItemIndex < 0) {
    alert(`Product "${product}" not found in inventory.`);
    return;
  }

  if (inventory[invItemIndex].quantity < quantity) {
    alert(`Insufficient stock for "${product}". Available: ${inventory[invItemIndex].quantity}`);
    return;
  }

  const existingIndex = sales.findIndex(s => s.id === saleIdInput.value);

  if (existingIndex >= 0) {
    // Update sale: rollback previous quantity to inventory first
    const prevSale = sales[existingIndex];
    inventory[invItemIndex].quantity += prevSale.quantity;

    // Deduct new quantity
    if (inventory[invItemIndex].quantity < quantity) {
      alert(`Insufficient stock for "${product}" after updating quantity.`);
      return;
    }

    inventory[invItemIndex].quantity -= quantity;
    sales[existingIndex] = {
      id: saleIdInput.value,
      product,
      quantity,
      price,
    };
  } else {
    // New sale
    inventory[invItemIndex].quantity -= quantity;
    sales.push({
      id: crypto.randomUUID(),
      product,
      quantity,
      price,
    });
  }

  saveData(SALES_KEY, sales);
  saveData(INVENTORY_KEY, inventory);
  renderSales();
  renderInventory();

  salesForm.reset();
  saleIdInput.value = '';
  salesCancelBtn.classList.add('hidden');
  salesSubmitBtn.textContent = 'Add Sale';
});

salesTableBody.addEventListener('click', e => {
  const target = e.target;
  if (target.tagName !== 'BUTTON') return;
  const id = target.dataset.id;
  const type = target.dataset.type;

  if (type === 'sales-edit') {
    const sales = loadData(SALES_KEY);
    const sale = sales.find(s => s.id === id);
    if (!sale) return;
    saleProductInput.value = sale.product;
    saleQuantityInput.value = sale.quantity;
    salePriceInput.value = sale.price;
    saleIdInput.value = sale.id;
    salesSubmitBtn.textContent = 'Update Sale';
    salesCancelBtn.classList.remove('hidden');
    saleProductInput.focus();
  } else if (type === 'sales-delete') {
    if (confirm('Are you sure you want to delete this sale?')) {
      let sales = loadData(SALES_KEY);
      let inventory = loadData(INVENTORY_KEY);

      const sale = sales.find(s => s.id === id);
      if (!sale) return;

      // Return stock to inventory
      const invIndex = inventory.findIndex(i => i.product.toLowerCase() === sale.product.toLowerCase());
      if (invIndex >= 0) {
        inventory[invIndex].quantity += sale.quantity;
      }

      sales = sales.filter(s => s.id !== id);
      saveData(SALES_KEY, sales);
      saveData(INVENTORY_KEY, inventory);
      renderSales();
      renderInventory();
    }
  }
});

salesCancelBtn.addEventListener('click', () => {
  salesForm.reset();
  saleIdInput.value = '';
  salesCancelBtn.classList.add('hidden');
  salesSubmitBtn.textContent = 'Add Sale';
});

// --- Expenses management ---
function renderExpenses() {
  const expenses = loadData(EXPENSES_KEY);
  expensesTableBody.innerHTML = '';
  expenses.forEach(({ id, description, amount }) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${description}</td>
      <td>${amount.toFixed(2)}</td>
      <td>
        <button class="actions-btn edit-btn" data-id="${id}" data-type="expense-edit">Edit</button>
        <button class="actions-btn" data-id="${id}" data-type="expense-delete">Delete</button>
      </td>
    `;
    expensesTableBody.appendChild(tr);
  });
}

expensesForm.addEventListener('submit', e => {
  e.preventDefault();
  const description = expenseDescInput.value.trim();
  const amount = parseFloat(expenseAmountInput.value);

  if (!description || isNaN(amount) || amount < 0) {
    alert('Please enter valid expense description and amount.');
    return;
  }

  const expenses = loadData(EXPENSES_KEY);
  const existingIndex = expenses.findIndex(exp => exp.id === expenseIdInput.value);

  if (existingIndex >= 0) {
    expenses[existingIndex] = {
      id: expenseIdInput.value,
      description,
      amount,
    };
  } else {
    expenses.push({
      id: crypto.randomUUID(),
      description,
      amount,
    });
  }

  saveData(EXPENSES_KEY, expenses);
  renderExpenses();
  expensesForm.reset();
  expenseIdInput.value = '';
  expensesCancelBtn.classList.add('hidden');
  expensesSubmitBtn.textContent = 'Add Expense';
});

expensesTableBody.addEventListener('click', e => {
  const target = e.target;
  if (target.tagName !== 'BUTTON') return;
  const id = target.dataset.id;
  const type = target.dataset.type;

  if (type === 'expense-edit') {
    const expenses = loadData(EXPENSES_KEY);
    const expense = expenses.find(exp => exp.id === id);
    if (!expense) return;
    expenseDescInput.value = expense.description;
    expenseAmountInput.value = expense.amount;
    expenseIdInput.value = expense.id;
    expensesSubmitBtn.textContent = 'Update Expense';
    expensesCancelBtn.classList.remove('hidden');
    expenseDescInput.focus();
  } else if (type === 'expense-delete') {
    if (confirm('Are you sure you want to delete this expense?')) {
      let expenses = loadData(EXPENSES_KEY);
      expenses = expenses.filter(exp => exp.id !== id);
      saveData(EXPENSES_KEY, expenses);
      renderExpenses();
    }
  }
});

expensesCancelBtn.addEventListener('click', () => {
  expensesForm.reset();
  expenseIdInput.value = '';
  expensesCancelBtn.classList.add('hidden');
  expensesSubmitBtn.textContent = 'Add Expense';
});

// Initial render calls
renderInventory();
renderSales();
renderExpenses();
