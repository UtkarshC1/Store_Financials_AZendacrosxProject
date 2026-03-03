// ==========================================
// State Management & Init
// ==========================================
let currentInput = '0';
let transactions = [];
let financeChartInstance = null; 

window.onload = () => {
    // Set Header Date
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    document.getElementById('current-date-display').innerText = new Date().toLocaleDateString('en-US', options);

    // Load Data
    const savedData = localStorage.getItem('storeFinancesGlassPro');
    if (savedData) {
        transactions = JSON.parse(savedData);
    }
    updateDisplay();
};

function vibrate() {
    if (navigator.vibrate) navigator.vibrate(40);
}

// ==========================================
// Navigation
// ==========================================
function switchTab(tab) {
    vibrate();
    document.getElementById('calc-view').classList.remove('active');
    document.getElementById('finance-view').classList.remove('active');
    document.getElementById('nav-calc').classList.remove('active');
    document.getElementById('nav-finance').classList.remove('active');

    if(tab === 'calc') {
        document.getElementById('calc-view').classList.add('active');
        document.getElementById('nav-calc').classList.add('active');
    } else {
        document.getElementById('finance-view').classList.add('active');
        document.getElementById('nav-finance').classList.add('active');
        // Reset filter view to today when entering
        document.getElementById('time-filter').value = 'today';
        handleFilterChange();
    }
}

// ==========================================
// Calculator Engine
// ==========================================
function append(val) {
    vibrate();
    if (currentInput === '0' && !['+', '-', '*', '/'].includes(val)) {
        currentInput = val;
    } else {
        currentInput += val;
    }
    updateDisplay();
}

function clearDisplay() {
    vibrate();
    currentInput = '0';
    updateDisplay();
}

function updateDisplay() {
    const displayElement = document.getElementById('display');
    displayElement.innerText = currentInput;
    if (currentInput.length > 10) displayElement.style.fontSize = '2.5rem';
    else if (currentInput.length > 15) displayElement.style.fontSize = '1.8rem';
    else displayElement.style.fontSize = '3.5rem';
}

function calculate() {
    vibrate();
    try {
        let result = new Function('return ' + currentInput)();
        currentInput = (Math.round(result * 100) / 100).toString();
    } catch (e) {
        currentInput = 'Error';
        setTimeout(clearDisplay, 1200);
    }
    updateDisplay();
}

// ==========================================
// Data Handling
// ==========================================
function addTransaction(type) {
    calculate(); 
    const amount = parseFloat(currentInput);
    
    if (isNaN(amount) || amount <= 0) {
        alert("Please calculate an amount greater than 0 first.");
        return;
    }

    const newTx = {
        id: Date.now(),
        type: type,
        amount: amount,
        date: new Date().toISOString()
    };

    transactions.push(newTx);
    localStorage.setItem('storeFinancesGlassPro', JSON.stringify(transactions));
    
    clearDisplay();
    
    // Button UI Feedback
    const btn = type === 'revenue' ? document.querySelector('.btn-rev') : document.querySelector('.btn-exp');
    const originalText = btn.querySelector('.btn-text').innerText;
    btn.querySelector('.btn-text').innerText = "Saved!";
    setTimeout(() => btn.querySelector('.btn-text').innerText = originalText, 1000);
}

function deleteTransaction(id) {
    vibrate();
    if(confirm("Delete this transaction?")) {
        transactions = transactions.filter(t => t.id !== id);
        localStorage.setItem('storeFinancesGlassPro', JSON.stringify(transactions));
        updateFinancials();
    }
}

// ==========================================
// Analytics & Chart Generation
// ==========================================

function handleFilterChange() {
    const filter = document.getElementById('time-filter').value;
    const customDateContainer = document.getElementById('custom-date-container');
    
    if (filter === 'custom') {
        customDateContainer.style.display = 'flex';
    } else {
        customDateContainer.style.display = 'none';
        // Clear inputs when hiding
        document.getElementById('date-start').value = '';
        document.getElementById('date-end').value = '';
    }
    updateFinancials();
}

