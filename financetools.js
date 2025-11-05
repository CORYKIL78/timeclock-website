// Finance Tools - Product Sales Tracker with Payhip Integration
const BACKEND_URL = 'https://timeclock-backend.marcusray.workers.dev';
const ROBUX_TAX_RATE = 0.30; // 30% marketplace tax

let products = [];
let editingProductId = null;

// Load products from backend on page load
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());
    document.getElementById('cancelBtn').addEventListener('click', () => closeProductModal());
    document.getElementById('productForm').addEventListener('submit', handleProductSubmit);
    document.getElementById('syncBtn').addEventListener('click', syncProductsFromPayhip);
}

async function loadProducts() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/finance/products`);
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                products = result.products || [];
                renderProducts();
                updateStats();
            }
        }
    } catch (error) {
        console.error('Error loading products:', error);
        // Load from localStorage as fallback
        products = JSON.parse(localStorage.getItem('finance_products') || '[]');
        renderProducts();
        updateStats();
    }
}

function renderProducts() {
    const container = document.getElementById('productsTableContainer');
    
    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <h3>No Products Yet</h3>
                <p>Add your first product or sync from Payhip to get started</p>
            </div>
        `;
        return;
    }

    const table = `
        <table class="products-table">
            <thead>
                <tr>
                    <th>Product Name</th>
                    <th>Price (R$)</th>
                    <th>Quantity Sold</th>
                    <th>Gross Revenue</th>
                    <th>Net Revenue (After Tax)</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${products.map(product => `
                    <tr>
                        <td class="product-name">${product.name}</td>
                        <td class="product-price">R$ ${product.price.toLocaleString()}</td>
                        <td>
                            <input 
                                type="number" 
                                class="quantity-input" 
                                value="${product.quantity || 0}" 
                                min="0"
                                data-product-id="${product.id}"
                                onchange="updateQuantity('${product.id}', this.value)"
                            >
                        </td>
                        <td>R$ ${(product.price * (product.quantity || 0)).toLocaleString()}</td>
                        <td class="revenue-cell">R$ ${calculateNetRevenue(product.price, product.quantity || 0).toLocaleString()}</td>
                        <td>
                            <div class="actions-cell">
                                <button class="btn btn-sm btn-primary" onclick="editProduct('${product.id}')">Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.id}')">Delete</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = table;
}

function calculateNetRevenue(price, quantity) {
    const gross = price * quantity;
    return Math.floor(gross * (1 - ROBUX_TAX_RATE));
}

function updateStats() {
    const totalProducts = products.length;
    const totalSales = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const grossRevenue = products.reduce((sum, p) => sum + (p.price * (p.quantity || 0)), 0);
    const netRevenue = products.reduce((sum, p) => sum + calculateNetRevenue(p.price, p.quantity || 0), 0);

    document.getElementById('totalProducts').textContent = totalProducts;
    document.getElementById('totalSales').textContent = totalSales.toLocaleString();
    document.getElementById('grossRevenue').textContent = grossRevenue.toLocaleString();
    document.getElementById('netRevenue').textContent = netRevenue.toLocaleString();
}

function updateQuantity(productId, quantity) {
    const product = products.find(p => p.id === productId);
    if (product) {
        product.quantity = parseInt(quantity) || 0;
        saveProducts();
        renderProducts();
        updateStats();
    }
}

function openProductModal(product = null) {
    editingProductId = product ? product.id : null;
    
    document.getElementById('modalTitle').textContent = product ? 'Edit Product' : 'Add New Product';
    document.getElementById('productName').value = product ? product.name : '';
    document.getElementById('productPrice').value = product ? product.price : '';
    document.getElementById('productPayhipId').value = product ? (product.payhipId || '') : '';
    document.getElementById('productDescription').value = product ? (product.description || '') : '';
    
    document.getElementById('productModal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    document.getElementById('productForm').reset();
    editingProductId = null;
}

async function handleProductSubmit(e) {
    e.preventDefault();
    
    const productData = {
        id: editingProductId || generateId(),
        name: document.getElementById('productName').value,
        price: parseInt(document.getElementById('productPrice').value),
        payhipId: document.getElementById('productPayhipId').value,
        description: document.getElementById('productDescription').value,
        quantity: 0,
        createdAt: new Date().toISOString()
    };

    if (editingProductId) {
        // Update existing product
        const index = products.findIndex(p => p.id === editingProductId);
        if (index !== -1) {
            productData.quantity = products[index].quantity; // Preserve quantity
            products[index] = productData;
        }
    } else {
        // Add new product
        products.push(productData);
    }

    await saveProducts();
    renderProducts();
    updateStats();
    closeProductModal();
}

function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        openProductModal(product);
    }
}

async function deleteProduct(productId) {
    if (confirm('Are you sure you want to delete this product?')) {
        products = products.filter(p => p.id !== productId);
        await saveProducts();
        renderProducts();
        updateStats();
    }
}

async function saveProducts() {
    // Save to localStorage
    localStorage.setItem('finance_products', JSON.stringify(products));
    
    // Save to backend
    try {
        await fetch(`${BACKEND_URL}/api/finance/products/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products })
        });
    } catch (error) {
        console.error('Error saving to backend:', error);
    }
}

async function syncProductsFromPayhip() {
    const syncStatus = document.getElementById('syncStatus');
    const syncText = document.getElementById('syncText');
    
    syncStatus.classList.add('syncing');
    syncText.textContent = 'Syncing...';

    try {
        const response = await fetch(`${BACKEND_URL}/api/finance/sync-payhip`, {
            method: 'POST'
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                // Merge synced products with existing ones
                result.products.forEach(syncedProduct => {
                    const existingIndex = products.findIndex(p => 
                        p.payhipId === syncedProduct.payhipId || p.name === syncedProduct.name
                    );
                    
                    if (existingIndex !== -1) {
                        // Update existing product but preserve quantity
                        products[existingIndex] = {
                            ...syncedProduct,
                            quantity: products[existingIndex].quantity
                        };
                    } else {
                        // Add new product
                        products.push(syncedProduct);
                    }
                });

                await saveProducts();
                renderProducts();
                updateStats();

                syncStatus.classList.remove('syncing');
                syncStatus.classList.add('success');
                syncText.textContent = `Synced ${result.products.length} products`;
                
                setTimeout(() => {
                    syncStatus.classList.remove('success');
                    syncText.textContent = 'Ready';
                }, 3000);
            } else {
                throw new Error(result.error || 'Sync failed');
            }
        } else {
            throw new Error('Sync request failed');
        }
    } catch (error) {
        console.error('Error syncing from Payhip:', error);
        syncStatus.classList.remove('syncing');
        syncText.textContent = 'Sync failed';
        alert('Failed to sync from Payhip. Please check console for details.');
        
        setTimeout(() => {
            syncText.textContent = 'Ready';
        }, 3000);
    }
}

function generateId() {
    return 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Close modal when clicking outside
document.getElementById('productModal').addEventListener('click', (e) => {
    if (e.target.id === 'productModal') {
        closeProductModal();
    }
});
