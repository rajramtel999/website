// Global variables
let cart = {};
let cartTotalAmount = 0;
let isCartMinimized = false;

// Transaction history storage
let transactionHistory = [];

// Data storage arrays
let inventoryData = [];
let salesData = [];
let expensesData = [];

// Inventory page state variables
let currentInventoryFilter = 'all';
let currentInventoryView = 'grid';

// Storage system initialization
let storageReady = false;

// Initialize storage system on app start
async function initializeApp() {
    try {
        console.log('Initializing Mini Vyapar app...');
        
        // Initialize storage system and wait for completion
        await MiniVyaparStorage.initializeStorage();
        storageReady = true;
        console.log('Storage initialized and ready');
        
        // Load saved preferences
        loadUserPreferences();
        
        // Load and apply saved language
        loadSavedLanguage();
        
        // Load and apply saved theme
        loadSavedTheme();
        
        // Remove any existing demo products (one-time cleanup)
        if (window.MiniVyaparStorage && typeof MiniVyaparStorage.removeDemoProducts === 'function') {
            await MiniVyaparStorage.removeDemoProducts();
        }
        
        // Load all real data from storage
        console.log('=== CALLING loadAllRealData() ===');
        await loadAllRealData();
        console.log('=== AFTER loadAllRealData(), inventoryData length:', inventoryData.length, '===');
        
        // Load credit data and clear any sample data
        loadCreditsData();
        
        // Load expenses data
        loadExpensesData();
        
        // DON'T call loadInventoryData() here - it conflicts with loadAllRealData()
        // loadInventoryData(); // REMOVED: This was overriding IndexedDB data with localStorage
        
        // Clear any existing sample credit data on first load
        const isFirstLoad = !localStorage.getItem('miniVyapar_creditsCleared');
        if (isFirstLoad) {
            clearAllCreditsData();
            localStorage.setItem('miniVyapar_creditsCleared', 'true');
        }
        
        // Load cart state
        loadSavedCartState();
        
        // Load favorites
        loadFavorites();
        
        // Load transaction history from IndexedDB (with error handling)
        try {
            await loadTransactionHistoryFromDB();
        } catch (error) {
            console.error('Error loading transaction history:', error);
        }
        
        // Update dashboard with real data
        updateDashboardData();
        
        // Initialize dashboard in collapsed state
        initializeDashboardState();
        
        // Load real quick items from inventory
        refreshQuickItemsFromInventory();
        
        console.log('App initialization completed');
    } catch (error) {
        console.error('Error initializing app:', error);
        // App can still function with basic features even if storage fails
        console.log('App will run in limited mode without persistence');
        storageReady = false;
    }
}

// Load user preferences from localStorage
function loadUserPreferences() {
    try {
        const theme = MiniVyaparStorage.getPreference('theme', 'light');
        const lastPage = MiniVyaparStorage.getPreference('lastPage', 'home');
        const tutorialSeen = MiniVyaparStorage.getPreference('tutorialSeen', false);
        
        // Apply theme
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        }
        
        // Show tutorial if not seen
        if (!tutorialSeen) {
            setTimeout(() => showTutorial(), 2000);
        }
        
        console.log('User preferences loaded:', { theme, lastPage, tutorialSeen });
    } catch (error) {
        console.error('Error loading preferences:', error);
    }
}

// Load saved cart state
function loadSavedCartState() {
    try {
        if (storageReady) {
            const savedCart = MiniVyaparStorage.loadCartState();
            if (savedCart && savedCart.length > 0) {
                // Convert array back to object format for existing cart system
                cart = {};
                savedCart.forEach(item => {
                    cart[item.id || item.name] = item;
                });
                updateCart();
                console.log('Cart state loaded from storage');
            }
        }
    } catch (error) {
        console.error('Error loading cart state:', error);
    }
}

// Save current cart state
function saveCurrentCartState() {
    try {
        if (storageReady) {
            const cartArray = Object.values(cart);
            MiniVyaparStorage.saveCartState(cartArray);
        }
    } catch (error) {
        console.error('Error saving cart state:', error);
    }
}

// Load transaction history from IndexedDB sales
async function loadTransactionHistoryFromDB() {
    try {
        if (!storageReady || !MiniVyaparStorage) {
            console.log('Storage not ready, skipping transaction history load');
            return;
        }
        
        const sales = await MiniVyaparStorage.getAllSales();
        
        // Convert sales to transaction history format
        transactionHistory = sales.map(sale => ({
            id: sale.id,
            timestamp: sale.timestamp,
            items: sale.items,
            total: sale.total,
            type: 'sale'
        })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Display recent transactions
        displayRecentTransactions();
        
        console.log(`Loaded ${transactionHistory.length} transactions from database`);
    } catch (error) {
        console.error('Error loading transaction history:', error);
    }
}

// Show tutorial for new users
async function showTutorial() {
    const tutorial = await showCustomConfirm(
        'Welcome to Mini Vyapar POS!\n\n' +
        '• Use Quick Items to add products quickly\n' +
        '• Swipe gestures: Right (+1), Up (+5), Left (-1), Down (-5)\n' +
        '• Your data is saved offline automatically\n' +
        '• Access Sales, Inventory, and Expenses from the floating menu\n\n' +
        'Click OK to mark tutorial as seen.',
        'Welcome to Mini Vyapar POS!',
        '👋',
        'Got it!',
        'Skip',
        false
    );
    
    if (tutorial) {
        MiniVyaparStorage.savePreference('tutorialSeen', true);
    }
}

// Initialize preferences from localStorage
function initializeTransactionHistory() {
    const saved = localStorage.getItem('vyapar_transactions');
    if (saved) {
        try {
            transactionHistory = JSON.parse(saved);
        } catch (error) {
            console.log('Error loading transaction history:', error);
            transactionHistory = [];
        }
    }
}

// Save transaction history to localStorage
function saveTransactionHistory() {
    try {
        localStorage.setItem('vyapar_transactions', JSON.stringify(transactionHistory));
    } catch (error) {
        console.log('Error saving transaction history:', error);
    }
}

// Add new transaction to history and IndexedDB
async function addTransaction(items, total, type = 'sale') {
    try {
        const transaction = {
            timestamp: new Date(),
            items: [...items],
            total: total,
            type: type
        };
        
        // Add to IndexedDB if storage is ready
        if (storageReady) {
            const saleData = {
                timestamp: transaction.timestamp,
                items: items.map(item => ({
                    productId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    total: item.price * item.quantity,
                    costPrice: item.costPrice || 0  // Store cost price for profit calculation
                })),
                total: total,
                paymentType: type === 'checkout' ? 'cash' : 'sale'
            };
            
            const saleId = await MiniVyaparStorage.addSale(saleData);
            transaction.id = saleId;
            
            // Update product stock for actual products
            for (const item of items) {
                if (item.id && typeof item.id === 'number') {
                    try {
                        const product = await MiniVyaparStorage.getDB().getProduct(item.id);
                        if (product) {
                            product.stock = Math.max(0, product.stock - item.quantity);
                            await MiniVyaparStorage.updateProduct(product);
                        }
                    } catch (error) {
                        console.warn(`Could not update stock for product ${item.id}:`, error);
                    }
                }
            }
        } else {
            // Fallback to local storage
            transaction.id = Date.now();
            saveTransactionHistory();
        }
        
        // Add to local transaction history
        transactionHistory.unshift(transaction);
        
        // Keep only last 50 transactions in memory
        if (transactionHistory.length > 50) {
            transactionHistory = transactionHistory.slice(0, 50);
        }
        
        // Update the display
        displayRecentTransactions();
        
        // Update dashboard with new transaction data
        updateDashboardData();
        
        // Refresh all real data to keep in sync
        await refreshDataAfterTransaction();
        
        console.log('Transaction added successfully:', transaction);
    } catch (error) {
        console.error('Error adding transaction:', error);
        
        // Fallback: add to local storage only
        const transaction = {
            id: Date.now(),
            timestamp: new Date(),
            items: [...items],
            total: total,
            type: type
        };
        
        transactionHistory.unshift(transaction);
        saveTransactionHistory();
        displayRecentTransactions();
    }
}

// Display recent transactions in the UI
function displayRecentTransactions() {
    const container = document.getElementById('transactionsContainer');
    
    if (!container) return;
    
    // Combine sales transactions and expenses
    let allTransactions = [];
    
    // Add sales transactions
    if (transactionHistory && transactionHistory.length > 0) {
        allTransactions = [...transactionHistory];
    }
    
    // Add expense transactions
    if (expensesData && expensesData.length > 0) {
        const expenseTransactions = expensesData.map(expense => ({
            id: expense.id || Date.now(),
            timestamp: expense.date || new Date(),
            items: [{
                name: expense.description || 'Expense',
                price: expense.amount || 0,
                quantity: 1,
                total: expense.amount || 0
            }],
            total: expense.amount || 0,
            type: 'expense'
        }));
        allTransactions.push(...expenseTransactions);
    }
    
    // Sort by timestamp (newest first)
    allTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (allTransactions.length === 0) {
        // Create no transactions content
        container.innerHTML = `
            <div class="no-transactions" id="noTransactions">
                <div class="no-transactions-icon">📋</div>
                <div class="no-transactions-text">No recent transactions</div>
                <div class="no-transactions-subtext">Complete a sale or add expenses to see transactions here</div>
            </div>
        `;
        return;
    }
    
    // Display recent transactions (limit to 5 for UI)
    const recentTransactions = allTransactions.slice(0, 5);
    
    let html = '';
    recentTransactions.forEach(transaction => {
        const date = new Date(transaction.timestamp);
        const timeStr = date.toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        const dateStr = date.toLocaleDateString('en-IN');
        
        html += `
            <div class="transaction-item">
                <div class="transaction-header">
                    <div>
                        <div class="transaction-id">#${transaction.id.toString().slice(-6)}</div>
                        <div class="transaction-time">${dateStr} at ${timeStr}</div>
                    </div>
                    <div class="transaction-type ${transaction.type}">${transaction.type}</div>
                </div>
                <div class="transaction-items">
        `;
        
        transaction.items.forEach(item => {
            html += `
                <div class="transaction-item-row">
                    <div class="item-name">${item.name}</div>
                    <div class="item-details">Rs ${item.price} × ${item.quantity} = Rs ${item.total}</div>
                </div>
            `;
        });
        
        html += `
                </div>
                <div class="transaction-total">Total: Rs ${transaction.total}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Clear transaction history
async function clearTransactionHistory() {
    const confirmed = await showCustomConfirm(
        'Are you sure you want to clear all transaction history? This action cannot be undone.',
        'Clear Transaction History',
        '🗑️',
        'Clear History',
        'Cancel',
        true
    );
    
    if (confirmed) {
        transactionHistory = [];
        saveTransactionHistory();
        displayRecentTransactions();
        
        // Show success message
        showCustomNotification('Transaction history cleared successfully!', 'success', 'History Cleared');
    }
}

// Reset all data to start fresh
async function resetAllData() {
    const confirmed = await showCustomConfirm(
        'This will permanently delete:\n• All products from inventory\n• All transaction history\n• All cart items\n• All expenses data\n• All stored preferences\n\nAre you sure you want to start fresh?',
        '⚠️ RESET ALL DATA',
        '⚠️',
        'Reset Everything',
        'Cancel',
        true
    );
    
    if (confirmed) {
        console.log('Starting reset process...');
        
        // Clear in-memory data first
        cart = {};
        cartTotalAmount = 0;
        transactionHistory = [];
        inventoryData = [];
        expensesData = [];
        if (typeof saleCart !== 'undefined') {
            saleCart = [];
        }
        
        // Clear localStorage
        localStorage.clear();
        console.log('LocalStorage cleared');
        
        // Clear IndexedDB (if available) with better error handling
        if (storageReady && MiniVyaparStorage) {
            try {
                console.log('Attempting to clear IndexedDB...');
                await MiniVyaparStorage.clearAllData();
                console.log('IndexedDB clearing completed');
            } catch (error) {
                console.log('Note: Could not clear IndexedDB data:', error);
                // Continue anyway - this isn't fatal
            }
        } else {
            console.log('Storage not ready or not available');
        }
        
        // Update UI
        updateCart();
        displayRecentTransactions();
        loadInventoryList();
        loadExpensesList();
        updateSaleCartDisplay();
        
        // Update dashboard with reset data
        updateDashboardData();
        
        // Reset chart to show empty data
        if (typeof drawWireframeChart === 'function') {
            drawWireframeChart();
        }
        
        // Clear and refresh quick items
        refreshQuickItemsFromInventory();
        
        showToast('🎉 All data reset successfully! You can now start adding your own products.');
        
        console.log('All data has been reset to start fresh');
    }
}

// Global function to show toast notification
function showToast(message) {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2000);
  }
}

// ===============================
// DASHBOARD DATA FUNCTIONS
// ===============================

// Update dashboard with real data
function updateDashboardData() {
    updateTodaysSales();
    updateInventoryAlerts();
    updateTodaysExpenses();
    updateCreditDashboard();
    updateSalesChart();
    updateProductProfitDashboard(); // Add product profit calculation
    displayRecentTransactions(); // Also update recent transactions display
}

// Calculate and update today's sales
function updateTodaysSales() {
    const today = new Date().toDateString();
    let todayTotal = 0;
    let todayTransactionCount = 0;
    
    // Calculate from transaction history only
    if (transactionHistory && transactionHistory.length > 0) {
        transactionHistory.forEach(transaction => {
            const transactionDate = new Date(transaction.timestamp).toDateString();
            if (transactionDate === today) {
                todayTotal += transaction.total || 0;
                todayTransactionCount++;
            }
        });
    }
    
    // Update UI
    const salesCard = document.getElementById('todaySalesCard');
    const transactionsCard = document.getElementById('todayTransactionsCard');
    
    if (salesCard) salesCard.textContent = `Rs ${todayTotal}`;
    if (transactionsCard) transactionsCard.textContent = `${todayTransactionCount} transactions`;
}

// Calculate and update inventory alerts
function updateInventoryAlerts() {
    let lowStockCount = 0;
    
    if (inventoryData && inventoryData.length > 0) {
        lowStockCount = inventoryData.filter(product => {
            const threshold = product.lowStockThreshold || 10;
            return product.stock <= threshold;
        }).length;
    }
    
    const alertsCard = document.getElementById('inventoryAlertsCard');
    if (alertsCard) alertsCard.textContent = lowStockCount;
}

// Show low stock items modal
function showLowStockItems() {
    const modal = document.getElementById('lowStockModal');
    const lowStockList = document.getElementById('lowStockList');
    
    if (!modal || !lowStockList) return;
    
    // Get low stock items
    const lowStockItems = [];
    if (inventoryData && inventoryData.length > 0) {
        inventoryData.forEach(product => {
            const threshold = product.lowStockThreshold || 10;
            if (product.stock <= threshold) {
                lowStockItems.push(product);
            }
        });
    }
    
    // Generate low stock list HTML
    if (lowStockItems.length === 0) {
        lowStockList.innerHTML = `
            <div class="no-low-stock">
                <div class="icon">✅</div>
                <h4>All Good!</h4>
                <p>No items are currently low in stock</p>
            </div>
        `;
    } else {
        // Sort by stock level (lowest first)
        lowStockItems.sort((a, b) => a.stock - b.stock);
        
        lowStockList.innerHTML = lowStockItems.map(product => {
            const threshold = product.lowStockThreshold || 10;
            const stockLevel = product.stock === 0 ? 'critical' : 'low';
            const stockClass = product.stock === 0 ? 'stock-critical' : 'stock-low';
            
            return `
                <div class="low-stock-item">
                    <div class="low-stock-info">
                        <div class="low-stock-name">${product.emoji || '📦'} ${product.name}</div>
                        <div class="low-stock-details">
                            Category: ${product.category || 'Uncategorized'} | 
                            Threshold: ${threshold} | 
                            Price: Rs ${product.sellingPrice}
                        </div>
                    </div>
                    <div class="low-stock-stock ${stockClass}">
                        ${product.stock === 0 ? 'OUT OF STOCK' : `${product.stock} left`}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Show modal
    modal.style.display = 'flex';
}

// Close low stock modal
function closeLowStockModal() {
    const modal = document.getElementById('lowStockModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Calculate and update today's expenses
function updateTodaysExpenses() {
    const today = new Date().toDateString();
    let todayExpensesTotal = 0;
    let todayExpensesCount = 0;
    
    if (expensesData && expensesData.length > 0) {
        expensesData.forEach(expense => {
            const expenseDate = new Date(expense.date).toDateString();
            if (expenseDate === today) {
                todayExpensesTotal += expense.amount || 0;
                todayExpensesCount++;
            }
        });
    }
    
    const expensesCard = document.getElementById('todayExpensesCard');
    const expenseEntriesCard = document.getElementById('todayExpenseEntriesCard');
    
    if (expensesCard) expensesCard.textContent = `Rs ${todayExpensesTotal}`;
    if (expenseEntriesCard) expenseEntriesCard.textContent = `${todayExpensesCount} entries`;
}

// Update sales chart with real data
function updateSalesChart() {
    if (typeof drawWireframeChart === 'function') {
        drawWireframeChart();
    }
}

// Refresh quick items from inventory
function refreshQuickItemsFromInventory() {
    const quickItemsGrid = document.getElementById('quickItemsGrid');
    const noQuickItems = document.getElementById('noQuickItems');
    
    if (!quickItemsGrid) return;
    
    // Clear existing items
    quickItemsGrid.innerHTML = '';
    
    if (!inventoryData || inventoryData.length === 0) {
        // Show no items message
        quickItemsGrid.innerHTML = `
            <div class="no-quick-items" id="noQuickItems">
                <div class="no-quick-items-text">No products in inventory</div>
                <div class="no-quick-items-subtitle">Add products to inventory to see them here</div>
            </div>
        `;
        return;
    }
    
    // Add all inventory items as quick items (limit to first 12 for performance)
    const itemsToShow = inventoryData.slice(0, 12);
    
    itemsToShow.forEach((product, index) => {
        const quickItem = document.createElement('div');
        quickItem.className = 'quick-item';
        if (index >= 6) quickItem.classList.add('hidden-item');
        
        quickItem.setAttribute('data-product', product.id);
        quickItem.setAttribute('data-price', product.sellingPrice);
        quickItem.setAttribute('data-name', product.name);
        
        const emoji = product.emoji || getProductEmoji(product.category);
        
        quickItem.innerHTML = `
            <div class="quick-item-image">${emoji}</div>
            <div class="quick-item-name">${product.name}</div>
            <div class="quick-item-price">Rs ${product.sellingPrice}</div>
            <div class="quantity-badge" style="display: none;">0</div>
        `;
        
        quickItemsGrid.appendChild(quickItem);
    });
    
    // Re-attach event listeners
    setupQuickItemListeners();
}

// Global function to update cart display
function updateCart() {
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");
  const cartBottomBar = document.getElementById("cartBottomBar");
  
  if (!cartItems || !cartTotal || !cartBottomBar) return;
  
  cartItems.innerHTML = "";
  cartTotalAmount = 0;

  console.log('=== UPDATE CART DEBUG ===');
  console.log('Cart object:', cart);

  Object.keys(cart).forEach((productId) => {
    if (cart[productId].quantity > 0) {
      const item = cart[productId];
      // Ensure price is a number
      const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
      const quantity = typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0;
      const itemTotal = price * quantity;
      cartTotalAmount += itemTotal;
      
      console.log(`Item: ${item.name}, Price: ${price} (type: ${typeof price}), Quantity: ${quantity}, Total: ${itemTotal}`);

      const cartItemEl = document.createElement("div");
      cartItemEl.className = "cart-item";
      cartItemEl.innerHTML = `
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-qty">
          <div class="qty-btn" data-action="decrease" data-product="${productId}">-</div>
          <span>${quantity}</span>
          <div class="qty-btn" data-action="increase" data-product="${productIdRs}">+</div>
        </div>
        <div class="cart-item-price">Rs ${itemTotal.toFixed(2)}</div>
      `;
      cartItems.appendChild(cartItemEl);
    }
  });

  console.log('Final cart total amount:', cartTotalAmount);
  cartTotal.textContent = `Total: Rs ${cartTotalAmount.toFixed(2)}`;

  // Show/hide cart using the existing CSS classes
  if (cartTotalAmount > 0) {
    cartBottomBar.classList.add("visible");
  } else {
    cartBottomBar.classList.remove("visible");
  }
  
  // Save cart state to storage
  saveCurrentCartState();
}

// Helper function to save inventory data to storage
async function saveInventoryData() {
  try {
    if (storageReady && typeof MiniVyaparStorage !== 'undefined') {
      console.log('=== SAVING INVENTORY DATA TO INDEXEDDB ===');
      console.log('Products to save:', inventoryData.length);
      
      // Get existing products from database
      const existingProducts = await MiniVyaparStorage.getAllProducts() || [];
      const existingIds = existingProducts.map(p => p.id);
      
      // Save each product to IndexedDB
      for (const product of inventoryData) {
        try {
          if (existingIds.includes(product.id)) {
            // Update existing product
            await MiniVyaparStorage.updateProduct(product);
            console.log('Updated existing product:', product.name);
          } else {
            // Add new product
            await MiniVyaparStorage.addProduct(product);
            console.log('Added new product:', product.name);
          }
        } catch (error) {
          console.error(`Error saving product ${product.name}:`, error);
        }
      }
      console.log('✅ Inventory data saved to IndexedDB');
    } else {
      // Fallback to localStorage
      localStorage.setItem('miniVyapar_inventoryData', JSON.stringify(inventoryData));
      console.log('⚠️ Inventory data saved to localStorage (fallback)');
    }
  } catch (error) {
    console.error('❌ Error saving inventory data:', error);
  }
}

// Helper function to load inventory data from storage
function loadInventoryData() {
  try {
    let loadedData = null;
    
    if (typeof MiniVyaparStorage !== 'undefined' && MiniVyaparStorage.getPreference) {
      loadedData = MiniVyaparStorage.getPreference('inventoryData', []);
    } else {
      // Fallback to direct localStorage
      const stored = localStorage.getItem('miniVyapar_inventoryData');
      loadedData = stored ? JSON.parse(stored) : [];
    }
    
    if (Array.isArray(loadedData)) {
      inventoryData = loadedData;
      console.log(`Loaded ${inventoryData.length} products from storage`);
    }
  } catch (error) {
    console.error('Error loading inventory data:', error);
    inventoryData = []; // Reset to empty array on error
  }
}

// Helper function to validate stock before checkout
function validateStockBeforeCheckout(cartItems) {
  const insufficientItems = [];
  
  Object.values(cartItems).forEach(item => {
    // Use ID first, then fallback to name+price
    let inventoryProduct = inventoryData.find(p => p.id.toString() === item.id.toString());
    
    if (!inventoryProduct) {
      // Fallback to name and price matching
      inventoryProduct = inventoryData.find(p => 
        p.name.toLowerCase() === item.name.toLowerCase() && 
        p.sellingPrice === item.price
      );
    }
    
    if (inventoryProduct && item.quantity > inventoryProduct.stock) {
      insufficientItems.push({
        name: item.name,
        requested: item.quantity,
        available: inventoryProduct.stock
      });
    }
  });
  
  return insufficientItems;
}

// Helper function to reduce stock when items are sold
async function reduceInventoryStock(soldItems) {
  console.log('=== REDUCE INVENTORY STOCK DEBUG ===');
  console.log('Reducing stock for sold items:', soldItems);
  console.log('Current inventory before reduction:', inventoryData);
  
  const updatedProducts = [];
  
  soldItems.forEach(item => {
    console.log(`Looking for product: id="${item.id}", name="${item.name}", price=${item.price}`);
    
    // Find the product in inventory by ID first (most reliable), then fallback to name+price
    let inventoryProduct = inventoryData.find(p => p.id.toString() === item.id.toString());
    
    if (!inventoryProduct) {
      // Fallback to name and price matching if ID doesn't work
      inventoryProduct = inventoryData.find(p => {
        const nameMatch = p.name.toLowerCase() === item.name.toLowerCase();
        const priceMatch = p.sellingPrice === item.price;
        return nameMatch && priceMatch;
      });
      console.log(`Fallback search used for: ${item.name}`);
    }
    
    if (inventoryProduct) {
      const previousStock = inventoryProduct.stock;
      inventoryProduct.stock = Math.max(0, inventoryProduct.stock - item.quantity);
      updatedProducts.push(inventoryProduct);
      console.log(`✅ Reduced stock for ${item.name}: ${item.quantity} units sold, ${previousStock} -> ${inventoryProduct.stock} remaining`);
    } else {
      console.warn(`❌ Product not found in inventory for reduction: ID=${item.id}, ${item.name} at Rs ${item.price}`);
      console.log('Available products in inventory:');
      inventoryData.forEach(p => {
        console.log(`  - ID: ${p.id}, ${p.name} (selling price: ${p.sellingPrice})`);
      });
    }
  });
  
  // Save updated products to IndexedDB
  if (storageReady && updatedProducts.length > 0) {
    try {
      for (const product of updatedProducts) {
        await MiniVyaparStorage.updateProduct(product);
      }
      console.log('Successfully updated product stocks in database');
      
      // Reload inventory data from database to ensure sync
      inventoryData = await MiniVyaparStorage.getAllProducts() || [];
      console.log('Reloaded inventory data after stock update');
    } catch (error) {
      console.error('Error updating product stocks:', error);
    }
  }
  
  // Refresh quick items and inventory display if on those pages
  refreshQuickItemsFromInventory();
  
  // Update quantity displays for all quick items to reflect new stock
  document.querySelectorAll('.quick-item').forEach(item => {
    const productId = item.getAttribute('data-product');
    if (productId && cart[productId]) {
      updateQuantityDisplay(item, cart[productId].quantity);
    } else {
      updateQuantityDisplay(item, 0);
    }
  });
  
  if (document.getElementById('inventory') && document.getElementById('inventory').classList.contains('active')) {
    loadInventoryList();
  }
  
  // Update dashboard alerts for low stock
  updateInventoryAlerts();
}

// Global function to add item to cart
function addToCart(productId, productName, price, quantity) {
  // Find product in inventory to check stock and get cost price
  const inventoryProduct = inventoryData.find(p => p.id.toString() === productId.toString());
  
  if (!cart[productId]) {
    cart[productId] = { 
      name: productName, 
      price: price, 
      quantity: 0,
      id: productId,
      costPrice: inventoryProduct ? inventoryProduct.costPrice || 0 : 0
    };
  }
  
  const currentCartQuantity = cart[productId].quantity;
  const newQuantity = currentCartQuantity + quantity;
  
  // Handle negative quantities (removing items)
  if (quantity < 0) {
    // Can't remove more than what's in cart
    if (currentCartQuantity <= 0) {
      showToast(`⚠️ ${productName} is not in cart!`);
      return false;
    }
    
    // If trying to remove more than what's in cart, only remove what's available
    if (Math.abs(quantity) > currentCartQuantity) {
      cart[productId].quantity = 0;
      showToast(`Removed all ${currentCartQuantity} units of ${productName}`);
    } else {
      cart[productId].quantity = newQuantity;
    }
  } else {
    // Handle positive quantities (adding items)
    // Check stock availability
    if (inventoryProduct && newQuantity > inventoryProduct.stock) {
      const availableStock = inventoryProduct.stock - currentCartQuantity;
      if (availableStock <= 0) {
        showToast(`⚠️ ${productName} is out of stock!`);
        return false;
      } else {
        showToast(`⚠️ Only ${availableStock} units of ${productName} available!`);
        cart[productId].quantity = inventoryProduct.stock; // Set to max available
      }
    } else {
      cart[productId].quantity = newQuantity;
    }
  }

  // Remove item if quantity becomes 0 or negative
  if (cart[productId].quantity <= 0) {
    delete cart[productId];
  }

  updateCart();
  updateQuantityDisplay(
    document.querySelector(`[data-product="${productId}"]`),
    cart[productId] ? cart[productId].quantity : 0
  );
  
  return true;
}

// Global function to update quantity badge on quick items
function updateQuantityDisplay(item, quantity) {
  if (!item) return;
  
  let badge = item.querySelector(".quantity-badge");
  
  if (quantity > 0) {
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "quantity-badge";
      item.appendChild(badge);
    }
    badge.textContent = quantity;
    badge.style.display = "block";
  } else if (badge) {
    badge.style.display = "none";
  }
}

// Basic navigation functionality
document.addEventListener("DOMContentLoaded", function () {
  const pages = document.querySelectorAll(".page");
  const fabMain = document.getElementById("fabMain");
  const fabMenu = document.getElementById("fabMenu");
  const fabOptions = document.querySelectorAll(".fab-option");
  const expandBtn = document.getElementById("expandBtn");
  const quickItemsGrid = document.getElementById("quickItemsGrid");
  const toast = document.getElementById("toast");
  const cartBottomBar = document.getElementById("cartBottomBar");
  const cartHeader = document.getElementById("cartHeader");
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");
  const checkoutBtn = document.getElementById("checkoutBtn");
  
  // Initialize sales chart
  setTimeout(() => {
    initializeSalesChart();
  }, 100);
  
  // Note: App initialization is handled by the main DOMContentLoaded listener at the end of the file
  // Do not initialize here to avoid duplicate initialization
  
  // Fallback: Initialize transaction history from localStorage if storage fails
  setTimeout(() => {
    if (!storageReady) {
      initializeTransactionHistory();
      displayRecentTransactions();
      updateDashboardData(); // Update dashboard with fallback data
      refreshQuickItemsFromInventory(); // Load quick items
    }
  }, 1000);
  const clearCartBtn = document.getElementById("clearCartBtn");

  let isMenuOpen = false;
  let isExpanded = false;
  let touchStartY = 0;
  let touchStartX = 0;

  // FAB Menu Toggle
  fabMain.addEventListener("click", function () {
    isMenuOpen = !isMenuOpen;
    fabMenu.classList.toggle("active", isMenuOpen);
    fabMain.classList.toggle("active", isMenuOpen);
  });

  // Close menu when clicking outside
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".fab-container") && isMenuOpen) {
      isMenuOpen = false;
      fabMenu.classList.remove("active");
      fabMain.classList.remove("active");
    }
  });

  // Navigation handler for FAB options
  fabOptions.forEach((option) => {
    option.addEventListener("click", function () {
      const targetPage = this.getAttribute("data-page");

      // Show target page using new function
      switchToPage(targetPage);

      // Close FAB menu
      isMenuOpen = false;
      fabMenu.classList.remove("active");
      fabMain.classList.remove("active");
    });
  });

  // Quick Items Expand/Collapse
  expandBtn.addEventListener("click", function () {
    const hiddenItems = document.querySelectorAll(".hidden-item");

    if (isExpanded) {
      hiddenItems.forEach((item) => (item.style.display = "none"));
      quickItemsGrid.classList.remove("expanded");
      expandBtn.textContent = "▼";
      isExpanded = false;
    } else {
      hiddenItems.forEach((item) => (item.style.display = "block"));
      quickItemsGrid.classList.add("expanded");
      expandBtn.textContent = "▲";
      isExpanded = true;
    }
  });

  // Cart item quantity controls with better event delegation
  cartItems.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.target.classList.contains("qty-btn")) {
      const action = e.target.getAttribute("data-action");
      const productId = e.target.getAttribute("data-product");
      
      console.log("Cart button clicked:", action, productId); // Debug log
      
      if (cart[productId]) {
        const change = action === "increase" ? 1 : -1;
        addToCart(
          productId,
          cart[productId].name,
          cart[productId].price,
          change
        );
        
        // Remove item from cart if quantity becomes 0
        if (cart[productId].quantity <= 0) {
          delete cart[productId];
          updateCart();
        }
      }
    }
  });

  // Clear cart
  clearCartBtn.addEventListener("click", function () {
    clearCartCompletely();
    showToast("Cart cleared");
  });

  // Comprehensive cart clearing function
  function clearCartCompletely() {
    // Clear cart data
    cart = {};
    cartTotalAmount = 0;
    
    // Update cart display
    updateCart();
    
    // Clear cart state from storage
    if (storageReady) {
      MiniVyaparStorage.clearCartState();
    }
    
    // Clear all visual indicators
    document.querySelectorAll(".quantity-badge").forEach((badge) => {
      badge.style.display = "none";
      badge.textContent = "0";
    });
    
    // Remove selected state from all items
    document.querySelectorAll(".quick-item").forEach((item) => {
      item.classList.remove("selected");
    });
    
    // Clear any product card modals
    const currentQuantityDisplay = document.getElementById('quantityDisplay');
    if (currentQuantityDisplay) {
      currentQuantityDisplay.textContent = 'Qty: 0';
    }
    
    console.log('Cart completely cleared');
  }

  // Checkout
  checkoutBtn.addEventListener("click", async function () {
    if (cartTotalAmount > 0) {
      console.log('=== CHECKOUT DEBUG ===');
      console.log('Cart contents:', cart);
      console.log('Inventory data:', inventoryData);
      
      // Validate stock before proceeding
      const insufficientItems = validateStockBeforeCheckout(cart);
      
      if (insufficientItems.length > 0) {
        const itemsList = insufficientItems.map(item => 
          `${item.name}: Need ${item.requested}, Only ${item.available} available`
        ).join('\n');
        showToast(`⚠️ Insufficient stock:\n${itemsList}`);
        return;
      }
      
      // Prepare transaction items
      const transactionItems = Object.values(cart).map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
        costPrice: item.costPrice || 0
      }));
      
      console.log('Transaction items to process:', transactionItems);
      
      // Reduce inventory stock (now async)
      await reduceInventoryStock(transactionItems);
      
      // Capture the total before clearing the cart
      const finalTotal = cartTotalAmount;
      
      // Add to transaction history
      addTransaction(transactionItems, finalTotal, 'checkout');
      
      // Generate receipt if enabled
      if (shopSettings.autoGenerateReceipts) {
        setTimeout(() => {
          generateReceipt({
            id: Date.now(),
            items: transactionItems,
            total: finalTotal,
            type: 'checkout'
          });
        }, 500); // Delay to allow transaction to complete
      }
      
      // Clear cart immediately after transaction using comprehensive clearing
      clearCartCompletely();
      
      // Update dashboard with new transaction data
      updateDashboardData();
      
      showToast(`Checkout: Rs ${transactionItems.reduce((sum, item) => sum + item.total, 0)} - Order placed!`);
    }
  });

  // Cart minimize/expand functionality
  cartHeader.addEventListener("click", function () {
    isCartMinimized = !isCartMinimized;
    cartBottomBar.classList.toggle("minimized", isCartMinimized);
  });

  // Product Card Modal functionality for quick items
  document.querySelectorAll(".quick-item").forEach((item) => {
    const productId = item.getAttribute("data-product");
    const productName = item.getAttribute("data-name");
    const price = parseFloat(item.getAttribute("data-price"));

    // Click to open product card
    item.addEventListener("click", function () {
      openProductCard(productId, productName, price);
    });
  });
});

