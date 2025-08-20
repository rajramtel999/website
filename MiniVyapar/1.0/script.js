// DOM Elements
const appContent = document.getElementById('appContent');
const navButtons = document.querySelectorAll('.nav-btn');
const mainFab = document.getElementById('mainFab');
const addProductFab = document.getElementById('addProductFab');
const newSaleFab = document.getElementById('newSaleFab');
const productModal = document.getElementById('productModal');
const saleModal = document.getElementById('saleModal');
const productForm = document.getElementById('productForm');
const closeProductBtn = document.querySelector('#productModal .close-btn');
const closeSaleBtn = document.querySelector('#saleModal .close-btn');
const fabMenu = document.querySelector('.fab-menu');

// Sample Data
const dashboardData = {
    metrics: {
        sales: 1200,
        expenses: 500,
        inventory: 500
    },
    quickItems: [
        { name: "Wai Wai", icon: "fa-bowl-food" },
        { name: "Coke", icon: "fa-bottle" },
        { name: "Chocolate", icon: "fa-candy" },
        { name: "Biscuit", icon: "fa-cookie" }
    ],
    recentActivity: [
        { type: "sale", amount: 150, time: "2 hours ago" },
        { type: "sale", amount: 200, time: "4 hours ago" },
        { type: "expense", amount: 100, time: "6 hours ago" }
    ]
};

// Format currency
const formatCurrency = (amount) => {
    return 'Rs ' + amount.toFixed(2);
};

// Toggle FAB Menu
function toggleFabMenu() {
    fabMenu.classList.toggle('show');
    mainFab.style.transform = fabMenu.classList.contains('show') 
        ? 'rotate(45deg)' 
        : 'rotate(0deg)';
}

// Open Add Product Modal
function openAddProductModal() {
    productModal.style.display = 'block';
    toggleFabMenu();
}

// Open New Sale Modal
function openNewSaleModal() {
    saleModal.style.display = 'block';
    toggleFabMenu();
}

// Close Modal
function closeModal(modal) {
    modal.style.display = 'none';
}

