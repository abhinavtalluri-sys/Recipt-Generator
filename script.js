// Configuration - YOUR ACTUAL APPS SCRIPT URL
const APPS_SCRIPT_URL = 'https://script.google.com/a/macros/batterypool.com/s/AKfycbx8DcIfLuuwPUxGhHE29qqzEsXt-vRc4oFFrQMnOXoMvNTWpBzEvB4GeDRhssqSLSJajA/exec';

// State
let customers = [];
let filteredCustomers = [];
let selectedCustomer = null;
let currentUser = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadInitialData();
});

// Load data
async function loadInitialData() {
    try {
        showOverlay(true);
        
        // Get user and customers
        const [userRes, custRes] = await Promise.all([
            fetch(`${APPS_SCRIPT_URL}?action=getUser`),
            fetch(`${APPS_SCRIPT_URL}?action=getCustomers`)
        ]);
        
        const userData = await userRes.json();
        const custData = await custRes.json();
        
        currentUser = userData.email;
        customers = custData.customers || [];
        filteredCustomers = customers;
        
        renderForm();
        
    } catch (error) {
        showToast('Error: ' + error.message);
        renderForm();
    } finally {
        showOverlay(false);
    }
}

// Render form
function renderForm() {
    document.getElementById('app').innerHTML = `
        <div class="wrap">
            <div class="card">
                <h1>Receipt Generator ${currentUser ? `<div style="font-size:12px">👤 ${currentUser}</div>` : ''}</h1>
                
                <form id="receiptForm">
                    <label>Receipt Type</label>
                    <div class="radio-group">
                        <label><input type="radio" name="type" value="rental" checked> 🚗 Rental</label>
                        <label><input type="radio" name="type" value="cashsale"> 💵 Cash Sale</label>
                    </div>

                    <!-- Rental Fields -->
                    <div id="rentalFields">
                        <label>Select Customer</label>
                        <div class="searchable-dropdown" id="customerDropdown">
                            <div class="dropdown-display">
                                <span id="selectedCustomer">${customers.length ? '-- Select --' : 'No customers'}</span>
                            </div>
                            <div class="dropdown-content" id="customerDropdownContent">
                                <input type="text" class="dropdown-search" id="customerSearch" placeholder="Search...">
                                <div class="dropdown-options" id="customerOptions"></div>
                            </div>
                        </div>
                        <div id="customerPreview" class="small"></div>
                        <label>Contact</label>
                        <input id="contactNumber" readonly>
                    </div>

                    <!-- Cash Sale Fields -->
                    <div id="cashSaleFields" style="display:none">
                        <label>Driver Name *</label>
                        <input type="text" id="driverName" placeholder="Enter name">
                        <label>Driver Phone *</label>
                        <input type="tel" id="driverPhone" placeholder="Enter phone">
                    </div>

                    <label>Amount (₹) *</label>
                    <input id="amount" type="number" min="0" step="0.01" required>

                    <label>Notes</label>
                    <textarea id="notes" placeholder="Optional"></textarea>

                    <button id="generateBtn" type="submit">Generate Receipt</button>
                </form>
            </div>
        </div>
    `;

    setupEventListeners();
    populateDropdown();
}

// Setup listeners
function setupEventListeners() {
    // Type toggle
    document.querySelectorAll('input[name="type"]').forEach(r => {
        r.addEventListener('change', toggleFields);
    });
    
    // Dropdown
    setupDropdown();
    
    // Submit
    document.getElementById('receiptForm').addEventListener('submit', handleSubmit);
}

// Toggle fields
function toggleFields() {
    const type = document.querySelector('input[name="type"]:checked').value;
    document.getElementById('rentalFields').style.display = type === 'rental' ? 'block' : 'none';
    document.getElementById('cashSaleFields').style.display = type === 'cashsale' ? 'block' : 'none';
}