// Product Card Modal Functions
let currentProduct = null;
let currentQuantity = 0;

function openProductCard(productId, productName, price) {
  currentProduct = { id: productId, name: productName, price: price };
  currentQuantity = cart[productId] ? cart[productId].quantity : 0;
  
  // Find product in inventory to get real stock
  const inventoryProduct = inventoryData.find(p => p.id.toString() === productId.toString());
  const actualStock = inventoryProduct ? inventoryProduct.stock : 0;
  
  // Update modal content
  document.getElementById('productCardTitle').textContent = productName;
  document.getElementById('productCardPrice').textContent = `Rs ${price}`;
  document.getElementById('productCardStock').textContent = `Stock: ${actualStock}`;
  document.getElementById('quantityDisplay').textContent = `Qty: ${currentQuantity}`;
  
  // Set product image based on product or inventory emoji
  let productIcon = '📦'; // Default icon
  if (inventoryProduct && inventoryProduct.emoji) {
    productIcon = inventoryProduct.emoji;
  } else {
    const productImages = {
      'tea': '🍵',
      'biscuit': '🍪', 
      'milk': '🥛',
      'bread': '🍞',
      'sugar': '🧂',
      'rice': '🍚',
      'salt': '🧂',
      'oil': '🛢️',
      'soap': '🧼',
      'shampoo': '🧴'
    };
    productIcon = productImages[productId] || '📦';
  }
  
  document.getElementById('productCardImage').textContent = productIcon;
  
  // Show modal
  document.getElementById('productCardModal').style.display = 'flex';
  
  // Setup gesture interactions for the interactive zone
  setupProductCardGestures();
}

function closeProductCard() {
  document.getElementById('productCardModal').style.display = 'none';
  currentProduct = null;
}

function setupProductCardGestures() {
  const interactiveZone = document.getElementById('productCardInteractive');
  
  if (!interactiveZone) return; // Safety check
  
  let touchStartY = 0;
  let touchStartX = 0;
  let isGesturing = false;
  
  // Remove existing listeners to avoid duplicates
  interactiveZone.replaceWith(interactiveZone.cloneNode(true));
  const newInteractiveZone = document.getElementById('productCardInteractive');
  
  // Touch events for mobile gestures
  newInteractiveZone.addEventListener("touchstart", function (e) {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    isGesturing = true;
    
    // Prevent background scrolling during gesture
    e.preventDefault();
    document.body.classList.add('gesture-active');
  }, { passive: false });

  newInteractiveZone.addEventListener("touchmove", function (e) {
    if (isGesturing) {
      // Prevent background scrolling during gesture movement
      e.preventDefault();
    }
  }, { passive: false });

  newInteractiveZone.addEventListener("touchend", function (e) {
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaY = touchStartY - touchEndY;
    const deltaX = touchStartX - touchEndX;

    let change = 0;
    let action = "";
    
    // Re-enable background scrolling
    isGesturing = false;
    document.body.classList.remove('gesture-active');

    // Determine swipe direction (minimum 30px movement)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
      // Horizontal swipe
      if (deltaX > 0) {
        // Swipe left: -1
        change = -1;
        action = "-1";
      } else {
        // Swipe right: +1
        change = 1;
        action = "+1";
      }
    } else if (Math.abs(deltaY) > 30) {
      // Vertical swipe
      if (deltaY > 0) {
        // Swipe up: +5
        change = 5;
        action = "+5";
      } else {
        // Swipe down: -5
        change = -5;
        action = "-5";
      }
    }

    if (change !== 0) {
      // Check stock validation before allowing negative changes
      if (change < 0 && currentProduct) {
        const currentCartQuantity = cart[currentProduct.id] ? cart[currentProduct.id].quantity : 0;
        const inventoryProduct = inventoryData.find(p => p.id.toString() === currentProduct.id.toString());
        
        // Prevent removing more than what's in cart or available in stock
        if (currentCartQuantity <= 0) {
          showCustomNotification(`${currentProduct.name} is not in cart!`, 'warning', 'Cannot Remove');
          return;
        }
        
        // If trying to remove more than what's in cart, limit the removal
        if (Math.abs(change) > currentCartQuantity) {
          change = -currentCartQuantity; // Only remove what's available in cart
          action = `-${currentCartQuantity}`;
        }
      }
      
      const success = updateProductCardQuantity(change);
      if (success) {
        showToast(`${action} ${currentProduct.name} ${change > 0 ? "added" : "removed"}`);
      }
    }
  }, { passive: false });

  // Handle touch cancel (e.g., user drags outside the element)
  newInteractiveZone.addEventListener("touchcancel", function (e) {
    // Re-enable background scrolling if gesture is cancelled
    isGesturing = false;
    document.body.classList.remove('gesture-active');
  }, { passive: false });

  // Click for desktop - tap to add 1
  newInteractiveZone.addEventListener("click", function (e) {
    if (e.detail === 1) {
      setTimeout(() => {
        if (!newInteractiveZone.classList.contains("double-clicked")) {
          const success = updateProductCardQuantity(1);
          if (success) {
            showToast(`+1 ${currentProduct.name} added`);
          }
        }
      }, 200);
    }
  });

  // Double click: +5
  newInteractiveZone.addEventListener("dblclick", function () {
    this.classList.add("double-clicked");
    const success = updateProductCardQuantity(5);
    if (success) {
      showToast(`+5 ${currentProduct.name} added`);
    }
    setTimeout(() => {
      this.classList.remove("double-clicked");
    }, 300);
  });
}

function updateProductCardQuantity(change) {
  if (!currentProduct) return false;
  
  // Update the main cart and get success status
  const success = addToCart(currentProduct.id, currentProduct.name, currentProduct.price, change);
  
  // Update current quantity display
  currentQuantity = cart[currentProduct.id] ? cart[currentProduct.id].quantity : 0;
  document.getElementById('quantityDisplay').textContent = `Qty: ${currentQuantity}`;
  
  return success;
}

// NEW SALE PAGE FUNCTIONALITY

// Sale cart state
let saleCart = [];
let saleCartVisible = false;
let currentFilter = 'favorites';
let favoriteProducts = []; // Array to store favorite product IDs

// Load favorites from storage
function loadFavorites() {
  try {
    const savedFavorites = localStorage.getItem('mini_vyapar_favorites');
    favoriteProducts = savedFavorites ? JSON.parse(savedFavorites) : [];
  } catch (error) {
    console.error('Error loading favorites:', error);
    favoriteProducts = [];
  }
}

// Save favorites to storage
function saveFavorites() {
  try {
    localStorage.setItem('mini_vyapar_favorites', JSON.stringify(favoriteProducts));
  } catch (error) {
    console.error('Error saving favorites:', error);
  }
}

// Toggle favorite status for a product
function toggleFavorite(productId, event) {
  if (event) {
    event.stopPropagation(); // Prevent product card click
  }
  
  const index = favoriteProducts.indexOf(productId);
  if (index > -1) {
    favoriteProducts.splice(index, 1);
    showCustomNotification('Removed from favorites', 'info', 'Favorites');
  } else {
    favoriteProducts.push(productId);
    showCustomNotification('Added to favorites', 'success', 'Favorites');
  }
  
  saveFavorites();
  
  // Refresh the current view if showing favorites
  if (currentFilter === 'favorites') {
    loadProductsForSale('favorites');
  } else {
    // Just update the heart icons
    updateFavoriteIcons();
  }
}

// Check if a product is favorite
function isFavorite(productId) {
  return favoriteProducts.includes(productId);
}

// Update favorite icons in the current view
function updateFavoriteIcons() {
  document.querySelectorAll('.product-card').forEach(card => {
    const productId = parseInt(card.dataset.productId);
    const heartIcon = card.querySelector('.favorite-heart');
    if (heartIcon) {
      heartIcon.textContent = isFavorite(productId) ? '❤️' : '🤍';
      heartIcon.classList.toggle('favorited', isFavorite(productId));
    }
  });
}

// Load products from inventory for New Sale page
function loadProductsForSale(filter = 'allProducts') {
  const productGrid = document.getElementById('productGrid');
  if (!productGrid) return;
  
  let products = [];
  
  // Get products from inventory data
  if (inventoryData && inventoryData.length > 0) {
    switch (filter) {
      case 'favorites':
        // Show only favorite products
        products = inventoryData.filter(product => isFavorite(product.id));
        break;
      case 'topSellers':
        // Get actual top sellers based on sales transactions
        products = getTopSellingProducts(inventoryData, 15);
        break;
      case 'allProducts':
      default:
        products = inventoryData;
        break;
    }
  } else {
    // Fallback: Load from storage if inventoryData is not ready
    try {
      if (storageReady) {
        const allProducts = JSON.parse(localStorage.getItem('inventory_data') || '[]');
        switch (filter) {
          case 'favorites':
            products = allProducts.filter(product => isFavorite(product.id));
            break;
          case 'topSellers':
            products = getTopSellingProducts(allProducts, 15);
            break;
          case 'allProducts':
          default:
            products = allProducts;
            break;
        }
      }
    } catch (error) {
      console.error('Error loading products from storage:', error);
    }
  }
  
  // Render products
  if (products.length === 0) {
    let message = '';
    if (filter === 'favorites') {
      message = `
        <div class="no-products-message">
          <div class="no-products-icon">⭐</div>
          <h3>No Favorite Products</h3>
          <p>Mark products as favorites by clicking the heart icon</p>
          <button onclick="applySaleFilter('allProducts')" class="add-products-btn">View All Products</button>
        </div>
      `;
    } else {
      message = `
        <div class="no-products-message">
          <div class="no-products-icon">📦</div>
          <h3>No Products Found</h3>
          <p>Add products to your inventory to start making sales</p>
          <button onclick="switchToPage('inventory')" class="add-products-btn">Add Products</button>
        </div>
      `;
    }
    productGrid.innerHTML = message;
    return;
  }
  
  productGrid.innerHTML = products.map(product => `
    <div class="product-card" data-product-id="${product.id}" onclick="addToSaleCart(${product.id})">
      <div class="favorite-heart ${isFavorite(product.id) ? 'favorited' : ''}" 
           onclick="toggleFavorite(${product.id}, event)">
        ${isFavorite(product.id) ? '❤️' : '🤍'}
      </div>
      <div class="product-image">${product.emoji || '📦'}</div>
      <div class="product-info">
        <div class="product-name">${product.name}</div>
        <div class="product-price">Rs ${product.sellingPrice || product.price || 0}</div>
        <div class="product-stock ${product.stock <= (product.lowStockThreshold || 10) ? 'low-stock' : ''}">
          Stock: ${product.stock || 0}
        </div>
      </div>
    </div>
  `).join('');
}

// Get top selling products based on transaction history
function getTopSellingProducts(products, limit = 15) {
  // Get sales count for each product
  const salesCount = {};
  
  // Count sales from transaction history
  if (transactionHistory && transactionHistory.length > 0) {
    transactionHistory.forEach(transaction => {
      if (transaction.items && Array.isArray(transaction.items)) {
        transaction.items.forEach(item => {
          const productId = item.id || item.productId;
          if (productId) {
            salesCount[productId] = (salesCount[productId] || 0) + (item.quantity || 1);
          }
        });
      }
    });
  }
  
  // Sort products by sales count, then by lower stock (fallback)
  const sortedProducts = [...products].sort((a, b) => {
    const aSales = salesCount[a.id] || 0;
    const bSales = salesCount[b.id] || 0;
    
    if (aSales !== bSales) {
      return bSales - aSales; // Higher sales first
    }
    
    // If sales are equal, prefer products with lower stock (more sold)
    return a.stock - b.stock;
  });
  
  return sortedProducts.slice(0, limit);
}

// Apply sale filter and update UI
function applySaleFilter(filter) {
  currentFilter = filter;
  
  // Update active tab
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.filter === filter) {
      tab.classList.add('active');
    }
  });
  
  // Load products with new filter
  loadProductsForSale(filter);
}

// Handle window resize for chart responsiveness
window.addEventListener('resize', function() {
  if (document.getElementById('salesWireframeChart')) {
    setTimeout(() => {
      drawWireframeChart();
    }, 100);
  }
});

// Initialize New Sale page when it becomes active
document.addEventListener('DOMContentLoaded', function() {
  const salesPage = document.getElementById('sales');
  
  // Observer to detect when sales page becomes active
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        if (salesPage.classList.contains('active')) {
          initNewSalePage();
        }
      }
    });
  });
  
  observer.observe(salesPage, { attributes: true });
});

function initNewSalePage() {
  setupNewSaleFilters();
  setupNewSaleSearch();
  setupSaleCartGestures();
  loadProducts('favorites');
}

function setupNewSaleFilters() {
  const filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      loadProducts(currentFilter);
    });
  });
}

function setupNewSaleSearch() {
  const searchInput = document.getElementById('productSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterProducts(e.target.value);
    });
  }
}

// Filter products based on search query
function filterProducts(searchQuery) {
  if (!searchQuery || searchQuery.trim() === '') {
    // If search is empty, show current filter
    loadProductsForSale(currentFilter);
    return;
  }
  
  const query = searchQuery.toLowerCase().trim();
  let allProducts = [];
  
  // Get all products from inventory
  if (inventoryData && inventoryData.length > 0) {
    allProducts = inventoryData;
  } else {
    try {
      allProducts = JSON.parse(localStorage.getItem('inventory_data') || '[]');
    } catch (error) {
      console.error('Error loading products for search:', error);
      return;
    }
  }
  
  // Filter products by name, category, or emoji
  const filteredProducts = allProducts.filter(product => {
    return (
      product.name.toLowerCase().includes(query) ||
      (product.category && product.category.toLowerCase().includes(query)) ||
      (product.emoji && product.emoji.includes(query))
    );
  });
  
  // Render filtered products
  const productGrid = document.getElementById('productGrid');
  if (!productGrid) return;
  
  if (filteredProducts.length === 0) {
    productGrid.innerHTML = `
      <div class="no-products-message">
        <div class="no-products-icon">🔍</div>
        <h3>No Products Found</h3>
        <p>No products match "${searchQuery}"</p>
        <button onclick="document.getElementById('productSearch').value=''; filterProducts('')" class="add-products-btn">Clear Search</button>
      </div>
    `;
    return;
  }
  
  productGrid.innerHTML = filteredProducts.map(product => `
    <div class="product-card" data-product-id="${product.id}" onclick="addToSaleCart(${product.id})">
      <div class="favorite-heart ${isFavorite(product.id) ? 'favorited' : ''}" 
           onclick="toggleFavorite(${product.id}, event)">
        ${isFavorite(product.id) ? '❤️' : '🤍'}
      </div>
      <div class="product-image">${product.emoji || '📦'}</div>
      <div class="product-info">
        <div class="product-name">${product.name}</div>
        <div class="product-price">Rs ${product.sellingPrice || product.price || 0}</div>
        <div class="product-stock ${product.stock <= (product.lowStockThreshold || 10) ? 'low-stock' : ''}">
          Stock: ${product.stock || 0}
        </div>
      </div>
    </div>
  `).join('');
}

function loadProducts(category = 'favorites') {
  currentFilter = category;
  loadProductsForSale(category);
}

function addToSaleCart(productId) {
  // Find product in inventory data
  let product = null;
  
  if (inventoryData && inventoryData.length > 0) {
    product = inventoryData.find(p => p.id === productId);
  } else {
    // Fallback: Load from storage
    try {
      const allProducts = JSON.parse(localStorage.getItem('inventory_data') || '[]');
      product = allProducts.find(p => p.id === productId);
    } catch (error) {
      console.error('Error finding product:', error);
      return;
    }
  }
  
  if (!product) {
    showSaleToast('Product not found');
    return;
  }
  
  // Check if product has stock
  if (product.stock <= 0) {
    showSaleToast('Product out of stock');
    return;
  }
  
  const existingItem = saleCart.find(item => item.id === product.id);
  
  if (existingItem) {
    // Check if we can add more (don't exceed stock)
    if (existingItem.quantity >= product.stock) {
      showSaleToast('Cannot add more - insufficient stock');
      return;
    }
    existingItem.quantity += 1;
  } else {
    saleCart.push({
      id: product.id,
      name: product.name,
      price: product.sellingPrice || product.price || 0,
      emoji: product.emoji || '📦',
      quantity: 1,
      maxStock: product.stock,
      costPrice: product.costPrice || 0
    });
  }
  
  updateSaleCartDisplay();
  showSaleToast(`+1 ${product.name} added to cart`);
}

function setFloatingBarPosition(cartOpen) {
  const fabMain = document.getElementById('fabMain');
  const fabMenu = document.getElementById('fabMenu');
  if (!fabMain || !fabMenu) return;
  if (cartOpen) {
    fabMain.style.bottom = '220px';
    fabMenu.style.bottom = '280px';
  } else {
    fabMain.style.bottom = '32px';
    fabMenu.style.bottom = '90px';
  }
}

function updateSaleCartDisplay() {
  const cartSection = document.getElementById('saleCartSection');
  const cartItems = document.getElementById('saleCartItems');
  const cartTotal = document.getElementById('saleCartTotal');
  const fabMain = document.getElementById('fabMain');
  const fabMenu = document.getElementById('fabMenu');
  if (!cartSection || !cartItems || !cartTotal) return;

  if (saleCart.length === 0) {
    cartSection.style.display = 'none';
    saleCartVisible = false;
    setFloatingBarPosition(false);
    return;
  }

  // Show cart if hidden
  if (!saleCartVisible) {
    cartSection.style.display = 'block';
    saleCartVisible = true;
    setFloatingBarPosition(true);
  }
  
  // Update cart items
  cartItems.innerHTML = saleCart.map(item => `
    <div class="sale-cart-item">
      <div class="sale-cart-item-info">
        <span class="sale-cart-item-name">${item.name}</span>
        <span class="sale-cart-item-price">Rs ${item.price}</span>
      </div>
      <div class="sale-cart-item-controls">
        <button class="sale-qty-btn" onclick="updateSaleCartQuantity(${item.id}, -1)">−</button>
        <span class="sale-qty-display">${item.quantity}</span>
        <button class="sale-qty-btn" onclick="updateSaleCartQuantity(${item.id}, 1)">+</button>
      </div>
      <div class="sale-cart-item-total">Rs ${(item.price * item.quantity).toFixed(2)}</div>
    </div>
  `).join('');
  
  // Update total
  const total = saleCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  cartTotal.textContent = `Rs ${total.toFixed(2)}`;
}

function updateSaleCartQuantity(productId, change) {
  const item = saleCart.find(item => item.id === productId);
  if (!item) return;
  
  item.quantity += change;
  
  if (item.quantity <= 0) {
    saleCart = saleCart.filter(item => item.id !== productId);
  }
  
  updateSaleCartDisplay();
}

function clearSaleCart() {
  saleCart = [];
  updateSaleCartDisplay();
  showSaleToast('Cart cleared');
  setFloatingBarPosition(false);
}

async function saleCheckout() {
  if (saleCart.length === 0) {
    showSaleToast('Cart is empty');
    return;
  }
  
  // Convert saleCart to format compatible with validation
  const saleCartForValidation = {};
  saleCart.forEach((item, index) => {
    saleCartForValidation[index] = item;
  });
  
  // Validate stock before proceeding
  const insufficientItems = validateStockBeforeCheckout(saleCartForValidation);
  
  if (insufficientItems.length > 0) {
    const itemsList = insufficientItems.map(item => 
      `${item.name}: Need ${item.requested}, Only ${item.available} available`
    ).join('\n');
    showSaleToast(`⚠️ Insufficient stock:\n${itemsList}`);
    return;
  }
  
  const total = saleCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Prepare transaction items
  const transactionItems = saleCart.map(item => ({
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    total: item.price * item.quantity,
    costPrice: item.costPrice || 0
  }));
  
  // Reduce inventory stock (now async)
  await reduceInventoryStock(transactionItems);
  
  // Add to transaction history
  addTransaction(transactionItems, total, 'sale');
  
  // Generate receipt if enabled
  if (shopSettings.autoGenerateReceipts) {
    setTimeout(() => {
      generateReceipt({
        id: Date.now(),
        items: transactionItems,
        total: total,
        type: 'sale'
      });
    }, 500); // Delay to allow transaction to complete
  }
  
  // Clear cart immediately
  clearSaleCart();
  
  // Update dashboard with new transaction data
  updateDashboardData();
  
  showSaleToast(`Sale completed! Total: Rs ${total.toFixed(2)}`);
  
  // Return to dashboard
  setTimeout(() => {
    showDashboard();
    setFloatingBarPosition(false);
  }, 1500);
}

function filterProducts(searchTerm) {
  const productCards = document.querySelectorAll('.product-card');
  
  productCards.forEach(card => {
    const productName = card.querySelector('.product-name').textContent.toLowerCase();
    const matches = productName.includes(searchTerm.toLowerCase());
    card.style.display = matches ? 'block' : 'none';
  });
}

function setupSaleCartGestures() {
  const cartSection = document.getElementById('saleCartSection');
  if (!cartSection) return;
  
  let startY = 0;
  let isMinimized = false;
  
  cartSection.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
  }, { passive: true });
  
  cartSection.addEventListener('touchmove', (e) => {
    const currentY = e.touches[0].clientY;
    const deltaY = startY - currentY;
    
    // Swipe down to minimize
    if (deltaY < -50 && !isMinimized) {
      cartSection.classList.add('minimized');
      isMinimized = true;
    }
    // Swipe up to expand
    else if (deltaY > 50 && isMinimized) {
      cartSection.classList.remove('minimized');
      isMinimized = false;
    }
  }, { passive: true });
  
  // Click to toggle when minimized
  cartSection.addEventListener('click', (e) => {
    if (isMinimized && e.target.closest('.sale-cart-header')) {
      cartSection.classList.remove('minimized');
      isMinimized = false;
    }
  });
}

// Ensure floating nav bar is hidden whenever cart is open
const cartSection = document.getElementById('saleCartSection');
const fabMain = document.getElementById('fabMain');
const fabMenu = document.getElementById('fabMenu');
if (cartSection && fabMain && fabMenu) {
  const observer = new MutationObserver(() => {
    if (cartSection.style.display !== 'none') {
      fabMain.style.display = 'none';
      fabMenu.style.display = 'none';
    } else {
      fabMain.style.display = '';
      fabMenu.style.display = '';
    }
  });
  observer.observe(cartSection, { attributes: true, attributeFilter: ['style'] });
}

function showDashboard() {
  switchToPage('dashboard');
}

function switchToPage(pageId) {
  const pages = document.querySelectorAll('.page');
  const header = document.querySelector('.header');
  
  pages.forEach(page => page.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  
  // Show/hide header based on page
  if (pageId === 'dashboard') {
    header.style.display = 'block';
  } else {
    header.style.display = 'none';
  }
  
  // Save last page preference
  if (storageReady) {
    MiniVyaparStorage.savePreference('lastPage', pageId);
  }
}

function showSaleToast(message) {
  // Remove existing toast
  const existingToast = document.querySelector('.sale-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = 'sale-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 2000);
}

// INVENTORY PAGE FUNCTIONALITY

// Initialize Inventory page when it becomes active
document.addEventListener('DOMContentLoaded', function() {
  const inventoryPage = document.getElementById('inventory');
  
  // Observer to detect when inventory page becomes active
  const inventoryObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        if (inventoryPage.classList.contains('active')) {
          initInventoryPage();
        }
      }
    });
  });
  
  inventoryObserver.observe(inventoryPage, { attributes: true });
});

function initInventoryPage() {
  setupInventoryControls();
  loadInventoryList();
}

function setupInventoryControls() {
  // Filter tabs
  const filterTabs = document.querySelectorAll('.inventory-filters .filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentInventoryFilter = tab.dataset.filter;
      loadInventoryList();
    });
  });
  
  // View toggle
  const viewBtns = document.querySelectorAll('.view-btn');
  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      viewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentInventoryView = btn.dataset.view;
      loadInventoryList();
    });
  });
  
  // Search functionality
  const searchInput = document.getElementById('inventorySearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterInventoryBySearch(e.target.value);
    });
  }
}

function toggleInventorySearch() {
  const searchDiv = document.getElementById('inventorySearch');
  const searchInput = document.getElementById('inventorySearchInput');
  
  if (searchDiv.style.display === 'none') {
    searchDiv.style.display = 'block';
    searchInput.focus();
    
    // Add search event listener if not already added
    if (!searchInput.hasAttribute('data-listener-added')) {
      searchInput.addEventListener('input', (e) => {
        filterInventoryBySearch(e.target.value);
      });
      searchInput.setAttribute('data-listener-added', 'true');
    }
  } else {
    searchDiv.style.display = 'none';
    searchInput.value = '';
    // Reset search filter
    loadInventoryList();
  }
}

function toggleInventoryFilters() {
  const filtersDiv = document.getElementById('inventoryFilters');
  if (filtersDiv.style.display === 'none') {
    filtersDiv.style.display = 'block';
  } else {
    filtersDiv.style.display = 'none';
  }
}

function loadInventoryList() {
  const inventoryList = document.getElementById('inventoryList');
  if (!inventoryList) return;
  
  let filteredData = inventoryData;
  
  // Apply filters based on current filter type
  if (currentInventoryFilter === 'lowStock') {
    filteredData = inventoryData.filter(item => item.stock <= (item.lowStockThreshold || 10));
  } else if (currentInventoryFilter === 'categories' && currentSelectedCategory) {
    filteredData = inventoryData.filter(item => (item.category || 'Other') === currentSelectedCategory);
  }
  
  // Clear list
  inventoryList.innerHTML = '';
  inventoryList.className = `inventory-list ${currentInventoryView}-view`;
  
  if (filteredData.length === 0) {
    let emptyMessage = 'No products found';
    if (currentInventoryFilter === 'lowStock') {
      emptyMessage = 'No low stock items';
    } else if (currentInventoryFilter === 'categories' && currentSelectedCategory) {
      emptyMessage = `No products in ${currentSelectedCategory} category`;
    }
    
    inventoryList.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }
  
  filteredData.forEach(product => {
    const productElement = createProductElement(product);
    inventoryList.appendChild(productElement);
  });
}

function createProductElement(product) {
  const div = document.createElement('div');
  div.className = 'product-item';
  
  const isLowStock = product.stock <= product.lowStockThreshold;
  const productEmoji = product.emoji || getProductEmoji(product.category); // Use custom emoji or fallback
  
  if (currentInventoryView === 'list') {
    div.innerHTML = `
      <div class="product-image">${productEmoji}</div>
      <div class="product-info">
        <div class="product-name">${product.name}</div>
        <div class="product-details">
          <span class="stock ${isLowStock ? 'low-stock' : ''}">${product.stock} units</span>
          <span class="price">Rs ${product.sellingPrice}</span>
          ${product.costPrice ? `<span class="cost-price">Cost: Rs ${product.costPrice}</span>` : ''}
        </div>
      </div>
      <button class="edit-btn" onclick="openEditProductForm(${product.id})">✏️</button>
    `;
  } else {
    div.className += ' grid-item';
    div.innerHTML = `
      <div class="product-image">${productEmoji}</div>
      <div class="product-name">${product.name}</div>
      <div class="stock ${isLowStock ? 'low-stock' : ''}">${product.stock} units</div>
      <div class="price">Rs ${product.sellingPrice}</div>
      <button class="edit-btn" onclick="openEditProductForm(${product.id})">✏️</button>
    `;
  }
  
  return div;
}

function getProductEmoji(category) {
  const emojis = {
    'food': '🍽️',
    'household': '🏠',
    'personal': '🧴',
    'other': '📦'
  };
  return emojis[category] || '📦';
}

function filterInventoryBySearch(searchTerm) {
  const items = document.querySelectorAll('.product-item');
  items.forEach(item => {
    const name = item.querySelector('.product-name').textContent.toLowerCase();
    const matches = name.includes(searchTerm.toLowerCase());
    item.style.display = matches ? 'flex' : 'none';
  });
}

// New category filtering functions
let currentSelectedCategory = null;

function filterInventoryByType(filterType) {
  currentInventoryFilter = filterType;
  
  // Update active tab
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`[data-filter="${filterType}"]`).classList.add('active');
  
  // Hide categories dropdown if not categories filter
  const categoriesDropdown = document.getElementById('categoriesDropdown');
  if (filterType !== 'categories') {
    categoriesDropdown.style.display = 'none';
    currentSelectedCategory = null;
  }
  
  // Update filter display
  updateCurrentFilterDisplay(filterType);
  
  // Apply filter
  loadInventoryList();
}

function toggleCategoryDropdown() {
  const categoriesDropdown = document.getElementById('categoriesDropdown');
  const isVisible = categoriesDropdown.style.display !== 'none';
  
  if (isVisible) {
    categoriesDropdown.style.display = 'none';
  } else {
    categoriesDropdown.style.display = 'block';
    loadCategoryList();
  }
}

