/**
 * TravelMate - Trip Expense Tracker & Splitter
 * Main JavaScript File (js/script.js)
 * 
 * Features:
 * 1. Mobile navigation menu toggle and active link detection.
 * 2. URL parameter parsing (e.g. ?destination=Goa pre-fills "Goa Trip").
 * 3. Dynamic Trip Creation with customizable number of members.
 * 4. LocalStorage persistence for both trip metadata and actual expenses.
 * 5. Full Expense CRUD (Add, Edit, Delete) with live recalculations.
 * 6. Financial Analytics: Total Expense, Average per Person, Member Summary.
 * 7. Simplified Settlement Engine ("Who Owes Whom").
 * 8. Native Browser Print & "Save as PDF" report generation.
 */

// Global state keys for localStorage
const STORAGE_KEYS = {
  TRIPS: 'travelMateTrips',
  ACTIVE_ID: 'travelMateActiveTripId',
  LEGACY_TRIP: 'travelMateTrip',
  LEGACY_EXPENSES: 'travelMateExpenses'
};

// Current editing state
let editingExpenseId = null;
let editingTripId = null;

// Initialize app when DOM is ready
function initApp() {
  setupNavigation();
  initExpenseTracker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

/**
 * ----------------------------------------------------
 * 1. Navigation Setup
 * ----------------------------------------------------
 */
function setupNavigation() {
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!menuToggle.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('show');
      }
    });
  }

  // Highlight active link based on current filename
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const links = document.querySelectorAll('.nav-link');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/**
 * ----------------------------------------------------
 * 2. Multi-Trip Expense Tracker Core Logic
 * ----------------------------------------------------
 */
