// Configuration - YOUR ACTUAL APPS SCRIPT URL
const APPS_SCRIPT_URL = 'https://script.google.com/a/macros/batterypool.com/s/AKfycbw8nN2akkicRAJ8cMUqLLxPFGatXlRCvmi_WNr_7J0JshjIWJM7iff73ifDtWjw7FLPnw/exec';

// State management
let customers = [];
let filteredCustomers = [];
let selectedCustomer = null;
let currentUser = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadInitialData();
});

// Load initial data from Apps Script
async function loadInitialData() {
    try {
        showOverlay(true);
        
        // Get user email and customers from sheet
        const [userResponse, customersResponse] = await Promise.all([
            fetch(`${APPS_SCRIPT_URL}?action=getUser`),
            fetch(`${APPS_SCRIPT_URL}?action=getCustomers`) // This now fetches from Customers sheet
        ]);
        
        const userData = await userResponse.json();
        const customersData = await customersResponse.json();
        
        currentUser = userData.email;
        customers = customersData.customers || [];
        filteredCustomers = customers;
        
        console.log('✅ Customers loaded from sheet:', customers.length);
        console.log('First customer:', customers[0]);
        
        renderForm();
        
    } catch (error) {
        showToast('Failed to load data: ' + error.message);
        console.error('Error loading data:', error);
        renderForm();
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
                <h1 id="header">Receipt Generator ${currentUser ? `<div style="font-size: 12px; color: #666; font-weight: normal; margin-top: 5px;">👤 ${currentUser}</div>` : ''}</h1>
                
                <form id="receiptForm">
                    <label>Receipt Type</label>
                    <div class="radio-group">
                        <label class="radio-option">
                            <input type="radio" name="receiptType" value="rental" checked> 🚗 Rental (Existing Customer)
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="receiptType" value="cashsale"> 💵 Cash Sale (New Driver)
                        </label>
                    </div>

                    <div id="rentalFields">
                        <label>Select Customer</label>
                        <div class="searchable-dropdown" id="customerDropdown">
                            <div class="dropdown-display" tabindex="0">
                                <span id="selectedCustomer">${customers.length ? '-- Select Customer --' : 'No customers found'}</span>
                            </div>
                            <div class="dropdown-content" id="customerDropdownContent">
                                <input type="text" class="dropdown-search" id="customerSearch" placeholder="Search by ID or name...">
                                <div class="dropdown-options" id="customerOptions"></div>
                            </div>
                        </div>
                        <div id="customerPreview" class="small"></div>
                        
                        <label>Contact Number</label>
                        <input id="contactNumber" readonly placeholder="Contact will appear here">
                    </div>

                    <div id="cashSaleFields" style="display: none;">
                        <label>Driver Name</label>
                        <input type="text" id="driverName" placeholder="Enter driver name" required>
                        
                        <label>Driver Phone</label>
                        <input type="tel" id="driverPhone" placeholder="Enter phone number" required>
                        
                        <label>Driver ID (Optional)</label>
                        <input type="text" id="driverId" placeholder="Enter driver ID if available">
                    </div>

                    <label>Amount (₹)</label>
                    <input id="amount" type="number" min="0" step="0.01" required placeholder="Enter amount">

                    <label>Notes (Optional)</label>
                    <textarea id="notes" placeholder="Add any notes..."></textarea>

                    <button id="generateBtn" type="submit">Generate Receipt</button>
                </form>
            </div>

            <div class="card" style="width:420px;">
                <h1 style="font-size:18px;">Last Receipt</h1>
                <div id="lastArea" class="small" style="min-height:60px; display:flex; align-items:center; justify-content:center; color:var(--muted);">
                    No receipt generated yet.
                </div>
            </div>
        </div>
    `;

    initializeEventListeners();
    populateCustomerDropdown();
}

// Initialize all event listeners
function initializeEventListeners() {
    document.querySelectorAll('input[name="receiptType"]').forEach(radio => {
        radio.addEventListener('change', toggleReceiptFields);
    });

    setupCustomerDropdown();
    document.getElementById('receiptForm').addEventListener('submit', handleFormSubmit);
}

// Setup customer dropdown
function setupCustomerDropdown() {
    const dropdown = document.getElementById('customerDropdown');
    const content = document.getElementById('customerDropdownContent');
    const search = document.getElementById('customerSearch');
    const display = document.querySelector('#customerDropdown .dropdown-display');
    
    if (!dropdown || !content) return;

    display.addEventListener('click', function(e) {
        e.stopPropagation();
        const isVisible = content.style.display === 'block';
        content.style.display = isVisible ? 'none' : 'block';
        if (!isVisible && search) {
            search.focus();
            filterCustomers('');
        }
    });

    if (search) {
        search.addEventListener('input', function(e) {
            filterCustomers(e.target.value);
        });
    }

    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target)) {
            content.style.display = 'none';
        }
    });
}

// Toggle between rental and cash sale fields
function toggleReceiptFields() {
    const rentalFields = document.getElementById('rentalFields');
    const cashSaleFields = document.getElementById('cashSaleFields');
    const receiptType = document.querySelector('input[name="receiptType"]:checked').value;
    
    if (receiptType === 'rental') {
        rentalFields.style.display = 'block';
        cashSaleFields.style.display = 'none';
    } else {
        rentalFields.style.display = 'none';
        cashSaleFields.style.display = 'block';
    }
}

// Populate customer dropdown
function populateCustomerDropdown() {
    const optionsContainer = document.getElementById('customerOptions');
    const selectedSpan = document.getElementById('selectedCustomer');
    
    if (!optionsContainer) return;
    
    if (!customers.length) {
        if (selectedSpan) selectedSpan.textContent = 'No customers found';
        optionsContainer.innerHTML = '<div class="no-results">No customers available</div>';
        return;
    }

    renderCustomerOptions();
}

// Filter customers
function filterCustomers(searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredCustomers = customers.filter(customer => 
        (customer.id && customer.id.toLowerCase().includes(term)) || 
        (customer.name && customer.name.toLowerCase().includes(term))
    );
    renderCustomerOptions();
}

// Render customer options
function renderCustomerOptions() {
    const optionsContainer = document.getElementById('customerOptions');
    if (!optionsContainer) return;

    optionsContainer.innerHTML = '';

    const customersToShow = filteredCustomers.length ? filteredCustomers : customers;

    if (!customersToShow.length) {
        optionsContainer.innerHTML = '<div class="no-results">No customers match your search</div>';
        return;
    }

    customersToShow.forEach(customer => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.textContent = `${customer.id} - ${customer.name}`;
        option.setAttribute('data-id', customer.id);
        option.setAttribute('data-name', customer.name);
        option.setAttribute('data-contact', customer.contact);
        option.addEventListener('click', () => selectCustomer(customer));
        optionsContainer.appendChild(option);
    });
}

// Select a customer
function selectCustomer(customer) {
    selectedCustomer = customer;
    document.getElementById('selectedCustomer').textContent = `${customer.id} - ${customer.name}`;
    document.getElementById('customerPreview').textContent = `📋 ID: ${customer.id} | Name: ${customer.name} | 📞 ${customer.contact}`;
    document.getElementById('contactNumber').value = customer.contact;
    document.getElementById('customerDropdownContent').style.display = 'none';
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const btn = document.getElementById('generateBtn');
    const receiptType = document.querySelector('input[name="receiptType"]:checked').value;
    const amount = document.getElementById('amount').value;
    
    // Validate
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
        if (!selectedCustomer) {
            showToast('Please select a customer');
            return;
        }
        formData.customerId = selectedCustomer.id;
        formData.customerName = selectedCustomer.name;
        formData.contactNumber = selectedCustomer.contact;
        formData.driverId = selectedCustomer.id; // For receipt
    } else {
        const driverName = document.getElementById('driverName').value;
        const driverPhone = document.getElementById('driverPhone').value;
        const driverId = document.getElementById('driverId').value;
        
        if (!driverName || !driverPhone) {
            showToast('Please enter driver name and phone');
            return;
        }
        
        formData.driverName = driverName;
        formData.driverPhone = driverPhone;
        formData.driverId = driverId || 'CASH-' + Date.now();
        formData.customerId = 'CASH-SALE';
    }

    btn.disabled = true;
    btn.textContent = "Generating...";
    showOverlay(true);

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        showOverlay(false);
        
        if (result.success) {
            showToast('Receipt generated successfully!');
            
            document.getElementById('lastArea').innerHTML = `
                <div style="text-align:center;">
                    <strong>${result.receiptId}</strong>
                    <div class="small">${receiptType === 'rental' ? formData.customerName : formData.driverName}</div>
                    <div class="small">₹${formData.amount}</div>
                    <div class="small">${new Date().toLocaleString()}</div>
                </div>
            `;
            
            window.location.href = `${APPS_SCRIPT_URL}?page=receipt&receiptUrl=${encodeURIComponent(result.pdfUrl)}&receiptId=${result.receiptId}`;
        } else {
            showToast('Error: ' + (result.error || 'Unknown error'));
        }
        
    } catch (error) {
        showOverlay(false);
        showToast('Failed: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Generate Receipt";
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