function loadCategoryList() {
  const categoryList = document.getElementById('categoryList');
  if (!categoryList) return;
  
  // Category display names mapping
  const categoryDisplayNames = {
    'food': 'Food & Beverages',
    'dairy': 'Dairy Products',
    'bakery': 'Bakery Items',
    'grains': 'Grains & Cereals',
    'fruits': 'Fruits',
    'vegetables': 'Vegetables',
    'poultry': 'Poultry & Meat',
    'essentials': 'Daily Essentials',
    'household': 'Household Items',
    'personal': 'Personal Care',
    'other': 'Other'
  };
  
  // Get unique categories from inventory data
  const categories = {};
  inventoryData.forEach(product => {
    const category = product.category || 'other';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(product);
  });
  
  // Generate category items
  let categoryHTML = '';
  Object.keys(categories).forEach(categoryName => {
    const productCount = categories[categoryName].length;
    const isActive = currentSelectedCategory === categoryName;
    const displayName = categoryDisplayNames[categoryName] || categoryName;
    
    categoryHTML += `
      <div class="category-item ${isActive ? 'active' : ''}" onclick="selectCategory('${categoryName}')">
        <span class="category-name">${displayName}</span>
        <span class="category-count">${productCount}</span>
      </div>
    `;
  });
  
  categoryList.innerHTML = categoryHTML;
}

function selectCategory(categoryName) {
  currentSelectedCategory = categoryName;
  currentInventoryFilter = 'categories';
  
  // Update active category
  document.querySelectorAll('.category-item').forEach(item => {
    item.classList.remove('active');
  });
  event.target.closest('.category-item').classList.add('active');
  
  // Update filter display
  updateCurrentFilterDisplay('categories', categoryName);
  
  // Apply filter
  loadInventoryList();
  
  // Hide dropdown
  document.getElementById('categoriesDropdown').style.display = 'none';
}

function updateCurrentFilterDisplay(filterType, categoryName = null) {
  const currentFilter = document.getElementById('currentFilter');
  const currentFilterText = document.getElementById('currentFilterText');
  
  if (filterType === 'all') {
    currentFilter.style.display = 'none';
  } else {
    currentFilter.style.display = 'flex';
    
    if (filterType === 'lowStock') {
      currentFilterText.textContent = 'Showing low stock items';
    } else if (filterType === 'categories' && categoryName) {
      currentFilterText.textContent = `Showing ${categoryName} products`;
    } else {
      currentFilterText.textContent = 'Filter applied';
    }
  }
}

function clearInventoryFilter() {
  currentInventoryFilter = 'all';
  currentSelectedCategory = null;
  
  // Reset active tab
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector('[data-filter="all"]').classList.add('active');
  
  // Hide filter display and dropdown
  document.getElementById('currentFilter').style.display = 'none';
  document.getElementById('categoriesDropdown').style.display = 'none';
  
  // Reload inventory
  loadInventoryList();
}

function changeInventoryView(viewType) {
  currentInventoryView = viewType;
  
  // Update active view button
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-view="${viewType}"]`).classList.add('active');
  
  // Reload inventory with new view
  loadInventoryList();
}

// Add Product functionality
function openAddProductForm() {
  document.getElementById('addProductModal').style.display = 'flex';
  
  // Set today's date as default
  const form = document.getElementById('addProductForm');
  form.reset();
  
  // Set default emoji
  document.getElementById('productEmoji').value = '📦';
  
  // Initialize emoji picker
  setTimeout(() => {
    console.log('Initializing emoji picker...');
    const picker = document.getElementById('emojiPicker');
    const emojiInput = document.getElementById('productEmoji');
    const emojiBtn = document.querySelector('.emoji-picker-btn');
    
    console.log('Emoji picker elements:', {
      picker: !!picker,
      input: !!emojiInput,
      button: !!emojiBtn
    });
    
    // Test if emoji data is available
    console.log('Emoji data categories:', Object.keys(emojiData));
  }, 100);
  
  form.addEventListener('submit', handleAddProduct);
}

function closeAddProductForm() {
  document.getElementById('addProductModal').style.display = 'none';
}

async function handleAddProduct(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const emoji = document.getElementById('productEmoji').value || '📦'; // Default emoji if none selected
  
  const newProduct = {
    id: Date.now(),
    name: document.getElementById('productName').value,
    emoji: emoji,
    category: document.getElementById('productCategory').value,
    costPrice: parseFloat(document.getElementById('costPrice').value) || 0,
    sellingPrice: parseFloat(document.getElementById('sellingPrice').value),
    stock: parseInt(document.getElementById('initialStock').value),
    supplier: document.getElementById('supplier').value,
    code: document.getElementById('productCode').value,
    lowStockThreshold: 10 // Default threshold
  };
  
  try {
    console.log('=== ADDING PRODUCT TO STORAGE (handleAddProduct) ===');
    console.log('Product to save:', newProduct);
    
    // Add to in-memory array first
    inventoryData.push(newProduct);
    
    // Save to persistent storage (IndexedDB)
    if (storageReady && window.MiniVyaparStorage && MiniVyaparStorage.addProduct) {
      await MiniVyaparStorage.addProduct(newProduct);
      console.log('✅ Product saved to IndexedDB:', newProduct.name);
    } else {
      // Fallback to saveInventoryData() for localStorage
      saveInventoryData();
      console.log('⚠️ Product saved via saveInventoryData (fallback):', newProduct.name);
    }
    
    // Update all displays
    loadInventoryList();
    refreshQuickItems(); // Update quick items with new product
    closeAddProductForm();
    showToast(`${emoji} ${newProduct.name} added to inventory`);
    
  } catch (error) {
    console.error('❌ Error saving product:', error);
    // Remove from memory if save failed
    const index = inventoryData.findIndex(p => p.id === newProduct.id);
    if (index > -1) {
      inventoryData.splice(index, 1);
    }
    showToast('❌ Error saving product. Please try again.');
  }
}

// Edit Product functionality
function openEditProductForm(productId) {
  editingProductId = productId;
  const product = inventoryData.find(p => p.id === productId);
  if (!product) return;
  
  document.getElementById('editProductName').textContent = product.name;
  document.getElementById('editProductDetails').innerHTML = `
    Stock: ${product.stock} units | Price: Rs ${product.sellingPrice}
    ${product.costPrice ? ` | Cost: Rs ${product.costPrice}` : ''}
  `;
  
  document.getElementById('editProductModal').style.display = 'flex';
}

function closeEditProductForm() {
  document.getElementById('editProductModal').style.display = 'none';
  editingProductId = null;
  
  // Hide all forms
  hideAllForms();
  
  // Remove event listeners
  const costPriceInput = document.getElementById('newCostPrice');
  const sellingPriceInput = document.getElementById('newSellingPrice');
  const stockAdjustmentInput = document.getElementById('stockAdjustment');
  
  if (costPriceInput) {
    costPriceInput.removeEventListener('input', calculateProfit);
  }
  if (sellingPriceInput) {
    sellingPriceInput.removeEventListener('input', calculateProfit);
  }
  if (stockAdjustmentInput) {
    stockAdjustmentInput.removeEventListener('input', updateNewStock);
  }
}

function showStockUpdate() {
  hideAllForms();
  const product = inventoryData.find(p => p.id === editingProductId);
  document.getElementById('currentStock').textContent = product.stock;
  document.getElementById('newStock').textContent = product.stock;
  document.getElementById('stockAdjustment').value = 0;
  document.getElementById('stockUpdateForm').style.display = 'block';
  
  // Add event listener for real-time stock calculation
  document.getElementById('stockAdjustment').addEventListener('input', updateNewStock);
}

function showPriceUpdate() {
  hideAllForms();
  const product = inventoryData.find(p => p.id === editingProductId);
  document.getElementById('newCostPrice').value = product.costPrice || 0;
  document.getElementById('newSellingPrice').value = product.sellingPrice;
  document.getElementById('priceUpdateForm').style.display = 'block';
  
  // Calculate initial profit
  calculateProfit();
  
  // Add event listeners for real-time calculation
  document.getElementById('newCostPrice').addEventListener('input', calculateProfit);
  document.getElementById('newSellingPrice').addEventListener('input', calculateProfit);
}

function showFullEdit() {
  hideAllForms();
  const product = inventoryData.find(p => p.id === editingProductId);
  document.getElementById('editFullName').value = product.name;
  document.getElementById('editFullCategory').value = product.category || 'other';
  document.getElementById('editFullCostPrice').value = product.costPrice || 0;
  document.getElementById('editFullSellingPrice').value = product.sellingPrice;
  document.getElementById('editFullStock').value = product.stock;
  document.getElementById('editFullSupplier').value = product.supplier || '';
  document.getElementById('fullEditForm').style.display = 'block';
}

function hideAllForms() {
  document.getElementById('stockUpdateForm').style.display = 'none';
  document.getElementById('priceUpdateForm').style.display = 'none';
  document.getElementById('fullEditForm').style.display = 'none';
}

function calculateProfit() {
  const costPrice = parseFloat(document.getElementById('newCostPrice').value) || 0;
  const sellingPrice = parseFloat(document.getElementById('newSellingPrice').value) || 0;
  const product = inventoryData.find(p => p.id === editingProductId);
  const stock = product ? product.stock : 0;
  
  const profitPerUnit = sellingPrice - costPrice;
  const profitMargin = sellingPrice > 0 ? ((profitPerUnit / sellingPrice) * 100) : 0;
  const totalPotentialProfit = profitPerUnit * stock;
  
  document.getElementById('profitPerUnit').textContent = `Rs ${profitPerUnit.toFixed(2)}`;
  document.getElementById('profitMargin').textContent = `${profitMargin.toFixed(1)}%`;
  document.getElementById('totalPotentialProfit').textContent = `Rs ${totalPotentialProfit.toFixed(2)}`;
  
  // Color coding for profit
  const profitElement = document.getElementById('profitPerUnit');
  if (profitPerUnit > 0) {
    profitElement.style.color = '#28a745';
  } else if (profitPerUnit < 0) {
    profitElement.style.color = '#dc3545';
  } else {
    profitElement.style.color = '#6c757d';
  }
}

function adjustStock(amount) {
  const input = document.getElementById('stockAdjustment');
  const newValue = parseInt(input.value) + amount;
  input.value = newValue;
  
  // Update the new stock display
  const product = inventoryData.find(p => p.id === editingProductId);
  const newStock = Math.max(0, product.stock + newValue);
  document.getElementById('newStock').textContent = newStock;
}

// Add event listener to stock adjustment input
function updateNewStock() {
  const adjustment = parseInt(document.getElementById('stockAdjustment').value) || 0;
  const product = inventoryData.find(p => p.id === editingProductId);
  const newStock = Math.max(0, product.stock + adjustment);
  document.getElementById('newStock').textContent = newStock;
}

function saveStockUpdate() {
  const product = inventoryData.find(p => p.id === editingProductId);
  const adjustment = parseInt(document.getElementById('stockAdjustment').value);
  
  product.stock = Math.max(0, product.stock + adjustment);
  
  saveInventoryData(); // Save to storage
  loadInventoryList();
  refreshQuickItems(); // Update quick items after stock change
  closeEditProductForm();
  showToast(`Stock updated for ${product.name}`);
}

function savePriceUpdate() {
  const product = inventoryData.find(p => p.id === editingProductId);
  const newCostPrice = parseFloat(document.getElementById('newCostPrice').value) || 0;
  const newSellingPrice = parseFloat(document.getElementById('newSellingPrice').value);
  
  if (newSellingPrice <= 0) {
    showToast('Please enter a valid selling price', 'error');
    return;
  }
  
  product.costPrice = newCostPrice;
  product.sellingPrice = newSellingPrice;
  
  saveInventoryData(); // Save to storage
  loadInventoryList();
  refreshQuickItems(); // Update quick items after price change
  closeEditProductForm();
  showToast(`Prices updated for ${product.name}`);
}

function saveFullEdit() {
  const product = inventoryData.find(p => p.id === editingProductId);
  const newName = document.getElementById('editFullName').value.trim();
  const newCategory = document.getElementById('editFullCategory').value;
  const newCostPrice = parseFloat(document.getElementById('editFullCostPrice').value) || 0;
  const newSellingPrice = parseFloat(document.getElementById('editFullSellingPrice').value);
  const newStock = parseInt(document.getElementById('editFullStock').value);
  const newSupplier = document.getElementById('editFullSupplier').value.trim();
  
  if (!newName || newSellingPrice <= 0 || newStock < 0) {
    showToast('Please fill in all required fields correctly', 'error');
    return;
  }
  
  product.name = newName;
  product.category = newCategory;
  product.costPrice = newCostPrice;
  product.sellingPrice = newSellingPrice;
  product.stock = newStock;
  product.supplier = newSupplier;
  
  saveInventoryData(); // Save to storage
  loadInventoryList();
  refreshQuickItems(); // Update quick items after changes
  closeEditProductForm();
  showToast(`${product.name} updated successfully`);
}

async function deleteProduct() {
  const product = inventoryData.find(p => p.id === editingProductId);
  const confirmed = await showCustomConfirm(
    `Are you sure you want to delete ${product.name}?`,
    'Delete Product',
    '🗑️',
    'Delete',
    'Cancel',
    true
  );
  
  if (confirmed) {
    inventoryData = inventoryData.filter(p => p.id !== editingProductId);
    saveInventoryData(); // Save to storage
    loadInventoryList();
    refreshQuickItems(); // Update quick items after deletion
    closeEditProductForm();
    showCustomNotification(`${product.name} deleted from inventory`, 'success', 'Product Deleted');
  }
}

// Month tracking and financial period management
function getMonthStartDate(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEndDate(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getMonthlyData(year = new Date().getFullYear(), month = new Date().getMonth()) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  
  // Get transactions for the month
  const monthlyTransactions = transactionHistory.filter(transaction => {
    const transactionDate = new Date(transaction.timestamp);
    return transactionDate >= monthStart && transactionDate <= monthEnd;
  });
  
  // Get expenses for the month
  const monthlyExpenses = expensesData.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate >= monthStart && expenseDate <= monthEnd;
  });
  
  // Calculate totals
  const totalSales = monthlyTransactions.reduce((sum, transaction) => sum + (transaction.total || 0), 0);
  const totalExpenses = monthlyExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const netProfit = totalSales - totalExpenses;
  
  return {
    month: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    startDate: monthStart,
    endDate: monthEnd,
    totalSales,
    totalExpenses,
    netProfit,
    transactionCount: monthlyTransactions.length,
    expenseCount: monthlyExpenses.length,
    transactions: monthlyTransactions,
    expenses: monthlyExpenses
  };
}

function getCurrentMonthSummary() {
  return getMonthlyData();
}

function getPreviousMonthSummary() {
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  return getMonthlyData(lastMonth.getFullYear(), lastMonth.getMonth());
}

function getDateRangeData(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Get transactions for the date range
  const rangeTransactions = transactionHistory.filter(transaction => {
    const transactionDate = new Date(transaction.timestamp);
    return transactionDate >= start && transactionDate <= end;
  });
  
  // Get expenses for the date range
  const rangeExpenses = expensesData.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate >= start && expenseDate <= end;
  });
  
  const totalSales = rangeTransactions.reduce((sum, transaction) => sum + (transaction.total || 0), 0);
  const totalExpenses = rangeExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const netProfit = totalSales - totalExpenses;
  
  return {
    startDate: start,
    endDate: end,
    totalSales,
    totalExpenses,
    netProfit,
    transactionCount: rangeTransactions.length,
    expenseCount: rangeExpenses.length,
    transactions: rangeTransactions,
    expenses: rangeExpenses
  };
}

// Utility function to display month summary in console or for debugging
function showMonthSummary(month, year) {
  const summary = month && year ? getMonthlyData(year, month) : getCurrentMonthSummary();
  
  console.log(`
