/**
 * Mini Vyapar POS - Offline Storage Manager
 * Provides LocalStorage and IndexedDB functionality for offline-first PWA
 */

// ===========================================
// LocalStorage Helper Functions
// ===========================================

/**
 * Save a preference to localStorage
 * @param {string} key - The preference key
 * @param {any} value - The preference value
 */
function savePreference(key, value) {
    try {
        localStorage.setItem(`miniVyapar_${key}`, JSON.stringify(value));
        console.log(`Preference saved: ${key} = ${value}`);
    } catch (error) {
        console.error(`Error saving preference ${key}:`, error);
    }
}

/**
 * Get a preference from localStorage
 * @param {string} key - The preference key
 * @param {any} defaultValue - Default value if key doesn't exist
 * @returns {any} The preference value or default
 */
function getPreference(key, defaultValue = null) {
    try {
        const stored = localStorage.getItem(`miniVyapar_${key}`);
        return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
        console.error(`Error getting preference ${key}:`, error);
        return defaultValue;
    }
}

/**
 * Remove a preference from localStorage
 * @param {string} key - The preference key
 */
function removePreference(key) {
    try {
        localStorage.removeItem(`miniVyapar_${key}`);
        console.log(`Preference removed: ${key}`);
    } catch (error) {
        console.error(`Error removing preference ${key}:`, error);
    }
}

/**
 * Initialize default preferences
 */
function initializePreferences() {
    const defaults = {
        theme: 'light',
        lastPage: 'home',
        tutorialSeen: false,
        soundEnabled: true,
        autoBackup: true
    };

    Object.entries(defaults).forEach(([key, value]) => {
        if (getPreference(key) === null) {
            savePreference(key, value);
        }
    });
}

// ===========================================
// IndexedDB Database Manager
// ===========================================

class MiniVyaparDB {
    constructor() {
        this.dbName = 'MiniVyaparDB';
        this.version = 1;
        this.db = null;
    }

    /**
     * Initialize the IndexedDB database
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('IndexedDB upgrade needed, creating object stores...');

                // Create Products store
                if (!db.objectStoreNames.contains('products')) {
                    const productsStore = db.createObjectStore('products', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    productsStore.createIndex('name', 'name', { unique: false });
                    productsStore.createIndex('category', 'category', { unique: false });
                    console.log('Products store created');
                }

                // Create Sales store
                if (!db.objectStoreNames.contains('sales')) {
                    const salesStore = db.createObjectStore('sales', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    salesStore.createIndex('timestamp', 'timestamp', { unique: false });
                    salesStore.createIndex('paymentType', 'paymentType', { unique: false });
                    console.log('Sales store created');
                }

                // Create Expenses store
                if (!db.objectStoreNames.contains('expenses')) {
                    const expensesStore = db.createObjectStore('expenses', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    expensesStore.createIndex('date', 'date', { unique: false });
                    expensesStore.createIndex('type', 'type', { unique: false });
                    console.log('Expenses store created');
                }
            };
        });
    }

    /**
     * Generic function to perform database operations
     * @param {string} storeName - Name of the object store
     * @param {string} mode - Transaction mode ('readonly' or 'readwrite')
     * @param {function} operation - Function to execute on the store
     * @returns {Promise}
     */
    async performOperation(storeName, mode, operation) {
        if (!this.db) {
            throw new Error('Database not initialized. Call init() first.');
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], mode);
                const store = transaction.objectStore(storeName);
                
                transaction.oncomplete = () => {
                    console.log(`Transaction completed for ${storeName}`);
                };
                
                transaction.onerror = () => {
                    console.error(`Transaction error for ${storeName}:`, transaction.error);
                    reject(transaction.error);
                };

                const result = operation(store);
                
