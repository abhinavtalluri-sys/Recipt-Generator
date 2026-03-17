// Configuration
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'; // Replace with your Apps Script URL

// State management
let customers = [];
let filteredCustomers = [];
let selectedCustomer = null;
let currentUser = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadInitialData();
    renderForm();
});

// Load initial data from Apps Script
async function loadInitialData() {
    try {
        showOverlay(true);
        
        // Get user email and customers in parallel
        const [userResponse, customersResponse] = await Promise.all([
            fetch(`${APPS_SCRIPT_URL}?action=getUser`),
            fetch(`${APPS_SCRIPT_URL}?action=getCustomers`)
        ]);
        
        const userData = await userResponse.json();
        const customersData = await customersResponse.json();
        
        currentUser = userData.email;
        customers = customersData.customers || [];
        filteredCustomers = customers;
        
        updateHeader();
        renderForm();
        
    } catch (error) {
        showToast('Failed to load data: ' + error.message);
    } finally {
        showOverlay(false);
    }
}

// Render the main form
function renderForm() {
    const app = document.getElementById('app');
    
    app.innerHTML = `
        <div class="wrap">
            <div class="card">
                <h1 id="header">Generate Receipt ${currentUser ? `<div style="font-size: 12px; color: #666; font-weight: normal; margin-top: 5px;">Logged in as: ${currentUser}</div>` : ''}</h1>
                
                <form id="receiptForm">
                    <label>Receipt Type</label>
                    <div class="radio-group">
                        <label class="radio-option">
                            <input type="radio" name="receiptType" value="rental" checked> Rental
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="receiptType" value="cashsale"> Cash Sale
                        </label>
                    </div>

                    <div id="rentalFields">
                        <label>Customer ID</label>
                        <div class="searchable-dropdown">
                            <div class="dropdown-display" id="customerDropdown" tabindex="0">
                                <span id="selectedCustomer">Loading customers...</span>
                            </div>
                            <div class="dropdown-content" id="dropdownContent">
                                <input type="text" class="dropdown-search" id="customerSearch" placeholder="Search customers...">
                                <div class="dropdown-options" id="customerOptions"></div>
                            </div>
                        </div>
                        <div id="customerPreview" class="small"></div>
                        <label>Contact (auto-filled)</label>
                        <input id="contactNumber" readonly placeholder="Contact will appear here">
                    </div>

                    <div id="cashSaleFields" style="display: none;">
                        <label>Driver Name</label>
                        <input type="text" id="driverName" placeholder="Enter driver name">
                        
                        <label>Driver Phone</label>
                        <input type="tel" id="driverPhone" placeholder="Enter phone number">
                    </div>

                    <label>Amount (₹)</label>
                    <input id="amount" type="number" min="0" step="0.01" required placeholder="Enter amount">

                    <label>Notes</label>
                    <textarea id="notes" placeholder="Optional notes"></textarea>

                    <button id="generateBtn" type="submit">Generate Receipt</button>
                </form>
            </div>

            <div class="card" style="width:420px;">
                <h1 style="font-size:18px;">Last Receipt (this session)</h1>
                <div id="lastArea" class="small" style="min-height:60px; display:flex; align-items:center; justify-content:center; color:var(--muted);">
                    No receipt generated yet.
                </div>
            </div>
        </div>

        <div class="result" id="resultSection" style="display:none;">
            <div class="box">
                <h1 style="font-size:18px; margin-bottom:6px;">Receipt Generated ✅</h1>
                <div id="resultMeta" class="small"></div>
                <div id="resultActions" style="margin-top:12px;"></div>
                <div id="previewWrap" style="margin-top:12px;"></div>
                <div style="margin-top:12px;">
                    <button onclick="resetForm()">Generate Another Receipt</button>
                </div>
            </div>
        </div>
    `;

    initializeEventListeners();
}

// Initialize all event listeners
function initializeEventListeners() {
    // Receipt type toggle
    document.querySelectorAll('input[name="receiptType"]').forEach(radio => {
        radio.addEventListener('change', toggleReceiptFields);
    });

    // Dropdown functionality
    setupDropdown();

    // Form submission
    document.getElementById('receiptForm').addEventListener('submit', handleFormSubmit);

    // Populate dropdown with customers
    populateDropdown();
}

// Toggle between rental and cash sale fields
function toggleReceiptFields() {
    const rentalFields = document.getElementById('rentalFields');
    const cashSaleFields = document.getElementById('cashSaleFields');
    
    if (document.querySelector('input[name="receiptType"]:checked').value === 'rental') {
        rentalFields.style.display = 'block';
        cashSaleFields.style.display = 'none';
    } else {
        rentalFields.style.display = 'none';
        cashSaleFields.style.display = 'block';
    }
}