📊 MONTH SUMMARY: ${summary.month}
📅 Period: ${summary.startDate.toLocaleDateString()} - ${summary.endDate.toLocaleDateString()}
💰 Total Sales: Rs ${summary.totalSales}
💸 Total Expenses: Rs ${summary.totalExpenses}
📈 Net Profit: Rs ${summary.netProfit}
🧾 Transactions: ${summary.transactionCount}
🗂️ Expenses: ${summary.expenseCount}
  `);
  
  return summary;
}

// Function to export month data (you can extend this for reports)
function exportMonthData(month, year) {
  const summary = month && year ? getMonthlyData(year, month) : getCurrentMonthSummary();
  
  const exportData = {
    period: summary.month,
    startDate: summary.startDate.toISOString(),
    endDate: summary.endDate.toISOString(),
    summary: {
      totalSales: summary.totalSales,
      totalExpenses: summary.totalExpenses,
      netProfit: summary.netProfit,
      transactionCount: summary.transactionCount,
      expenseCount: summary.expenseCount
    },
    transactions: summary.transactions,
    expenses: summary.expenses
  };
  
  // You can extend this to save to file or send to server
  console.log('Month data exported:', exportData);
  return exportData;
}

// Helper functions for expense data persistence
function saveExpensesData() {
  try {
    console.log('Attempting to save expenses data:', expensesData);
    
    // Always save to localStorage as primary storage
    localStorage.setItem('miniVyapar_expensesData', JSON.stringify(expensesData));
    console.log('✅ Expenses data saved to localStorage:', expensesData.length, 'items');
    
    // Also try to save to MiniVyaparStorage if available
    if (typeof MiniVyaparStorage !== 'undefined' && MiniVyaparStorage.savePreference) {
      MiniVyaparStorage.savePreference('expensesData', expensesData);
      console.log('✅ Expenses data also saved to MiniVyaparStorage preferences');
    }
  } catch (error) {
    console.error('❌ Error saving expenses data:', error);
  }
}

// Save individual expense to IndexedDB
async function saveExpenseToIndexedDB(expense) {
  try {
    if (storageReady && window.MiniVyaparStorage && window.MiniVyaparStorage.addExpense) {
      await window.MiniVyaparStorage.addExpense(expense);
      console.log('✅ Expense saved to IndexedDB:', expense);
    }
  } catch (error) {
    console.error('❌ Error saving expense to IndexedDB:', error);
  }
}

// Debug function to test expense persistence
function testExpensePersistence() {
  console.log('=== EXPENSE PERSISTENCE TEST ===');
  console.log('Current expensesData:', expensesData);
  console.log('LocalStorage expenses:', localStorage.getItem('miniVyapar_expensesData'));
  console.log('MiniVyaparStorage expenses:', 
    typeof MiniVyaparStorage !== 'undefined' && MiniVyaparStorage.getPreference ? 
    MiniVyaparStorage.getPreference('expensesData', []) : 'N/A');
  
  // Test save
  const testExpense = {
    id: Date.now(),
    type: 'Test',
    description: 'Test Expense',
    category: 'Test',
    amount: 100,
    date: new Date().toISOString().split('T')[0],
    notes: 'Testing persistence'
  };
  
  expensesData.push(testExpense);
  saveExpensesData();
  console.log('Test expense added. New expensesData:', expensesData);
  console.log('New LocalStorage:', localStorage.getItem('miniVyapar_expensesData'));
}

// Make test function available globally for debugging
window.testExpensePersistence = testExpensePersistence;

// PRODUCT PROFIT ANALYSIS FUNCTIONALITY

let currentProfitPeriod = 'today';

// Show profit analysis modal
function showProfitAnalysis() {
  console.log('🔍 Opening profit analysis modal...');
  const modal = document.getElementById('profitAnalysisModal');
  if (modal) {
    modal.style.display = 'flex';
    console.log('✅ Modal opened, calculating profit...');
    calculateProductProfit();
    loadProfitTransactionsList();
  } else {
    console.error('❌ Profit analysis modal not found!');
  }
}

// Close profit analysis modal
function closeProfitAnalysisModal() {
  const modal = document.getElementById('profitAnalysisModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Filter profit analysis by period
function filterProfitByPeriod(period) {
  currentProfitPeriod = period;
  
  // Update active period button
  document.querySelectorAll('.profit-period-filter .period-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.period === period) {
      btn.classList.add('active');
    }
  });
  
  calculateProductProfit();
  loadProfitTransactionsList();
}

// Calculate product profit (only from cost vs selling price)
function calculateProductProfit() {
  console.log('💰 Calculating product profit...');
  console.log('Available inventory data:', inventoryData ? inventoryData.length : 0, 'products');
  console.log('Available transaction history:', transactionHistory ? transactionHistory.length : 0, 'transactions');
  
  let totalRevenue = 0;
  let totalCost = 0;
  let profitableTransactions = 0;
  let totalTransactions = 0;
  
  // Get date range based on current period
  const today = new Date();
  const todayStr = today.toDateString();
  let startDate = new Date();
  
  if (currentProfitPeriod === 'week') {
    startDate.setDate(today.getDate() - 7);
  } else if (currentProfitPeriod === 'month') {
    startDate.setDate(today.getDate() - 30);
  } else {
    // Today
    startDate = new Date(todayStr);
  }
  
  // Calculate from transaction history
  if (transactionHistory && transactionHistory.length > 0) {
    transactionHistory.forEach(transaction => {
      const transactionDate = new Date(transaction.timestamp);
      
      // Check if transaction falls within period
      let includeTransaction = false;
      if (currentProfitPeriod === 'today') {
        includeTransaction = transactionDate.toDateString() === todayStr;
      } else {
        includeTransaction = transactionDate >= startDate;
      }
      
      if (includeTransaction && transaction.items && transaction.type !== 'expense') {
        totalTransactions++;
        let transactionRevenue = 0;
        let transactionCost = 0;
        let hasValidCostData = false;
        
        console.log(`Processing transaction ${transaction.id}:`, transaction.items);
        
        transaction.items.forEach(item => {
          const revenue = (item.price || 0) * (item.quantity || 0);
          transactionRevenue += revenue;
          
          // Get cost price from product data
          let costPrice = 0;
          if (item.costPrice) {
            costPrice = item.costPrice;
            hasValidCostData = true;
            console.log(`  - ${item.name}: Cost from item = Rs ${costPrice}`);
          } else if (item.productId || item.id) {
            // Try to find product in current inventory
            const productId = item.productId || item.id;
            if (typeof productId === 'number' && inventoryData && inventoryData.length > 0) {
              const product = inventoryData.find(p => p.id === productId);
              if (product && product.costPrice) {
                costPrice = product.costPrice;
                hasValidCostData = true;
                console.log(`  - ${item.name}: Cost from inventory = Rs ${costPrice}`);
              } else {
                console.log(`  - ${item.name}: No cost price found (product:`, product, ')');
              }
            } else {
              console.log(`  - ${item.name}: Invalid product ID or no inventory data`);
            }
          } else {
            console.log(`  - ${item.name}: No product ID found`);
          }
          
          const cost = costPrice * (item.quantity || 0);
          transactionCost += cost;
          
          console.log(`  - ${item.name}: Revenue Rs ${revenue}, Cost Rs ${cost}, Profit Rs ${revenue - cost}`);
        });
        
        if (hasValidCostData) {
          totalRevenue += transactionRevenue;
          totalCost += transactionCost;
          
          if (transactionRevenue > transactionCost) {
            profitableTransactions++;
          }
        }
      }
    });
  }
  
  const netProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;
  
  console.log(`📊 Profit Summary for ${currentProfitPeriod}:`);
  console.log(`  Total Revenue: Rs ${totalRevenue}`);
  console.log(`  Total Cost: Rs ${totalCost}`);
  console.log(`  Net Profit: Rs ${netProfit}`);
  console.log(`  Profit Margin: ${profitMargin.toFixed(2)}%`);
  console.log(`  Profitable Transactions: ${profitableTransactions}/${totalTransactions}`);
  
  // Update dashboard card
  const profitCard = document.getElementById('productProfitCard');
  const marginCard = document.getElementById('profitMarginCard');
  if (profitCard) profitCard.textContent = `Rs ${Math.round(netProfit)}`;
  if (marginCard) marginCard.textContent = `${Math.round(profitMargin)}% margin`;
  
  // Update modal summary
  const revenueEl = document.getElementById('profitTotalRevenue');
  const costEl = document.getElementById('profitTotalCost');
  const profitEl = document.getElementById('profitNetProfit');
  const marginEl = document.getElementById('profitMarginPercent');
  
  if (revenueEl) revenueEl.textContent = `Rs ${Math.round(totalRevenue)}`;
  if (costEl) costEl.textContent = `Rs ${Math.round(totalCost)}`;
  if (profitEl) profitEl.textContent = `Rs ${Math.round(netProfit)}`;
  if (marginEl) marginEl.textContent = `${Math.round(profitMargin)}% margin`;
}

// Load profit transactions list for modal
function loadProfitTransactionsList() {
  const transactionsList = document.getElementById('profitTransactionsList');
  if (!transactionsList) return;
  
  // Get date range based on current period
  const today = new Date();
  const todayStr = today.toDateString();
  let startDate = new Date();
  
  if (currentProfitPeriod === 'week') {
    startDate.setDate(today.getDate() - 7);
  } else if (currentProfitPeriod === 'month') {
    startDate.setDate(today.getDate() - 30);
  } else {
    startDate = new Date(todayStr);
  }
  
  let profitTransactions = [];
  
  // Process transaction history
  if (transactionHistory && transactionHistory.length > 0) {
    transactionHistory.forEach(transaction => {
      const transactionDate = new Date(transaction.timestamp);
      
      // Check if transaction falls within period
      let includeTransaction = false;
      if (currentProfitPeriod === 'today') {
        includeTransaction = transactionDate.toDateString() === todayStr;
      } else {
        includeTransaction = transactionDate >= startDate;
      }
      
      if (includeTransaction && transaction.items && transaction.type !== 'expense') {
        let transactionRevenue = 0;
        let transactionCost = 0;
        let hasValidCostData = false;
        let itemsWithProfit = [];
        
        transaction.items.forEach(item => {
          const revenue = (item.price || 0) * (item.quantity || 0);
          transactionRevenue += revenue;
          
          // Get cost price
          let costPrice = 0;
          if (item.costPrice) {
            costPrice = item.costPrice;
            hasValidCostData = true;
          } else if (item.productId || item.id) {
            const productId = item.productId || item.id;
            if (typeof productId === 'number' && inventoryData && inventoryData.length > 0) {
              const product = inventoryData.find(p => p.id === productId);
              if (product && product.costPrice) {
                costPrice = product.costPrice;
                hasValidCostData = true;
              }
            }
          }
          
          const cost = costPrice * (item.quantity || 0);
          transactionCost += cost;
          
          if (hasValidCostData) {
            itemsWithProfit.push({
              name: item.name,
              quantity: item.quantity,
              costPrice: costPrice,
              sellingPrice: item.price,
              profit: revenue - cost
            });
          }
        });
        
        if (hasValidCostData) {
          const netProfit = transactionRevenue - transactionCost;
          profitTransactions.push({
            id: transaction.id,
            timestamp: transaction.timestamp,
            revenue: transactionRevenue,
            cost: transactionCost,
            profit: netProfit,
            items: itemsWithProfit
          });
        }
      }
    });
  }
  
  // Sort by timestamp (newest first)
  profitTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  if (profitTransactions.length === 0) {
    transactionsList.innerHTML = `
      <div class="no-profit-data">
        <div class="icon">📊</div>
        <div>No profit data available for ${currentProfitPeriod}</div>
        <div style="margin-top: 8px; font-size: 12px;">Make sales with products that have cost prices set</div>
      </div>
    `;
    return;
  }
  
  let html = '';
  profitTransactions.forEach(transaction => {
    const date = new Date(transaction.timestamp);
    const timeStr = date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    const dateStr = date.toLocaleDateString('en-IN');
    
    const profitColor = transaction.profit >= 0 ? '#28a745' : '#dc3545';
    
    html += `
      <div class="profit-transaction-item">
        <div class="profit-transaction-info">
          <div class="profit-transaction-title">Sale #${transaction.id.toString().slice(-6)}</div>
          <div class="profit-transaction-details">
            ${dateStr} at ${timeStr} • ${transaction.items.length} items
          </div>
        </div>
        <div class="profit-amount">
          <div class="profit-amount-value" style="color: ${profitColor}">
            Rs ${Math.round(transaction.profit)}
          </div>
          <div class="profit-amount-calculation">
            Rs ${Math.round(transaction.revenue)} - Rs ${Math.round(transaction.cost)}
          </div>
        </div>
      </div>
    `;
  });
  
  transactionsList.innerHTML = html;
}

// Update dashboard with product profit data
function updateProductProfitDashboard() {
  // Calculate today's profit for dashboard
  const originalPeriod = currentProfitPeriod;
  currentProfitPeriod = 'today';
  calculateProductProfit();
  currentProfitPeriod = originalPeriod;
}

function loadExpensesData() {
  try {
    console.log('Loading expenses data...');
    let loadedData = null;
    
    // Try localStorage first (most reliable)
    const storedLocalStorage = localStorage.getItem('miniVyapar_expensesData');
    if (storedLocalStorage) {
      loadedData = JSON.parse(storedLocalStorage);
      console.log('📄 Loaded from localStorage:', loadedData.length, 'expenses');
    }
    
    // If localStorage is empty, try MiniVyaparStorage
    if (!loadedData || loadedData.length === 0) {
      if (typeof MiniVyaparStorage !== 'undefined' && MiniVyaparStorage.getPreference) {
        loadedData = MiniVyaparStorage.getPreference('expensesData', []);
        console.log('📄 Loaded from MiniVyaparStorage:', loadedData ? loadedData.length : 0, 'expenses');
      }
    }
    
    if (Array.isArray(loadedData) && loadedData.length > 0) {
      expensesData = loadedData;
      console.log(`✅ Successfully loaded ${expensesData.length} expenses from storage`);
      
      // Update dashboard and displays after loading expenses
      updateTodaysExpenses();
      displayRecentTransactions();
    } else {
      expensesData = [];
      console.log('ℹ️ No expenses data found - starting with empty array');
    }
  } catch (error) {
    console.error('❌ Error loading expenses data:', error);
    expensesData = []; // Reset to empty array on error
  }
}

// EXPENSES PAGE FUNCTIONALITY

// Initialize Expenses page when it becomes active
document.addEventListener('DOMContentLoaded', function() {
  const expensesPage = document.getElementById('expenses');
  
  // Observer to detect when expenses page becomes active
  const expensesObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        if (expensesPage.classList.contains('active')) {
          initExpensesPage();
        }
      }
    });
  });
  
  expensesObserver.observe(expensesPage, { attributes: true });
});

function initExpensesPage() {
  loadExpensesSummary();
  loadExpensesList();
  loadCreditsData();
  loadCreditsSummary();
  loadCreditsList();
  
  // Initialize with expenses tab active
  switchExpensesTab('expenses');
}

// Tab switching function
function switchExpensesTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  if (tabName === 'expenses') {
    document.getElementById('expensesTab').classList.add('active');
  } else if (tabName === 'credit') {
    document.getElementById('creditTab').classList.add('active');
    // Refresh credit data when switching to credit tab
    loadCreditsSummary();
    loadCreditsList();
  }
}

function loadExpensesSummary() {
  const today = new Date().toDateString();
  const monthData = getCurrentMonthSummary();
  
  // Today's expenses
  const todayExpenses = expensesData
    .filter(expense => new Date(expense.date).toDateString() === today)
    .reduce((sum, expense) => sum + expense.amount, 0);
  
  // Update UI
  document.getElementById('todayExpenses').textContent = `Rs ${todayExpenses}`;
  document.getElementById('monthExpenses').textContent = `Rs ${monthData.totalExpenses}`;
  
  // Add month information if elements exist
  const monthInfo = document.getElementById('monthInfo');
  if (monthInfo) {
    monthInfo.innerHTML = `
      <div class="month-summary">
        <h4>${monthData.month}</h4>
        <p>Period: ${monthData.startDate.toLocaleDateString()} - ${monthData.endDate.toLocaleDateString()}</p>
        <div class="month-stats">
          <div>Sales: Rs ${monthData.totalSales}</div>
          <div>Expenses: Rs ${monthData.totalExpenses}</div>
          <div class="${monthData.netProfit >= 0 ? 'profit' : 'loss'}">
            Net: Rs ${monthData.netProfit} ${monthData.netProfit >= 0 ? '📈' : '📉'}
          </div>
        </div>
      </div>
    `;
  }
}

function loadExpensesList() {
  const expensesList = document.getElementById('expensesList');
  if (!expensesList) return;
  
  expensesList.innerHTML = '';
  
  if (expensesData.length === 0) {
    expensesList.innerHTML = '<div class="empty-state">No expenses recorded yet</div>';
    return;
  }
  
  // Sort by date (newest first)
  const sortedExpenses = [...expensesData].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  sortedExpenses.forEach(expense => {
    const expenseElement = createExpenseElement(expense);
    expensesList.appendChild(expenseElement);
  });
}

function createExpenseElement(expense) {
  const div = document.createElement('div');
  div.className = 'expense-item';
  
  const date = new Date(expense.date).toLocaleDateString();
  
  div.innerHTML = `
    <div class="expense-info">
      <div class="expense-type">${expense.type}</div>
      <div class="expense-date">${date}</div>
      ${expense.notes ? `<div class="expense-notes">${expense.notes}</div>` : ''}
    </div>
    <div class="expense-amount">Rs ${expense.amount}</div>
    <div class="expense-actions">
      <button class="edit-btn" onclick="editExpense(${expense.id})" title="Edit Expense">✏️</button>
      <button class="delete-btn" onclick="deleteExpense(${expense.id})" title="Delete Expense">🗑️</button>
    </div>
  `;
  
  return div;
}

// Add Expense functionality
function openAddExpenseForm() {
  // Reset modal for adding (not editing)
  resetExpenseModal();
  
  document.getElementById('addExpenseModal').style.display = 'flex';
  
  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('expenseDate').value = today;
  
  const form = document.getElementById('addExpenseForm');
  form.reset();
  document.getElementById('expenseDate').value = today;
}

function closeAddExpenseForm() {
  document.getElementById('addExpenseModal').style.display = 'none';
  resetExpenseModal(); // Reset modal state when closing
}

function handleAddExpense(e) {
  e.preventDefault();
  
  const newExpense = {
    id: Date.now(),
    type: document.getElementById('expenseType').value,
    description: document.getElementById('expenseType').value + (document.getElementById('expenseNotes').value ? ': ' + document.getElementById('expenseNotes').value : ''),
    category: document.getElementById('expenseType').value,
    amount: parseFloat(document.getElementById('expenseAmount').value),
    date: document.getElementById('expenseDate').value,
    notes: document.getElementById('expenseNotes').value
  };
  
  expensesData.push(newExpense);
  saveExpensesData(); // Save to localStorage
  saveExpenseToIndexedDB(newExpense); // Also save to IndexedDB
  loadExpensesSummary();
  loadExpensesList();
  updateDashboardData(); // Update dashboard after adding expense
  closeAddExpenseForm();
  showToast(`Expense of Rs ${newExpense.amount} added`);
}

// Delete Expense functionality
async function deleteExpense(expenseId) {
  const expense = expensesData.find(e => e.id === expenseId);
  if (expense) {
    const confirmed = await showCustomConfirm(
      `Are you sure you want to delete this expense?\n\n${expense.type}: Rs ${expense.amount}\nDate: ${new Date(expense.date).toLocaleDateString()}`,
      'Delete Expense',
      '🗑️',
      'Delete',
      'Cancel',
      true
    );
    
    if (confirmed) {
      expensesData = expensesData.filter(e => e.id !== expenseId);
      saveExpensesData(); // Save to storage
      loadExpensesSummary();
      loadExpensesList();
      updateDashboardData(); // Update dashboard after expense deletion
      showCustomNotification('Expense deleted successfully', 'success', 'Expense Deleted');
    }
  }
}

// Edit Expense functionality
let editingExpenseId = null;

function editExpense(expenseId) {
  const expense = expensesData.find(e => e.id === expenseId);
  if (!expense) return;
  
  editingExpenseId = expenseId;
  
  // Populate the form with existing expense data
  document.getElementById('expenseType').value = expense.type;
  document.getElementById('expenseAmount').value = expense.amount;
  document.getElementById('expenseDate').value = expense.date;
  document.getElementById('expenseNotes').value = expense.notes || '';
  
  // Change modal title and button text to indicate editing
  const modal = document.getElementById('addExpenseModal');
  const modalTitle = modal.querySelector('h3');
  const submitBtn = modal.querySelector('button[type="submit"]');
  
  if (modalTitle) modalTitle.textContent = 'Edit Expense';
  if (submitBtn) submitBtn.textContent = 'Update Expense';
  
  // Show the modal
  modal.style.display = 'flex';
  
  // Update form handler for editing
  const form = document.getElementById('addExpenseForm');
  form.removeEventListener('submit', handleAddExpense);
  form.addEventListener('submit', handleEditExpense);
}

function handleEditExpense(e) {
  e.preventDefault();
  
  const expenseIndex = expensesData.findIndex(e => e.id === editingExpenseId);
  if (expenseIndex === -1) return;
  
  // Update the expense
  expensesData[expenseIndex] = {
    ...expensesData[expenseIndex],
    type: document.getElementById('expenseType').value,
    amount: parseFloat(document.getElementById('expenseAmount').value),
    date: document.getElementById('expenseDate').value,
    notes: document.getElementById('expenseNotes').value
  };
  
  saveExpensesData(); // Save to storage
  loadExpensesSummary();
  loadExpensesList();
  updateDashboardData(); // Update dashboard after expense edit
  closeAddExpenseForm();
  
  // Reset modal for next use
  resetExpenseModal();
  
  showToast('Expense updated successfully');
}

function resetExpenseModal() {
  editingExpenseId = null;
  
  // Reset modal title and button text
  const modal = document.getElementById('addExpenseModal');
  const modalTitle = modal.querySelector('h3');
  const submitBtn = modal.querySelector('button[type="submit"]');
  
  if (modalTitle) modalTitle.textContent = 'Add New Expense';
  if (submitBtn) submitBtn.textContent = 'Add Expense';
  
  // Reset form handler
  const form = document.getElementById('addExpenseForm');
  form.removeEventListener('submit', handleEditExpense);
  form.addEventListener('submit', handleAddExpense);
}

// CREDIT SYSTEM FUNCTIONALITY

// Credit data array
let creditsData = [];

function loadCreditsSummary() {
  const activeCredits = creditsData.filter(credit => credit.status === 'active');
  const totalOutstanding = activeCredits.reduce((sum, credit) => sum + credit.amount, 0);
  
  // Update UI
  document.getElementById('activeCredits').textContent = `${activeCredits.length}`;
  document.getElementById('totalOutstanding').textContent = `Rs ${totalOutstanding}`;
}

function loadCreditsList() {
  const creditsList = document.getElementById('creditList');
  if (!creditsList) return;
  
  creditsList.innerHTML = '';
  
  if (creditsData.length === 0) {
    creditsList.innerHTML = `
      <div class="empty-credit-state">
        <h3>No credit entries found</h3>
        <p>Add your first credit entry to get started</p>
      </div>
    `;
    return;
  }
  
  // Sort by date (newest first)
  const sortedCredits = [...creditsData].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  sortedCredits.forEach(credit => {
    const creditElement = createCreditElement(credit);
    creditsList.appendChild(creditElement);
  });
}

function createCreditElement(credit) {
  const div = document.createElement('div');
  div.className = 'credit-item';
  
  const date = new Date(credit.date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  
  div.innerHTML = `
    <div class="credit-info">
      <div class="credit-customer">${credit.customerName}</div>
      <div class="credit-date">${date}</div>
      ${credit.phone ? `<div class="credit-phone">Phone: ${credit.phone}</div>` : ''}
    </div>
    <div class="credit-amount">Rs ${credit.amount}</div>
    <div class="credit-status">
      <span class="status-badge ${credit.status}">${credit.status.toUpperCase()}</span>
      ${credit.status === 'active' ? 
        `<button class="mark-paid-btn" onclick="markCreditAsPaid(${credit.id})" title="Mark as Paid">✓</button>` : 
        ''
      }
    </div>
    <div class="credit-actions">
      <button class="edit-btn" onclick="editCredit(${credit.id})" title="Edit Credit">✏️</button>
      <button class="delete-btn" onclick="deleteCredit(${credit.id})" title="Delete Credit">🗑️</button>
    </div>
  `;
  
  return div;
}

// Add Credit functionality
function openAddCreditForm() {
  // Reset modal for adding (not editing)
  resetCreditModal();
  
  document.getElementById('addCreditModal').style.display = 'flex';
  
  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('creditDate').value = today;
  
  const form = document.getElementById('addCreditForm');
  form.reset();
  document.getElementById('creditDate').value = today;
}

function closeAddCreditForm() {
  document.getElementById('addCreditModal').style.display = 'none';
  resetCreditModal(); // Reset modal state when closing
}

function handleAddCredit(e) {
  e.preventDefault();
  
  const newCredit = {
    id: Date.now(),
    customerName: document.getElementById('customerName').value,
    amount: parseFloat(document.getElementById('creditAmount').value),
    date: document.getElementById('creditDate').value,
    phone: document.getElementById('customerPhone').value,
    notes: document.getElementById('creditNotes').value,
    status: 'active' // Default status
  };
  
  creditsData.push(newCredit);
  saveCreditsData(); // Save to storage
  loadCreditsSummary();
  loadCreditsList();
  updateCreditDashboard(); // Update dashboard
  closeAddCreditForm();
  showToast(`Credit of Rs ${newCredit.amount} added for ${newCredit.customerName}`);
}

// Mark credit as paid
async function markCreditAsPaid(creditId) {
  const credit = creditsData.find(c => c.id === creditId);
  if (credit) {
    const confirmed = await showCustomConfirm(
      `Mark credit as paid?\n\n${credit.customerName}: Rs ${credit.amount}`,
      'Mark as Paid',
      '💰',
      'Mark Paid',
      'Cancel',
      false
    );
    
    if (confirmed) {
      credit.status = 'paid';
      credit.paidDate = new Date().toISOString().split('T')[0];
      saveCreditsData(); // Save to storage
      loadCreditsSummary();
      loadCreditsList();
      updateCreditDashboard(); // Update dashboard
      showToast(`Credit marked as paid for ${credit.customerName}`);
    }
  }
}

// Delete Credit functionality
async function deleteCredit(creditId) {
  const credit = creditsData.find(c => c.id === creditId);
  if (credit) {
    const confirmed = await showCustomConfirm(
      `Are you sure you want to delete this credit?\n\n${credit.customerName}: Rs ${credit.amount}\nDate: ${new Date(credit.date).toLocaleDateString()}`,
      'Delete Credit',
      '🗑️',
      'Delete',
      'Cancel',
      true
    );
    
    if (confirmed) {
      creditsData = creditsData.filter(c => c.id !== creditId);
      saveCreditsData(); // Save to storage
      loadCreditsSummary();
      loadCreditsList();
      updateCreditDashboard(); // Update dashboard
      showCustomNotification('Credit deleted successfully', 'success', 'Credit Deleted');
    }
  }
}

// Edit Credit functionality
let editingCreditId = null;

function editCredit(creditId) {
  const credit = creditsData.find(c => c.id === creditId);
  if (!credit) return;
  
  editingCreditId = creditId;
  
  // Populate the form with existing credit data
  document.getElementById('customerName').value = credit.customerName;
  document.getElementById('creditAmount').value = credit.amount;
  document.getElementById('creditDate').value = credit.date;
  document.getElementById('customerPhone').value = credit.phone || '';
  document.getElementById('creditNotes').value = credit.notes || '';
  
  // Change modal title and button text to indicate editing
  const modal = document.getElementById('addCreditModal');
  const modalTitle = modal.querySelector('h3');
  const submitBtn = modal.querySelector('button[type="submit"]');
  
  if (modalTitle) modalTitle.textContent = 'Edit Credit';
  if (submitBtn) submitBtn.textContent = 'Update Credit';
  
  // Show the modal
  modal.style.display = 'flex';
  
  // Update form handler for editing
  const form = document.getElementById('addCreditForm');
  form.removeEventListener('submit', handleAddCredit);
  form.addEventListener('submit', handleEditCredit);
}

function handleEditCredit(e) {
  e.preventDefault();
  
  const creditIndex = creditsData.findIndex(c => c.id === editingCreditId);
  if (creditIndex === -1) return;
  
  // Update the credit
  creditsData[creditIndex] = {
    ...creditsData[creditIndex],
    customerName: document.getElementById('customerName').value,
    amount: parseFloat(document.getElementById('creditAmount').value),
    date: document.getElementById('creditDate').value,
    phone: document.getElementById('customerPhone').value,
    notes: document.getElementById('creditNotes').value
  };
  
  saveCreditsData(); // Save to storage
  loadCreditsSummary();
  loadCreditsList();
  updateCreditDashboard(); // Update dashboard
  closeAddCreditForm();
  
  // Reset modal for next use
  resetCreditModal();
  
  showToast('Credit updated successfully');
}

function resetCreditModal() {
  editingCreditId = null;
  
  // Reset modal title and button text
  const modal = document.getElementById('addCreditModal');
  const modalTitle = modal.querySelector('h3');
  const submitBtn = modal.querySelector('button[type="submit"]');
  
  if (modalTitle) modalTitle.textContent = 'Add Credit';
  if (submitBtn) submitBtn.textContent = 'Save Credit';
  
  // Reset form handler
  const form = document.getElementById('addCreditForm');
  form.removeEventListener('submit', handleEditCredit);
  form.addEventListener('submit', handleAddCredit);
}

// Helper functions for credit data persistence
function saveCreditsData() {
  try {
    if (typeof MiniVyaparStorage !== 'undefined' && MiniVyaparStorage.savePreference) {
      MiniVyaparStorage.savePreference('creditsData', creditsData);
      console.log('Credits data saved to storage');
    } else {
      // Fallback to direct localStorage
      localStorage.setItem('miniVyapar_creditsData', JSON.stringify(creditsData));
      console.log('Credits data saved to localStorage (fallback)');
    }
  } catch (error) {
    console.error('Error saving credits data:', error);
  }
}

function loadCreditsData() {
  try {
    let loadedData = null;
    
    if (typeof MiniVyaparStorage !== 'undefined' && MiniVyaparStorage.getPreference) {
      loadedData = MiniVyaparStorage.getPreference('creditsData', []);
    } else {
      // Fallback to direct localStorage
      const stored = localStorage.getItem('miniVyapar_creditsData');
      loadedData = stored ? JSON.parse(stored) : [];
    }
    
    if (Array.isArray(loadedData)) {
      creditsData = loadedData;
      console.log(`Loaded ${creditsData.length} credits from storage`);
    }
  } catch (error) {
    console.error('Error loading credits data:', error);
    creditsData = []; // Reset to empty array on error
  }
}

// Clear all credit data (for removing sample data)
function clearAllCreditsData() {
  creditsData = [];
  try {
    if (typeof MiniVyaparStorage !== 'undefined' && MiniVyaparStorage.savePreference) {
      MiniVyaparStorage.savePreference('creditsData', []);
    } else {
      localStorage.setItem('miniVyapar_creditsData', JSON.stringify([]));
    }
    // Update displays
    updateCreditDashboard();
    if (document.querySelector('.credit-page').style.display !== 'none') {
      displayCredits();
    }
    console.log('All credit data cleared successfully');
  } catch (error) {
    console.error('Error clearing credits data:', error);
  }
}

// CREDIT DASHBOARD INTEGRATION

// Update credit data on dashboard
function updateCreditDashboard() {
  if (!creditsData) return;
  
  const activeCredits = creditsData.filter(credit => credit.status === 'active');
  const totalOutstanding = activeCredits.reduce((sum, credit) => sum + credit.amount, 0);
  
  // Update dashboard card
  const creditOutstandingCard = document.getElementById('creditOutstandingCard');
  const activeCreditEntriesCard = document.getElementById('activeCreditEntriesCard');
  
  if (creditOutstandingCard) {
    creditOutstandingCard.textContent = `Rs ${totalOutstanding}`;
  }
  
  if (activeCreditEntriesCard) {
    activeCreditEntriesCard.textContent = `${activeCredits.length} active`;
  }
}

// Show credit summary modal
function showCreditSummary() {
  loadCreditsData(); // Ensure data is loaded
  
  const modal = document.getElementById('creditSummaryModal');
  if (!modal) return;
  
  // Calculate summary statistics
  const activeCredits = creditsData.filter(credit => credit.status === 'active');
  const totalOutstanding = activeCredits.reduce((sum, credit) => sum + credit.amount, 0);
  
  // Calculate paid this month
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const paidThisMonth = creditsData
    .filter(credit => {
      if (credit.status === 'paid' && credit.paidDate) {
        const paidDate = new Date(credit.paidDate);
        return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear;
      }
      return false;
    })
    .reduce((sum, credit) => sum + credit.amount, 0);
  
  // Update modal content
  document.getElementById('modalTotalOutstanding').textContent = `Rs ${totalOutstanding}`;
  document.getElementById('modalActiveCredits').textContent = activeCredits.length;
  document.getElementById('modalPaidThisMonth').textContent = `Rs ${paidThisMonth}`;
  
  // Show recent credits (last 5)
  const recentCredits = [...creditsData]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  
  const recentCreditsList = document.getElementById('recentCreditsList');
  if (recentCreditsList) {
    if (recentCredits.length === 0) {
      recentCreditsList.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">No credit entries found</p>';
    } else {
      recentCreditsList.innerHTML = recentCredits.map(credit => {
        const date = new Date(credit.date).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short'
        });
        return `
          <div class="recent-credit-item">
            <div class="recent-credit-info">
              <div class="recent-credit-name">${credit.customerName}</div>
              <div class="recent-credit-date">${date}</div>
            </div>
            <div class="recent-credit-amount">Rs ${credit.amount}</div>
          </div>
        `;
      }).join('');
    }
  }
  
  // Show modal
  modal.style.display = 'flex';
}

// Close credit summary modal
function closeCreditSummaryModal() {
  const modal = document.getElementById('creditSummaryModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// View all credits - navigate to expenses page with credit tab
function viewAllCredits() {
  closeCreditSummaryModal();
  switchToPage('expenses');
  // Switch to credit tab after a short delay to ensure page is loaded
  setTimeout(() => {
    switchExpensesTab('credit');
  }, 100);
}

// Add new credit from dashboard
function addNewCreditFromDashboard() {
  closeCreditSummaryModal();
  switchToPage('expenses');
  // Switch to credit tab and open add form
  setTimeout(() => {
    switchExpensesTab('credit');
    setTimeout(() => {
      openAddCreditForm();
    }, 100);
  }, 100);
}

// On page load and after navigation, ensure correct floating bar visibility
window.addEventListener('DOMContentLoaded', () => setFloatingBarPosition(false));

function setHomeFloatingBarVisibility() {
  const cartBottomBar = document.getElementById('cartBottomBar');
  const fabMain = document.getElementById('fabMain');
  const fabMenu = document.getElementById('fabMenu');
  if (!cartBottomBar || !fabMain || !fabMenu) return;
  // Hide floating bar if Home Screen cart is visible
  const isCartOpen = cartBottomBar.classList.contains('visible');
  if (isCartOpen) {
    fabMain.style.display = 'none';
    fabMenu.style.display = 'none';
  } else {
    fabMain.style.display = '';
    fabMenu.style.display = '';
  }
}

// Patch updateCart to call setHomeFloatingBarVisibility
const originalUpdateCart = window.updateCart;
window.updateCart = function() {
  if (originalUpdateCart) originalUpdateCart.apply(this, arguments);
  setHomeFloatingBarVisibility();
};

// On page load, ensure correct floating bar visibility for Home Screen
window.addEventListener('DOMContentLoaded', setHomeFloatingBarVisibility);

// Overview dropdown toggle
function toggleOverviewDropdown() {
    const content = document.getElementById('overviewDropdownContent');
    const icon = document.getElementById('overviewDropdownIcon');
    if (!content || !icon) return;
    if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'flex';
        icon.textContent = '▲';
    } else {
        content.style.display = 'none';
        icon.textContent = '▼';
    }
}

// Sales Chart functionality
function renderSalesChart(data, labels) {
    const barsContainer = document.getElementById('salesChartBars');
    const labelsContainer = document.getElementById('salesChartLabels');
    if (!barsContainer || !labelsContainer) return;
    barsContainer.innerHTML = '';
    labelsContainer.innerHTML = '';
    const maxValue = Math.max(...data, 1);
    data.forEach((value, i) => {
        const bar = document.createElement('div');
        bar.className = 'sales-chart-bar';
        bar.style.height = (value / maxValue * 60) + 'px';
        barsContainer.appendChild(bar);
        const label = document.createElement('div');
        label.className = 'sales-chart-label';
        label.textContent = labels[i];
        labelsContainer.appendChild(label);
    });
}
// Example usage: sales for 6 hours
window.addEventListener('DOMContentLoaded', function() {
    renderSalesChart([120, 80, 150, 60, 200, 90], ['9am','10am','11am','12pm','1pm','2pm']);
});

const salesChartData = {
    today: {
        labels: ['9am','10am','11am','12pm','1pm','2pm','3pm','4pm'],
        data: [120, 80, 150, 60, 200, 90, 170, 110]
    },
    week: {
        labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        data: [800, 950, 700, 1200, 1100, 900, 1000]
    },
    month: {
        labels: ['Week 1','Week 2','Week 3','Week 4'],
        data: [4200, 5100, 3900, 4800]
    }
};

function drawSalesLineChart(range) {
    const canvas = document.getElementById('salesLineChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { labels, data } = salesChartData[range];
    const w = canvas.width, h = canvas.height;
    const padding = 60;
    const chartW = w - 2 * padding;
    const chartH = h - 2 * padding;
    const maxVal = Math.max(...data, 1);
    const minVal = Math.min(...data, 0);
    const n = data.length;
    // Calculate points
    const points = data.map((val, i) => [
        padding + (i * chartW / (n-1)),
        h - padding - ((val-minVal)/(maxVal-minVal||1))*chartH
    ]);
    // Draw axes
    ctx.strokeStyle = '#adb5bd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, h-padding);
    ctx.lineTo(w-padding, h-padding);
    ctx.stroke();
    // Draw line
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    points.forEach(([x,y],i) => {
        if(i===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
    });
    ctx.stroke();
    // Draw indicators
    points.forEach(([x,y],i) => {
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, 2*Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#007bff';
        ctx.stroke();
        // Value label
        ctx.font = 'bold 15px Arial';
        ctx.fillStyle = '#007bff';
        ctx.textAlign = 'center';
        ctx.fillText(data[i], x, y-16);
    });
    // Draw x labels
    ctx.font = '13px Arial';
    ctx.fillStyle = '#495057';
    ctx.textAlign = 'center';
    labels.forEach((lbl,i) => {
        ctx.fillText(lbl, points[i][0], h-padding+22);
    });
}
function switchSalesChartTab(range) {
    document.querySelectorAll('.sales-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.range === range);
    });
    drawSalesLineChart(range);
}
window.addEventListener('DOMContentLoaded', function() {
    drawSalesLineChart('today');
});

const salesOverviewData = {
    today: {
        labels: ['5 AM','6 AM','7 AM','8 AM','9 AM','10 AM','11 AM','12 PM'],
        data: [120, 220, 450, 300, 600, 480, 700, 650]
    },
    week: {
        labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        data: [800, 950, 700, 1200, 1100, 900, 1000]
    },
    month: {
        labels: ['Week 1','Week 2','Week 3','Week 4'],
        data: [4200, 5100, 3900, 4800]
    }
};
let currentSalesTab = 'today';
let chartAnimFrame = null;
function drawSmoothLineChart(range, animate = true) {
    const canvas = document.getElementById('salesOverviewCanvas');
    const tooltip = document.getElementById('salesOverviewTooltip');
    if (!canvas) return;
    // Responsive canvas size
    const parentWidth = canvas.parentElement.offsetWidth;
    canvas.width = parentWidth;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { labels, data } = getSalesChartData(range);
    const w = canvas.width, h = canvas.height;
    const padding = 60;
    const chartW = w - 2 * padding;
    const chartH = h - 2 * padding;
    const maxY = 800, minY = 0;
    const n = data.length;
    // Calculate points
    const points = data.map((val, i) => [
        padding + (i * chartW / (n-1)),
        h - padding - ((val-minY)/(maxY-minY))*chartH
    ]);
    // Animation
    let animProgress = animate ? 0 : 1;
    if (animate) {
        if (chartAnimFrame) cancelAnimationFrame(chartAnimFrame);
        function animateChart() {
            animProgress += 0.07;
            if (animProgress > 1) animProgress = 1;
            renderChart(animProgress);
            if (animProgress < 1) chartAnimFrame = requestAnimationFrame(animateChart);
        }
        animateChart();
    } else {
        renderChart(1);
    }
    function renderChart(progress) {
        ctx.clearRect(0, 0, w, h);
        // Axes
        ctx.strokeStyle = '#adb5bd';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, h-padding);
        ctx.lineTo(w-padding, h-padding);
        ctx.stroke();
        // Y-axis labels
        ctx.font = '13px Arial';
        ctx.fillStyle = '#868e96';
        ctx.textAlign = 'right';
        for(let y=0; y<=800; y+=200) {
            const yPos = h-padding-((y-minY)/(maxY-minY))*chartH;
            ctx.fillText(y, padding-10, yPos+5);
            ctx.beginPath();
            ctx.strokeStyle = '#e9ecef';
            ctx.moveTo(padding, yPos);
            ctx.lineTo(w-padding, yPos);
            ctx.stroke();
        }
        // X-axis labels
        ctx.textAlign = 'center';
        labels.forEach((lbl,i) => {
            ctx.fillText(lbl, points[i][0], h-padding+22);
        });
        // Smooth line (Bezier)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for(let i=1; i<n; i++) {
            const prev = points[i-1], curr = points[i];
            const midX = (prev[0]+curr[0])/2;
            ctx.bezierCurveTo(midX, prev[1], midX, curr[1], curr[0], curr[1]);
        }
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.95;
        ctx.stroke();
        // Shaded area
        ctx.lineTo(points[n-1][0], h-padding);
        ctx.lineTo(points[0][0], h-padding);
        ctx.closePath();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#007bff';
        ctx.fill();
        ctx.restore();
        // Data points
        points.forEach(([x,y],i) => {
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, 2*Math.PI);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#007bff';
            ctx.stroke();
        });
    }
    // Tooltip interactivity
    canvas.onmousemove = function(e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        let found = false;
        points.forEach(([x,y],i) => {
            if(Math.abs(mx-x)<14 && Math.abs(my-y)<14) {
                tooltip.style.display = 'block';
                tooltip.style.left = (x-rect.left+10)+'px';
                tooltip.style.top = (y-rect.top-40)+'px';
                tooltip.textContent = labels[i]+': Rs. '+data[i];
                found = true;
            }
        });
        if(!found) tooltip.style.display = 'none';
    };
    canvas.ontouchstart = function(e) {
        const rect = canvas.getBoundingClientRect();
        const t = e.touches[0];
        const mx = t.clientX - rect.left;
        const my = t.clientY - rect.top;
        let found = false;
        points.forEach(([x,y],i) => {
            if(Math.abs(mx-x)<18 && Math.abs(my-y)<18) {
                tooltip.style.display = 'block';
                tooltip.style.left = (x-rect.left+10)+'px';
                tooltip.style.top = (y-rect.top-40)+'px';
                tooltip.textContent = labels[i]+': Rs. '+data[i];
                found = true;
            }
        });
        if(!found) tooltip.style.display = 'none';
    };
    canvas.onmouseleave = function() { tooltip.style.display = 'none'; };
}
function switchSalesChartTab(range) {
    document.querySelectorAll('.sales-pill').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.range === range);
    });
    currentSalesTab = range;
    drawSmoothLineChart(range, true);
}
window.addEventListener('DOMContentLoaded', function() {
    drawSmoothLineChart('today', false);
    window.addEventListener('resize', () => drawSmoothLineChart(currentSalesTab, false));
});

// Load all real data from storage
async function loadAllRealData() {
  try {
    console.log('=== loadAllRealData START ===');
    console.log('storageReady:', storageReady);
    console.log('window.MiniVyaparStorage exists:', !!window.MiniVyaparStorage);
    
    if (storageReady && window.MiniVyaparStorage) {
      // Load sales data
      salesData = await MiniVyaparStorage.getAllSales() || [];
      console.log('Loaded sales data:', salesData.length, 'records');
      
      // Load inventory data  
      console.log('Calling MiniVyaparStorage.getAllProducts()...');
      const loadedProducts = await MiniVyaparStorage.getAllProducts() || [];
      inventoryData = loadedProducts;
      console.log('Loaded inventory data:', inventoryData.length, 'records');
      console.log('Inventory data contents:', inventoryData);
      
      // Don't override expenses data if it's already loaded by loadExpensesData()
      if (!expensesData || expensesData.length === 0) {
        try {
          expensesData = await MiniVyaparStorage.getAllExpenses() || [];
          console.log('Loaded expenses data from IndexedDB:', expensesData.length, 'records');
        } catch (error) {
          console.log('Could not load expenses from IndexedDB, keeping existing data');
        }
      } else {
        console.log('Expenses already loaded, keeping existing data:', expensesData.length, 'records');
      }
      
      // Update all displays that depend on this data
      updateAllDataDisplays();
    } else {
      console.log('Storage not ready, using empty data arrays');
    }
  } catch (error) {
    console.error('Error loading real data:', error);
    // Only initialize as empty arrays if not already loaded
    if (!salesData) salesData = [];
    if (!inventoryData) inventoryData = [];
    if (!expensesData) expensesData = [];
  }
}

// Update all displays when data changes
function updateAllDataDisplays() {
  // Update dashboard if it's active
  if (document.getElementById('dashboard').classList.contains('active')) {
    updateDashboardData();
  }
  
  // Update inventory display if it's active
  if (document.getElementById('inventory').classList.contains('active')) {
    loadInventoryList();
  }
  
  // Update expenses display if it's active
  if (document.getElementById('expenses').classList.contains('active')) {
    loadExpensesList();
  }
}

// Refresh data when a new transaction is added
async function refreshDataAfterTransaction() {
  await loadAllRealData();
  updateAllDataDisplays();
}
function getSalesChartData(range) {
    // You can replace this logic with your real data aggregation
    if (range === 'today') {
        // Filter salesData for today, group by hour 5-12
        const today = new Date();
        today.setHours(0,0,0,0);
        let labels = [];
        let data = [];
        for(let h=5; h<=12; h++) {
            labels.push(h+':00');
            const sum = salesData.filter(s => {
                const d = new Date(s.timestamp);
                return d.getDate() === today.getDate() && d.getHours() === h;
            }).reduce((acc,s) => acc+s.value, 0);
            data.push(sum);
        }
        return { labels, data };
    } else if (range === 'week') {
        // Group by day of week
        let labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        let data = labels.map((lbl,i) => {
            return salesData.filter(s => {
                const d = new Date(s.timestamp);
                return d.getDay() === (i+1)%7;
            }).reduce((acc,s) => acc+s.value, 0);
        });
        return { labels, data };
    } else if (range === 'month') {
        // Group by week of month
        let labels = ['Week 1','Week 2','Week 3','Week 4'];
        let data = labels.map((lbl,i) => {
            return salesData.filter(s => {
                const d = new Date(s.timestamp);
                return Math.floor((d.getDate()-1)/7) === i;
            }).reduce((acc,s) => acc+s.value, 0);
        });
        return { labels, data };
    }
    return { labels: [], data: [] };
}

// PDF Download Function
// Sales Overview Chart Variables
let currentSalesView = 'today';
let salesChart = null;

// Sales data from app (using real cart and transaction data)
function getRealSalesData() {
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Calculate real sales from cart history and transactions
    const todayTotal = getCurrentDayTotal();
    const weekTotal = getWeekTotal();
    const monthTotal = getMonthTotal();
    
    // Generate week data based on real sales pattern
    const weekData = {
        labels: [],
        values: []
    };
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        weekData.labels.push(dayNames[date.getDay()]);
        
        // Simulate daily sales based on day patterns with some real data influence
        let dailySales;
        if (i === 0) {
            dailySales = todayTotal; // Today's actual total
        } else {
            // Simulate based on real patterns but add variation
            const baseAmount = todayTotal * (0.7 + Math.random() * 0.6);
            const dayMultiplier = [0.6, 0.8, 0.9, 1.0, 1.2, 1.3, 0.8][date.getDay()]; // Weekend patterns
            dailySales = baseAmount * dayMultiplier;
        }
        weekData.values.push(Math.max(0, dailySales));
    }
    
    return {
        today: {
            labels: ['6AM', '9AM', '12PM', '3PM', '6PM', '9PM'],
            values: generateHourlyData(todayTotal)
        },
        week: weekData,
        month: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            values: [monthTotal * 0.2, monthTotal * 0.3, monthTotal * 0.25, monthTotal * 0.25]
        }
    };
}

function getCurrentDayTotal() {
    // Get today's total from actual transactions
    const today = new Date().toDateString();
    let total = 0;
    
    // Calculate from actual transaction history
    if (transactionHistory && transactionHistory.length > 0) {
        transactionHistory.forEach(transaction => {
            const transactionDate = new Date(transaction.timestamp).toDateString();
            if (transactionDate === today) {
                total += transaction.total || 0;
            }
        });
    }
    
    // Add current cart values
    if (typeof saleCart !== 'undefined' && Array.isArray(saleCart) && saleCart.length > 0) {
        total += saleCart.reduce((sum, item) => {
            const price = item.price || 0;
            const quantity = item.quantity || 0;
            return sum + (price * quantity);
        }, 0);
    }
    
    if (typeof cart !== 'undefined' && cart && typeof cart === 'object') {
        Object.values(cart).forEach(item => {
            if (item && item.price && item.quantity) {
                total += item.price * item.quantity;
            }
        });
    }
    
    return total; // Return only real data, no demo numbers
}

function getWeekTotal() {
    // Calculate actual week total from transactions
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    let total = 0;
    if (transactionHistory && transactionHistory.length > 0) {
        transactionHistory.forEach(transaction => {
            const transactionDate = new Date(transaction.timestamp);
            if (transactionDate >= weekAgo) {
                total += transaction.total || 0;
            }
        });
    }
    
    return total; // Real data only
}

function getMonthTotal() {
    // Calculate actual month total from transactions
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    
    let total = 0;
    if (transactionHistory && transactionHistory.length > 0) {
        transactionHistory.forEach(transaction => {
            const transactionDate = new Date(transaction.timestamp);
            if (transactionDate >= monthAgo) {
                total += transaction.total || 0;
            }
        });
    }
    
    return total; // Real data only
}

function generateHourlyData(dayTotal) {
    // Generate hourly breakdown from actual transactions
    const today = new Date().toDateString();
    const hourlyData = [0, 0, 0, 0, 0, 0]; // 6 time periods
    
    if (transactionHistory && transactionHistory.length > 0) {
        transactionHistory.forEach(transaction => {
            const transactionDate = new Date(transaction.timestamp);
            if (transactionDate.toDateString() === today) {
                const hour = transactionDate.getHours();
                let periodIndex = 0;
                
                // Map hours to periods: 6AM, 9AM, 12PM, 3PM, 6PM, 9PM
                if (hour >= 6 && hour < 9) periodIndex = 0;
                else if (hour >= 9 && hour < 12) periodIndex = 1;
                else if (hour >= 12 && hour < 15) periodIndex = 2;
                else if (hour >= 15 && hour < 18) periodIndex = 3;
                else if (hour >= 18 && hour < 21) periodIndex = 4;
                else if (hour >= 21 || hour < 6) periodIndex = 5;
                
                hourlyData[periodIndex] += transaction.total || 0;
            }
        });
    }
    
    return hourlyData; // Return real hourly data
}

// Initialize chart on page load
function initializeSalesChart() {
    const canvas = document.getElementById('salesWireframeChart');
    if (!canvas) {
        console.log('Chart canvas not found');
        return;
    }
    
    console.log('Initializing sales chart...');
    drawWireframeChart();
}

// Switch between Today/Week/Month views
function switchSalesView(range) {
    currentSalesView = range;
    
    // Update button states
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-range="${range}"]`).classList.add('active');
    
    // Redraw chart
    drawWireframeChart();
}

