// Sample Data
const appData = {
    home: {
        sales: 12540.75,
        expenses: 5840.20,
        inventory: 1243
    },
    sales: [
        { id: 1, product: "Laptop", amount: 1200, date: "2023-05-15" },
        { id: 2, product: "Phone", amount: 800, date: "2023-05-15" },
        { id: 3, product: "Tablet", amount: 450, date: "2023-05-14" }
    ],
    inventory: [
        { id: 1, product: "Laptop", quantity: 42, price: 1200 },
        { id: 2, product: "Phone", quantity: 87, price: 800 },
        { id: 3, product: "Tablet", quantity: 35, price: 450 }
    ],
    expenses: [
        { id: 1, category: "Rent", amount: 2000, date: "2023-05-01" },
        { id: 2, category: "Salaries", amount: 3000, date: "2023-05-05" },
        { id: 3, category: "Utilities", amount: 350, date: "2023-05-10" }
    ]
};

// DOM Elements
const appContent = document.getElementById('appContent');
const navButtons = document.querySelectorAll('.nav-btn');

// Format currency
const formatCurrency = (amount) => {
    return '$' + amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
};

// Load Page Content
function loadPage(page) {
    let content = '';
    
    switch(page) {
        case 'home':
            content = `
                <div class="page">
                    <div class="dashboard-card">
                        <div class="card-title">
                            <i class="fas fa-shopping-cart"></i>
                            Today's Total Sales
                        </div>
                        <div class="card-value">${formatCurrency(appData.home.sales)}</div>
                    </div>
                    
                    <div class="dashboard-card">
                        <div class="card-title">
                            <i class="fas fa-money-bill-wave"></i>
                            Today's Total Expenses
                        </div>
                        <div class="card-value">${formatCurrency(appData.home.expenses)}</div>
                    </div>
                    
                    <div class="dashboard-card">
                        <div class="card-title">
                            <i class="fas fa-boxes"></i>
                            Total Items in Inventory
                        </div>
                        <div class="card-value">${appData.home.inventory.toLocaleString()}</div>
                    </div>
                </div>
            `;
            break;
            
        case 'sales':
            content = `
                <div class="page">
                    <h2 style="margin-bottom: 16px; font-size: 1.1rem;">Recent Sales</h2>
                    ${appData.sales.map(sale => `
                        <div class="dashboard-card">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <strong>${sale.product}</strong>
                                <span>${formatCurrency(sale.amount)}</span>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-light);">${sale.date}</div>
                        </div>
                    `).join('')}
                </div>
            `;
            break;
            
        case 'inventory':
            content = `
                <div class="page">
                    <h2 style="margin-bottom: 16px; font-size: 1.1rem;">Inventory Summary</h2>
                    ${appData.inventory.map(item => `
                        <div class="dashboard-card">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <strong>${item.product}</strong>
                                <span>${item.quantity} units</span>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-light);">
                                ${formatCurrency(item.price)} each
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            break;
            
        case 'expenses':
            content = `
                <div class="page">
                    <h2 style="margin-bottom: 16px; font-size: 1.1rem;">Recent Expenses</h2>
                    ${appData.expenses.map(expense => `
                        <div class="dashboard-card">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <strong>${expense.category}</strong>
                                <span>${formatCurrency(expense.amount)}</span>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-light);">${expense.date}</div>
                        </div>
                    `).join('')}
                </div>
            `;
            break;
    }
    
    appContent.innerHTML = content;
}

// Initialize App
function initApp() {
    // Load home page by default
    loadPage('home');
    
    // Set up navigation
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const page = button.dataset.page;
            
            // Update active state
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Load page content
            loadPage(page);
        });
    });
    
    // Prevent zooming
    document.addEventListener('touchmove', function(event) {
        if (event.scale !== 1) { event.preventDefault(); }
    }, { passive: false });
    
    // Simulate data updates (in real app this would be API calls)
    setInterval(() => {
        // Randomly adjust values for demo purposes
        appData.home = {
            sales: appData.home.sales + (Math.random() * 200 - 100),
            expenses: appData.home.expenses + (Math.random() * 100 - 50),
            inventory: Math.max(0, appData.home.inventory + Math.floor(Math.random() * 10 - 5))
        };
        
        // Reload current page if it's home
        if (document.querySelector('.nav-btn.active').dataset.page === 'home') {
            loadPage('home');
        }
    }, 3000);
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);