                if (result && result.onsuccess !== undefined) {
                    result.onsuccess = () => resolve(result.result);
                    result.onerror = () => reject(result.error);
                } else {
                    resolve(result);
                }
            } catch (error) {
                console.error(`Operation error for ${storeName}:`, error);
                reject(error);
            }
        });
    }

    // ===========================================
    // Products CRUD Operations
    // ===========================================

    /**
     * Add a new product
     * @param {Object} product - Product object
     * @returns {Promise<number>} Product ID
     */
    async addProduct(product) {
        const productData = {
            id: product.id || Date.now(),
            name: product.name,
            emoji: product.emoji || '📦',
            category: product.category || 'General',
            costPrice: product.costPrice || 0,
            sellingPrice: product.sellingPrice || product.price || 0,
            price: product.sellingPrice || product.price || 0, // Keep for backward compatibility
            stock: product.stock || 0,
            supplier: product.supplier || '',
            code: product.code || '',
            description: product.description || '',
            barcode: product.barcode || '',
            lowStockThreshold: product.lowStockThreshold || 10,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        return this.performOperation('products', 'readwrite', (store) => {
            return store.add(productData);
        });
    }

    /**
     * Get all products
     * @returns {Promise<Array>} Array of products
     */
    async getAllProducts() {
        return this.performOperation('products', 'readonly', (store) => {
            return store.getAll();
        });
    }

    /**
     * Get product by ID
     * @param {number} id - Product ID
     * @returns {Promise<Object>} Product object
     */
    async getProduct(id) {
        return this.performOperation('products', 'readonly', (store) => {
            return store.get(id);
        });
    }

    /**
     * Update a product
     * @param {Object} product - Product object with ID
     * @returns {Promise}
     */
    async updateProduct(product) {
        product.updatedAt = new Date();
        return this.performOperation('products', 'readwrite', (store) => {
            return store.put(product);
        });
    }

    /**
     * Delete a product
     * @param {number} id - Product ID
     * @returns {Promise}
     */
    async deleteProduct(id) {
        return this.performOperation('products', 'readwrite', (store) => {
            return store.delete(id);
        });
    }

    /**
     * Search products by name or category
     * @param {string} query - Search query
     * @returns {Promise<Array>} Matching products
     */
    async searchProducts(query) {
        const products = await this.getAllProducts();
        const searchTerm = query.toLowerCase();
        
        return products.filter(product => 
            product.name.toLowerCase().includes(searchTerm) ||
            product.category.toLowerCase().includes(searchTerm) ||
            (product.description && product.description.toLowerCase().includes(searchTerm))
        );
    }

    // ===========================================
    // Sales CRUD Operations
    // ===========================================

    /**
     * Add a new sale
     * @param {Object} sale - Sale object
     * @returns {Promise<number>} Sale ID
     */
    async addSale(sale) {
        const saleData = {
            timestamp: sale.timestamp || new Date(),
            items: sale.items || [],
            total: sale.total || 0,
            paymentType: sale.paymentType || 'cash',
            discount: sale.discount || 0,
            tax: sale.tax || 0,
            customerName: sale.customerName || '',
            notes: sale.notes || ''
        };

        return this.performOperation('sales', 'readwrite', (store) => {
            return store.add(saleData);
        });
    }

    /**
     * Get all sales
     * @returns {Promise<Array>} Array of sales
     */
    async getAllSales() {
        return this.performOperation('sales', 'readonly', (store) => {
            return store.getAll();
        });
    }

    /**
     * Get sales by date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>} Filtered sales
     */
    async getSalesByDateRange(startDate, endDate) {
        const sales = await this.getAllSales();
        return sales.filter(sale => {
            const saleDate = new Date(sale.timestamp);
            return saleDate >= startDate && saleDate <= endDate;
        });
    }

    /**
     * Get today's sales
     * @returns {Promise<Array>} Today's sales
     */
    async getTodaysSales() {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        
        return this.getSalesByDateRange(startOfDay, endOfDay);
    }

    // ===========================================
    // Expenses CRUD Operations
    // ===========================================

    /**
     * Add a new expense
     * @param {Object} expense - Expense object
     * @returns {Promise<number>} Expense ID
     */
    async addExpense(expense) {
        const expenseData = {
            date: expense.date || new Date(),
            type: expense.type || 'general',
            amount: expense.amount || 0,
            notes: expense.notes || '',
            category: expense.category || 'General',
            receipt: expense.receipt || '',
            vendor: expense.vendor || ''
        };

        return this.performOperation('expenses', 'readwrite', (store) => {
            return store.add(expenseData);
        });
    }

    /**
     * Get all expenses
     * @returns {Promise<Array>} Array of expenses
     */
    async getAllExpenses() {
        return this.performOperation('expenses', 'readonly', (store) => {
            return store.getAll();
        });
    }

    /**
     * Get expenses by date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>} Filtered expenses
     */
    async getExpensesByDateRange(startDate, endDate) {
        const expenses = await this.getAllExpenses();
        return expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate >= startDate && expenseDate <= endDate;
        });
    }

    // ===========================================
    // Cart Integration Methods
    // ===========================================

    /**
     * Process a sale and update inventory
     * @param {Array} cartItems - Array of cart items
     * @param {Object} saleDetails - Sale details
     * @returns {Promise<number>} Sale ID
     */
    async processSale(cartItems, saleDetails = {}) {
        try {
            // Calculate total
            const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // Create sale record
            const sale = {
                timestamp: new Date(),
                items: cartItems.map(item => ({
                    productId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    total: item.price * item.quantity
                })),
                total: total,
                paymentType: saleDetails.paymentType || 'cash',
                discount: saleDetails.discount || 0,
                tax: saleDetails.tax || 0,
                customerName: saleDetails.customerName || ''
            };

            // Add sale to database
            const saleId = await this.addSale(sale);

            // Update product stock
            for (const item of cartItems) {
                if (item.id) {
                    const product = await this.getProduct(item.id);
                    if (product) {
                        product.stock = Math.max(0, product.stock - item.quantity);
                        await this.updateProduct(product);
                    }
                }
            }

            console.log(`Sale processed successfully. Sale ID: ${saleId}`);
            return saleId;
        } catch (error) {
            console.error('Error processing sale:', error);
            throw error;
        }
    }

    /**
     * Save cart state
     * @param {Array} cartItems - Cart items
     */
    async saveCartState(cartItems) {
        savePreference('cartState', cartItems);
    }

    /**
     * Load cart state
     * @returns {Array} Cart items
     */
    loadCartState() {
        return getPreference('cartState', []);
    }

    /**
     * Clear cart state
     */
    clearCartState() {
        removePreference('cartState');
    }

    /**
     * Clear all stores in IndexedDB
     */
    async clearAllStores() {
        try {
            if (!this.db) {
                console.log('Database not available for clearing');
                return true;
            }

            // Get list of available stores
            const storeNames = Array.from(this.db.objectStoreNames);
            console.log('Available stores:', storeNames);
            
            if (storeNames.length === 0) {
                console.log('No stores to clear');
                return true;
            }

            const transaction = this.db.transaction(storeNames, 'readwrite');
            
            // Clear each available store
            const clearPromises = storeNames.map(storeName => {
                return new Promise((resolve, reject) => {
                    const store = transaction.objectStore(storeName);
                    const clearRequest = store.clear();
                    clearRequest.onsuccess = () => {
                        console.log(`Cleared store: ${storeName}`);
                        resolve();
                    };
                    clearRequest.onerror = () => {
                        console.error(`Error clearing store ${storeName}:`, clearRequest.error);
                        reject(clearRequest.error);
                    };
                });
            });
            
            await Promise.all(clearPromises);
            
            return new Promise((resolve, reject) => {
                transaction.oncomplete = () => {
                    console.log('All IndexedDB stores cleared successfully');
                    resolve(true);
                };
                transaction.onerror = () => {
                    console.error('Transaction failed:', transaction.error);
                    reject(transaction.error);
                };
            });
            
        } catch (error) {
            console.error('Error clearing IndexedDB stores:', error);
            return false;
        }
    }

    // ===========================================
    // Analytics and Reporting
    // ===========================================

    /**
     * Get sales analytics
     * @param {string} period - 'today', 'week', 'month'
     * @returns {Promise<Object>} Analytics data
     */
    async getSalesAnalytics(period = 'today') {
        try {
            let startDate, endDate;
            const now = new Date();

            switch (period) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    endDate = now;
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    break;
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            }

            const sales = await this.getSalesByDateRange(startDate, endDate);
            
            const analytics = {
                totalSales: sales.reduce((sum, sale) => sum + sale.total, 0),
                totalTransactions: sales.length,
                averageTransaction: sales.length > 0 ? sales.reduce((sum, sale) => sum + sale.total, 0) / sales.length : 0,
                topProducts: this.getTopProducts(sales),
                paymentMethods: this.getPaymentMethodStats(sales),
                hourlyBreakdown: this.getHourlyBreakdown(sales)
            };

            return analytics;
        } catch (error) {
            console.error('Error getting sales analytics:', error);
            throw error;
        }
    }

    /**
     * Get top selling products from sales data
     * @param {Array} sales - Sales array
     * @returns {Array} Top products
     */
    getTopProducts(sales) {
        const productStats = {};
        
        sales.forEach(sale => {
            sale.items.forEach(item => {
                if (!productStats[item.name]) {
                    productStats[item.name] = { name: item.name, quantity: 0, revenue: 0 };
                }
                productStats[item.name].quantity += item.quantity;
                productStats[item.name].revenue += item.total;
            });
        });

        return Object.values(productStats)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
    }

    /**
     * Get payment method statistics
     * @param {Array} sales - Sales array
     * @returns {Object} Payment method stats
     */
    getPaymentMethodStats(sales) {
        const stats = {};
        sales.forEach(sale => {
            const method = sale.paymentType || 'cash';
            if (!stats[method]) {
                stats[method] = { count: 0, total: 0 };
            }
            stats[method].count++;
            stats[method].total += sale.total;
        });
        return stats;
    }

    /**
     * Get hourly sales breakdown
     * @param {Array} sales - Sales array
     * @returns {Array} Hourly breakdown
     */
    getHourlyBreakdown(sales) {
        const hourly = new Array(24).fill(0);
        sales.forEach(sale => {
            const hour = new Date(sale.timestamp).getHours();
            hourly[hour] += sale.total;
        });
        return hourly;
    }
}