// Draw the wireframe chart
function drawWireframeChart() {
    const canvas = document.getElementById('salesWireframeChart');
    if (!canvas) {
        console.log('Canvas not found for chart drawing');
        return;
    }
    
    console.log('Drawing wireframe chart...');
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas size to match display size
    canvas.width = rect.width * window.devicePixelRatio || 800;
    canvas.height = rect.height * window.devicePixelRatio || 300;
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    
    const width = rect.width || 800;
    const height = rect.height || 300;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Get data for current view
    const salesData = getRealSalesData();
    const data = salesData[currentSalesView];
    
    if (!data || !data.values || data.values.length === 0) {
        console.log('No data for chart');
        // Draw "No Data" message
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No Data Available', width / 2, height / 2);
        return;
    }
    
    console.log('Chart data:', data);
    
    // Chart dimensions
    const padding = 50;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    // Find max value for scaling
    const maxValue = Math.max(...data.values);
    const minValue = 0;
    
    // Draw background grid (wireframe style)
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
        const y = padding + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
        
        // Y-axis labels
        const value = maxValue - (maxValue / 5) * i;
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`Rs ${Math.round(value)}`, padding - 10, y + 4);
    }
    
    // Vertical grid lines
    for (let i = 0; i < data.labels.length; i++) {
        const x = padding + (chartWidth / (data.labels.length - 1)) * i;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
        
        // X-axis labels
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(data.labels[i], x, height - padding + 20);
    }
    
    // Draw the line chart
    ctx.strokeStyle = '#4A90E2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < data.values.length; i++) {
        const x = padding + (chartWidth / (data.values.length - 1)) * i;
        const y = padding + chartHeight - ((data.values[i] - minValue) / (maxValue - minValue)) * chartHeight;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    
    // Draw circle markers
    ctx.fillStyle = '#4A90E2';
    for (let i = 0; i < data.values.length; i++) {
        const x = padding + (chartWidth / (data.values.length - 1)) * i;
        const y = padding + chartHeight - ((data.values[i] - minValue) / (maxValue - minValue)) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    // Add subtle shaded area under line
    ctx.fillStyle = 'rgba(74, 144, 226, 0.1)';
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    
    for (let i = 0; i < data.values.length; i++) {
        const x = padding + (chartWidth / (data.values.length - 1)) * i;
        const y = padding + chartHeight - ((data.values[i] - minValue) / (maxValue - minValue)) * chartHeight;
        ctx.lineTo(x, y);
    }
    
    ctx.lineTo(width - padding, height - padding);
    ctx.closePath();
    ctx.fill();
    
    console.log('Chart drawn successfully');
}

// PDF Library Loading with proper fallback
let pdfLibraryReady = false;
let pdfLibraryChecked = false;

// Check and load PDF library with fallback
async function ensurePdfLibrary() {
    if (pdfLibraryChecked) {
        return pdfLibraryReady;
    }
    
    // Check if already loaded
    if (typeof window.jsPDF !== 'undefined') {
        pdfLibraryReady = true;
        pdfLibraryChecked = true;
        return true;
    }
    
    // Try loading fallback CDN
    try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        pdfLibraryReady = typeof window.jsPDF !== 'undefined';
    } catch (error) {
        console.log('Fallback PDF library failed to load:', error);
        pdfLibraryReady = false;
    }
    
    pdfLibraryChecked = true;
    return pdfLibraryReady;
}

// Helper function to load script dynamically
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Download chart and sales report as PDF
async function downloadChartReport() {
    // Check if jsPDF is loaded, try fallback if not
    const pdfReady = await ensurePdfLibrary();
    
    if (!pdfReady) {
        console.log('PDF library not available, using HTML fallback');
        downloadChartReportFallback();
        return;
    }
    
    const canvas = document.getElementById('salesWireframeChart');
    const salesData = getRealSalesData();
    
    // Create PDF document
    const { jsPDF } = window.jsPDF;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // PDF dimensions
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    // Header
    pdf.setFontSize(20);
    pdf.setFont(undefined, 'bold');
    pdf.text('MINI VYAPAR - SALES REPORT', margin, 30);
    
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, 40);
    
    // Line separator
    pdf.setLineWidth(0.5);
    pdf.line(margin, 45, pageWidth - margin, 45);
    
    let yPos = 55;
    
    // Sales Overview Section
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('SALES OVERVIEW', margin, yPos);
    yPos += 10;
    
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Current View: ${currentSalesView.toUpperCase()}`, margin, yPos);
    yPos += 6;
    pdf.text(`Today's Total: Rs ${Math.round(getCurrentDayTotal())}`, margin, yPos);
    yPos += 6;
    pdf.text(`Week Total: Rs ${Math.round(getWeekTotal())}`, margin, yPos);
    yPos += 6;
    pdf.text(`Month Total: Rs ${Math.round(getMonthTotal())}`, margin, yPos);
    yPos += 15;
    
    // Add Chart Image
    if (canvas) {
        try {
            const chartImageData = canvas.toDataURL('image/png');
            const chartWidth = contentWidth;
            const chartHeight = (chartWidth * canvas.height) / canvas.width;
            
            // Check if chart fits on current page
            if (yPos + chartHeight > pageHeight - margin) {
                pdf.addPage();
                yPos = 30;
            }
            
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'bold');
            pdf.text(`Sales Chart (${currentSalesView.toUpperCase()})`, margin, yPos);
            yPos += 10;
            
            pdf.addImage(chartImageData, 'PNG', margin, yPos, chartWidth, chartHeight);
            yPos += chartHeight + 15;
        } catch (error) {
            console.error('Error adding chart to PDF:', error);
            pdf.text('Chart could not be included in the report.', margin, yPos);
            yPos += 10;
        }
    }
    
    // Check if we need a new page
    if (yPos > pageHeight - 60) {
        pdf.addPage();
        yPos = 30;
    }
    
    // Profit Analysis Section (NEW)
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('💰 PROFIT ANALYSIS', margin, yPos);
    yPos += 10;
    
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    const profitData = calculateProfitAnalysis();
    const profitLines = profitData.split('\n');
    
    profitLines.forEach(line => {
        if (yPos > pageHeight - margin) {
            pdf.addPage();
            yPos = 30;
        }
        // Highlight important profit metrics
        if (line.includes('Total Profit:') || line.includes('Profit Margin:')) {
            pdf.setFont(undefined, 'bold');
            pdf.text(line, margin, yPos);
            pdf.setFont(undefined, 'normal');
        } else {
            pdf.text(line, margin, yPos);
        }
        yPos += 6;
    });
    
    yPos += 10;

    // Detailed Sales Data Section
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('DETAILED SALES DATA', margin, yPos);
    yPos += 10;
    
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    const salesDataText = getSalesDataText();
    const salesLines = salesDataText.split('\n').filter(line => !line.includes('PROFIT ANALYSIS') && !line.includes('---'));
    
    salesLines.forEach(line => {
        if (yPos > pageHeight - margin) {
            pdf.addPage();
            yPos = 30;
        }
        pdf.text(line, margin, yPos);
        yPos += 6;
    });
    
    yPos += 10;
    
    // Cart Status Section
    if (yPos > pageHeight - 40) {
        pdf.addPage();
        yPos = 30;
    }
    
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('CURRENT CART STATUS', margin, yPos);
    yPos += 10;
    
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    const cartText = getCartStatusText();
    const cartLines = cartText.split('\n');
    
    cartLines.forEach(line => {
        if (yPos > pageHeight - margin) {
            pdf.addPage();
            yPos = 30;
        }
        pdf.text(line, margin, yPos);
        yPos += 6;
    });
    
    // Recent Transactions Section
    yPos += 10;
    if (yPos > pageHeight - 40) {
        pdf.addPage();
        yPos = 30;
    }
    
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('RECENT TRANSACTIONS', margin, yPos);
    yPos += 10;
    
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    const transactionText = getRecentTransactionsText();
    const transactionLines = transactionText.split('\n');
    
    transactionLines.forEach(line => {
        if (yPos > pageHeight - margin) {
            pdf.addPage();
            yPos = 30;
        }
        pdf.text(line, margin, yPos);
        yPos += 6;
    });
    
    // Footer on last page
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'italic');
    pdf.text('Report generated by Mini Vyapar POS System', margin, pageHeight - 10);
    
    // Save the PDF
    const fileName = `Mini_Vyapar_Sales_Report_${currentSalesView}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    
    showCustomNotification('📊 PDF report with chart downloaded successfully!', 'success', 'Report Downloaded');
}

// Fallback function for when PDF library is not available
function downloadChartReportFallback() {
    const canvas = document.getElementById('salesWireframeChart');
    
    // Try to get chart as image first
    let chartDataUrl = '';
    if (canvas) {
        try {
            chartDataUrl = canvas.toDataURL('image/png');
        } catch (error) {
            console.error('Could not export chart image:', error);
        }
    }
    
    // Create comprehensive HTML report
    const reportContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Mini Vyapar Sales Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .section { margin: 20px 0; }
        .section h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        .chart-container { text-align: center; margin: 20px 0; }
        .chart-img { max-width: 100%; height: auto; border: 1px solid #ccc; }
        .data-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .data-table th { background-color: #f2f2f2; }
        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
        @media print { body { margin: 0; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>MINI VYAPAR - SALES REPORT</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
    </div>

    <div class="section">
        <h2>📊 SALES OVERVIEW</h2>
        <table class="data-table">
            <tr><th>Period</th><th>Amount</th></tr>
            <tr><td>Current View</td><td>${currentSalesView.toUpperCase()}</td></tr>
            <tr><td>Today's Total</td><td>Rs ${Math.round(getCurrentDayTotal())}</td></tr>
            <tr><td>Week Total</td><td>Rs ${Math.round(getWeekTotal())}</td></tr>
            <tr><td>Month Total</td><td>Rs ${Math.round(getMonthTotal())}</td></tr>
        </table>
    </div>

    ${chartDataUrl ? `
    <div class="section">
        <h2>📈 SALES CHART (${currentSalesView.toUpperCase()})</h2>
        <div class="chart-container">
            <img src="${chartDataUrl}" alt="Sales Chart" class="chart-img">
        </div>
    </div>
    ` : ''}

    <div class="section">
        <h2>� PROFIT ANALYSIS</h2>
        <pre>${calculateProfitAnalysis()}</pre>
    </div>

    <div class="section">
        <h2>�📋 DETAILED SALES DATA</h2>
        <pre>${getSalesDataText().split('--- PROFIT ANALYSIS ---')[0]}</pre>
    </div>

    <div class="section">
        <h2>🛒 CURRENT CART STATUS</h2>
        <pre>${getCartStatusText()}</pre>
    </div>

    <div class="section">
        <h2>📜 RECENT TRANSACTIONS</h2>
        <pre>${getRecentTransactionsText()}</pre>
    </div>

    <div class="footer">
        <p>Report generated by Mini Vyapar POS System</p>
        <p><strong>Note:</strong> This HTML report can be printed to PDF using your browser's print function (Ctrl+P → Save as PDF)</p>
    </div>

    <script>
        // Auto-print option
        if (confirm('Would you like to print/save this report as PDF now?')) {
            window.print();
        }
    </script>
</body>
</html>
    `;
    
    // Create and download the HTML report
    const blob = new Blob([reportContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mini_Vyapar_Sales_Report_${currentSalesView}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showCustomNotification('📊 HTML report downloaded! Open the file and use your browser\'s print function to save as PDF.', 'success', 'Report Downloaded');
}

function getSalesDataText() {
    const salesData = getRealSalesData();
    const data = salesData[currentSalesView];
    
    let text = '';
    for (let i = 0; i < data.labels.length; i++) {
        text += `${data.labels[i]}: Rs ${Math.round(data.values[i])}\n`;
    }
    
    // Add profit analysis section
    text += '\n--- PROFIT ANALYSIS ---\n';
    const profitData = calculateProfitAnalysis();
    text += profitData;
    
    return text;
}

function calculateProfitAnalysis() {
    let profitText = '';
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let profitableTransactions = 0;
    let totalTransactions = 0;
    
    // Get today's date for filtering
    const today = new Date();
    const todayStr = today.toDateString();
    
    // Filter based on current view
    let startDate = new Date();
    if (currentSalesView === 'week') {
        startDate.setDate(today.getDate() - 7);
    } else if (currentSalesView === 'month') {
        startDate.setDate(today.getDate() - 30);
    } else {
        // Today view
        startDate = new Date(todayStr);
    }
    
    if (transactionHistory && transactionHistory.length > 0) {
        transactionHistory.forEach(transaction => {
            const transactionDate = new Date(transaction.timestamp);
            
            // Check if transaction falls within current view period
            let includeTransaction = false;
            if (currentSalesView === 'today') {
                includeTransaction = transactionDate.toDateString() === todayStr;
            } else {
                includeTransaction = transactionDate >= startDate;
            }
            
            if (includeTransaction && transaction.items) {
                totalTransactions++;
                let transactionRevenue = 0;
                let transactionCost = 0;
                
                transaction.items.forEach(item => {
                    const revenue = item.price * item.quantity;
                    transactionRevenue += revenue;
                    
                    // Try to get cost price from stored product data
                    let costPrice = 0;
                    if (item.costPrice) {
                        costPrice = item.costPrice;
                    } else if (item.productId || item.id) {
                        // Try to find product in current inventory
                        const productId = item.productId || item.id;
                        if (typeof productId === 'number' && window.products) {
                            const product = window.products.find(p => p.id === productId);
                            if (product && product.costPrice) {
                                costPrice = product.costPrice;
                            }
                        }
                    }
                    
                    const cost = costPrice * item.quantity;
                    transactionCost += cost;
                });
                
                totalRevenue += transactionRevenue;
                totalCost += transactionCost;
                
                if (transactionRevenue > transactionCost) {
                    profitableTransactions++;
                }
            }
        });
    }
    
    totalProfit = totalRevenue - totalCost;
    
    // Format profit analysis text
    if (totalTransactions > 0) {
        profitText += `Total Revenue: Rs ${Math.round(totalRevenue)}\n`;
        profitText += `Total Cost: Rs ${Math.round(totalCost)}\n`;
        profitText += `Total Profit: Rs ${Math.round(totalProfit)}\n`;
        profitText += `Profit Margin: ${totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0}%\n`;
        profitText += `Profitable Transactions: ${profitableTransactions}/${totalTransactions}\n`;
        
        if (totalTransactions > 0) {
            profitText += `Avg Profit per Transaction: Rs ${Math.round(totalProfit / totalTransactions)}\n`;
        }
        
        // Add example as requested
        profitText += '\nEXAMPLE:\n';
        profitText += 'If Cost Price = Rs 5, Selling Price = Rs 10\n';
        profitText += 'Then Profit = Rs 10 - Rs 5 = Rs 5 per unit\n';
        
        // Show period info
        const periodText = currentSalesView === 'today' ? 'Today' : 
                          currentSalesView === 'week' ? 'This Week' : 'This Month';
        profitText += `\nPeriod: ${periodText}\n`;
    } else {
        profitText += 'No transactions found for profit analysis.\n';
        profitText += 'Complete some sales to see profit calculations.\n';
        profitText += '\nEXAMPLE:\n';
        profitText += 'If Cost Price = Rs 5, Selling Price = Rs 10\n';
        profitText += 'Then Profit = Rs 10 - Rs 5 = Rs 5 per unit\n';
    }
    
    return profitText;
}

function getCartStatusText() {
    let hasItems = false;
    let text = '';
    let total = 0;
    let itemCount = 0;
    
    // Check saleCart (array) first
    if (typeof saleCart !== 'undefined' && Array.isArray(saleCart) && saleCart.length > 0) {
        hasItems = true;
        itemCount += saleCart.length;
        text += `Sale Cart Items: ${saleCart.length}\n`;
        
        saleCart.forEach((item, index) => {
            const itemTotal = (item.price || 0) * (item.quantity || 0);
            total += itemTotal;
            text += `${index + 1}. ${item.name || 'Unknown Item'} - Qty: ${item.quantity || 0} × Rs ${item.price || 0} = Rs ${itemTotal}\n`;
        });
    }
    
    // Check cart object
    if (typeof cart !== 'undefined' && cart && typeof cart === 'object') {
        const cartValues = Object.values(cart).filter(item => item && item.name);
        if (cartValues.length > 0) {
            hasItems = true;
            itemCount += cartValues.length;
            if (text) text += '\n';
            text += `Cart Items: ${cartValues.length}\n`;
            
            cartValues.forEach((item, index) => {
                const itemTotal = (item.price || 0) * (item.quantity || 0);
                total += itemTotal;
                text += `${index + 1}. ${item.name || 'Unknown Item'} - Qty: ${item.quantity || 0} × Rs ${item.price || 0} = Rs ${itemTotal}\n`;
            });
        }
    }
    
    if (!hasItems) {
        return 'Cart is empty';
    }
    
    text += `\nTotal Items: ${itemCount}`;
    text += `\nTotal Amount: Rs ${total}`;
    return text;
}

function downloadReport() {
    // Generate PDF content (using a simple approach)
    const reportData = {
        date: new Date().toLocaleDateString(),
        todaySales: document.getElementById('todaySales')?.textContent || 'Rs 1,250',
        weekSales: document.getElementById('weekSales')?.textContent || 'Rs 8,500', 
        monthSales: document.getElementById('monthSales')?.textContent || 'Rs 32,400',
        cartItems: Object.keys(cart).length,
        totalValue: cartTotalAmount
    };

    // Create PDF content as text (you can enhance this with a PDF library)
    const pdfContent = `
MINI VYAPAR - SALES REPORT
Generated on: ${reportData.date}

=== SALES OVERVIEW ===
Today: ${reportData.todaySales}
This Week: ${reportData.weekSales}
This Month: ${reportData.monthSales}

=== CURRENT CART ===
Items in Cart: ${reportData.cartItems}
Cart Value: Rs ${reportData.totalValue}

=== RECENT TRANSACTIONS ===
${getRecentTransactionsText()}

=== CHART DATA ===
${getChartDataText()}
    `;

    // Download as text file (you can replace with actual PDF generation)
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('Report downloaded successfully!');
}

function getRecentTransactionsText() {
    // Make sure transaction history is initialized
    if (!transactionHistory || transactionHistory.length === 0) {
        return 'No recent transactions found.\nComplete a sale or checkout to see transaction history here.';
    }
    
    let text = '';
    const recentTransactions = transactionHistory.slice(0, 10); // Get last 10 transactions
    
    recentTransactions.forEach((transaction, index) => {
        const date = new Date(transaction.timestamp);
        const timeStr = date.toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        const dateStr = date.toLocaleDateString('en-IN');
        
        text += `\n${index + 1}. Transaction #${transaction.id.toString().slice(-6)}\n`;
        text += `   Date: ${dateStr} at ${timeStr}\n`;
        text += `   Type: ${transaction.type.toUpperCase()}\n`;
        text += `   Items:\n`;
        
        transaction.items.forEach(item => {
            text += `   - ${item.name}: Rs ${item.price} × ${item.quantity} = Rs ${item.total}\n`;
        });
        
        text += `   Total: Rs ${transaction.total}\n`;
        
        if (index < recentTransactions.length - 1) {
            text += `   ${'='.repeat(40)}\n`;
        }
    });
    
    if (text === '') {
        text = 'No recent transactions available.';
    }
    
    return text;
}

function getChartDataText() {
    const salesData = getRealSalesData();
    const data = salesData[currentSalesView];
    
    if (!data || !data.labels || !data.values) {
        return 'No chart data available for current view.';
    }
    
    let text = `Chart Data for ${currentSalesView.toUpperCase()} view:\n`;
    text += `${'='.repeat(40)}\n`;
    
    for (let i = 0; i < data.labels.length; i++) {
        const label = data.labels[i];
        const value = Math.round(data.values[i]);
        text += `${label}: Rs ${value}\n`;
    }
    
    const total = data.values.reduce((sum, val) => sum + val, 0);
    text += `${'='.repeat(40)}\n`;
    text += `Total for ${currentSalesView}: Rs ${Math.round(total)}`;
    
    return text;
}

// ===============================
// EMOJI PICKER FUNCTIONALITY
// ===============================

// Emoji picker data
const emojiData = {
    food: ['🍎', '🍌', '🍞', '🥛', '🧀', '🥩', '🍗', '🥚', '🍚', '🍜', '🍕', '🍔', '🌭', '🥙', '🌮', '🥪', '🍰', '🧁', '🍪', '🍫', '🍬', '🍭', '🥨', '🥯', '🥐', '🍯', '🥜', '🌰', '🥥', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥝', '🍋', '🍊', '🥕', '🌽', '🌶️', '🫒', '🥒', '🥬', '🥦', '🍅', '🥔', '🍆', '🥑'],
    drinks: ['🥤', '🧃', '🧋', '🍵', '☕', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧊', '💧', '🥛', '🍼', '🧴'],
    household: ['🧽', '🧴', '🧼', '🪣', '🧻', '🕯️', '💡', '🔌', '🔧', '🔨', '🪚', '🧰', '🧲', '🪜', '🪠', '🧹', '🪞', '🛏️', '🛋️', '🪑', '🚪', '🪟', '🗃️', '🗂️', '📦', '📪', '📫', '📬', '📭', '📮'],
    personal: ['🧴', '🧼', '🪥', '🦷', '🧽', '🪒', '💊', '🩹', '🩺', '💄', '💅', '👄', '👁️', '👃', '👂', '🦻', '🧠', '🫀', '🫁', '🦴', '🧒', '👦', '👧', '🧑', '👨', '👩', '🧓', '👴', '👵'],
    office: ['📝', '✏️', '✒️', '🖊️', '🖋️', '🖍️', '📄', '📃', '📑', '📊', '📈', '📉', '📋', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️', '🗃️', '🗂️', '🗄️', '📁', '📂', '🗓️', '📅', '📆', '🗒️', '📇', '🔍', '🔎', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '💾', '💿', '📀'],
    other: ['⭐', '🌟', '✨', '💫', '🔥', '💥', '💢', '💨', '💤', '💯', '✅', '❌', '❗', '❓', '⁉️', '‼️', '💲', '💰', '💳', '💎', '⚖️', '🔔', '🔕', '📢', '📣', '📯', '🎵', '🎶', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🎤', '🎧', '📻', '🎬', '🎭', '🎨', '🖼️', '🧩', '🎯', '🎱', '🔮', '🎪']
};

let currentEmojiCategory = 'food';

// Open emoji picker
function openEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    if (!picker) {
        console.error('Emoji picker element not found');
        return;
    }
    
    const isVisible = picker.style.display === 'block';
    picker.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
        showEmojiCategory(currentEmojiCategory);
    }
}

// Show emojis for a specific category
function showEmojiCategory(category) {
    currentEmojiCategory = category;
    
    console.log('Showing emoji category:', category);
    
    // Update active category button
    document.querySelectorAll('.emoji-cat-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        }
    });
    
    // Populate emoji grid
    const grid = document.getElementById('emojiGrid');
    if (!grid) {
        console.error('Emoji grid element not found');
        return;
    }
    
    grid.innerHTML = '';
    
    if (emojiData[category]) {
        console.log('Loading', emojiData[category].length, 'emojis for category:', category);
        emojiData[category].forEach(emoji => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'emoji-item';
            button.textContent = emoji;
            button.onclick = () => selectEmoji(emoji);
            grid.appendChild(button);
        });
    } else {
        console.error('No emoji data found for category:', category);
    }
}

// Select an emoji
function selectEmoji(emoji) {
    console.log('Selecting emoji:', emoji);
    const emojiInput = document.getElementById('productEmoji');
    const picker = document.getElementById('emojiPicker');
    
    if (emojiInput) {
        emojiInput.value = emoji;
        console.log('Emoji set to:', emoji);
    } else {
        console.error('Product emoji input not found');
    }
    
    if (picker) {
        picker.style.display = 'none';
    }
}

// Close emoji picker when clicking outside
document.addEventListener('click', function(e) {
    const picker = document.getElementById('emojiPicker');
    const input = document.getElementById('productEmoji');
    const button = document.querySelector('.emoji-picker-btn');
    
    if (picker && !picker.contains(e.target) && e.target !== input && e.target !== button) {
        picker.style.display = 'none';
    }
});

// Refresh quick items with inventory data
function refreshQuickItems() {
    const quickItemsGrid = document.getElementById('quickItemsGrid');
    if (!quickItemsGrid) return;
    
    // Keep existing hardcoded items but add new ones from inventory
    const existingItems = quickItemsGrid.querySelectorAll('.quick-item:not(.dynamic-item)');
    
    // Remove previous dynamic items
    quickItemsGrid.querySelectorAll('.dynamic-item').forEach(item => item.remove());
    
    // Add recent inventory items as quick items (limit to last 5 added items)
    const recentItems = inventoryData.slice(-5).reverse();
    
    recentItems.forEach(product => {
        // Don't add if it's already in static quick items
        const existingNames = Array.from(existingItems).map(item => 
            item.querySelector('.quick-item-name').textContent.toLowerCase()
        );
        
        if (!existingNames.includes(product.name.toLowerCase())) {
            const quickItem = document.createElement('div');
            quickItem.className = 'quick-item dynamic-item';
            quickItem.setAttribute('data-product', product.id);
            quickItem.setAttribute('data-price', product.sellingPrice);
            quickItem.setAttribute('data-name', product.name);
            
            const emoji = product.emoji || getProductEmoji(product.category);
            
            quickItem.innerHTML = `
                <div class="quick-item-image">${emoji}</div>
                <div class="quick-item-name">${product.name}</div>
                <div class="quick-item-price">Rs ${product.sellingPrice}</div>
                <div class="quantity-badge" style="display: none;">0</div>
            `;
            
            quickItemsGrid.appendChild(quickItem);
        }
    });
    
    // Re-attach event listeners for new items
    setupQuickItemListeners();
}

// Setup event listeners for quick items
function setupQuickItemListeners() {
    document.querySelectorAll(".quick-item").forEach((item) => {
        // Remove existing listeners
        item.replaceWith(item.cloneNode(true));
    });
    
    // Re-attach listeners
    document.querySelectorAll(".quick-item").forEach((item) => {
        item.addEventListener("click", function () {
            const productId = this.getAttribute("data-product");
            const productName = this.getAttribute("data-name");
            const price = parseFloat(this.getAttribute("data-price"));
            
            // Open product card modal with gesture support
            openProductCard(productId, productName, price);
        });
    });
}

// ===============================
// ADVANCED ICON SELECTOR WITH THOUSANDS OF OPTIONS
// ===============================

// Comprehensive emoji database organized by categories
const advancedEmojiData = {
    food: {
        'noodles': ['🍜', '🍝', '🥢'],
        'biscuits': ['🍪', '🥧', '🧁'],
        'milk': ['🥛', '🍼', '🐄'],
        'bread': ['🍞', '🥖', '🥯', '🥐'],
        'rice': ['🍚', '🍛', '🥘'],
        'fruits': ['🍎', '🍌', '🍇', '🍓', '🍒', '🍑', '🥭', '🍍', '🥝', '🍋', '🍊', '🥥', '🫒'],
        'vegetables': ['🥕', '🌽', '🥒', '🥬', '🥦', '🍅', '🥔', '🍆', '🥑', '🌶️', '🫑', '🧄', '🧅'],
        'meat': ['🥩', '🍗', '🥓', '🌭', '🍖'],
        'seafood': ['🐟', '🐠', '🦐', '🦀', '🦞', '🐙', '🦑'],
        'dairy': ['🧀', '🥛', '🧈', '🥚'],
        'spices': ['🧂', '🌶️', '🧄', '🧅', '🫒'],
        'sweets': ['🍰', '🧁', '🍪', '🍫', '🍬', '🍭', '🍩', '🍮'],
        'fast_food': ['🍔', '🍟', '🍕', '🌭', '🥙', '🌮', '🌯', '🥪'],
        'asian': ['🍜', '🍝', '🍱', '🍙', '🍘', '🍚', '🍛', '🥟', '🥠', '🥢'],
        'breakfast': ['🥐', '🥯', '🧇', '🥞', '🍳', '🥓'],
        'snacks': ['🥨', '🍿', '🥜', '🌰', '🥔'],
        'beverages': ['☕', '🍵', '🧃', '🥤', '🧋', '🍷', '🍺', '🥂'],
        'grains': ['🌾', '🍚', '🍞', '🥖', '🌽'],
        'condiments': ['🍯', '🧂', '🫒', '🥫'],
        'frozen': ['🧊', '🍦', '🍧', '🥶'],
        'canned': ['🥫', '🫙'],
        'oil': ['🫒', '🥥', '🌻'],
        'herbs': ['🌿', '🌱', '🪴']
    },
    drinks: {
        'tea': ['🍵', '🧋', '🫖'],
        'coffee': ['☕', '🥤'],
        'soft_drinks': ['🥤', '🧃'],
        'juices': ['🧃', '🍷', '🥂'],
        'water': ['💧', '🚰', '🥤'],
        'alcohol': ['🍷', '🍺', '🍻', '🥂', '🥃', '🍸', '🍹'],
        'energy': ['🥤', '⚡', '💪'],
        'milk_drinks': ['🥛', '🧋', '☕'],
        'ice': ['🧊', '❄️']
    },
    snacks: {
        'chips': ['🥔', '🍟', '🧂'],
        'crackers': ['🍪', '🥨'],
        'nuts': ['🥜', '🌰', '🪴'],
        'candy': ['🍬', '🍭', '🧁'],
        'chocolate': ['🍫', '🍰', '🧁'],
        'cookies': ['🍪', '🥧'],
        'popcorn': ['🍿', '🌽'],
        'dried_fruits': ['🍇', '🍌', '🥭'],
        'ice_cream': ['🍦', '🍧', '🍨'],
        'cakes': ['🍰', '🧁', '🎂']
    },
    household: {
        'cleaning': ['🧽', '🧴', '🧻', '🪣', '🧹'],
        'kitchen': ['🍽️', '🥄', '🔪', '🍳', '🥘', '⚗️'],
        'bathroom': ['🚿', '🛁', '🪥', '🧴', '🧼'],
        'laundry': ['👕', '🧺', '🧴'],
        'tools': ['🔧', '🔨', '🪚', '🔩', '⚒️'],
        'storage': ['📦', '🗃️', '🛍️', '👜'],
        'lighting': ['💡', '🕯️', '🔦'],
        'furniture': ['🪑', '🛏️', '🛋️', '🪞'],
        'decor': ['🖼️', '🕯️', '🪴', '🌸']
    },
    personal: {
        'hygiene': ['🧼', '🪥', '🧴', '🧽'],
        'cosmetics': ['💄', '💅', '👄', '👁️'],
        'hair_care': ['🧴', '💇', '✂️'],
        'skin_care': ['🧴', '🧽', '💆'],
        'perfume': ['🧴', '💐', '🌸'],
        'accessories': ['👓', '⌚', '💍', '👜'],
        'clothing': ['👕', '👖', '👗', '👔', '🧥', '👟', '👠'],
        'baby_care': ['🍼', '👶', '🧸']
    },
    electronics: {
        'phones': ['📱', '📞', '☎️'],
        'computers': ['💻', '🖥️', '⌨️', '🖱️'],
        'audio': ['🎧', '📻', '🔊', '🎵'],
        'gaming': ['🎮', '🕹️', '🎯'],
        'cameras': ['📷', '📹', '📺'],
        'appliances': ['🔌', '💡', '🔋', '⚡'],
        'accessories': ['🔌', '🔋', '💾', '📀'],
        'smart_home': ['🏠', '📱', '💡', '🔌']
    },
    stationery: {
        'writing': ['✏️', '✒️', '🖊️', '🖋️', '🖍️'],
        'paper': ['📄', '📃', '📑', '📋', '📰'],
        'office': ['📎', '🖇️', '📌', '📍', '✂️'],
        'storage': ['🗃️', '🗂️', '📁', '📂'],
        'art': ['🎨', '🖌️', '🖍️', '✏️'],
        'measuring': ['📏', '📐', '⚖️'],
        'books': ['📚', '📖', '📓', '📒', '📕', '📗', '📘', '📙']
    },
    medicine: {
        'pills': ['💊', '💉', '🩹'],
        'first_aid': ['🩹', '🚑', '⛑️'],
        'vitamins': ['💊', '🥤', '🌿'],
        'equipment': ['🩺', '💉', '🌡️'],
        'therapy': ['💆', '🧘', '🏥'],
        'dental': ['🦷', '🪥', '🧴']
    }
};

// Product name to emoji mapping for auto-suggestion
const productNameMapping = {
    // Food items
    'noodles': '🍜', 'pasta': '🍝', 'spaghetti': '🍝', 'ramen': '🍜',
    'biscuits': '🍪', 'cookies': '🍪', 'crackers': '🍪',
    
    // Dairy Products
    'milk': '🥛', 'dairy': '🥛', 'yogurt': '🥛', 'curd': '🥛',
    'cheese': '🧀', 'butter': '🧈', 'cream': '🥛', 'paneer': '🧀',
    'ghee': '🧈', 'lassi': '🥛', 'buttermilk': '🥛',
    
    // Bakery Items
    'bread': '🍞', 'toast': '🍞', 'loaf': '🍞', 'bun': '🍞',
    'cake': '🍰', 'pastry': '🧁', 'croissant': '🥐', 'donut': '🍩',
    'muffin': '🧁', 'bagel': '🥯', 'pretzel': '🥨',
    
    // Grains & Cereals
    'rice': '🍚', 'grain': '🌾', 'wheat': '🌾', 'barley': '🌾',
    'oats': '🥣', 'cereal': '🥣', 'quinoa': '🌾', 'millet': '🌾',
    'corn': '🌽', 'maize': '🌽', 'flour': '🌾', 'atta': '🌾',
    
    // Fruits
    'apple': '🍎', 'banana': '🍌', 'orange': '🍊', 'mango': '🥭',
    'grapes': '🍇', 'strawberry': '🍓', 'pineapple': '🍍', 'watermelon': '🍉',
    'kiwi': '🥝', 'peach': '🍑', 'pear': '🍐', 'cherry': '🍒',
    'lemon': '🍋', 'lime': '🍋', 'coconut': '🥥', 'avocado': '🥑',
    
    // Vegetables
    'tomato': '🍅', 'carrot': '🥕', 'potato': '🥔', 'onion': '🧅',
    'garlic': '🧄', 'ginger': '🧄', 'cucumber': '🥒', 'lettuce': '🥬',
    'spinach': '🥬', 'broccoli': '🥦', 'cauliflower': '🥦', 'cabbage': '🥬',
    'pepper': '🌶️', 'chili': '🌶️', 'eggplant': '🍆', 'mushroom': '🍄',
    'beetroot': '🥕', 'radish': '�', 'turnip': '�🥔',
    
    // Poultry & Meat
    'meat': '🥩', 'chicken': '🍗', 'beef': '🥩', 'mutton': '🥩',
    'pork': '🥓', 'bacon': '🥓', 'sausage': '🌭', 'ham': '🥓',
    'fish': '🐟', 'seafood': '🐠', 'prawns': '🦐', 'crab': '�',
    'eggs': '�', 'egg': '🥚',
    
    // Daily Essentials
    'salt': '🧂', 'sugar': '🧂', 'spices': '🧂', 'oil': '🛢️',
    'vinegar': '🍾', 'sauce': '🍯', 'honey': '🍯', 'jam': '🍯',
    'pickle': '🥒', 'ketchup': '🍅', 'mustard': '�',
    
    // Snacks & Confectionery
    'chocolate': '🍫', 'candy': '🍬', 'chips': '🍟', 'nuts': '🥜',
    'pizza': '🍕', 'burger': '🍔', 'fries': '🍟', 'popcorn': '🍿',
    
    // Drinks
    'tea': '🍵', 'coffee': '☕', 'water': '💧',
    'juice': '🧃', 'soda': '🥤', 'beer': '🍺',
    
    // Household
    'soap': '🧼', 'shampoo': '🧴', 'toothpaste': '🪥',
    'detergent': '🧴', 'cleaner': '🧽',
    'towel': '🧻', 'tissue': '🧻',
    
    // Electronics
    'phone': '📱', 'computer': '💻', 'headphones': '🎧',
    'battery': '🔋', 'charger': '🔌',
    
    // Stationery
    'pen': '🖊️', 'pencil': '✏️', 'paper': '📄',
    'notebook': '📓', 'book': '📚',
    
    // Medicine
    'medicine': '💊', 'pills': '💊', 'bandage': '🩹'
};

let currentIconCategory = 'food';
let iconSearchResults = [];

// Open the advanced icon picker
function openAdvancedIconPicker() {
    const modal = document.getElementById('advancedIconPicker');
    if (modal) {
        modal.style.display = 'flex';
        showIconCategory('food');
        setupIconSearch();
    }
}

// Close the advanced icon picker
function closeAdvancedIconPicker() {
    const modal = document.getElementById('advancedIconPicker');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Show icons for a specific category
function showIconCategory(category) {
    currentIconCategory = category;
    
    // Update active tab
    document.querySelectorAll('.icon-cat-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.category === category) {
            tab.classList.add('active');
        }
    });
    
    // Populate icon grid
    const grid = document.getElementById('iconGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (advancedEmojiData[category]) {
        // Get all emojis for this category
        const categoryEmojis = new Set();
        Object.values(advancedEmojiData[category]).forEach(emojiArray => {
            emojiArray.forEach(emoji => categoryEmojis.add(emoji));
        });
        
        // Convert to array and display
        Array.from(categoryEmojis).forEach(emoji => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'icon-item';
            button.textContent = emoji;
            button.title = getEmojiDescription(emoji, category);
            button.onclick = () => selectAdvancedIcon(emoji);
            grid.appendChild(button);
        });
    }
}