function updateFinancials() {
    const filter = document.getElementById('time-filter').value;
    const now = new Date();
    
    // Custom date logic setup
    const startDateVal = document.getElementById('date-start').value;
    const endDateVal = document.getElementById('date-end').value;
    let customStart = startDateVal ? new Date(startDateVal) : null;
    let customEnd = endDateVal ? new Date(endDateVal) : null;
    
    // Ensure customEnd includes the whole end day up to 23:59:59
    if (customEnd) {
        customEnd.setHours(23, 59, 59, 999);
    }

    // 1. Filter Data based on selected time frame
    const filteredTx = transactions.filter(t => {
        const txDate = new Date(t.date);
        
        if (filter === 'today') {
            return txDate.toDateString() === now.toDateString();
        } 
        else if (filter === 'month') {
            return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
        } 
        else if (filter === 'last_month') {
            // Calculate previous month, handling January rollover
            let prevMonth = now.getMonth() - 1;
            let year = now.getFullYear();
            if (prevMonth < 0) {
                prevMonth = 11; // December
                year--;
            }
            return txDate.getMonth() === prevMonth && txDate.getFullYear() === year;
        } 
        else if (filter === 'year') {
            return txDate.getFullYear() === now.getFullYear();
        }
        else if (filter === 'custom') {
            // If both dates are selected, check range. If only one, or none, don't filter.
            if (customStart && customEnd) {
                return txDate >= customStart && txDate <= customEnd;
            } else if (customStart) {
                return txDate >= customStart;
            } else if (customEnd) {
                return txDate <= customEnd;
            }
            return true; // No dates selected yet, show all
        }
        return true; // 'all' time
    });

    let totalRev = 0;
    let totalExp = 0;
    const historyList = document.getElementById('history');
    historyList.innerHTML = ''; 

    // 2. Build Ledger List
    if (filteredTx.length === 0) {
        let msg = "No transactions for this period.";
        if (filter === 'custom' && (!startDateVal || !endDateVal)) {
            msg = "Please select a Start and End date.";
        }
        historyList.innerHTML = `<p style="text-align:center; color: var(--text-muted); padding: 20px;">${msg}</p>`;
    }

    [...filteredTx].reverse().forEach(t => {
        if (t.type === 'revenue') totalRev += t.amount;
        else totalExp += t.amount;

        const dateObj = new Date(t.date);
        // Format time dynamically based on filter
        const timeString = (filter === 'today') 
            ? dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            : dateObj.toLocaleDateString([], {month: 'short', day: 'numeric', year: 'numeric'});

        const li = document.createElement('li');
        li.className = `history-item ${t.type === 'revenue' ? 'rev' : 'exp'}`;
        
        li.innerHTML = `
            <div class="details">
                <span class="title">${t.type === 'revenue' ? 'Revenue' : 'Expense'}</span>
                <span class="date">${timeString}</span>
            </div>
            <div style="display: flex; align-items: center;">
                <span class="amount">${t.type === 'revenue' ? '+' : '-'}₹${t.amount.toLocaleString()}</span>
                <button class="delete-btn" onclick="deleteTransaction(${t.id})">×</button>
            </div>
        `;
        historyList.appendChild(li);
    });

    // 3. Update Text Summaries
    const net = totalRev - totalExp;
    const netElement = document.getElementById('net-amount');
    
    netElement.innerText = `₹${Math.abs(net).toLocaleString()}`;
    if (net > 0) netElement.style.color = 'var(--revenue)';
    else if (net < 0) {
        netElement.style.color = 'var(--expense)';
        netElement.innerText = "- " + netElement.innerText;
    } else netElement.style.color = 'var(--text-main)';

    document.getElementById('tot-rev').innerText = `₹${totalRev.toLocaleString()}`;
    document.getElementById('tot-exp').innerText = `₹${totalExp.toLocaleString()}`;

    // 4. Update Pie Chart
    updateChart(totalRev, totalExp);
}

function updateChart(revenue, expense) {
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    const emptyState = document.getElementById('chart-empty-state');

    // Handle empty data state
    if (revenue === 0 && expense === 0) {
        canvasWrapper.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    } else {
        canvasWrapper.style.display = 'block';
        emptyState.style.display = 'none';
    }

    const ctx = document.getElementById('financeChart').getContext('2d');

    // Destroy existing chart to prevent overlap bugs
    if (financeChartInstance) {
        financeChartInstance.destroy();
    }

    // Create new Doughnut Chart
    financeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Revenue', 'Expenses'],
            datasets: [{
                data: [revenue, expense],
                backgroundColor: [
                    '#059669', // Revenue Green
                    '#e11d48'  // Expense Red
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%', 
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { family: "'Poppins', sans-serif", size: 12 }
                    }
                }
            },
            animation: { animateScale: true, animateRotate: true }
        }
    });
}
// Register Service Worker for PWA (Add to Home Screen capabilities)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('ServiceWorker registered successfully with scope: ', registration.scope);
      })
      .catch((error) => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}