// ===========================================
// Initialize Storage System
// ===========================================

// Global database instance
let miniVyaparDB = null;

/**
 * Initialize the storage system
 * @returns {Promise<MiniVyaparDB>}
 */
async function initializeStorage() {
    try {
        console.log('Initializing Mini Vyapar storage system...');
        
        // Initialize preferences
        initializePreferences();
        
        // Initialize IndexedDB
        miniVyaparDB = new MiniVyaparDB();
        await miniVyaparDB.init();
        
        // Add a small delay to ensure database is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Seed initial data if needed - REMOVED FOR PRODUCTION
        // await seedInitialData();
        
        console.log('Storage system initialized successfully');
        return miniVyaparDB;
    } catch (error) {
        console.error('Error initializing storage system:', error);
        throw error;
    }
}

/**
 * Seed initial data for demo purposes
 */
async function seedInitialData() {
    try {
        // Check if database is properly initialized
        if (!miniVyaparDB || !miniVyaparDB.db) {
            console.error('Database not ready for seeding');
            return;
        }
        
        const products = await miniVyaparDB.getAllProducts();
        
        if (products.length === 0) {
            console.log('Seeding initial product data...');
            
            const initialProducts = [
                { name: 'Tea', category: 'Beverages', price: 10, stock: 100 },
                { name: 'Biscuit', category: 'Snacks', price: 15, stock: 50 },
                { name: 'Milk', category: 'Dairy', price: 25, stock: 30 },
                { name: 'Bread', category: 'Bakery', price: 20, stock: 40 },
                { name: 'Sugar', category: 'Groceries', price: 30, stock: 25 },
                { name: 'Rice', category: 'Groceries', price: 50, stock: 60 },
                { name: 'Oil', category: 'Groceries', price: 80, stock: 20 },
                { name: 'Soap', category: 'Personal Care', price: 35, stock: 45 }
            ];

            for (const product of initialProducts) {
                await miniVyaparDB.addProduct(product);
            }
            
            console.log('Initial product data seeded successfully');
        }
    } catch (error) {
        console.error('Error seeding initial data:', error);
    }
}