// Add New Product
function addNewProduct(e) {
    e.preventDefault();
    
    const newProduct = {
        id: Date.now(),
        name: document.getElementById('productName').value,
        price: parseFloat(document.getElementById('productPrice').value),
        stock: parseInt(document.getElementById('productStock').value),
        category: document.getElementById('productCategory').value,
        image: document.getElementById('productImage').value || null
    };

    console.log('New Product Added:', newProduct);
    
    // Show success message
    const submitBtn = document.querySelector('.submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-check"></i> Product Added!';
    submitBtn.style.backgroundColor = 'var(--success)';
    
    setTimeout(() => {
        productForm.reset();
        closeModal(productModal);
        submitBtn.innerHTML = originalText;
        submitBtn.style.backgroundColor = 'var(--primary)';
    }, 1500);
}

// Load Dashboard
function loadDashboard() {
    const content = `
        <div class="dashboard-section">
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Today's Sales</div>
                    <div class="metric-value">${formatCurrency(dashboardData.metrics.sales)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Expenses</div>
                    <div class="metric-value expenses">${formatCurrency(dashboardData.metrics.expenses)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Items in Inventory</div>
                    <div class="metric-value inventory">${dashboardData.metrics.inventory}</div>
                </div>
            </div>
        </div>

        <div class="dashboard-section">
            <div class="section-title">
                <i class="fas fa-bolt"></i>
                Quick Item Bar
            </div>
            <div class="quick-items">
                ${dashboardData.quickItems.map(item => `
                    <div class="quick-item" title="${item.name}">
                        <i class="fas ${item.icon}"></i>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="dashboard-section">
            <div class="section-title">
                <i class="fas fa-clock-rotate-left"></i>
                Recent Activity
            </div>
            <div class="activity-grid">
                ${dashboardData.recentActivity.map(activity => `
                    <div class="activity-item">
                        <div style="text-align: center;">
                            <i class="fas ${activity.type === 'sale' ? 'fa-shopping-cart' : 'fa-money-bill-wave'}"></i>
                            <div style="font-size: 0.8rem; margin-top: 5px;">Rs ${activity.amount}</div>
                            <div style="font-size: 0.6rem; color: var(--text-light);">${activity.time}</div>
                        </div>
                    </div>
                `).join('')}
                <div class="activity-item empty">
                    <i class="fas fa-plus"></i>
                </div>
                <div class="activity-item empty">
                    <i class="fas fa-plus"></i>
                </div>
            </div>
        </div>

        <div class="new-sale-section">
            <button class="new-sale-btn" id="startNewSale">
                <i class="fas fa-plus"></i>
                Start New Sale
            </button>
        </div>
    `;
    
    appContent.innerHTML = content;
    
    // Add event listener to the dashboard sale button
    setTimeout(() => {
        const startSaleBtn = document.getElementById('startNewSale');
        if (startSaleBtn) {
            startSaleBtn.addEventListener('click', openNewSaleModal);
        }
    }, 100);
}

// Load other pages
function loadSalesPage() {
    appContent.innerHTML = `
        <div class="page">
            <h2 style="margin: 15px; font-size: 1.1rem; color: var(--text);">
                <i class="fas fa-shopping-cart"></i> Sales
            </h2>
            <div style="text-align: center; padding: 40px 20px; color: var(--text-light);">
                <i class="fas fa-cog fa-spin" style="font-size: 2rem; margin-bottom: 15px;"></i>
                <p>Sales functionality coming soon</p>
            </div>
        </div>
    `;
}

function loadInventoryPage() {
    appContent.innerHTML = `
        <div class="page">
            <h2 style="margin: 15px; font-size: 1.1rem; color: var(--text);">
                <i class="fas fa-boxes"></i> Inventory
            </h2>
            <div style="text-align: center; padding: 40px 20px; color: var(--text-light);">
                <i class="fas fa-cog fa-spin" style="font-size: 2rem; margin-bottom: 15px;"></i>
                <p>Inventory management coming soon</p>
            </div>
        </div>
    `;
}

function loadExpensesPage() {
    appContent.innerHTML = `
        <div class="page">
            <h2 style="margin: 15px; font-size: 1.1rem; color: var(--text);">
                <i class="fas fa-money-bill-wave"></i> Expenses
            </h2>
            <div style="text-align: center; padding: 40px 20px; color: var(--text-light);">
                <i class="fas fa-cog fa-spin" style="font-size: 2rem; margin-bottom: 15px;"></i>
                <p>Expense tracking coming soon</p>
            </div>
        </div>
    `;
}

function loadPage(page) {
    switch(page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'sales':
            loadSalesPage();
            break;
        case 'inventory':
            loadInventoryPage();
            break;
        case 'expenses':
            loadExpensesPage();
            break;
        default:
            loadDashboard();
    }
}

// Initialize App
function initApp() {
    loadDashboard();
    
    // Navigation
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const page = button.dataset.page;
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            loadPage(page);
        });
    });
    
    // FAB Events
    mainFab.addEventListener('click', toggleFabMenu);
    addProductFab.addEventListener('click', openAddProductModal);
    newSaleFab.addEventListener('click', openNewSaleModal);
    
    // Modal Close Events - FIXED
    if (closeProductBtn) {
        closeProductBtn.addEventListener('click', () => closeModal(productModal));
    }
    
    if (closeSaleBtn) {
        closeSaleBtn.addEventListener('click', () => closeModal(saleModal));
    }
    
    // Form submission
    productForm.addEventListener('submit', addNewProduct);
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === productModal) closeModal(productModal);
        if (e.target === saleModal) closeModal(saleModal);
    });
    
    // Close FAB menu when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.fab') && !e.target.closest('.fab-menu') && fabMenu.classList.contains('show')) {
            toggleFabMenu();
        }
    });
    
    // Prevent zooming
    document.addEventListener('touchmove', function(event) {
        if (event.scale !== 1) { event.preventDefault(); }
    }, { passive: false });
}

// Start the app
document.addEventListener('DOMContentLoaded', initApp);