// Setup dropdown
function setupDropdown() {
    const dd = document.getElementById('customerDropdown');
    const content = document.getElementById('customerDropdownContent');
    const search = document.getElementById('customerSearch');
    
    dd.querySelector('.dropdown-display').addEventListener('click', (e) => {
        e.stopPropagation();
        content.style.display = content.style.display === 'block' ? 'none' : 'block';
        if (content.style.display === 'block') search?.focus();
    });
    
    if (search) {
        search.addEventListener('input', (e) => filterCustomers(e.target.value));
    }
    
    document.addEventListener('click', (e) => {
        if (!dd.contains(e.target)) content.style.display = 'none';
    });
}

// Populate dropdown
function populateDropdown() {
    const container = document.getElementById('customerOptions');
    if (!container) return;
    
    if (!customers.length) {
        container.innerHTML = '<div class="no-results">No customers</div>';
        return;
    }
    
    renderCustomerOptions();
}

// Filter customers
function filterCustomers(term) {
    const t = term.toLowerCase();
    filteredCustomers = customers.filter(c => 
        c.id.toLowerCase().includes(t) || c.name.toLowerCase().includes(t)
    );
    renderCustomerOptions();
}

// Render options
function renderCustomerOptions() {
    const container = document.getElementById('customerOptions');
    const list = filteredCustomers.length ? filteredCustomers : customers;
    
    container.innerHTML = '';
    
    if (!list.length) {
        container.innerHTML = '<div class="no-results">No matches</div>';
        return;
    }
    
    list.forEach(c => {
        const opt = document.createElement('div');
        opt.className = 'dropdown-option';
        opt.textContent = `${c.id} - ${c.name}`;
        opt.onclick = () => selectCustomer(c);
        container.appendChild(opt);
    });
}

// Select customer
function selectCustomer(c) {
    selectedCustomer = c;
    document.getElementById('selectedCustomer').textContent = `${c.id} - ${c.name}`;
    document.getElementById('customerPreview').textContent = `📋 ${c.name} | 📞 ${c.contact}`;
    document.getElementById('contactNumber').value = c.contact;
    document.getElementById('customerDropdownContent').style.display = 'none';
}

// Handle submit
async function handleSubmit(e) {
    e.preventDefault();
    
    const btn = document.getElementById('generateBtn');
    const type = document.querySelector('input[name="type"]:checked').value;
    const amount = document.getElementById('amount').value;
    
    if (!amount || amount <= 0) {
        showToast('Enter valid amount');
        return;
    }
    
    // Prepare data
    const data = {
        receiptType: type,
        amount: amount,
        notes: document.getElementById('notes').value || '',
        generatedBy: currentUser
    };
    
    if (type === 'rental') {
        if (!selectedCustomer) {
            showToast('Select a customer');
            return;
        }
        data.customerId = selectedCustomer.id;
        data.customerName = selectedCustomer.name;
        data.contactNumber = selectedCustomer.contact;
    } else {
        const name = document.getElementById('driverName').value;
        const phone = document.getElementById('driverPhone').value;
        
        if (!name || !phone) {
            showToast('Enter name and phone');
            return;
        }
        
        data.driverName = name;
        data.driverPhone = phone;
    }
    
    // Submit
    btn.disabled = true;
    btn.textContent = 'Generating...';
    showOverlay(true);
    
    try {
        // FIXED: Using text/plain to avoid CORS
        const res = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (result.success) {
            window.location.href = `${APPS_SCRIPT_URL}?page=receipt&receiptUrl=${encodeURIComponent(result.pdfUrl)}&receiptId=${result.receiptId}`;
        } else {
            showToast('Error: ' + result.error);
        }
    } catch (err) {
        showToast('Failed: ' + err.message);
    } finally {
        showOverlay(false);
        btn.disabled = false;
        btn.textContent = 'Generate Receipt';
    }
}

// UI helpers
function showOverlay(show) { 
    document.getElementById('overlay').style.display = show ? 'flex' : 'none'; 
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}