// Get description for emoji based on category
function getEmojiDescription(emoji, category) {
    if (!advancedEmojiData[category]) return emoji;
    
    for (const [key, emojis] of Object.entries(advancedEmojiData[category])) {
        if (emojis.includes(emoji)) {
            return `${emoji} ${key.replace('_', ' ')}`;
        }
    }
    return emoji;
}

// Select an icon from the advanced picker
function selectAdvancedIcon(emoji) {
    const input = document.getElementById('productIcon');
    const preview = document.getElementById('iconPreview');
    
    if (input) input.value = emoji;
    if (preview) preview.textContent = emoji;
    
    closeAdvancedIconPicker();
    console.log('Selected icon:', emoji);
}

// Setup icon search functionality
function setupIconSearch() {
    const searchInput = document.getElementById('iconSearchInput');
    const suggestions = document.getElementById('searchSuggestions');
    
    if (!searchInput || !suggestions) return;
    
    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length < 2) {
            suggestions.style.display = 'none';
            return;
        }
        
        // Search through all categories
        iconSearchResults = [];
        const searchResults = new Set();
        
        // Search in product name mapping first
        Object.entries(productNameMapping).forEach(([name, emoji]) => {
            if (name.includes(query)) {
                searchResults.add({ emoji, name, score: name.indexOf(query) });
            }
        });
        
        // Search in emoji data
        Object.entries(advancedEmojiData).forEach(([category, items]) => {
            Object.entries(items).forEach(([itemName, emojis]) => {
                if (itemName.toLowerCase().includes(query)) {
                    emojis.forEach(emoji => {
                        searchResults.add({ 
                            emoji, 
                            name: itemName.replace('_', ' '), 
                            category,
                            score: itemName.indexOf(query) 
                        });
                    });
                }
            });
        });
        
        // Convert to array and sort by relevance
        iconSearchResults = Array.from(searchResults)
            .sort((a, b) => a.score - b.score)
            .slice(0, 20); // Limit to 20 results
        
        displaySearchSuggestions();
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.style.display = 'none';
        }
    });
}

// Display search suggestions
function displaySearchSuggestions() {
    const suggestions = document.getElementById('searchSuggestions');
    if (!suggestions) return;
    
    if (iconSearchResults.length === 0) {
        suggestions.style.display = 'none';
        return;
    }
    
    suggestions.innerHTML = '';
    suggestions.style.display = 'block';
    
    iconSearchResults.forEach(result => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `
            <span style="font-size: 20px;">${result.emoji}</span>
            <span>${result.name}</span>
            ${result.category ? `<small style="color: #6c757d;">${result.category}</small>` : ''}
        `;
        item.onclick = () => {
            selectAdvancedIcon(result.emoji);
            suggestions.style.display = 'none';
        };
        suggestions.appendChild(item);
    });
}

// Select random icon from current category
function selectRandomIcon() {
    if (!advancedEmojiData[currentIconCategory]) return;
    
    const categoryEmojis = new Set();
    Object.values(advancedEmojiData[currentIconCategory]).forEach(emojiArray => {
        emojiArray.forEach(emoji => categoryEmojis.add(emoji));
    });
    
    const emojisArray = Array.from(categoryEmojis);
    const randomEmoji = emojisArray[Math.floor(Math.random() * emojisArray.length)];
    
    selectAdvancedIcon(randomEmoji);
}

// Auto-suggest icon based on product name
function selectIconByName() {
    const productNameInput = document.getElementById('productName');
    if (!productNameInput || !productNameInput.value) {
        showCustomNotification('Please enter a product name first', 'warning', 'Input Required');
        return;
    }
    
    const productName = productNameInput.value.toLowerCase();
    let suggestedEmoji = '📦'; // Default
    
    // Check direct mapping first
    for (const [key, emoji] of Object.entries(productNameMapping)) {
        if (productName.includes(key)) {
            suggestedEmoji = emoji;
            break;
        }
    }
    
    // If no direct match, search in categories
    if (suggestedEmoji === '📦') {
        for (const [category, items] of Object.entries(advancedEmojiData)) {
            for (const [itemName, emojis] of Object.entries(items)) {
                if (productName.includes(itemName.toLowerCase()) || itemName.toLowerCase().includes(productName)) {
                    suggestedEmoji = emojis[0];
                    break;
                }
            }
            if (suggestedEmoji !== '📦') break;
        }
    }
    
    selectAdvancedIcon(suggestedEmoji);
}

// Initialize icon selector when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setupIconSelector();
});

function setupIconSelector() {
    const iconInput = document.getElementById('productIcon');
    const iconPreview = document.getElementById('iconPreview');
    
    if (iconInput && iconPreview) {
        // Set default icon
        if (!iconInput.value) {
            iconInput.value = '📦';
        }
        iconPreview.textContent = iconInput.value;
    }
}

// Modified handleAddProduct function to include icon selection
async function handleAddProductWithIcon(e) {
    e.preventDefault();
    
    const iconInput = document.getElementById('productIcon');
    const selectedIcon = iconInput ? iconInput.value : '📦'; // Default icon if input not found
    
    const newProduct = {
        id: Date.now(),
        name: document.getElementById('productName').value,
        emoji: selectedIcon, // Use selected icon
        category: document.getElementById('productCategory').value,
        costPrice: parseFloat(document.getElementById('costPrice').value) || 0,
        sellingPrice: parseFloat(document.getElementById('sellingPrice').value),
        stock: parseInt(document.getElementById('initialStock').value),
        supplier: document.getElementById('supplier').value,
        code: document.getElementById('productCode').value,
        lowStockThreshold: 10 // Default threshold
    };
    
    try {
        console.log('=== ADDING PRODUCT TO STORAGE ===');
        console.log('Product to save:', newProduct);
        
        // Add to in-memory array first
        inventoryData.push(newProduct);
        
        // Save to persistent storage (IndexedDB)
        if (storageReady && window.MiniVyaparStorage && MiniVyaparStorage.addProduct) {
            await MiniVyaparStorage.addProduct(newProduct);
            console.log('✅ Product saved to IndexedDB:', newProduct.name);
        } else {
            // Fallback to localStorage
            localStorage.setItem('miniVyapar_inventoryData', JSON.stringify(inventoryData));
            console.log('⚠️ Product saved to localStorage (fallback):', newProduct.name);
        }
        
        // Update all displays
        loadInventoryList();
        refreshQuickItemsFromInventory(); // Update quick items with new product
        updateDashboardData(); // Update dashboard with new inventory data
        closeAddProductForm();
        showToast(`${selectedIcon} ${newProduct.name} added to inventory`);
        
    } catch (error) {
        console.error('❌ Error saving product:', error);
        // Remove from memory if save failed
        const index = inventoryData.findIndex(p => p.id === newProduct.id);
        if (index > -1) {
            inventoryData.splice(index, 1);
        }
        showToast('❌ Error saving product. Please try again.');
    }
}

// Update the openAddProductForm function to use icon selector
const originalOpenAddProductForm = window.openAddProductForm;
window.openAddProductForm = function() {
    document.getElementById('addProductModal').style.display = 'flex';
    
    // Set today's date as default
    const form = document.getElementById('addProductForm');
    form.reset();
    
    // Initialize icon selector
    setupIconSelector();
    
    // Remove old event listener and add new one
    form.removeEventListener('submit', handleAddProduct);
    form.removeEventListener('submit', handleAddProductWithIcon);
    form.addEventListener('submit', handleAddProductWithIcon);
};

// ===============================
// SETTINGS PAGE FUNCTIONALITY
// ===============================

// Shop settings
let shopSettings = {
    name: 'Mini Vyapar Store',
    address: '',
    phone: '',
    receiptFooter: 'Thank you for your business!',
    autoGenerateReceipts: true,
    backupFrequency: 'weekly',
    backupNotifications: true,
    lastBackupDate: null
};

// Load shop settings
function loadShopSettings() {
    try {
        if (typeof MiniVyaparStorage !== 'undefined' && MiniVyaparStorage.getPreference) {
            const savedSettings = MiniVyaparStorage.getPreference('shopSettings', {});
            shopSettings = { ...shopSettings, ...savedSettings };
        } else {
            const stored = localStorage.getItem('miniVyapar_shopSettings');
            if (stored) {
                const savedSettings = JSON.parse(stored);
                shopSettings = { ...shopSettings, ...savedSettings };
            }
        }
        
        // Update UI if settings page is active
        updateSettingsUI();
        console.log('Shop settings loaded');
    } catch (error) {
        console.error('Error loading shop settings:', error);
    }
}

// Save shop settings
function saveShopSettings() {
    try {
        if (typeof MiniVyaparStorage !== 'undefined' && MiniVyaparStorage.savePreference) {
            MiniVyaparStorage.savePreference('shopSettings', shopSettings);
        } else {
            localStorage.setItem('miniVyapar_shopSettings', JSON.stringify(shopSettings));
        }
        console.log('Shop settings saved');
    } catch (error) {
        console.error('Error saving shop settings:', error);
    }
}

// Update settings UI
function updateSettingsUI() {
    const elements = {
        shopName: document.getElementById('shopName'),
        shopAddress: document.getElementById('shopAddress'),
        shopPhone: document.getElementById('shopPhone'),
        receiptFooter: document.getElementById('receiptFooter'),
        autoGenerateReceipts: document.getElementById('autoGenerateReceipts'),
        backupFrequency: document.getElementById('backupFrequency'),
        backupNotifications: document.getElementById('backupNotifications'),
        lastBackupDate: document.getElementById('lastBackupDate')
    };
    
    if (elements.shopName) elements.shopName.value = shopSettings.name;
    if (elements.shopAddress) elements.shopAddress.value = shopSettings.address;
    if (elements.shopPhone) elements.shopPhone.value = shopSettings.phone;
    if (elements.receiptFooter) elements.receiptFooter.value = shopSettings.receiptFooter;
    if (elements.autoGenerateReceipts) elements.autoGenerateReceipts.checked = shopSettings.autoGenerateReceipts;
    if (elements.backupFrequency) elements.backupFrequency.value = shopSettings.backupFrequency;
    if (elements.backupNotifications) elements.backupNotifications.checked = shopSettings.backupNotifications;
    if (elements.lastBackupDate) {
        elements.lastBackupDate.textContent = shopSettings.lastBackupDate 
            ? new Date(shopSettings.lastBackupDate).toLocaleDateString() 
            : 'Never';
    }
}

// Show settings page
function showSettings() {
    switchToPage('settings');
}

// Open language settings
function openLanguageSettings() {
    switchToPage('languageSettings');
    setupLanguageEventListeners();
}

// Open theme settings
function openThemeSettings() {
    switchToPage('themeSettings');
    setupThemeEventListeners();
}

// Open shop settings
function openShopSettings() {
    switchToPage('shopSettings');
    loadShopSettings();
    updateSettingsUI();
    setupSettingsEventListeners();
}

// Back to main settings
function backToMainSettings() {
    switchToPage('settings');
}

// Setup language event listeners
function setupLanguageEventListeners() {
    const languageOptions = document.querySelectorAll('.language-option');
    
    languageOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove active class from all options
            languageOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to clicked option
            option.classList.add('active');
            
            // Get selected language
            const selectedLang = option.getAttribute('data-lang');
            
            // Save language preference
            if (storageReady) {
                MiniVyaparStorage.savePreference('language', selectedLang);
            }
            
            // Apply language changes (placeholder for future implementation)
            applyLanguageChanges(selectedLang);
            
            showToast(selectedLang === 'ne' ? 'भाषा परिवर्तन गरियो!' : 'Language changed!');
        });
    });
}

// Setup theme event listeners
function setupThemeEventListeners() {
    const themeOptions = document.querySelectorAll('.theme-option');
    
    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove active class from all options
            themeOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to clicked option
            option.classList.add('active');
            
            // Get selected theme
            const selectedTheme = option.getAttribute('data-theme');
            
            // Save theme preference
            if (storageReady) {
                MiniVyaparStorage.savePreference('theme', selectedTheme);
            }
            
            // Apply theme changes
            applyTheme(selectedTheme);
            
            showToast(selectedTheme === 'dark' ? 'Dark mode enabled!' : 'Light mode enabled!');
        });
    });
}

