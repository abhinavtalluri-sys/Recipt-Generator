// Configuration - REPLACE WITH YOUR ACTUAL APPS SCRIPT URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

// State management
let customers = [];
let filteredCustomers = [];
let selectedCustomer = null;
let currentUser = null;
let activeRiders = [];
let filteredRiders = [];

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadInitialData();
});

// Load initial data from Apps Script
async function loadInitialData() {
    try {
        showOverlay(true);
        
        // Get user email, customers, and active riders
        const [userResponse, customersResponse, ridersResponse] = await Promise.all([
            fetch(`${APPS_SCRIPT_URL}?action=getUser`),
            fetch(`${APPS_SCRIPT_URL}?action=getCustomers`),
            fetch(`${APPS_SCRIPT_URL}?action=getActiveRiders`)
        ]);
        
        const userData = await userResponse.json();
        const customersData = await customersResponse.json();
        const ridersData = await ridersResponse.json();
        
        currentUser = userData.email;
        customers = customersData.customers || [];
        filteredCustomers = customers;
        activeRiders = ridersData.riders || [];
        filteredRiders = activeRiders;
        
        renderForm();
        
    } catch (error) {
        showToast('Failed to load data: ' + error.message);
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
                            <input type="radio" name="receiptType" value="cashsale"> 💵 Cash Sale (Active Rider)
                        </label>
                    </div>

                    <div id="rentalFields">
                        <label>Customer ID</label>
                        <div class="searchable-dropdown" id="customerDropdown">
                            <div class="dropdown-display" tabindex="0">
                                <span id="selectedCustomer">${customers.length ? '-- Select Customer --' : 'Loading customers...'}</span>
                            </div>
                            <div class="dropdown-content" id="customerDropdownContent">
                                <input type="text" class="dropdown-search" id="customerSearch" placeholder="Search customers...">
                                <div class="dropdown-options" id="customerOptions"></div>
                            </div>
                        </div>
                        <div id="customerPreview" class="small"></div>
                        
                        <label>Contact</label>
                        <input id="contactNumber" readonly placeholder="Contact will appear here">
                    </div>

                    <div id="cashSaleFields" style="display: none;">
                        <label>Select Active Rider</label>
                        <div class="searchable-dropdown" id="riderDropdown">
                            <div class="dropdown-display" tabindex="0">
                                <span id="selectedRider">${activeRiders.length ? '-- Select Rider --' : 'Loading riders...'}</span>
                            </div>
                            <div class="dropdown-content" id="riderDropdownContent">
                                <input type="text" class="dropdown-search" id="riderSearch" placeholder="Search riders...">
                                <div class="dropdown-options" id="riderOptions"></div>
                            </div>
                        </div>
                        <div id="riderPreview" class="small"></div>
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
    populateRiderDropdown();
}

// Initialize all event listeners
function initializeEventListeners() {
    document.querySelectorAll('input[name="receiptType"]').forEach(radio => {
        radio.addEventListener('change', toggleReceiptFields);
    });

    setupDropdown('customer');
    setupDropdown('rider');
    document.getElementById('receiptForm').addEventListener('submit', handleFormSubmit);
}

// Setup dropdown functionality
function setupDropdown(type) {
    const dropdown = document.getElementById(`${type}Dropdown`);
    const content = document.getElementById(`${type}DropdownContent`);
    const search = document.getElementById(`${type}Search`);
    
    if (!dropdown || !content) return;

    dropdown.querySelector('.dropdown-display').addEventListener('click', function(e) {
        e.stopPropagation();
        content.style.display = content.style.display === 'block' ? 'none' : 'block';
        if (content.style.display === 'block' && search) search.focus();
    });

    if (search) {
        search.addEventListener('input', function(e) {
            filterItems(type, e.target.value);
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
    if (!optionsContainer) return;
    
    if (!customers.length) {
        optionsContainer.innerHTML = '<div class="no-results">No customers available</div>';
        return;
    }
    renderCustomerOptions();
}

// Populate rider dropdown
function populateRiderDropdown() {
    const optionsContainer = document.getElementById('riderOptions');
    if (!optionsContainer) return;
    
    if (!activeRiders.length) {
        optionsContainer.innerHTML = '<div class="no-results">No active riders available</div>';
        return;
    }
    renderRiderOptions();
}

// Filter customers
function filterCustomers(searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredCustomers = customers.filter(customer => 
        customer.id.toLowerCase().includes(term) || 
        customer.name.toLowerCase().includes(term)
    );
    renderCustomerOptions();
}

// Filter riders
function filterRiders(searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredRiders = activeRiders.filter(rider => 
        rider.id.toLowerCase().includes(term) || 
        rider.name.toLowerCase().includes(term)
    );
    renderRiderOptions();
}

// Filter items based on type
function filterItems(type, searchTerm) {
    if (type === 'customer') {
        filterCustomers(searchTerm);
    } else {
        filterRiders(searchTerm);
    }
}

// Render customer options
function renderCustomerOptions() {
    const optionsContainer = document.getElementById('customerOptions');
    if (!optionsContainer) return;

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

// Render rider options
function renderRiderOptions() {
    const optionsContainer = document.getElementById('riderOptions');
    if (!optionsContainer) return;

    optionsContainer.innerHTML = '';

    const ridersToShow = filteredRiders.length ? filteredRiders : activeRiders;

    if (!ridersToShow.length) {
        optionsContainer.innerHTML = '<div class="no-results">No riders match your search</div>';
        return;
    }

    ridersToShow.forEach(rider => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.textContent = `${rider.id} - ${rider.name} (${rider.contact})`;
        option.addEventListener('click', () => selectRider(rider));
        optionsContainer.appendChild(option);
    });
}

// Select a customer
function selectCustomer(customer) {
    selectedCustomer = customer;
    document.getElementById('selectedCustomer').textContent = `${customer.id} - ${customer.name}`;
    document.getElementById('customerPreview').textContent = `📋 Name: ${customer.name} | 📞 ${customer.contact}`;
    document.getElementById('contactNumber').value = customer.contact;
    document.getElementById('customerDropdownContent').style.display = 'none';
}

// Select a rider
function selectRider(rider) {
    document.getElementById('selectedRider').textContent = `${rider.id} - ${rider.name}`;
    document.getElementById('riderPreview').textContent = `👤 ${rider.name} | 📞 ${rider.contact}`;
    
    const riderDisplay = document.querySelector('#riderDropdown .dropdown-display');
    riderDisplay.setAttribute('data-selected-id', rider.id);
    riderDisplay.setAttribute('data-selected-name', rider.name);
    riderDisplay.setAttribute('data-selected-contact', rider.contact);
    
    document.getElementById('riderDropdownContent').style.display = 'none';
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const btn = document.getElementById('generateBtn');
    const receiptType = document.querySelector('input[name="receiptType"]:checked').value;
    
    if (receiptType === 'rental' && !selectedCustomer) {
        showToast('Please select a customer');
        return;
    }

    const amount = document.getElementById('amount').value;
    if (!amount || parseFloat(amount) <= 0) {
        showToast('Please enter a valid amount');
        return;
    }

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
        const riderDisplay = document.querySelector('#riderDropdown .dropdown-display');
        const riderId = riderDisplay.getAttribute('data-selected-id');
        const riderName = riderDisplay.getAttribute('data-selected-name');
        const riderContact = riderDisplay.getAttribute('data-selected-contact');
        
        if (!riderId) {
            showToast('Please select an active rider');
            return;
        }
        
        formData.driverId = riderId;
        formData.driverName = riderName;
        formData.driverPhone = riderContact;
    }

    btn.disabled = true;
    btn.textContent = "Generating...";
    showOverlay(true);

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        
        showOverlay(false);
        
        if (result.success) {
            // Redirect to the receipt page in Apps Script
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