function initExpenseTracker() {
  // Only execute on budget.html (Trip Expenses page)
  const tripSetupForm = document.getElementById('tripSetupForm');
  if (!tripSetupForm) return;

  // DOM Elements
  const myTripsSection = document.getElementById('myTripsSection');
  const myTripsGrid = document.getElementById('myTripsGrid');
  const btnCreateNewTrip = document.getElementById('btnCreateNewTrip');

  const tripSetupPanel = document.getElementById('tripSetupPanel');
  const tripSetupTag = document.getElementById('tripSetupTag');
  const tripSetupTitle = document.getElementById('tripSetupTitle');
  const tripSetupDesc = document.getElementById('tripSetupDesc');
  const tripNameInput = document.getElementById('tripNameInput');
  const tripDestInput = document.getElementById('tripDestInput');
  const numMembersInput = document.getElementById('numMembersInput');
  const memberNamesContainer = document.getElementById('memberNamesContainer');
  const startTripBtn = document.getElementById('startTripBtn');
  const cancelTripSetupBtn = document.getElementById('cancelTripSetupBtn');

  const activeTripBanner = document.getElementById('activeTripBanner');
  const activeTripTitle = document.getElementById('activeTripTitle');
  const activeTripDestBadge = document.getElementById('activeTripDestBadge');
  const activeMembersList = document.getElementById('activeMembersList');
  const backToTripsBtn = document.getElementById('backToTripsBtn');
  const editTripBtn = document.getElementById('editTripBtn');
  const deleteActiveTripBtn = document.getElementById('deleteActiveTripBtn');

  const expenseFormPanel = document.getElementById('expenseFormPanel');
  const expenseForm = document.getElementById('expenseForm');
  const expensePayer = document.getElementById('expensePayer');
  const expenseName = document.getElementById('expenseName');
  const expenseCategory = document.getElementById('expenseCategory');
  const expenseAmount = document.getElementById('expenseAmount');
  const expenseDate = document.getElementById('expenseDate');
  const expenseError = document.getElementById('expenseError');
  const addExpenseBtn = document.getElementById('addExpenseBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');

  const expenseHistoryPanel = document.getElementById('expenseHistoryPanel');
  const expenseTableBody = document.getElementById('expenseTableBody');
  const emptyExpenseState = document.getElementById('emptyExpenseState');

  const summaryPanel = document.getElementById('summaryPanel');
  const totalTripExpense = document.getElementById('totalTripExpense');
  const totalMembersCount = document.getElementById('totalMembersCount');
  const averageExpensePerPerson = document.getElementById('averageExpensePerPerson');
  const memberSummaryBody = document.getElementById('memberSummaryBody');
  const pairSettlementList = document.getElementById('pairSettlementList');
  const settlementList = document.getElementById('settlementList');

  const printReportBtn = document.getElementById('printReportBtn');

  // Set today's date as default on expense date input
  if (expenseDate && !expenseDate.value) {
    const today = new Date().toISOString().split('T')[0];
    expenseDate.value = today;
  }

  // --------------------------------------------------
  // Helper: Currency Formatter (Indian Rupee - INR)
  // --------------------------------------------------
  const inrFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  });

  function formatINR(amount) {
    return inrFormatter.format(amount || 0);
  }

  // --------------------------------------------------
  // Backward Compatibility Migration
  // --------------------------------------------------
  function migrateLegacyData() {
    try {
      const existingTrips = localStorage.getItem(STORAGE_KEYS.TRIPS);
      if (!existingTrips) {
        const legacyTripData = localStorage.getItem(STORAGE_KEYS.LEGACY_TRIP);
        if (legacyTripData) {
          const legacyTrip = JSON.parse(legacyTripData);
          let legacyExpenses = [];
          try {
            const expData = localStorage.getItem(STORAGE_KEYS.LEGACY_EXPENSES);
            if (expData) legacyExpenses = JSON.parse(expData);
          } catch (e) {}

          const tripId = 'trip_' + Date.now();
          const tripName = legacyTrip.tripName || 'My Trip';
          const migratedTrip = {
            id: tripId,
            name: tripName,
            destination: legacyTrip.destination || (tripName.replace(/\s*Trip$/i, '').trim()),
            members: Array.isArray(legacyTrip.members) ? legacyTrip.members : [],
            expenses: Array.isArray(legacyExpenses) ? legacyExpenses : [],
            createdAt: new Date().toISOString()
          };

          localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify([migratedTrip]));
          localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, tripId);
        }
      }
    } catch (err) {
      console.error('Data migration error:', err);
    }
  }

  // Run migration once upon initialization
  migrateLegacyData();

  // --------------------------------------------------
  // Multi-Trip LocalStorage Helpers
  // --------------------------------------------------
  function getAllTrips() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRIPS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveAllTrips(trips) {
    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(trips));
  }

  function getActiveTripId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_ID) || null;
  }

  function setActiveTripId(id) {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID);
    }
  }

  function getActiveTrip() {
    const trips = getAllTrips();
    if (trips.length === 0) return null;
    const activeId = getActiveTripId();
    const found = trips.find(t => t.id === activeId);
    if (found) return found;

    // Fallback to first trip if activeId not matched
    setActiveTripId(trips[0].id);
    return trips[0];
  }

  function saveActiveTrip(updatedTrip) {
    const trips = getAllTrips();
    const index = trips.findIndex(t => t.id === updatedTrip.id);
    if (index !== -1) {
      trips[index] = updatedTrip;
    } else {
      trips.unshift(updatedTrip);
    }
    saveAllTrips(trips);
  }

  // --------------------------------------------------
  // Dynamic Member Input Generator
  // --------------------------------------------------
  function renderMemberInputs(count, existingNames = []) {
    if (!memberNamesContainer) return;

    const currentValues = existingNames.length > 0 ? existingNames : [];
    if (currentValues.length === 0) {
      const inputs = memberNamesContainer.querySelectorAll('.member-name-input');
      inputs.forEach(input => currentValues.push(input.value.trim()));
    }

    memberNamesContainer.innerHTML = '';
    const safeCount = Math.max(1, Math.min(count || 3, 20));

    for (let i = 0; i < safeCount; i++) {
      const formGroup = document.createElement('div');
      formGroup.className = 'form-group';

      const label = document.createElement('label');
      label.className = 'form-label';
      label.innerHTML = `<span>Member ${i + 1} Name</span> <span class="req">*</span>`;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input member-name-input';
      input.placeholder = `e.g. Member ${i + 1}`;
      input.required = true;
      input.value = currentValues[i] || '';

      formGroup.appendChild(label);
      formGroup.appendChild(input);
      memberNamesContainer.appendChild(formGroup);
    }
  }

  // Listen to member count changes
  if (numMembersInput) {
    numMembersInput.addEventListener('input', () => {
      const count = parseInt(numMembersInput.value, 10) || 1;
      renderMemberInputs(count);
    });
  }

  // --------------------------------------------------
  // Global Actions attached to window (Trip Switching & Deletion)
  // --------------------------------------------------
  window.openTrip = function(tripId) {
    setActiveTripId(tripId);
    editingExpenseId = null;
    editingTripId = null;

    if (tripSetupPanel) tripSetupPanel.classList.add('hidden');
    renderTracker();

    if (activeTripBanner) {
      activeTripBanner.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  window.deleteTrip = function(tripId) {
    const trips = getAllTrips();
    const tripToDelete = trips.find(t => t.id === tripId);
    const tripName = tripToDelete ? tripToDelete.name : 'this trip';

    const confirmed = confirm(`Are you sure you want to delete "${tripName}" and all its recorded expenses? This action cannot be undone.`);
    if (!confirmed) return;

    const remainingTrips = trips.filter(t => t.id !== tripId);
    saveAllTrips(remainingTrips);

    const currentActiveId = getActiveTripId();
    if (currentActiveId === tripId) {
      if (remainingTrips.length > 0) {
        setActiveTripId(remainingTrips[0].id);
      } else {
        setActiveTripId(null);
      }
    }

    editingExpenseId = null;
    editingTripId = null;
    renderTracker();
  };

  // --------------------------------------------------
  // "+ Create New Trip" & Cancel Buttons
  // --------------------------------------------------
  if (btnCreateNewTrip) {
    btnCreateNewTrip.addEventListener('click', () => {
      editingTripId = null;
      if (tripNameInput) tripNameInput.value = '';
      if (tripDestInput) tripDestInput.value = '';
      if (numMembersInput) numMembersInput.value = '3';
      renderMemberInputs(3, []);

      if (tripSetupTag) tripSetupTag.textContent = 'NEW TRIP SETUP';
      if (tripSetupTitle) tripSetupTitle.textContent = 'Create a New Trip';
      if (tripSetupDesc) tripSetupDesc.textContent = 'Add a new trip to your collection and start logging expenses.';
      if (startTripBtn) startTripBtn.textContent = 'Create Trip →';

      const trips = getAllTrips();
      if (cancelTripSetupBtn) {
        if (trips.length > 0) {
          cancelTripSetupBtn.classList.remove('hidden');
        } else {
          cancelTripSetupBtn.classList.add('hidden');
        }
      }

      if (tripSetupPanel) tripSetupPanel.classList.remove('hidden');
      tripSetupPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (cancelTripSetupBtn) {
    cancelTripSetupBtn.addEventListener('click', () => {
      editingTripId = null;
      const active = getActiveTrip();
      if (active && tripSetupPanel) {
        tripSetupPanel.classList.add('hidden');
      }
      renderTracker();
    });
  }

  // --------------------------------------------------
  // Check URL Parameters for Destination Pre-fill
  // --------------------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const selectedDest = urlParams.get('destination');
  if (selectedDest) {
    const cleanDest = selectedDest.trim();
    const trips = getAllTrips();
    const matchingTrip = trips.find(t =>
      (t.destination && t.destination.toLowerCase() === cleanDest.toLowerCase()) ||
      (t.name && t.name.toLowerCase().includes(cleanDest.toLowerCase()))
    );

    if (matchingTrip) {
      setActiveTripId(matchingTrip.id);
    } else {
      if (tripNameInput) tripNameInput.value = `${cleanDest} Trip`;
      if (tripDestInput) tripDestInput.value = cleanDest;
      if (tripSetupPanel) tripSetupPanel.classList.remove('hidden');
    }
  }

  // --------------------------------------------------
  // Trip Creation & Edit Form Handler
  // --------------------------------------------------
  tripSetupForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const tripName = tripNameInput ? tripNameInput.value.trim() : '';
    const tripDest = tripDestInput ? tripDestInput.value.trim() : '';

    if (!tripName) {
      alert('Please enter a trip name.');
      return;
    }

    const memberInputs = memberNamesContainer.querySelectorAll('.member-name-input');
    const members = [];
    let hasEmpty = false;

    memberInputs.forEach((inp) => {
      const val = inp.value.trim();
      if (!val) {
        hasEmpty = true;
      } else {
        members.push(val);
      }
    });

    if (hasEmpty || members.length === 0) {
      alert('Please enter a name for every member.');
      return;
    }

    const trips = getAllTrips();

    if (editingTripId) {
      // Update existing trip
      const idx = trips.findIndex(t => t.id === editingTripId);
      if (idx !== -1) {
        trips[idx].name = tripName;
        trips[idx].destination = tripDest;
        trips[idx].members = members;
      }
      saveAllTrips(trips);
      setActiveTripId(editingTripId);
      editingTripId = null;
    } else {
      // Create brand new trip
      const newId = 'trip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      const newTrip = {
        id: newId,
        name: tripName,
        destination: tripDest,
        members: members,
        expenses: [],
        createdAt: new Date().toISOString()
      };
      trips.unshift(newTrip);
      saveAllTrips(trips);
      setActiveTripId(newId);
    }

    if (tripSetupPanel) tripSetupPanel.classList.add('hidden');
    renderTracker();
  });

  // --------------------------------------------------
  // Edit Active Trip Handler
  // --------------------------------------------------
  if (editTripBtn) {
    editTripBtn.addEventListener('click', () => {
      const activeTrip = getActiveTrip();
      if (!activeTrip) return;

      editingTripId = activeTrip.id;
      if (tripNameInput) tripNameInput.value = activeTrip.name;
      if (tripDestInput) tripDestInput.value = activeTrip.destination || '';
      if (numMembersInput) numMembersInput.value = activeTrip.members.length;
      renderMemberInputs(activeTrip.members.length, activeTrip.members);

      if (tripSetupTag) tripSetupTag.textContent = 'EDIT TRIP';
      if (tripSetupTitle) tripSetupTitle.textContent = 'Edit Trip Details & Members';
      if (tripSetupDesc) tripSetupDesc.textContent = 'Update the trip title or add/modify members.';
      if (startTripBtn) startTripBtn.textContent = 'Save Changes →';
      if (cancelTripSetupBtn) cancelTripSetupBtn.classList.remove('hidden');

      if (tripSetupPanel) tripSetupPanel.classList.remove('hidden');
      tripSetupPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // --------------------------------------------------
  // Delete Active Trip Handler
  // --------------------------------------------------
  if (deleteActiveTripBtn) {
    deleteActiveTripBtn.addEventListener('click', () => {
      const activeTrip = getActiveTrip();
      if (activeTrip) {
        window.deleteTrip(activeTrip.id);
      }
    });
  }

  // --------------------------------------------------
  // Back to All Trips Button Handler
  // --------------------------------------------------
  if (backToTripsBtn) {
    backToTripsBtn.addEventListener('click', () => {
      if (myTripsSection) {
        myTripsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // --------------------------------------------------
  // Add / Edit Expense Handler
  // --------------------------------------------------
  if (expenseForm) {
    expenseForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (expenseError) {
        expenseError.textContent = '';
        expenseError.classList.add('hidden');
      }

      const activeTrip = getActiveTrip();
      if (!activeTrip) {
        alert('Please select or create a trip first.');
        return;
      }

      const payer = expensePayer ? expensePayer.value.trim() : '';
      const name = expenseName ? expenseName.value.trim() : '';
      const category = expenseCategory ? expenseCategory.value.trim() : 'Other';
      const amount = parseFloat(expenseAmount.value);
      const date = expenseDate ? expenseDate.value : new Date().toISOString().split('T')[0];

      // Validation
      if (!payer) {
        showExpenseError('Please select who paid for this expense.');
        return;
      }
      if (!name) {
        showExpenseError('Please enter the expense name.');
        return;
      }
      if (isNaN(amount) || amount <= 0) {
        showExpenseError('Please enter a valid expense amount greater than 0.');
        return;
      }
      if (!date) {
        showExpenseError('Please select a valid date.');
        return;
      }

      const expenses = activeTrip.expenses || [];

      if (editingExpenseId) {
        // Edit mode
        const index = expenses.findIndex(exp => exp.id === editingExpenseId);
        if (index !== -1) {
          expenses[index] = {
            id: editingExpenseId,
            payer,
            name,
            category,
            amount,
            date
          };
        }
        editingExpenseId = null;
        if (addExpenseBtn) addExpenseBtn.textContent = '+ Add Expense';
        if (cancelEditBtn) cancelEditBtn.classList.add('hidden');
      } else {
        // Create mode
        const newExpense = {
          id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          payer,
          name,
          category,
          amount,
          date
        };
        expenses.unshift(newExpense); // Put latest on top
      }

      activeTrip.expenses = expenses;
      saveActiveTrip(activeTrip);

      // Reset fields except date
      if (expenseName) expenseName.value = '';
      if (expenseAmount) expenseAmount.value = '';
      if (expensePayer) expensePayer.selectedIndex = 0;
      if (expenseCategory) expenseCategory.selectedIndex = 0;

      renderTracker();
    });
  }

  // Cancel edit expense handler
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      editingExpenseId = null;
      if (expenseName) expenseName.value = '';
      if (expenseAmount) expenseAmount.value = '';
      if (expensePayer) expensePayer.selectedIndex = 0;
      if (expenseCategory) expenseCategory.selectedIndex = 0;
      if (addExpenseBtn) addExpenseBtn.textContent = '+ Add Expense';
      cancelEditBtn.classList.add('hidden');
      if (expenseError) expenseError.classList.add('hidden');
    });
  }

  function showExpenseError(msg) {
    if (expenseError) {
      expenseError.textContent = msg;
      expenseError.classList.remove('hidden');
    }
  }

  // --------------------------------------------------
  // Global Delete and Edit Handlers for Expenses
  // --------------------------------------------------
  window.deleteExpense = function(id) {
    const confirmed = confirm('Are you sure you want to delete this expense?');
    if (!confirmed) return;

    const activeTrip = getActiveTrip();
    if (!activeTrip) return;

    activeTrip.expenses = (activeTrip.expenses || []).filter(exp => exp.id !== id);
    saveActiveTrip(activeTrip);

    if (editingExpenseId === id) {
      editingExpenseId = null;
      if (addExpenseBtn) addExpenseBtn.textContent = '+ Add Expense';
      if (cancelEditBtn) cancelEditBtn.classList.add('hidden');
      if (expenseName) expenseName.value = '';
      if (expenseAmount) expenseAmount.value = '';
    }

    renderTracker();
  };

  window.editExpense = function(id) {
    const activeTrip = getActiveTrip();
    if (!activeTrip) return;

    const exp = (activeTrip.expenses || []).find(e => e.id === id);
    if (!exp) return;

    editingExpenseId = id;
    if (expensePayer) expensePayer.value = exp.payer;
    if (expenseName) expenseName.value = exp.name;
    if (expenseCategory) expenseCategory.value = exp.category;
    if (expenseAmount) expenseAmount.value = exp.amount;
    if (expenseDate) expenseDate.value = exp.date;

    if (addExpenseBtn) addExpenseBtn.textContent = 'Save Changes';
    if (cancelEditBtn) cancelEditBtn.classList.remove('hidden');

    if (expenseFormPanel) {
      expenseFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (expenseAmount) expenseAmount.focus();
  };

  // --------------------------------------------------
  // Print Report Action (Active Trip Only)
  // --------------------------------------------------
  if (printReportBtn) {
    printReportBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // --------------------------------------------------
  // Settlement Calculator: Direct Pairwise Debts
  // --------------------------------------------------
  function calculateDirectSettlements(members, paidByMember, fairShare) {
    const debtors = [];
    const creditors = [];

    members.forEach(m => {
      const paid = paidByMember[m] || 0;
      const balance = Math.round((paid - fairShare) * 100) / 100;
      if (balance < -0.01) {
        debtors.push({ member: m, amount: Math.abs(balance) });
      } else if (balance > 0.01) {
        creditors.push({ member: m, amount: balance });
      }
    });

    // Sort descending
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transfers = [];
    let d = 0;
    let c = 0;

    while (d < debtors.length && c < creditors.length) {
      const debtor = debtors[d];
      const creditor = creditors[c];
      const settleAmount = Math.min(debtor.amount, creditor.amount);

      if (settleAmount > 0.01) {
        transfers.push({
          from: debtor.member,
          to: creditor.member,
          amount: Math.round(settleAmount * 100) / 100
        });
      }

      debtor.amount = Math.round((debtor.amount - settleAmount) * 100) / 100;
      creditor.amount = Math.round((creditor.amount - settleAmount) * 100) / 100;

      if (debtor.amount <= 0.01) d++;
      if (creditor.amount <= 0.01) c++;
    }

    return transfers;
  }

  // --------------------------------------------------
  // Render "My Trips" Dashboard Cards
  // --------------------------------------------------
  function renderMyTrips(trips, activeTrip) {
    if (!myTripsGrid) return;
    myTripsGrid.innerHTML = '';

    if (trips.length === 0) {
      const emptyCard = document.createElement('div');
      emptyCard.className = 'empty-trips-card';
      emptyCard.innerHTML = `
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">✈️</div>
        <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">No Trips Saved Yet</h3>
        <p style="font-size: 0.92rem; color: var(--text-muted); margin-bottom: 1.25rem;">Create your first trip below to begin tracking expenses.</p>
      `;
      myTripsGrid.appendChild(emptyCard);
      return;
    }

    trips.forEach(trip => {
      const isActive = activeTrip && trip.id === activeTrip.id;
      const totalExp = (trip.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const memberCount = (trip.members || []).length;

      const card = document.createElement('div');
      card.className = `trip-card ${isActive ? 'active' : ''}`;
      card.id = `trip-card-${trip.id}`;

      const destBadgeHtml = trip.destination 
        ? `<span class="trip-badge-dest">📍 ${trip.destination}</span>` 
        : '';
      const activeBadgeHtml = isActive 
        ? `<span class="trip-badge-active">✓ Active Trip</span>` 
        : '';

      const memberTagsHtml = (trip.members || [])
        .map(m => `<span class="trip-member-tag">${m}</span>`)
        .join('');

      card.innerHTML = `
        <div class="trip-card-header">
          <div>
            <h3 class="trip-card-title">${trip.name}</h3>
            ${destBadgeHtml}
          </div>
          ${activeBadgeHtml}
        </div>

        <div class="trip-card-members">
          <div><strong>${memberCount} Members:</strong></div>
          <div class="trip-members-chips">
            ${memberTagsHtml}
          </div>
        </div>

        <div class="trip-card-stats">
          <span class="trip-card-total-label">Total Expense</span>
          <span class="trip-card-total-val">${formatINR(totalExp)}</span>
        </div>

        <div class="trip-card-actions">
          <button class="btn ${isActive ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="openTrip('${trip.id}')">
            ${isActive ? 'Viewing Trip' : 'Open Trip'}
          </button>
          <button class="btn btn-outline-danger btn-sm" onclick="deleteTrip('${trip.id}')" title="Delete Trip">
            Delete
          </button>
        </div>
      `;

      myTripsGrid.appendChild(card);
    });
  }

  // --------------------------------------------------
  // Core UI Render Function
  // --------------------------------------------------
  function renderTracker() {
    const trips = getAllTrips();
    const activeTrip = getActiveTrip();

    // 1. Render My Trips section
    renderMyTrips(trips, activeTrip);

    // 2. Determine View State
    if (!activeTrip) {
      // No active trip
      if (tripSetupPanel) {
        tripSetupPanel.classList.remove('hidden');
        if (tripSetupTag) tripSetupTag.textContent = 'STEP 1: TRIP SETUP';
        if (tripSetupTitle) tripSetupTitle.textContent = 'Create Your Trip';
        if (tripSetupDesc) tripSetupDesc.textContent = 'Set your trip name and add your group members to start tracking expenses.';
        if (startTripBtn) startTripBtn.textContent = 'Start Trip →';
      }
      if (cancelTripSetupBtn) cancelTripSetupBtn.classList.add('hidden');
      if (activeTripBanner) activeTripBanner.classList.add('hidden');
      if (expenseFormPanel) expenseFormPanel.classList.add('hidden');
      if (expenseHistoryPanel) expenseHistoryPanel.classList.add('hidden');
      if (summaryPanel) summaryPanel.classList.add('hidden');
      if (printReportBtn) printReportBtn.closest('.print-actions-bar')?.classList.add('hidden');
      return;
    }

    // Active trip exists
    if (!editingTripId && tripSetupPanel) {
      tripSetupPanel.classList.add('hidden');
    }
    if (activeTripBanner) activeTripBanner.classList.remove('hidden');
    if (expenseFormPanel) expenseFormPanel.classList.remove('hidden');
    if (expenseHistoryPanel) expenseHistoryPanel.classList.remove('hidden');
    if (summaryPanel) summaryPanel.classList.remove('hidden');
    if (printReportBtn) printReportBtn.closest('.print-actions-bar')?.classList.remove('hidden');

    // Update Active Trip Banner
    if (activeTripTitle) activeTripTitle.textContent = activeTrip.name;
    if (activeTripDestBadge) {
      if (activeTrip.destination) {
        activeTripDestBadge.textContent = `📍 ${activeTrip.destination}`;
        activeTripDestBadge.classList.remove('hidden');
      } else {
        activeTripDestBadge.classList.add('hidden');
      }
    }

    if (activeMembersList) {
      activeMembersList.innerHTML = '';
      (activeTrip.members || []).forEach(member => {
        const chip = document.createElement('span');
        chip.className = 'member-chip';
        chip.innerHTML = `<span class="member-chip-avatar">${member.charAt(0).toUpperCase()}</span> ${member}`;
        activeMembersList.appendChild(chip);
      });
    }

    // Populate Payer dropdown
    if (expensePayer) {
      const currentSelected = expensePayer.value;
      expensePayer.innerHTML = '<option value="" disabled selected>Select who paid</option>';
      (activeTrip.members || []).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        expensePayer.appendChild(opt);
      });
      if ((activeTrip.members || []).includes(currentSelected)) {
        expensePayer.value = currentSelected;
      }
    }

    const expenses = activeTrip.expenses || [];

    // Render Expense Table
    if (expenseTableBody) {
      expenseTableBody.innerHTML = '';

      if (expenses.length === 0) {
        if (emptyExpenseState) emptyExpenseState.classList.remove('hidden');
      } else {
        if (emptyExpenseState) emptyExpenseState.classList.add('hidden');

        expenses.forEach(exp => {
          const row = document.createElement('tr');

          let formattedDate = exp.date;
          try {
            const dateObj = new Date(exp.date + 'T00:00:00');
            formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          } catch (e) {}

          row.innerHTML = `
            <td><strong>${formattedDate}</strong></td>
            <td>${exp.payer}</td>
            <td><strong>${exp.name}</strong></td>
            <td><span class="category-tag">${exp.category}</span></td>
            <td class="amount-cell">${formatINR(exp.amount)}</td>
            <td class="actions-cell">
              <button class="btn-action-edit" onclick="editExpense('${exp.id}')">Edit</button>
              <button class="btn-action-delete" onclick="deleteExpense('${exp.id}')">Delete</button>
            </td>
          `;
          expenseTableBody.appendChild(row);
        });
      }
    }

    // ------------------------------------------------
    // Calculations: Totals, Fair Shares & Settlements
    // ------------------------------------------------
    const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const memberCount = (activeTrip.members || []).length || 1;
    const fairShare = memberCount > 0 ? (total / memberCount) : 0;

    // Map each member's actual paid amount
    const paidByMember = {};
    (activeTrip.members || []).forEach(m => paidByMember[m] = 0);
    expenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      if (paidByMember[e.payer] !== undefined) {
        paidByMember[e.payer] += amt;
      } else {
        paidByMember[e.payer] = amt;
      }
    });

    // Update Top Metric Cards
    if (totalTripExpense) totalTripExpense.textContent = formatINR(total);
    if (totalMembersCount) totalMembersCount.textContent = memberCount;
    if (averageExpensePerPerson) averageExpensePerPerson.textContent = formatINR(fairShare);

    // Update Member Payment Summary Table
    if (memberSummaryBody) {
      memberSummaryBody.innerHTML = '';
      (activeTrip.members || []).forEach(member => {
        const paid = paidByMember[member] || 0;
        const balance = paid - fairShare;

        const row = document.createElement('tr');
        const balanceClass = balance > 0.01 
          ? 'color: var(--accent);' 
          : balance < -0.01 
          ? 'color: var(--secondary);' 
          : 'color: var(--text-muted);';
        const balanceSign = balance > 0.01 ? '+' : '';

        row.innerHTML = `
          <td><strong>${member}</strong></td>
          <td style="text-align: right; font-weight: 700;">${formatINR(paid)}</td>
          <td style="text-align: right; color: var(--text-muted);">${formatINR(fairShare)}</td>
          <td style="text-align: right; font-weight: 800; ${balanceClass}">
            ${balanceSign}${formatINR(balance)}
          </td>
        `;
        memberSummaryBody.appendChild(row);
      });
    }

    // Calculate Direct Pairwise Settlements
    const directTransfers = calculateDirectSettlements(activeTrip.members || [], paidByMember, fairShare);

    // Update Pairwise Settlement List
    if (pairSettlementList) {
      pairSettlementList.innerHTML = '';

      if (directTransfers.length === 0) {
        const cleanItem = document.createElement('div');
        cleanItem.className = 'pair-settlement-item settled-clean';
        cleanItem.innerHTML = `
          <div class="pair-settlement-desc">
            <span>🎉</span> <span>All balances are settled! No one owes anything.</span>
          </div>
        `;
        pairSettlementList.appendChild(cleanItem);
      } else {
        directTransfers.forEach(t => {
          const item = document.createElement('div');
          item.className = 'pair-settlement-item';
          item.innerHTML = `
            <div class="pair-settlement-desc">
              <span class="pair-debtor">${t.from}</span>
              <span class="pair-arrow">pays</span>
              <span class="pair-creditor">${t.to}</span>
            </div>
            <div class="pair-amount">${formatINR(t.amount)}</div>
          `;
          pairSettlementList.appendChild(item);
        });
      }
    }

    // Update Individual Member Settlement Cards
    if (settlementList) {
      settlementList.innerHTML = '';

      (activeTrip.members || []).forEach(member => {
        const paid = paidByMember[member] || 0;
        const balance = paid - fairShare;
        const card = document.createElement('div');

        if (balance > 0.01) {
          card.className = 'settlement-card receive';
          card.innerHTML = `
            <div>
              <div class="settlement-member">${member}</div>
              <div class="settlement-sub">Paid ${formatINR(paid)} (Fair share: ${formatINR(fairShare)})</div>
            </div>
            <div class="settlement-badge receive">
              Should receive ${formatINR(balance)}
            </div>
          `;
        } else if (balance < -0.01) {
          card.className = 'settlement-card pay';
          card.innerHTML = `
            <div>
              <div class="settlement-member">${member}</div>
              <div class="settlement-sub">Paid ${formatINR(paid)} (Fair share: ${formatINR(fairShare)})</div>
            </div>
            <div class="settlement-badge pay">
              Should pay ${formatINR(Math.abs(balance))}
            </div>
          `;
        } else {
          card.className = 'settlement-card settled';
          card.innerHTML = `
            <div>
              <div class="settlement-member">${member}</div>
              <div class="settlement-sub">Paid ${formatINR(paid)} (Fair share: ${formatINR(fairShare)})</div>
            </div>
            <div class="settlement-badge settled">
              Settled Up (₹0 balance)
            </div>
          `;
        }

        settlementList.appendChild(card);
      });
    }

    // Update Dedicated Print Container (Active Trip Only)
    renderPrintReport(activeTrip, expenses, total, fairShare, paidByMember, directTransfers);
  }

  // --------------------------------------------------
  // Helper: Renders Print-only Dedicated Report for Active Trip
  // --------------------------------------------------
  function renderPrintReport(trip, expenses, total, fairShare, paidByMember, directTransfers) {
    const printContainer = document.getElementById('printableReport');
    if (!printContainer) return;

    const reportDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    let expenseRows = '';
    expenses.forEach((e, idx) => {
      expenseRows += `
        <tr>
          <td>${idx + 1}</td>
          <td>${e.date}</td>
          <td>${e.payer}</td>
          <td>${e.name}</td>
          <td>${e.category}</td>
          <td style="text-align: right; font-weight: bold;">${formatINR(e.amount)}</td>
        </tr>
      `;
    });

    let memberRows = '';
    (trip.members || []).forEach(m => {
      const paid = paidByMember[m] || 0;
      const balance = paid - fairShare;
      const status = balance > 0.01 
        ? `Should receive ${formatINR(balance)}`
        : balance < -0.01 
        ? `Should pay ${formatINR(Math.abs(balance))}` 
        : `Settled Up`;

      memberRows += `
        <tr>
          <td><strong>${m}</strong></td>
          <td style="text-align: right;">${formatINR(paid)}</td>
          <td style="text-align: right;">${formatINR(fairShare)}</td>
          <td style="text-align: right;"><strong>${balance > 0.01 ? '+' : ''}${formatINR(balance)}</strong></td>
          <td>${status}</td>
        </tr>
      `;
    });

    let transferRows = '';
    if (directTransfers.length === 0) {
      transferRows = '<tr><td colspan="3">All members are settled up. No debt transfers needed.</td></tr>';
    } else {
      directTransfers.forEach((t, i) => {
        transferRows += `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${t.from}</strong> pays <strong>${t.to}</strong></td>
            <td style="text-align: right; font-weight: bold;">${formatINR(t.amount)}</td>
          </tr>
        `;
      });
    }

    printContainer.innerHTML = `
      <div class="print-header">
        <div class="print-brand">TRAVELMATE</div>
        <div class="print-title">TRIP EXPENSE REPORT</div>
        <div class="print-meta">
          <div><strong>Trip:</strong> ${trip.name} ${trip.destination ? `(${trip.destination})` : ''}</div>
          <div><strong>Date Generated:</strong> ${reportDate}</div>
          <div><strong>Members (${(trip.members || []).length}):</strong> ${(trip.members || []).join(', ')}</div>
        </div>
      </div>

      <div style="display: flex; gap: 2rem; margin-bottom: 1.5rem; border: 1px solid #000; padding: 10pt;">
        <div><strong>TOTAL EXPENSES:</strong> ${formatINR(total)}</div>
        <div><strong>MEMBERS:</strong> ${(trip.members || []).length}</div>
        <div><strong>AVERAGE / FAIR SHARE:</strong> ${formatINR(fairShare)}</div>
      </div>

      <h3 style="font-size: 12pt; margin-bottom: 6pt;">DIRECT SETTLEMENT INSTRUCTIONS</h3>
      <table class="expense-table" style="margin-bottom: 1.5rem;">
        <thead>
          <tr>
            <th>#</th>
            <th>Direct Settlement Transfer</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${transferRows}
        </tbody>
      </table>

      <h3 style="font-size: 12pt; margin-bottom: 6pt;">ITEMIZED EXPENSES</h3>
      <table class="expense-table" style="margin-bottom: 1.5rem;">
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>Person</th>
            <th>Expense</th>
            <th>Category</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.length > 0 ? expenseRows : '<tr><td colspan="6">No expenses recorded.</td></tr>'}
        </tbody>
      </table>

      <h3 style="font-size: 12pt; margin-bottom: 6pt;">MEMBER PAYMENT & BALANCE SUMMARY</h3>
      <table class="expense-table">
        <thead>
          <tr>
            <th>Member</th>
            <th style="text-align: right;">Total Paid</th>
            <th style="text-align: right;">Fair Share</th>
            <th style="text-align: right;">Balance</th>
            <th>Settlement Status</th>
          </tr>
        </thead>
        <tbody>
          ${memberRows}
        </tbody>
      </table>
    `;
  }

  // Initial setup: render dynamic inputs if no trips exist
  const existingTrips = getAllTrips();
  if (existingTrips.length === 0 && memberNamesContainer) {
    renderMemberInputs(parseInt(numMembersInput?.value, 10) || 3);
  }

  // Render tracker state on load
  renderTracker();
}