// Language translations
const translations = {
    en: {
        // Header
        'Mini Vyapar': 'Mini Vyapar',
        
        // Dashboard
        "Today's Sales": "Today's Sales",
        'transactions': 'transactions',
        'Inventory Alerts': 'Inventory Alerts',
        'Low stock items': 'Low stock items',
        "Today's Expenses": "Today's Expenses",
        'entries': 'entries',
        
        // Navigation & FAB
        'New Sale': 'New Sale',
        'Inventory': 'Inventory',
        'Expenses': 'Expenses',
        'All Transactions': 'All Transactions',
        'All Transaction History': 'All Transaction History',
        'View complete financial overview': 'View complete financial overview',
        'Export CSV': 'Export CSV',
        'Advanced Filter': 'Advanced Filter',
        'Settings': 'Settings',
        
        // Common Buttons
        'Add': 'Add',
        'Edit': 'Edit',
        'Delete': 'Delete',
        'Save': 'Save',
        'Cancel': 'Cancel',
        'Close': 'Close',
        'Back': 'Back',
        'Next': 'Next',
        'Previous': 'Previous',
        'Submit': 'Submit',
        'Clear': 'Clear',
        'Search': 'Search',
        'Filter': 'Filter',
        'Sort': 'Sort',
        'View': 'View',
        'Download': 'Download',
        'Upload': 'Upload',
        'Import': 'Import',
        'Export': 'Export',
        
        // Sales Page
        'Sales': 'Sales',
        'Cart': 'Cart',
        'Total': 'Total',
        'Checkout': 'Checkout',
        'Payment': 'Payment',
        'Cash': 'Cash',
        'Card': 'Card',
        'UPI': 'UPI',
        'Credit': 'Credit',
        'Quantity': 'Quantity',
        'Price': 'Price',
        'Amount': 'Amount',
        'Discount': 'Discount',
        'Tax': 'Tax',
        'Subtotal': 'Subtotal',
        'Grand Total': 'Grand Total',
        'Items in cart': 'Items in cart',
        'Empty cart': 'Empty cart',
        'Add to cart': 'Add to cart',
        'Remove from cart': 'Remove from cart',
        'Clear cart': 'Clear cart',
        'Quick Items': 'Quick Items',
        'Show More': 'Show More',
        'Show Less': 'Show Less',
        'Favorites': 'Favorites',
        'Top Sellers': 'Top Sellers',
        'All Products': 'All Products',
        'Search products...': 'Search products...',
        'Selected Items': 'Selected Items',
        
        // Inventory Page
        'Add Product': 'Add Product',
        'Product Name': 'Product Name',
        'Category': 'Category',
        'Stock': 'Stock',
        'Cost Price': 'Cost Price',
        'Selling Price': 'Selling Price',
        'Supplier': 'Supplier',
        'Product Code': 'Product Code',
        'Low Stock Threshold': 'Low Stock Threshold',
        'Enter product name': 'Enter product name',
        'Select category': 'Select category',
        'Enter stock quantity': 'Enter stock quantity',
        'Enter cost price': 'Enter cost price',
        'Enter selling price': 'Enter selling price',
        'Enter supplier name': 'Enter supplier name',
        'Enter product code': 'Enter product code',
        'Stock level to trigger alert': 'Stock level to trigger alert',
        'Choose emoji': 'Choose emoji',
        'All Categories': 'All Categories',
        'Low Stock': 'Low Stock',
        'Out of Stock': 'Out of Stock',
        'In Stock': 'In Stock',
        'List View': 'List View',
        'Card View': 'Card View',
        'Search by name, code, or barcode...': 'Search by name, code, or barcode...',
        'Categories': 'Categories',
        'List': 'List',
        'Grid': 'Grid',
        
        // Expenses Page
        'Add Expense': 'Add Expense',
        'Expense Type': 'Expense Type',
        'Date': 'Date',
        'Notes': 'Notes',
        'Enter amount': 'Enter amount',
        'Select expense type': 'Select expense type',
        'Enter notes': 'Enter notes',
        'Rent': 'Rent',
        'Utilities': 'Utilities',
        'Supplies': 'Supplies',
        'Marketing': 'Marketing',
        'Transportation': 'Transportation',
        'Maintenance': 'Maintenance',
        'Insurance': 'Insurance',
        'Other': 'Other',
        'All Expenses': 'All Expenses',
        'This Month': 'This Month',
        'Last Month': 'Last Month',
        'Today': 'Today',
        'Yesterday': 'Yesterday',
        'This Week': 'This Week',
        'Last Week': 'Last Week',
        'Custom Range': 'Custom Range',
        
        // Settings Categories
        'Language': 'Language',
        'English / नेपाली': 'English / नेपाली',
        'Theme': 'Theme',
        'Light / Dark mode': 'Light / Dark mode',
        'Shop Features': 'Shop Features',
        'Store info, backup & receipts': 'Store info, backup & receipts',
        
        // Shop Settings
        'Shop Information': 'Shop Information',
        'Shop Name': 'Shop Name',
        'Enter your shop name': 'Enter your shop name',
        'Address': 'Address',
        'Enter your shop address': 'Enter your shop address',
        'Phone Number': 'Phone Number',
        'Enter phone number': 'Enter phone number',
        
        // Backup & Restore
        'Backup & Restore': 'Backup & Restore',
        'Backup Now (Excel)': 'Backup Now (Excel)',
        'Last backup': 'Last backup',
        'Never': 'Never',
        'Auto Backup Frequency': 'Auto Backup Frequency',
        'Manual Only': 'Manual Only',
        'Daily': 'Daily',
        'Weekly': 'Weekly',
        'Monthly': 'Monthly',
        'Enable backup reminder notifications': 'Enable backup reminder notifications',
        
        // Receipt Settings
        'Receipt Settings': 'Receipt Settings',
        'Auto-generate receipts after sale': 'Auto-generate receipts after sale',
        'Receipt Footer Message': 'Receipt Footer Message',
        'Thank you for your business!': 'Thank you for your business!',
        'Receipt Generated': 'Receipt Generated',
        'Download PDF': 'Download PDF',
        'Share Receipt': 'Share Receipt',
        
        // Data Management
        'Data Management': 'Data Management',
        'Export All Data': 'Export All Data',
        'Reset All Data': 'Reset All Data',
        
        // Language Settings
        'Language Settings': 'Language Settings',
        'Select Language': 'Select Language',
        'English': 'English',
        'Default language': 'Default language',
        'नेपाली': 'नेपाली',
        'Nepali language': 'Nepali language',
        
        // Theme Settings
        'Theme Settings': 'Theme Settings',
        'Choose Theme': 'Choose Theme',
        'Light Mode': 'Light Mode',
        'Bright and clean interface': 'Bright and clean interface',
        'Dark Mode': 'Dark Mode',
        'Easy on the eyes': 'Easy on the eyes',
        
        // Low Stock Modal
        'Low Stock Items': 'Low Stock Items',
        'All Good!': 'All Good!',
        'No items are currently low in stock': 'No items are currently low in stock',
        'OUT OF STOCK': 'OUT OF STOCK',
        'left': 'left',
        
        // Messages & Status
        'Language changed!': 'Language changed!',
        'Light mode enabled!': 'Light mode enabled!',
        'Dark mode enabled!': 'Dark mode enabled!',
        'Product added successfully!': 'Product added successfully!',
        'Product updated successfully!': 'Product updated successfully!',
        'Product deleted successfully!': 'Product deleted successfully!',
        'Expense added successfully!': 'Expense added successfully!',
        'Sale completed successfully!': 'Sale completed successfully!',
        'Backup completed successfully!': 'Backup completed successfully!',
        'Data exported successfully!': 'Data exported successfully!',
        'Are you sure?': 'Are you sure?',
        'This action cannot be undone': 'This action cannot be undone',
        'Confirm': 'Confirm',
        'Loading...': 'Loading...',
        'Please wait': 'Please wait',
        'Error': 'Error',
        'Success': 'Success',
        'Warning': 'Warning',
        'Info': 'Info',
        
        // Form Labels & Placeholders
        'Required field': 'Required field',
        'Optional': 'Optional',
        'Select an option': 'Select an option',
        'Enter value': 'Enter value',
        'Choose date': 'Choose date',
        'Browse': 'Browse',
        'Upload file': 'Upload file',
        'No file chosen': 'No file chosen',
        
        // Time & Date
        'Today': 'Today',
        'Yesterday': 'Yesterday',
        'Tomorrow': 'Tomorrow',
        'This Week': 'This Week',
        'Last Week': 'Last Week',
        'This Month': 'This Month',
        'Last Month': 'Last Month',
        'This Year': 'This Year',
        'Last Year': 'Last Year',
        
        // Analytics & Reports
        'Analytics': 'Analytics',
        'Reports': 'Reports',
        'Summary': 'Summary',
        'Statistics': 'Statistics',
        'Trends': 'Trends',
        'Performance': 'Performance',
        'Revenue': 'Revenue',
        'Profit': 'Profit',
        'Loss': 'Loss',
        'Growth': 'Growth',
        'Decline': 'Decline',
        
        // All Transactions Page
        'Total Revenue': 'Total Revenue',
        'Total Expenses': 'Total Expenses',
        'Net Profit': 'Net Profit',
        'Outstanding Credit': 'Outstanding Credit',
        'Today': 'Today',
        'This Week': 'This Week',
        'This Month': 'This Month',
        'All Time': 'All Time',
        'All': 'All',
        'Sales': 'Sales',
        'Credit': 'Credit',
        'No Transactions Found': 'No Transactions Found',
        'Start making sales or adding expenses to see your transaction history.': 'Start making sales or adding expenses to see your transaction history.'
    },
    
    ne: {
        // Header
        'Mini Vyapar': 'मिनी व्यापार',
        
        // Dashboard
        "Today's Sales": 'आजको बिक्री',
        'transactions': 'कारोबार',
        'Inventory Alerts': 'स्टक चेतावनी',
        'Low stock items': 'कम स्टक सामान',
        "Today's Expenses": 'आजको खर्च',
        'entries': 'प्रविष्टि',
        
        // Navigation & FAB
        'New Sale': 'नयाँ बिक्री',
        'Inventory': 'स्टक',
        'Expenses': 'खर्च',
        'All Transactions': 'सबै कारोबार',
        'All Transaction History': 'सबै कारोबार इतिहास',
        'View complete financial overview': 'पूर्ण वित्तीय सिंहावलोकन हेर्नुहोस्',
        'Export CSV': 'CSV निर्यात',
        'Advanced Filter': 'उन्नत फिल्टर',
        'Settings': 'सेटिङ',
        
        // Common Buttons
        'Add': 'थप्नुहोस्',
        'Edit': 'सम्पादन',
        'Delete': 'मेटाउनुहोस्',
        'Save': 'सेभ गर्नुहोस्',
        'Cancel': 'रद्द गर्नुहोस्',
        'Close': 'बन्द गर्नुहोस्',
        'Back': 'फिर्ता',
        'Next': 'अर्को',
        'Previous': 'अघिल्लो',
        'Submit': 'पेश गर्नुहोस्',
        'Clear': 'खाली गर्नुहोस्',
        'Search': 'खोज्नुहोस्',
        'Filter': 'फिल्टर',
        'Sort': 'क्रमबद्ध',
        'View': 'हेर्नुहोस्',
        'Download': 'डाउनलोड',
        'Upload': 'अपलोड',
        'Import': 'आयात',
        'Export': 'निर्यात',
        
        // Sales Page
        'Sales': 'बिक्री',
        'Cart': 'कार्ट',
        'Total': 'जम्मा',
        'Checkout': 'चेकआउट',
        'Payment': 'भुक्तानी',
        'Cash': 'नगद',
        'Card': 'कार्ड',
        'UPI': 'यूपीआई',
        'Credit': 'क्रेडिट',
        'Quantity': 'परिमाण',
        'Price': 'मूल्य',
        'Amount': 'रकम',
        'Discount': 'छुट',
        'Tax': 'कर',
        'Subtotal': 'उप-जम्मा',
        'Grand Total': 'कुल जम्मा',
        'Items in cart': 'कार्टमा सामानहरू',
        'Empty cart': 'खाली कार्ट',
        'Add to cart': 'कार्टमा थप्नुहोस्',
        'Remove from cart': 'कार्टबाट हटाउनुहोस्',
        'Clear cart': 'कार्ट खाली गर्नुहोस्',
        'Quick Items': 'छिटो सामानहरू',
        'Show More': 'थप देखाउनुहोस्',
        'Show Less': 'कम देखाउनुहोस्',
        'Favorites': 'मनपर्ने',
        'Top Sellers': 'शीर्ष बिक्रेता',
        'All Products': 'सबै उत्पादनहरू',
        'Search products...': 'उत्पादनहरू खोज्नुहोस्...',
        'Selected Items': 'छानिएका सामानहरू',
        
        // Inventory Page
        'Add Product': 'उत्पादन थप्नुहोस्',
        'Product Name': 'उत्पादनको नाम',
        'Category': 'श्रेणी',
        'Stock': 'स्टक',
        'Cost Price': 'लागत मूल्य',
        'Selling Price': 'बिक्री मूल्य',
        'Supplier': 'आपूर्तिकर्ता',
        'Product Code': 'उत्पादन कोड',
        'Low Stock Threshold': 'कम स्टक सीमा',
        'Enter product name': 'उत्पादनको नाम राख्नुहोस्',
        'Select category': 'श्रेणी छान्नुहोस्',
        'Enter stock quantity': 'स्टक परिमाण राख्नुहोस्',
        'Enter cost price': 'लागत मूल्य राख्नुहोस्',
        'Enter selling price': 'बिक्री मूल्य राख्नुहोस्',
        'Enter supplier name': 'आपूर्तिकर्ताको नाम राख्नुहोस्',
        'Enter product code': 'उत्पादन कोड राख्नुहोस्',
        'Stock level to trigger alert': 'चेतावनी ट्रिगर गर्न स्टक स्तर',
        'Choose emoji': 'इमोजी छान्नुहोस्',
        'All Categories': 'सबै श्रेणीहरू',
        'Low Stock': 'कम स्टक',
        'Out of Stock': 'स्टक सकिएको',
        'In Stock': 'स्टकमा छ',
        'List View': 'सूची दृश्य',
        'Card View': 'कार्ड दृश्य',
        'Search by name, code, or barcode...': 'नाम, कोड, वा बारकोडले खोज्नुहोस्...',
        'Categories': 'श्रेणीहरू',
        'List': 'सूची',
        'Grid': 'ग्रिड',
        
        // Expenses Page
        'Add Expense': 'खर्च थप्नुहोस्',
        'Expense Type': 'खर्चको प्रकार',
        'Date': 'मिति',
        'Notes': 'टिप्पणी',
        'Enter amount': 'रकम राख्नुहोस्',
        'Select expense type': 'खर्चको प्रकार छान्नुहोस्',
        'Enter notes': 'टिप्पणी राख्नुहोस्',
        'Rent': 'भाडा',
        'Utilities': 'उपयोगिताहरू',
        'Supplies': 'आपूर्ति',
        'Marketing': 'मार्केटिङ',
        'Transportation': 'यातायात',
        'Maintenance': 'मर्मत',
        'Insurance': 'बीमा',
        'Other': 'अन्य',
        'All Expenses': 'सबै खर्चहरू',
        'This Month': 'यो महिना',
        'Last Month': 'गत महिना',
        'Today': 'आज',
        'Yesterday': 'हिजो',
        'This Week': 'यो हप्ता',
        'Last Week': 'गत हप्ता',
        'Custom Range': 'अनुकूलित दायरा',
        
        // Settings Categories
        'Language': 'भाषा',
        'English / नेपाली': 'अंग्रेजी / नेपाली',
        'Theme': 'थिम',
        'Light / Dark mode': 'उज्यालो / अँध्यारो मोड',
        'Shop Features': 'पसल सुविधा',
        'Store info, backup & receipts': 'पसल जानकारी, ब्याकअप र रसिद',
        
        // Shop Settings
        'Shop Information': 'पसल जानकारी',
        'Shop Name': 'पसलको नाम',
        'Enter your shop name': 'आफ्नो पसलको नाम राख्नुहोस्',
        'Address': 'ठेगाना',
        'Enter your shop address': 'आफ्नो पसलको ठेगाना राख्नुहोस्',
        'Phone Number': 'फोन नम्बर',
        'Enter phone number': 'फोन नम्बर राख्नुहोस्',
        
        // Backup & Restore
        'Backup & Restore': 'ब्याकअप र रिस्टोर',
        'Backup Now (Excel)': 'अहिले ब्याकअप (एक्सेल)',
        'Last backup': 'अन्तिम ब्याकअप',
        'Never': 'कहिल्यै छैन',
        'Auto Backup Frequency': 'स्वचालित ब्याकअप आवृत्ति',
        'Manual Only': 'म्यानुअल मात्र',
        'Daily': 'दैनिक',
        'Weekly': 'साप्ताहिक',
        'Monthly': 'मासिक',
        'Enable backup reminder notifications': 'ब्याकअप रिमाइन्डर सूचना सक्षम गर्नुहोस्',
        
        // Receipt Settings
        'Receipt Settings': 'रसिद सेटिङ',
        'Auto-generate receipts after sale': 'बिक्री पछि स्वचालित रसिद बनाउनुहोस्',
        'Receipt Footer Message': 'रसिद फुटर सन्देश',
        'Thank you for your business!': 'तपाईंको व्यापारको लागि धन्यवाद!',
        'Receipt Generated': 'रसिद बनाइयो',
        'Download PDF': 'पीडीएफ डाउनलोड',
        'Share Receipt': 'रसिद साझा गर्नुहोस्',
        
        // Data Management
        'Data Management': 'डाटा व्यवस्थापन',
        'Export All Data': 'सबै डाटा निर्यात गर्नुहोस्',
        'Reset All Data': 'सबै डाटा रिसेट गर्नुहोस्',
        
        // Language Settings
        'Language Settings': 'भाषा सेटिङ',
        'Select Language': 'भाषा छान्नुहोस्',
        'English': 'अंग्रेजी',
        'Default language': 'पूर्वनिर्धारित भाषा',
        'नेपाली': 'नेपाली',
        'Nepali language': 'नेपाली भाषा',
        
        // Theme Settings
        'Theme Settings': 'थिम सेटिङ',
        'Choose Theme': 'थिम छान्नुहोस्',
        'Light Mode': 'उज्यालो मोड',
        'Bright and clean interface': 'उज्यालो र सफा इन्टरफेस',
        'Dark Mode': 'अँध्यारो मोड',
        'Easy on the eyes': 'आँखामा सजिलो',
        
        // Low Stock Modal
        'Low Stock Items': 'कम स्टक सामान',
        'All Good!': 'सबै ठीक छ!',
        'No items are currently low in stock': 'हाल कुनै सामान कम स्टकमा छैन',
        'OUT OF STOCK': 'स्टक सकिएको',
        'left': 'बाँकी',
        
        // Messages & Status
        'Language changed!': 'भाषा परिवर्तन गरियो!',
        'Light mode enabled!': 'उज्यालो मोड सक्षम गरियो!',
        'Dark mode enabled!': 'अँध्यारो मोड सक्षम गरियो!',
        'Product added successfully!': 'उत्पादन सफलतापूर्वक थपियो!',
        'Product updated successfully!': 'उत्पादन सफलतापूर्वक अपडेट भयो!',
        'Product deleted successfully!': 'उत्पादन सफलतापूर्वक मेटाइयो!',
        'Expense added successfully!': 'खर्च सफलतापूर्वक थपियो!',
        'Sale completed successfully!': 'बिक्री सफलतापूर्वक सम्पन्न भयो!',
        'Backup completed successfully!': 'ब्याकअप सफलतापूर्वक सम्पन्न भयो!',
        'Data exported successfully!': 'डाटा सफलतापूर्वक निर्यात भयो!',
        'Are you sure?': 'तपाईं निश्चित हुनुहुन्छ?',
        'This action cannot be undone': 'यो कार्य पूर्ववत गर्न सकिँदैन',
        'Confirm': 'पुष्टि गर्नुहोस्',
        'Loading...': 'लोड गर्दै...',
        'Please wait': 'कृपया पर्खनुहोस्',
        'Error': 'त्रुटि',
        'Success': 'सफल',
        'Warning': 'चेतावनी',
        'Info': 'जानकारी',
        
        // Form Labels & Placeholders
        'Required field': 'आवश्यक फिल्ड',
        'Optional': 'वैकल्पिक',
        'Select an option': 'एक विकल्प छान्नुहोस्',
        'Enter value': 'मान राख्नुहोस्',
        'Choose date': 'मिति छान्नुहोस्',
        'Browse': 'ब्राउज गर्नुहोस्',
        'Upload file': 'फाइल अपलोड गर्नुहोस्',
        'No file chosen': 'कुनै फाइल छानिएको छैन',
        
        // Time & Date
        'Today': 'आज',
        'Yesterday': 'हिजो',
        'Tomorrow': 'भोलि',
        'This Week': 'यो हप्ता',
        'Last Week': 'गत हप्ता',
        'This Month': 'यो महिना',
        'Last Month': 'गत महिना',
        'This Year': 'यो वर्ष',
        'Last Year': 'गत वर्ष',
        
        // Analytics & Reports
        'Analytics': 'विश्लेषण',
        'Reports': 'रिपोर्टहरू',
        'Summary': 'सारांश',
        'Statistics': 'तथ्याङ्क',
        'Trends': 'प्रवृत्ति',
        'Performance': 'प्रदर्शन',
        'Revenue': 'राजस्व',
        'Profit': 'नाफा',
        'Loss': 'घाटा',
        'Growth': 'वृद्धि',
        'Decline': 'गिरावट',
        
        // All Transactions Page
        'Total Revenue': 'कुल राजस्व',
        'Total Expenses': 'कुल खर्च',
        'Net Profit': 'शुद्ध नाफा',
        'Outstanding Credit': 'बाँकी उधारो',
        'Today': 'आज',
        'This Week': 'यो हप्ता',
        'This Month': 'यो महिना',
        'All Time': 'सम्पूर्ण समय',
        'All': 'सबै',
        'Sales': 'बिक्री',
        'Credit': 'उधारो',
        'No Transactions Found': 'कुनै कारोबार फेला परेन',
        'Start making sales or adding expenses to see your transaction history.': 'कारोबार इतिहास हेर्न बिक्री वा खर्च थप्न सुरु गर्नुहोस्।'
    }
};

// Current language
let currentLanguage = 'en';

// Apply language changes (now with actual translation)
function applyLanguageChanges(language) {
    currentLanguage = language;
    document.documentElement.setAttribute('data-language', language);
    
    // For English, we need to reset any Nepali text back to English
    if (language === 'en') {
        resetToEnglish();
    }
    
    // Translate all elements with data-translate attribute
    const elementsToTranslate = document.querySelectorAll('[data-translate]');
    
    elementsToTranslate.forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[language] && translations[language][key]) {
            if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'search')) {
                element.placeholder = translations[language][key];
            } else if (element.tagName === 'TEXTAREA') {
                element.placeholder = translations[language][key];
            } else {
                element.textContent = translations[language][key];
            }
        }
    });
    
    // Automatically translate common elements without data-translate attributes
    translateCommonElements(language);
    
    // Update specific elements that don't have data-translate
    updateSpecificTranslations(language);
}

// Reset elements back to English when switching to English mode
function resetToEnglish() {
    // Reset specific elements that might have been translated
    const elementsToReset = document.querySelectorAll('[data-translate]');
    
    elementsToReset.forEach(element => {
        const key = element.getAttribute('data-translate');
        
        // For input placeholders
        if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'search' || element.type === 'tel')) {
            element.placeholder = key;
        } else if (element.tagName === 'TEXTAREA') {
            element.placeholder = key;
        } else if (element.tagName === 'OPTION') {
            // For option elements, use the key directly
            element.textContent = key;
        } else if (element.tagName === 'SPAN') {
            // For span elements, use the key directly  
            element.textContent = key;
        } else {
            // For text content, use the key as the English text
            element.textContent = key;
        }
    });
    
    // Force update any elements that might be dynamically generated
    updateDynamicContent();
}

// Update dynamic content that might not have data-translate attributes
function updateDynamicContent() {
    // Update any dynamically generated content that needs translation
    const language = currentLanguage;
    
    // Update backup notification text if it exists
    const backupNotificationLabel = document.querySelector('label[for="backupNotifications"]');
    if (backupNotificationLabel) {
        const text = 'Enable backup reminder notifications';
        backupNotificationLabel.textContent = language === 'en' ? text : (translations[language][text] || text);
    }
}

// Automatically translate common elements (only when not already handled by data-translate)
function translateCommonElements(language) {
    // Only run automatic translation if we have the translations for this language
    if (!translations[language]) return;
    
    // Translate buttons with common text (but skip if already has data-translate)
    const buttons = document.querySelectorAll('button:not([data-translate])');
    buttons.forEach(button => {
        const text = button.textContent.trim();
        // Only translate if we have a translation and it's not just numbers/emojis
        if (translations[language][text] && 
            !/^[\d\sRs .,]+$/.test(text) && 
            !/^[🔥⭐📦🔍⚙️🗑←→✕×]+$/.test(text) &&
            text.length > 1) {
            button.textContent = translations[language][text];
        }
    });
    
    // Translate labels without data-translate
    const labels = document.querySelectorAll('label:not([data-translate])');
    labels.forEach(label => {
        const text = label.textContent.trim();
        if (translations[language][text] && text.length > 1) {
            label.textContent = translations[language][text];
        }
    });
    
    // Translate headings without data-translate
    const headings = document.querySelectorAll('h1:not([data-translate]), h2:not([data-translate]), h3:not([data-translate]), h4:not([data-translate])');
    headings.forEach(heading => {
        const text = heading.textContent.trim();
        if (translations[language][text] && text.length > 1) {
            heading.textContent = translations[language][text];
        }
    });
    
    // Translate option elements without data-translate
    const options = document.querySelectorAll('option:not([data-translate])');
    options.forEach(option => {
        const text = option.textContent.trim();
        if (translations[language][text] && text.length > 1) {
            option.textContent = translations[language][text];
        }
    });
    
    // Be very selective with spans - only translate specific ones
    const spans = document.querySelectorAll('span.filter-tab:not([data-translate]), span.summary-label:not([data-translate])');
    spans.forEach(span => {
        const text = span.textContent.trim();
        if (translations[language][text] && 
            !/^[\d\sRs .,]+$/.test(text) && 
            !/^[🔥⭐📦🔍⚙️🗑←→↑↓✓×+\-]+$/.test(text) && 
            text.length > 1) {
            span.textContent = translations[language][text];
        }
    });
    
    // Only translate placeholders that don't have data-translate
    const inputs = document.querySelectorAll('input[placeholder]:not([data-translate]), textarea[placeholder]:not([data-translate])');
    inputs.forEach(input => {
        const placeholder = input.placeholder.trim();
        if (translations[language][placeholder] && placeholder.length > 1) {
            input.placeholder = translations[language][placeholder];
        }
    });
}

// Update specific translations
function updateSpecificTranslations(language) {
    // Update dashboard cards
    const salesCardTitle = document.querySelector('.card:nth-child(1) .card-title');
    const alertsCardTitle = document.querySelector('.card:nth-child(2) .card-title');
    const alertsCardSubtitle = document.querySelector('.card:nth-child(2) .card-subtitle');
    const expensesCardTitle = document.querySelector('.card:nth-child(3) .card-title');
    
    if (salesCardTitle) salesCardTitle.textContent = translations[language]["Today's Sales"];
    if (alertsCardTitle) alertsCardTitle.textContent = translations[language]['Inventory Alerts'];
    if (alertsCardSubtitle) alertsCardSubtitle.textContent = translations[language]['Low stock items'];
    if (expensesCardTitle) expensesCardTitle.textContent = translations[language]["Today's Expenses"];
    
    // Update FAB labels
    const fabLabels = document.querySelectorAll('.fab-label');
    const fabTexts = ['New Sale', 'Inventory', 'Expenses'];
    fabLabels.forEach((label, index) => {
        if (fabTexts[index] && translations[language][fabTexts[index]]) {
            label.textContent = translations[language][fabTexts[index]];
        }
    });
    
    // Update logo if needed
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.textContent = translations[language]['Mini Vyapar'];
    }
}

// Load saved language preference
function loadSavedLanguage() {
    if (storageReady) {
        const savedLanguage = MiniVyaparStorage.getPreference('language') || 'en';
        currentLanguage = savedLanguage;
        
        // Update language option selection
        const languageOptions = document.querySelectorAll('.language-option');
        languageOptions.forEach(option => {
            option.classList.remove('active');
            if (option.getAttribute('data-lang') === savedLanguage) {
                option.classList.add('active');
            }
        });
        
        // Apply the language
        applyLanguageChanges(savedLanguage);
    }
}

// Load saved theme preference
function loadSavedTheme() {
    if (storageReady) {
        const savedTheme = MiniVyaparStorage.getPreference('theme') || 'light';
        
        // Update theme option selection
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach(option => {
            option.classList.remove('active');
            if (option.getAttribute('data-theme') === savedTheme) {
                option.classList.add('active');
            }
        });
        
        // Apply the theme
        applyTheme(savedTheme);
    }
}

// Apply theme changes
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.body.classList.remove('dark-theme');
        document.documentElement.setAttribute('data-theme', 'light');
    }
}

// Setup settings event listeners
function setupSettingsEventListeners() {
    const inputs = ['shopName', 'shopAddress', 'shopPhone', 'receiptFooter'];
    
    inputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        if (element) {
            element.addEventListener('change', () => {
                shopSettings[inputId === 'shopName' ? 'name' : inputId === 'shopAddress' ? 'address' : inputId === 'shopPhone' ? 'phone' : 'receiptFooter'] = element.value;
                saveShopSettings();
            });
        }
    });
    
    const checkboxes = ['autoGenerateReceipts', 'backupNotifications'];
    checkboxes.forEach(checkboxId => {
        const element = document.getElementById(checkboxId);
        if (element) {
            element.addEventListener('change', () => {
                shopSettings[checkboxId] = element.checked;
                saveShopSettings();
            });
        }
    });
    
    const backupFrequencyElement = document.getElementById('backupFrequency');
    if (backupFrequencyElement) {
        backupFrequencyElement.addEventListener('change', () => {
            shopSettings.backupFrequency = backupFrequencyElement.value;
            saveShopSettings();
        });
    }
}

// ===============================
// BACKUP TO EXCEL FUNCTIONALITY
// ===============================

// Backup all data to Excel
async function backupToExcel() {
    try {
        // Check if XLSX library is loaded
        if (typeof XLSX === 'undefined') {
            showToast('❌ Excel library not loaded. Please refresh the page and try again.', 'error');
            return;
        }
        
        const backupBtn = document.getElementById('backupNowBtn');
        if (backupBtn) {
            backupBtn.disabled = true;
            backupBtn.textContent = '⏳ Creating backup...';
        }
        
        // Prepare data for export
        const backupData = await prepareBackupData();
        
        // Check if we have any data to backup
        const hasData = backupData.products.length > 0 || 
                       backupData.sales.length > 0 || 
                       backupData.expenses.length > 0 || 
                       backupData.credits.length > 0;
        
        if (!hasData) {
            showToast('⚠️ No data to backup. Add some products, sales, or expenses first.', 'warning');
            return;
        }
        
        // Create Excel workbook
        const wb = XLSX.utils.book_new();
        
        // Products sheet
        if (backupData.products.length > 0) {
            const productsSheet = XLSX.utils.json_to_sheet(backupData.products);
            XLSX.utils.book_append_sheet(wb, productsSheet, 'Products');
        }
        
        // Sales sheet
        if (backupData.sales.length > 0) {
            const salesSheet = XLSX.utils.json_to_sheet(backupData.sales);
            XLSX.utils.book_append_sheet(wb, salesSheet, 'Sales');
        }
        
        // Expenses sheet
        if (backupData.expenses.length > 0) {
            const expensesSheet = XLSX.utils.json_to_sheet(backupData.expenses);
            XLSX.utils.book_append_sheet(wb, expensesSheet, 'Expenses');
        }
        
        // Credits sheet
        if (backupData.credits.length > 0) {
            const creditsSheet = XLSX.utils.json_to_sheet(backupData.credits);
            XLSX.utils.book_append_sheet(wb, creditsSheet, 'Credits');
        }
        
        // Analytics sheet
        if (backupData.analytics.length > 0) {
            const analyticsSheet = XLSX.utils.json_to_sheet(backupData.analytics);
            XLSX.utils.book_append_sheet(wb, analyticsSheet, 'Analytics');
        }
        
        // Profit Analysis sheet
        if (backupData.profitAnalysis.length > 0) {
            const profitSheet = XLSX.utils.json_to_sheet(backupData.profitAnalysis);
            XLSX.utils.book_append_sheet(wb, profitSheet, 'Profit Analysis');
        }
        
        // Low Stock Items sheet
        if (backupData.lowStockItems.length > 0) {
            const lowStockSheet = XLSX.utils.json_to_sheet(backupData.lowStockItems);
            XLSX.utils.book_append_sheet(wb, lowStockSheet, 'Low Stock Items');
        }
        
        // Generate filename with current date
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
        const filename = `MiniVyapar_Backup_${dateStr}.xlsx`;
        
        // Download the file
        XLSX.writeFile(wb, filename);
        
        // Update last backup date
        shopSettings.lastBackupDate = now.toISOString();
        saveShopSettings();
        updateSettingsUI();
        
        showToast('✅ Enhanced backup completed successfully!');
        
    } catch (error) {
        console.error('Error creating backup:', error);
        showToast('❌ Backup failed. Please try again.');
    } finally {
        const backupBtn = document.getElementById('backupNowBtn');
        if (backupBtn) {
            backupBtn.disabled = false;
            backupBtn.textContent = '📊 Backup Now (Excel)';
        }
    }
}