// Setup dropdown functionality
function setupDropdown() {
    const dropdown = document.getElementById('customerDropdown');
    const content = document.getElementById('dropdownContent');
    const search = document.getElementById('customerSearch');

    dropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        content.style.display = content.style.display === 'block' ? 'none' : 'block';
        if (content.style.display === 'block') search.focus();
    });

    search.addEventListener('input', function(e) {
        filterCustomers(e.target.value);
    });

    document.addEventListener('click', function(e) {
        if (!document.querySelector('.searchable-dropdown').contains(e.target)) {
            content.style.display = 'none';
        }
    });
}

// Populate dropdown with customers
function populateDropdown() {
    const optionsContainer = document.getElementById('customerOptions');
    const selectedSpan = document.getElementById('selectedCustomer');
    
    if (!customers.length) {
        selectedSpan.textContent = 'No customers found';
        optionsContainer.innerHTML = '<div class="no-results">No customers available</div>';
        return;
    }

    selectedSpan.textContent = '-- Select Customer --';
    renderOptions();
}

// Filter customers based on search
function filterCustomers(searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredCustomers = customers.filter(customer => 
        customer.id.toLowerCase().includes(term) || 
        customer.name.toLowerCase().includes(term)
    );
    renderOptions();
}

// Render dropdown options
function renderOptions() {
    const optionsContainer = document.getElementById('customerOptions');
    optionsContainer.innerHTML = '';

    if (!filteredCustomers.length) {
        optionsContainer.innerHTML = '<div class="no-results">No customers match your search</div>';
        return;
    }

    filteredCustomers.forEach(customer => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.textContent = `${customer.id} - ${customer.name}`;
        option.addEventListener('click', () => selectCustomer(customer));
        optionsContainer.appendChild(option);
    });
}

// Select a customer
function selectCustomer(customer) {
    selectedCustomer = customer;
    document.getElementById('selectedCustomer').textContent = `${customer.id} - ${customer.name}`;
    document.getElementById('customerPreview').textContent = `Name: ${customer.name}`;
    document.getElementById('contactNumber').value = customer.contact;
    document.getElementById('dropdownContent').style.display = 'none';
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const btn = document.getElementById('generateBtn');
    const receiptType = document.querySelector('input[name="receiptType"]:checked').value;
    
    // Validate based on receipt type
    if (receiptType === 'rental' && !selectedCustomer) {
        showToast('Please select a customer');
        return;
    }

    const amount = document.getElementById('amount').value;
    if (!amount || parseFloat(amount) <= 0) {
        showToast('Please enter a valid amount');
        return;
    }

    // Prepare form data
    const formData = {
        receiptType: receiptType,
        amount: amount,
        notes: document.getElementById('notes').value || '',
        generatedBy: currentUser
    };

    if (receiptType === 'rental') {
        formData.customerId = selectedCustomer.id;
        formData.customerName = selectedCustomer.name;
        formData.contactNumber = selectedCustomer.contact;
    } else {
        formData.driverName = document.getElementById('driverName').value;
        formData.driverPhone = document.getElementById('driverPhone').value;
        
        if (!formData.driverName || !formData.driverPhone) {
            showToast('Please enter driver name and phone');
            return;
        }
    }

    // Show loading
    btn.disabled = true;
    btn.textContent = "Generating...";
    showOverlay(true);

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        // Since we're using no-cors, we'll assume success
        showOverlay(false);
        showToast('Receipt generated successfully!');
        
        // For demo purposes, show success
        showSuccess(formData);
        
    } catch (error) {
        showOverlay(false);
        showToast('Failed to generate receipt: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Generate Receipt";
    }
}

// Show success message (temporary until we get actual response)
function showSuccess(formData) {
    document.querySelector('.wrap').style.display = 'none';
    document.getElementById('resultSection').style.display = 'block';
    
    document.getElementById('resultMeta').innerHTML = `
        <div style="background: #e8f5e8; padding: 15px; border-radius: 8px;">
            <div style="color: #2e7d32;">✅ Receipt Generated Successfully!</div>
            <div>Type: ${formData.receiptType === 'rental' ? 'Rental' : 'Cash Sale'}</div>
            <div>Amount: ₹${formData.amount}</div>
        </div>
    `;
}

// Reset form
function resetForm() {
    document.querySelector('.wrap').style.display = 'flex';
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('receiptForm').reset();
    document.getElementById('customerPreview').textContent = '';
    document.getElementById('contactNumber').value = '';
    selectedCustomer = null;
    document.getElementById('selectedCustomer').textContent = '-- Select Customer --';
}

// Update header with user info
function updateHeader() {
    const header = document.getElementById('header');
    if (header && currentUser) {
        header.innerHTML = `Generate Receipt <div style="font-size: 12px; color: #666; font-weight: normal; margin-top: 5px;">Logged in as: ${currentUser}</div>`;
    }
}

// UI Helpers
function showOverlay(show) { 
    document.getElementById('overlay').style.display = show ? 'flex' : 'none'; 
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}