/**
 * Remove demo/sample products from the database
 */
async function removeDemoProducts() {
    try {
        // Check if database is properly initialized
        if (!miniVyaparDB || !miniVyaparDB.db) {
            console.error('Database not ready for demo product removal');
            return;
        }
        
        const demoProductNames = [
            'Tea', 'Biscuit', 'Milk', 'Bread', 'Sugar', 'Rice', 'Oil', 'Soap'
        ];
        
        const allProducts = await miniVyaparDB.getAllProducts();
        let removedCount = 0;
        
        for (const product of allProducts) {
            if (demoProductNames.includes(product.name)) {
                await miniVyaparDB.deleteProduct(product.id);
                removedCount++;
                console.log(`Removed demo product: ${product.name}`);
            }
        }
        
        if (removedCount > 0) {
            console.log(`Removed ${removedCount} demo products from database`);
        } else {
            console.log('No demo products found to remove');
        }
        
    } catch (error) {
        console.error('Error removing demo products:', error);
    }
}

/**
 * Export storage functions for use in other files
 */
window.MiniVyaparStorage = {
    // LocalStorage functions
    savePreference,
    getPreference,
    removePreference,
    initializePreferences,
    
    // Database functions
    initializeStorage,
    getDB: () => miniVyaparDB,
    
    // Quick access functions
    addProduct: (product) => miniVyaparDB?.addProduct(product),
    getAllProducts: () => miniVyaparDB?.getAllProducts(),
    updateProduct: (product) => miniVyaparDB?.updateProduct(product),
    deleteProduct: (id) => miniVyaparDB?.deleteProduct(id),
    
    addSale: (sale) => miniVyaparDB?.addSale(sale),
    getAllSales: () => miniVyaparDB?.getAllSales(),
    
    addExpense: (expense) => miniVyaparDB?.addExpense(expense),
    getAllExpenses: () => miniVyaparDB?.getAllExpenses(),
    
    processSale: (cartItems, details) => miniVyaparDB?.processSale(cartItems, details),
    getSalesAnalytics: (period) => miniVyaparDB?.getSalesAnalytics(period),
    
    saveCartState: (items) => miniVyaparDB?.saveCartState(items),
    loadCartState: () => miniVyaparDB?.loadCartState(),
    clearCartState: () => miniVyaparDB?.clearCartState(),
    
    // Demo data management
    removeDemoProducts: () => removeDemoProducts(),
    
    // Clear all data from both localStorage and IndexedDB
    clearAllData: async () => {
        try {
            console.log('Starting data clear process...');
            
            // Clear localStorage preferences
            const keys = Object.keys(localStorage);
            let clearedLocalStorage = 0;
            keys.forEach(key => {
                if (key.startsWith('miniVyapar_') || key.startsWith('vyapar_')) {
                    localStorage.removeItem(key);
                    clearedLocalStorage++;
                }
            });
            console.log(`Cleared ${clearedLocalStorage} localStorage items`);
            
            // Clear IndexedDB if available
            if (miniVyaparDB && miniVyaparDB.db) {
                console.log('Clearing IndexedDB...');
                const result = await miniVyaparDB.clearAllStores();
                if (result) {
                    console.log('IndexedDB cleared successfully');
                } else {
                    console.log('IndexedDB clearing had issues but continuing...');
                }
            } else {
                console.log('IndexedDB not available or not initialized');
            }
            
            console.log('All Mini Vyapar data cleared successfully');
            return true;
        } catch (error) {
            console.error('Error clearing all data:', error);
            // Don't fail completely, still return true to continue with UI reset
            return true;
        }
    }
};

console.log('Mini Vyapar Storage System loaded successfully');