// Prepare data for backup
async function prepareBackupData() {
    const backupData = {
        products: [],
        sales: [],
        expenses: [],
        credits: [],
        analytics: [],
        profitAnalysis: [],
        lowStockItems: []
    };
    
    // Prepare products data
    if (inventoryData && inventoryData.length > 0) {
        backupData.products = inventoryData.map(product => ({
            id: product.id,
            name: product.name,
            category: product.category,
            emoji: product.emoji,
            costPrice: product.costPrice,
            sellingPrice: product.sellingPrice,
            stock: product.stock,
            supplier: product.supplier,
            code: product.code,
            lowStockThreshold: product.lowStockThreshold,
            profitMargin: ((product.sellingPrice - product.costPrice) / product.costPrice * 100).toFixed(2) + '%'
        }));
    }
    
    // Prepare sales data with profit calculations
    if (transactionHistory && transactionHistory.length > 0) {
        transactionHistory.forEach(transaction => {
            transaction.items.forEach(item => {
                // Find product to get cost price
                const product = inventoryData.find(p => p.name === item.name);
                const costPrice = product ? product.costPrice : 0;
                const totalCost = costPrice * item.quantity;
                const totalRevenue = item.price * item.quantity;
                const profit = totalRevenue - totalCost;
                
                backupData.sales.push({
                    transactionId: transaction.id || transaction.timestamp,
                    timestamp: new Date(transaction.timestamp).toLocaleString(),
                    itemName: item.name,
                    quantity: item.quantity,
                    costPrice: costPrice,
                    sellingPrice: item.price,
                    totalCost: totalCost,
                    totalRevenue: totalRevenue,
                    profit: profit,
                    profitMargin: totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(2) + '%' : '0%',
                    paymentType: transaction.type || 'sale'
                });
            });
        });
    }
    
    // Prepare expenses data
    if (expensesData && expensesData.length > 0) {
        backupData.expenses = expensesData.map(expense => ({
            id: expense.id,
            date: new Date(expense.date).toLocaleDateString(),
            type: expense.type,
            amount: expense.amount,
            notes: expense.notes || '',
            monthYear: new Date(expense.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        }));
    }
    
    // Prepare credit data
    if (creditsData && creditsData.length > 0) {
        backupData.credits = creditsData.map(credit => ({
            id: credit.id,
            customerName: credit.customerName,
            amount: credit.amount,
            date: new Date(credit.date).toLocaleDateString(),
            phone: credit.phone || '',
            status: credit.status,
            monthYear: new Date(credit.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            daysOutstanding: Math.floor((Date.now() - new Date(credit.date).getTime()) / (1000 * 60 * 60 * 24))
        }));
    }
    
    // Prepare analytics data
    const analytics = calculateBusinessAnalytics();
    backupData.analytics = [
        { metric: 'Total Products', value: analytics.totalProducts },
        { metric: 'Total Sales Revenue', value: analytics.totalSalesRevenue },
        { metric: 'Total Expenses', value: analytics.totalExpenses },
        { metric: 'Net Profit', value: analytics.netProfit },
        { metric: 'Gross Profit Margin', value: analytics.grossProfitMargin + '%' },
        { metric: 'Total Transactions', value: analytics.totalTransactions },
        { metric: 'Average Order Value', value: analytics.averageOrderValue },
        { metric: 'Low Stock Items Count', value: analytics.lowStockCount },
        { metric: 'Out of Stock Items', value: analytics.outOfStockCount },
        { metric: 'Best Selling Product', value: analytics.bestSellingProduct },
        { metric: 'Most Profitable Product', value: analytics.mostProfitableProduct },
        { metric: 'Today Sales', value: analytics.todaySales },
        { metric: 'This Month Sales', value: analytics.thisMonthSales },
        { metric: 'Today Expenses', value: analytics.todayExpenses },
        { metric: 'This Month Expenses', value: analytics.thisMonthExpenses }
    ];
    
    // Prepare profit analysis by product
    if (inventoryData && inventoryData.length > 0) {
        backupData.profitAnalysis = inventoryData.map(product => {
            // Calculate total sales for this product
            let totalQuantitySold = 0;
            let totalRevenue = 0;
            
            if (transactionHistory && transactionHistory.length > 0) {
                transactionHistory.forEach(transaction => {
                    transaction.items.forEach(item => {
                        if (item.name === product.name) {
                            totalQuantitySold += item.quantity;
                            totalRevenue += item.price * item.quantity;
                        }
                    });
                });
            }
            
            const totalCost = totalQuantitySold * (product.costPrice || 0);
            const totalProfit = totalRevenue - totalCost;
            const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : '0';
            
            return {
                productName: product.name,
                category: product.category,
                costPrice: product.costPrice || 0,
                sellingPrice: product.sellingPrice,
                currentStock: product.stock,
                totalQuantitySold: totalQuantitySold,
                totalRevenue: totalRevenue,
                totalCost: totalCost,
                totalProfit: totalProfit,
                profitMargin: profitMargin + '%',
                status: product.stock === 0 ? 'Out of Stock' : product.stock <= (product.lowStockThreshold || 10) ? 'Low Stock' : 'In Stock'
            };
        });
    }
    
    // Prepare low stock items
    if (inventoryData && inventoryData.length > 0) {
        backupData.lowStockItems = inventoryData
            .filter(product => product.stock <= (product.lowStockThreshold || 10))
            .map(product => ({
                productName: product.name,
                category: product.category,
                currentStock: product.stock,
                lowStockThreshold: product.lowStockThreshold || 10,
                sellingPrice: product.sellingPrice,
                supplier: product.supplier || '',
                status: product.stock === 0 ? 'OUT OF STOCK' : 'LOW STOCK',
                urgency: product.stock === 0 ? 'CRITICAL' : product.stock <= 5 ? 'HIGH' : 'MEDIUM'
            }));
    }
    
    return backupData;
}

// Calculate comprehensive business analytics
function calculateBusinessAnalytics() {
    const analytics = {
        totalProducts: 0,
        totalSalesRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        grossProfitMargin: 0,
        totalTransactions: 0,
        averageOrderValue: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        bestSellingProduct: 'N/A',
        mostProfitableProduct: 'N/A',
        todaySales: 0,
        thisMonthSales: 0,
        todayExpenses: 0,
        thisMonthExpenses: 0
    };
    
    const today = new Date().toDateString();
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    
    // Product analytics
    if (inventoryData && inventoryData.length > 0) {
        analytics.totalProducts = inventoryData.length;
        analytics.lowStockCount = inventoryData.filter(p => p.stock <= (p.lowStockThreshold || 10)).length;
        analytics.outOfStockCount = inventoryData.filter(p => p.stock === 0).length;
    }
    
    // Sales analytics
    const productSales = {};
    const productProfits = {};
    
    if (transactionHistory && transactionHistory.length > 0) {
        analytics.totalTransactions = transactionHistory.length;
        
        transactionHistory.forEach(transaction => {
            const transactionDate = new Date(transaction.timestamp);
            const transactionTotal = transaction.total || 0;
            
            analytics.totalSalesRevenue += transactionTotal;
            
            // Today's sales
            if (transactionDate.toDateString() === today) {
                analytics.todaySales += transactionTotal;
            }
            
            // This month's sales
            if (transactionDate.getMonth() === thisMonth && transactionDate.getFullYear() === thisYear) {
                analytics.thisMonthSales += transactionTotal;
            }
            
            // Product-wise analytics
            transaction.items.forEach(item => {
                const productName = item.name;
                if (!productSales[productName]) {
                    productSales[productName] = 0;
                    productProfits[productName] = 0;
                }
                
                productSales[productName] += item.quantity;
                
                // Calculate profit
                const product = inventoryData.find(p => p.name === productName);
                if (product) {
                    const profit = (item.price - (product.costPrice || 0)) * item.quantity;
                    productProfits[productName] += profit;
                }
            });
        });
        
        analytics.averageOrderValue = analytics.totalTransactions > 0 ? 
            (analytics.totalSalesRevenue / analytics.totalTransactions).toFixed(2) : 0;
    }
    
    // Expenses analytics
    if (expensesData && expensesData.length > 0) {
        expensesData.forEach(expense => {
            const expenseDate = new Date(expense.date);
            analytics.totalExpenses += expense.amount || 0;
            
            // Today's expenses
            if (expenseDate.toDateString() === today) {
                analytics.todayExpenses += expense.amount || 0;
            }
            
            // This month's expenses
            if (expenseDate.getMonth() === thisMonth && expenseDate.getFullYear() === thisYear) {
                analytics.thisMonthExpenses += expense.amount || 0;
            }
        });
    }
    
    // Calculate net profit and margin
    analytics.netProfit = analytics.totalSalesRevenue - analytics.totalExpenses;
    analytics.grossProfitMargin = analytics.totalSalesRevenue > 0 ? 
        ((analytics.netProfit / analytics.totalSalesRevenue) * 100).toFixed(2) : 0;
    
    // Find best selling and most profitable products
    if (Object.keys(productSales).length > 0) {
        analytics.bestSellingProduct = Object.keys(productSales).reduce((a, b) => 
            productSales[a] > productSales[b] ? a : b);
    }
    
    if (Object.keys(productProfits).length > 0) {
        analytics.mostProfitableProduct = Object.keys(productProfits).reduce((a, b) => 
            productProfits[a] > productProfits[b] ? a : b);
    }
    
    return analytics;
}

// Export all data (alternative to backup)
async function exportAllData() {
    try {
        showToast('⏳ Preparing enhanced data export...');
        
        const backupData = await prepareBackupData();
        const analytics = calculateBusinessAnalytics();
        
        // Create a comprehensive data export
        const exportObj = {
            exportDate: new Date().toISOString(),
            shopSettings: shopSettings,
            businessAnalytics: analytics,
            summary: {
                totalProducts: backupData.products.length,
                totalSales: backupData.sales.length,
                totalExpenses: backupData.expenses.length,
                totalAnalyticsMetrics: backupData.analytics.length,
                totalProfitAnalysis: backupData.profitAnalysis.length,
                lowStockItemsCount: backupData.lowStockItems.length
            },
            data: backupData
        };
        
        // Create and download JSON file
        const dataStr = JSON.stringify(exportObj, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `MiniVyapar_Enhanced_Export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('✅ Enhanced data exported successfully!');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('❌ Export failed. Please try again.');
    }
}

// ===============================
// DIGITAL RECEIPTS FUNCTIONALITY
// ===============================

// Current receipt data
let currentReceiptData = null;

// Generate receipt after sale
function generateReceipt(transactionData) {
    if (!shopSettings.autoGenerateReceipts) return;
    
    currentReceiptData = {
        saleId: transactionData.id || Date.now(),
        timestamp: new Date(),
        items: transactionData.items,
        total: transactionData.total,
        paymentType: transactionData.type || 'cash'
    };
    
    showReceiptModal();
}

// Show receipt modal
function showReceiptModal() {
    if (!currentReceiptData) return;
    
    const modal = document.getElementById('receiptModal');
    const preview = document.getElementById('receiptPreview');
    
    if (modal && preview) {
        // Generate receipt preview
        preview.innerHTML = generateReceiptHTML();
        
        // Setup button event listeners
        setupReceiptButtons();
        
        // Show modal
        modal.style.display = 'flex';
    }
}

// Close receipt modal
function closeReceiptModal() {
    const modal = document.getElementById('receiptModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentReceiptData = null;
}

// Generate receipt HTML for preview
function generateReceiptHTML() {
    if (!currentReceiptData) return '';
    
    const { saleId, timestamp, items, total, paymentType } = currentReceiptData;
    
    return `
        <div style="text-align: center; margin-bottom: 15px;">
            <h3 style="margin: 0; font-size: 16px;">${shopSettings.name}</h3>
            ${shopSettings.address ? `<p style="margin: 5px 0; font-size: 12px;">${shopSettings.address}</p>` : ''}
            ${shopSettings.phone ? `<p style="margin: 5px 0; font-size: 12px;">Ph: ${shopSettings.phone}</p>` : ''}
        </div>
        <div style="border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 10px 0; margin: 10px 0;">
            <p style="margin: 2px 0;"><strong>Receipt #:</strong> ${saleId}</p>
            <p style="margin: 2px 0;"><strong>Date:</strong> ${timestamp.toLocaleDateString()}</p>
            <p style="margin: 2px 0;"><strong>Time:</strong> ${timestamp.toLocaleTimeString()}</p>
        </div>
        <div style="margin: 15px 0;">
            <table style="width: 100%; font-size: 12px;">
                <thead>
                    <tr style="border-bottom: 1px solid #ccc;">
                        <th style="text-align: left; padding: 5px 0;">Item</th>
                        <th style="text-align: right; padding: 5px 0;">Qty</th>
                        <th style="text-align: right; padding: 5px 0;">Price</th>
                        <th style="text-align: right; padding: 5px 0;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td style="padding: 3px 0;">${item.name}</td>
                            <td style="text-align: right; padding: 3px 0;">${item.quantity}</td>
                            <td style="text-align: right; padding: 3px 0;">Rs ${item.price}</td>
                            <td style="text-align: right; padding: 3px 0;">Rs ${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div style="border-top: 1px solid #ccc; padding-top: 10px; margin-top: 15px;">
            <p style="margin: 5px 0; font-size: 14px; font-weight: bold; text-align: right;">
                <strong>Total: Rs ${total.toFixed(2)}</strong>
            </p>
            <p style="margin: 5px 0; font-size: 12px; text-align: right;">
                Payment: ${paymentType.toUpperCase()}
            </p>
        </div>
        <div style="text-align: center; margin-top: 15px; font-size: 12px; font-style: italic;">
            ${shopSettings.receiptFooter}
        </div>
    `;
}

// Setup receipt button event listeners
function setupReceiptButtons() {
    const downloadBtn = document.getElementById('downloadReceiptBtn');
    const shareBtn = document.getElementById('shareReceiptBtn');
    
    if (downloadBtn) {
        downloadBtn.onclick = downloadReceiptPDF;
    }
    
    if (shareBtn) {
        shareBtn.onclick = shareReceipt;
    }
}

// Download receipt as PDF
function downloadReceiptPDF() {
    if (!currentReceiptData) return;
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add receipt content to PDF
        addReceiptToPDF(doc);
        
        // Generate filename
        const filename = `Receipt_${currentReceiptData.saleId}.pdf`;
        
        // Download PDF
        doc.save(filename);
        
        showToast('📥 Receipt downloaded successfully!');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('❌ Failed to generate PDF. Please try again.');
    }
}

// Add receipt content to PDF
function addReceiptToPDF(doc) {
    const { saleId, timestamp, items, total, paymentType } = currentReceiptData;
    
    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(shopSettings.name, pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    if (shopSettings.address) {
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(shopSettings.address, pageWidth / 2, y, { align: 'center' });
        y += 7;
    }
    
    if (shopSettings.phone) {
        doc.setFontSize(10);
        doc.text(`Ph: ${shopSettings.phone}`, pageWidth / 2, y, { align: 'center' });
        y += 10;
    }
    
    // Line separator
    doc.line(10, y, pageWidth - 10, y);
    y += 10;
    
    // Receipt details
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`Receipt #: ${saleId}`, 10, y);
    y += 7;
    doc.text(`Date: ${timestamp.toLocaleDateString()}`, 10, y);
    y += 7;
    doc.text(`Time: ${timestamp.toLocaleTimeString()}`, 10, y);
    y += 10;
    
    // Line separator
    doc.line(10, y, pageWidth - 10, y);
    y += 10;
    
    // Items header
    doc.setFont(undefined, 'bold');
    doc.text('Item', 10, y);
    doc.text('Qty', pageWidth - 80, y, { align: 'right' });
    doc.text('Price', pageWidth - 50, y, { align: 'right' });
    doc.text('Total', pageWidth - 10, y, { align: 'right' });
    y += 7;
    
    // Line separator
    doc.line(10, y, pageWidth - 10, y);
    y += 5;
    
    // Items
    doc.setFont(undefined, 'normal');
    items.forEach(item => {
        y += 7;
        doc.text(item.name, 10, y);
        doc.text(item.quantity.toString(), pageWidth - 80, y, { align: 'right' });
        doc.text(`Rs ${item.price}`, pageWidth - 50, y, { align: 'right' });
        doc.text(`Rs ${(item.price * item.quantity).toFixed(2)}`, pageWidth - 10, y, { align: 'right' });
    });
    
    y += 10;
    
    // Line separator
    doc.line(10, y, pageWidth - 10, y);
    y += 10;
    
    // Total
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Total: Rs ${total.toFixed(2)}`, pageWidth - 10, y, { align: 'right' });
    y += 7;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Payment: ${paymentType.toUpperCase()}`, pageWidth - 10, y, { align: 'right' });
    y += 15;
    
    // Footer
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.text(shopSettings.receiptFooter, pageWidth / 2, y, { align: 'center' });
}

// Share receipt
async function shareReceipt() {
    if (!currentReceiptData) return;
    
    try {
        // Check if Web Share API is supported
        if (navigator.share) {
            // Generate PDF blob for sharing
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            addReceiptToPDF(doc);
            
            const pdfBlob = doc.output('blob');
            const file = new File([pdfBlob], `Receipt_${currentReceiptData.saleId}.pdf`, { type: 'application/pdf' });
            
            await navigator.share({
                title: 'Mini Vyapar Receipt',
                text: 'Here is your purchase receipt',
                files: [file]
            });
            
            showToast('📱 Receipt shared successfully!');
            
        } else {
            // Fallback for unsupported devices
            showToast('❌ Sharing not supported on this device. Please download the receipt instead.');
        }
        
    } catch (error) {
        console.error('Error sharing receipt:', error);
        if (error.name === 'AbortError') {
            // User cancelled sharing
            return;
        }
        showToast('❌ Failed to share receipt. Please try downloading instead.');
    }
}

// Update initialization to load settings
document.addEventListener('DOMContentLoaded', function() {
    // Load settings on app start
    loadShopSettings();
    
    // Add settings page navigation
    const fabOptions = document.querySelectorAll('.fab-option');
    fabOptions.forEach(option => {
        if (option.dataset.page === 'settings') {
            option.addEventListener('click', () => {
                showSettings();
                // Close FAB menu
                const fabMenu = document.getElementById('fabMenu');
                const fabMain = document.getElementById('fabMain');
                if (fabMenu && fabMain) {
                    fabMenu.classList.remove('active');
                    fabMain.classList.remove('active');
                }
            });
        }
    });
});

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('=== MAIN INITIALIZATION START ===');
        // Initialize storage first and wait for it
        await initializeApp();
        console.log('=== MAIN INITIALIZATION COMPLETE ===');
    } catch (error) {
        console.error('Error during app initialization:', error);
    }
});

// ALL TRANSACTIONS MODAL FUNCTIONALITY

let modalCurrentPeriod = 'today';
let modalCurrentType = 'all';

// Open transaction history modal
function openTransactionHistoryModal() {
  const modal = document.getElementById('transactionHistoryModal');
  if (modal) {
    modal.style.display = 'flex';
    calculateModalFinancialSummary();
    loadModalTransactionsList();
  }
}

// Close transaction history modal
function closeTransactionHistoryModal() {
  const modal = document.getElementById('transactionHistoryModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Calculate financial summary for modal
function calculateModalFinancialSummary() {
  let totalRevenue = 0;
  let totalExpenses = 0;
  let outstandingCredit = 0;
  
  try {
    // Calculate revenue from sales
    if (salesData && salesData.length > 0) {
      totalRevenue = salesData.reduce((sum, sale) => {
        return sum + (sale.total || 0);
      }, 0);
      
      // Calculate outstanding credit from sales (if paymentType is 'credit')
      outstandingCredit += salesData.filter(sale => sale.paymentType === 'credit')
        .reduce((sum, sale) => sum + (sale.total || 0), 0);
    }
    
    // Add credit data from creditsData array
    if (creditsData && creditsData.length > 0) {
      const activeCredits = creditsData.filter(credit => credit.status === 'active');
      outstandingCredit += activeCredits.reduce((sum, credit) => sum + (credit.amount || 0), 0);
    }
    
    // Calculate expenses
    if (expensesData && expensesData.length > 0) {
      totalExpenses = expensesData.reduce((sum, expense) => {
        return sum + (expense.amount || 0);
      }, 0);
    }
    
    // Calculate net profit (revenue - expenses - outstanding credit)
    const netProfit = totalRevenue - totalExpenses;
    
    // Update modal summary display
    const revenueEl = document.getElementById('modalTotalRevenue');
    const expensesEl = document.getElementById('modalTotalExpenses');
    const profitEl = document.getElementById('modalNetProfit');
    const creditEl = document.getElementById('modalOutstandingCredit');
    
    if (revenueEl) revenueEl.textContent = `Rs ${totalRevenue.toFixed(2)}`;
    if (expensesEl) expensesEl.textContent = `Rs ${totalExpenses.toFixed(2)}`;
    if (profitEl) profitEl.textContent = `Rs ${netProfit.toFixed(2)}`;
    if (creditEl) creditEl.textContent = `Rs ${outstandingCredit.toFixed(2)}`;
    
  } catch (error) {
    console.error('Error calculating modal financial summary:', error);
  }
}

// Filter modal transactions by period
function filterModalTransactionsByPeriod(period) {
  modalCurrentPeriod = period;
  
  // Update active period button
  document.querySelectorAll('.period-filter-modal .period-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.period === period) {
      btn.classList.add('active');
    }
  });
  
  loadModalTransactionsList();
}

// Filter modal transactions by type
function filterModalTransactionsByType(type) {
  modalCurrentType = type;
  
  // Update active tab button
  document.querySelectorAll('.transaction-tabs-modal .tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.type === type) {
      btn.classList.add('active');
    }
  });
  
  loadModalTransactionsList();
}

// Load and display transactions in modal
function loadModalTransactionsList() {
  const transactionsList = document.getElementById('modalTransactionsList');
  const noTransactions = document.getElementById('modalNoTransactions');
  
  if (!transactionsList || !noTransactions) return;
  
  let allTransactions = [];
  
  try {
    // Collect sales transactions
    if (salesData && salesData.length > 0) {
      const salesTransactions = salesData.map(sale => ({
        id: sale.id,
        type: 'sale',
        title: `Sale #${sale.id}`,
        amount: sale.total || 0,
        date: sale.timestamp || new Date().toISOString(),
        status: sale.paymentType === 'credit' ? 'credit' : 'paid',
        description: `${sale.items?.length || 0} items sold`
      }));
      allTransactions.push(...salesTransactions);
    }
    
    // Collect expense transactions
    if (expensesData && expensesData.length > 0) {
      const expenseTransactions = expensesData.map(expense => ({
        id: expense.id,
        type: 'expense',
        title: expense.description || 'Expense',
        amount: -(expense.amount || 0),
        date: expense.date || new Date().toISOString(),
        status: 'expense',
        description: expense.category || 'General'
      }));
      allTransactions.push(...expenseTransactions);
    }
    
    // Collect credit transactions from creditsData
    if (creditsData && creditsData.length > 0) {
      const creditTransactions = creditsData.map(credit => ({
        id: credit.id,
        type: 'credit',
        title: `Credit - ${credit.customerName}`,
        amount: credit.amount || 0,
        date: credit.date || new Date().toISOString(),
        status: credit.status || 'active',
        description: credit.phone ? `Phone: ${credit.phone}` : 'Credit transaction'
      }));
      allTransactions.push(...creditTransactions);
    }
    
    // Filter by period
    allTransactions = filterModalTransactionsByPeriodFilter(allTransactions);
    
    // Filter by type
    if (modalCurrentType !== 'all') {
      if (modalCurrentType === 'credit') {
        allTransactions = allTransactions.filter(t => t.type === 'credit' || t.status === 'credit');
      } else if (modalCurrentType === 'sales') {
        allTransactions = allTransactions.filter(t => t.type === 'sale');
      } else if (modalCurrentType === 'expenses') {
        allTransactions = allTransactions.filter(t => t.type === 'expense');
      } else {
        allTransactions = allTransactions.filter(t => t.type === modalCurrentType);
      }
    }
    
    // Sort by date (newest first)
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (allTransactions.length === 0) {
      transactionsList.style.display = 'none';
      noTransactions.style.display = 'flex';
      return;
    }
    
    // Render transactions
    transactionsList.style.display = 'block';
    noTransactions.style.display = 'none';
    
    transactionsList.innerHTML = allTransactions.map(transaction => {
      const date = new Date(transaction.date);
      const formattedDate = date.toLocaleDateString();
      const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const amountClass = transaction.amount > 0 ? 'positive' : 
                         transaction.amount < 0 ? 'negative' : 'neutral';
      
      const statusClass = transaction.status === 'paid' ? 'paid' :
                         transaction.status === 'credit' ? 'credit' :
                         transaction.status === 'refunded' ? 'refunded' : 'expense';
      
      const statusText = transaction.status === 'paid' ? 'Paid' :
                        transaction.status === 'credit' ? 'Credit' :
                        transaction.status === 'refunded' ? 'Refunded' : 'Expense';
      
      return `
        <div class="transaction-item ${transaction.type}" onclick="openModalTransactionDetails('${transaction.id}', '${transaction.type}')">
          <div class="transaction-header">
            <div class="transaction-info">
              <h4>${transaction.title}</h4>
              <div class="transaction-id">ID: ${transaction.id}</div>
            </div>
            <div class="transaction-amount ${amountClass}">
              ${transaction.amount >= 0 ? '+' : ''}Rs ${Math.abs(transaction.amount).toFixed(2)}
            </div>
          </div>
          <div class="transaction-details">
            <div class="transaction-datetime">
              ${formattedDate} • ${formattedTime}
            </div>
            <div class="transaction-status ${statusClass}">${statusText}</div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading modal transactions:', error);
    transactionsList.style.display = 'none';
    noTransactions.style.display = 'flex';
  }
}

// Filter modal transactions by period
function filterModalTransactionsByPeriodFilter(transactions) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (modalCurrentPeriod) {
    case 'today':
      return transactions.filter(t => {
        const transactionDate = new Date(t.date);
        const transactionDay = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate());
        return transactionDay.getTime() === today.getTime();
      });
      
    case 'week':
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return transactions.filter(t => new Date(t.date) >= weekAgo);
      
    case 'month':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return transactions.filter(t => new Date(t.date) >= monthStart);
      
    case 'all':
    default:
      return transactions;
  }
}

// Open modal transaction details
function openModalTransactionDetails(id, type) {
  console.log(`Opening modal transaction details for ${type} #${id}`);
  
  const modal = document.getElementById('transactionDetailsModal');
  const titleElement = document.getElementById('transactionDetailsTitle');
  const infoElement = document.getElementById('transactionDetailsInfo');
  
  if (!modal || !titleElement || !infoElement) {
    console.error('Transaction details modal elements not found');
    return;
  }
  
  let transaction = null;
  
  // Find the transaction based on type and id
  if (type === 'sale') {
    transaction = salesData?.find(sale => sale.id == id);
    if (transaction) {
      titleElement.textContent = `Sale #${id} Details`;
      infoElement.innerHTML = generateSaleDetailsHTML(transaction);
    }
  } else if (type === 'expense') {
    transaction = expensesData?.find(expense => expense.id == id);
    if (transaction) {
      titleElement.textContent = `Expense #${id} Details`;
      infoElement.innerHTML = generateExpenseDetailsHTML(transaction);
    }
  }
  
  if (transaction) {
    modal.style.display = 'flex';
  } else {
    console.error(`Transaction not found: ${type} #${id}`);
  }
}

// Close transaction details modal
function closeTransactionDetailsModal() {
  const modal = document.getElementById('transactionDetailsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Generate sale details HTML
function generateSaleDetailsHTML(sale) {
  const paymentTypeText = sale.paymentType === 'cash' ? 'Cash' : sale.paymentType === 'credit' ? 'Credit' : 'Digital';
  const date = new Date(sale.date);
  
  let itemsHtml = '';
  if (sale.items && sale.items.length > 0) {
    itemsHtml = `
      <div class="details-section">
        <h4>Items Sold</h4>
        <div class="items-list">
          ${sale.items.map(item => `
            <div class="item-row">
              <span class="item-name">${item.name}</span>
              <span class="item-details">${item.quantity} × Rs ${item.price} = Rs ${(item.quantity * item.price).toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  return `
    <div class="details-section">
      <h4>Sale Information</h4>
      <div class="detail-row">
        <span class="detail-label">Sale ID:</span>
        <span class="detail-value">#${sale.id}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Total Amount:</span>
        <span class="detail-value amount">Rs ${sale.total?.toFixed(2) || '0.00'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Payment Method:</span>
        <span class="detail-value">${paymentTypeText}</span>
      </div>
      ${sale.customerName ? `
        <div class="detail-row">
          <span class="detail-label">Customer:</span>
          <span class="detail-value">${sale.customerName}</span>
        </div>
      ` : ''}
      ${sale.notes ? `
        <div class="detail-row">
          <span class="detail-label">Notes:</span>
          <span class="detail-value">${sale.notes}</span>
        </div>
      ` : ''}
    </div>
    ${itemsHtml}
  `;
}

// Generate expense details HTML
function generateExpenseDetailsHTML(expense) {
  const date = new Date(expense.date);
  
  return `
    <div class="details-section">
      <h4>Expense Information</h4>
      <div class="detail-row">
        <span class="detail-label">Expense ID:</span>
        <span class="detail-value">#${expense.id}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Category:</span>
        <span class="detail-value">${expense.category || 'Other'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Description:</span>
        <span class="detail-value">${expense.description || 'No description'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Amount:</span>
        <span class="detail-value amount">Rs ${expense.amount?.toFixed(2) || '0.00'}</span>
      </div>
      ${expense.notes ? `
        <div class="detail-row">
          <span class="detail-label">Notes:</span>
          <span class="detail-value">${expense.notes}</span>
        </div>
      ` : ''}
    </div>
  `;
}

// Export modal transactions
function exportModalTransactions() {
  try {
    const transactions = getAllModalTransactionsForExport();
    if (transactions.length === 0) {
      showCustomNotification('No transactions to export', 'info', 'Export Info');
      return;
    }
    
    const csvContent = generateTransactionsCSV(transactions);
    downloadCSV(csvContent, 'transactions.csv');
    showSaleToast('Transactions exported successfully');
  } catch (error) {
    console.error('Error exporting modal transactions:', error);
    showSaleToast('Error exporting transactions');
  }
}

// Get all modal transactions for export
function getAllModalTransactionsForExport() {
  let allTransactions = [];
  
  // Add sales
  if (salesData && salesData.length > 0) {
    salesData.forEach(sale => {
      allTransactions.push({
        id: sale.id,
        type: 'Sale',
        description: `Sale #${sale.id}`,
        amount: sale.total || 0,
        date: sale.timestamp || new Date().toISOString(),
        status: sale.paymentType === 'credit' ? 'credit' : 'paid'
      });
    });
  }
  
  // Add expenses
  if (expensesData && expensesData.length > 0) {
    expensesData.forEach(expense => {
      allTransactions.push({
        id: expense.id,
        type: 'Expense',
        description: expense.description || 'Expense',
        amount: -(expense.amount || 0),
        date: expense.date || new Date().toISOString(),
        status: 'expense'
      });
    });
  }
  
  return allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Open advanced filter (placeholder)
function openAdvancedFilter() {
  console.log('Opening advanced filter');
  showSaleToast('Advanced filter coming soon!');
}

// Generate CSV content
function generateTransactionsCSV(transactions) {
  const headers = ['Date', 'Type', 'Description', 'Amount', 'Status', 'Transaction ID'];
  const rows = transactions.map(t => [
    new Date(t.date).toLocaleDateString(),
    t.type,
    t.description,
    t.amount.toFixed(2),
    t.status,
    t.id
  ]);
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');
    
  return csvContent;
}

// Download CSV file
function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Dashboard Dropdown Toggle Function
function toggleDashboard() {
  const dashboardCards = document.getElementById('dashboardCards');
  const toggleIcon = document.getElementById('dashboardToggleIcon');
  
  if (dashboardCards && toggleIcon) {
    dashboardCards.classList.toggle('collapsed');
    toggleIcon.classList.toggle('rotated');
    
    // Update icon
    if (dashboardCards.classList.contains('collapsed')) {
      toggleIcon.textContent = '▶';
    } else {
      toggleIcon.textContent = '▼';
    }
  }
}

// Initialize Dashboard State - starts collapsed
function initializeDashboardState() {
  const dashboardCards = document.getElementById('dashboardCards');
  const toggleIcon = document.getElementById('dashboardToggleIcon');
  
  if (dashboardCards && toggleIcon) {
    // Start in collapsed state
    dashboardCards.classList.add('collapsed');
    toggleIcon.classList.add('rotated');
    toggleIcon.textContent = '▶';
  }
}

// Safe Reset Functions with Multiple Confirmations
function showResetConfirmation() {
  const modal = document.getElementById('resetConfirmationModal');
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const deleteInput = document.getElementById('deleteConfirmInput');
  const finalBtn = document.getElementById('finalResetBtn');
  
  if (modal) {
    // Reset modal state
    step1.style.display = 'block';
    step2.style.display = 'none';
    deleteInput.value = '';
    finalBtn.disabled = true;
    
    modal.style.display = 'block';
    setTimeout(() => deleteInput.focus(), 300);
    
    // Add input event listener for DELETE confirmation
    deleteInput.oninput = function() {
      const inputValue = this.value.toUpperCase();
      if (inputValue === 'DELETE') {
        step1.style.display = 'none';
        step2.style.display = 'block';
        finalBtn.disabled = false;
      } else {
        step2.style.display = 'none';
        step1.style.display = 'block';
        finalBtn.disabled = true;
      }
    };
  }
}

function closeResetConfirmation() {
  const modal = document.getElementById('resetConfirmationModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function proceedWithReset() {
  // Use custom confirmation dialogs instead of browser alerts
  showCustomConfirm(
    "This is your LAST CHANCE to cancel!\n\nClicking 'Proceed' will PERMANENTLY DELETE all your business data including:\n• Sales, inventory, expenses, credits\n• Customer information\n• All transaction history\n\nThis action CANNOT be undone!\n\nAre you absolutely certain you want to proceed?",
    "🚨 FINAL WARNING 🚨",
    "🚨",
    "Proceed",
    "Cancel",
    true
  ).then(finalConfirm => {
    if (finalConfirm) {
      // Second confirmation
      showCustomConfirm(
        "You clicked Proceed to delete everything.\n\nAre you REALLY sure?\n\nClick 'Yes, Delete' only if you are 100% certain you want to delete all data.",
        "⚠️ SECOND CONFIRMATION REQUIRED ⚠️",
        "⚠️",
        "Yes, Delete",
        "Keep Data",
        true
      ).then(doubleConfirm => {
        if (doubleConfirm) {
          // Third and final confirmation
          showCustomConfirm(
            "This is it! No going back after this!\n\nClick 'DELETE EVERYTHING' to permanently erase all data\nClick 'Keep Safe' to preserve your data",
            "🔥 LAST CONFIRMATION 🔥",
            "🔥",
            "DELETE EVERYTHING",
            "Keep Safe",
            true
          ).then(tripleConfirm => {
            if (tripleConfirm) {
              executeDataReset();
            } else {
              showCustomNotification('Reset cancelled. Your data is safe!', 'success', 'Data Protected');
              closeResetConfirmation();
            }
          });
        } else {
          showCustomNotification('Reset cancelled. Your data is safe!', 'success', 'Data Protected');
          closeResetConfirmation();
        }
      });
    } else {
      showCustomNotification('Reset cancelled. Your data is safe!', 'success', 'Data Protected');
      closeResetConfirmation();
    }
  });
}

function executeDataReset() {
  try {
    closeResetConfirmation();
    showCustomNotification('Resetting all data...', 'info', 'Data Reset');
    
    // Call the original reset function
    resetAllData();
    
    showCustomNotification('All data has been reset successfully!', 'success', 'Reset Complete');
  } catch (error) {
    console.error('Error during reset:', error);
    showCustomNotification('Error occurred during reset. Please try again.', 'error', 'Reset Failed');
  }
}

// Custom Notification System for PWA
function showCustomNotification(message, type = 'info', title = '') {
  const container = document.getElementById('notificationContainer');
  if (!container) return;

  // Remove any existing notifications first to prevent stacking
  const existingNotifications = container.querySelectorAll('.custom-notification');
  existingNotifications.forEach(notification => {
    notification.classList.add('hide');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 200);
  });

  // Create new notification element
  const notification = document.createElement('div');
  notification.className = `custom-notification ${type}`;
  
  // Get appropriate icon for type
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const icon = icons[type] || icons.info;
  const notificationTitle = title || type.charAt(0).toUpperCase() + type.slice(1);

  notification.innerHTML = `
    <div class="notification-icon">${icon}</div>
    <div class="notification-content">
      <div class="notification-title">${notificationTitle}</div>
      <div class="notification-message">${message}</div>
    </div>
    <button class="notification-close" onclick="removeNotification(this)">&times;</button>
    <div class="notification-progress"></div>
  `;

  // Add to container with slight delay to ensure previous notifications are being removed
  setTimeout(() => {
    container.appendChild(notification);
    
    // Show with animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
  }, 250);

  // Auto remove after 3 seconds (shorter duration for faster replacement)
  setTimeout(() => {
    removeNotification(notification.querySelector('.notification-close'));
  }, 3000);

  return notification;
}

function removeNotification(closeBtn) {
  const notification = closeBtn.closest('.custom-notification');
  if (notification) {
    notification.classList.add('hide');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }
}

// Custom Confirmation Dialog
function showCustomConfirm(message, title = 'Confirm Action', icon = '⚠️', confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false) {
  return new Promise((resolve) => {
    const modal = document.getElementById('customConfirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const iconEl = document.getElementById('confirmIcon');
    const confirmBtn = document.getElementById('confirmConfirmBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    if (!modal || !titleEl || !messageEl || !iconEl || !confirmBtn || !cancelBtn) {
      // Fallback to browser confirm if elements not found
      resolve(confirm(message));
      return;
    }

    // Set content
    titleEl.textContent = title;
    messageEl.textContent = message;
    iconEl.textContent = icon;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    // Set button style
    confirmBtn.className = isDanger ? 'confirm-btn confirm danger' : 'confirm-btn confirm';

    // Show modal
    modal.style.display = 'flex';

    // Handle responses
    const handleConfirm = () => {
      modal.style.display = 'none';
      resolve(true);
      cleanup();
    };

    const handleCancel = () => {
      modal.style.display = 'none';
      resolve(false);
      cleanup();
    };

    const handleOverlayClick = (e) => {
      if (e.target.classList.contains('confirm-overlay')) {
        handleCancel();
      }
    };

    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
      modal.removeEventListener('click', handleOverlayClick);
    };

    // Add event listeners
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    modal.addEventListener('click', handleOverlayClick);
  });
}

// Legacy compatibility - replace showToast calls with custom notifications
function showToast(message, type = 'info') {
  showCustomNotification(message, type);
}

// Legacy compatibility - replace showSaleToast calls with custom notifications  
function showSaleToast(message, type = 'info') {
  showCustomNotification(message, type);
}

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