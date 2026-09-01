/**
 * Om Shanirajeshwar Fabrication (OSF) - Invoicing Core Engine
 */

function numberToIndianWords(amount) {
  if (amount === 0 || isNaN(amount)) return "Zero Rupees Only";

  var num = Math.abs(parseFloat(amount));
  var rupees = Math.floor(num);
  var paise = Math.round((num - rupees) * 100);

  var a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  var b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords999(n) {
    var str = "";
    if (n > 99) {
      str += a[Math.floor(n / 100)] + "Hundred ";
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + " " + a[n % 10];
    } else if (n > 0) {
      str += a[n];
    }
    return str;
  }

  function convertRupees(n) {
    if (n === 0) return "";
    var output = "";
    var crore = Math.floor(n / 10000000);
    n %= 10000000;
    var lakh = Math.floor(n / 100000);
    n %= 100000;
    var thousand = Math.floor(n / 1000);
    n %= 1000;
    var remainder = n;

    if (crore > 0) {
      output += inWords999(crore) + "Crore ";
    }
    if (lakh > 0) {
      output += inWords999(lakh) + "Lakh ";
    }
    if (thousand > 0) {
      output += inWords999(thousand) + "Thousand ";
    }
    if (remainder > 0) {
      output += inWords999(remainder);
    }
    return output.trim();
  }

  var words = "Rupees " + convertRupees(rupees);
  if (paise > 0) {
    words += " and " + inWords999(paise).trim() + " Paise";
  }
  words += " Only";
  return words.replace(/\s+/g, ' ').trim();
}

var OSFApp = {
  STORAGE_KEYS: {
    COMPANY: "osf_company_config",
    CLIENTS: "osf_clients_db",
    PRODUCTS: "osf_products_db",
    INVOICES: "osf_invoices_history",
    ACTIVE_INV: "osf_active_draft"
  },

  state: {
    company: null,
    clients: [],
    products: [],
    invoices: [],
    currentInvoice: null,
    activeTab: 'invoiceBuilder',
    printCopies: 'original_duplicate'
  },

  init: function() {
    this.loadState();
    
    // Only bind builder controls if present on page
    if (document.getElementById('invoiceItemsTbody')) {
      this.bindEvents();
      this.renderClientDropdowns();
      this.renderItemsMasterDropdown();
      this.renderPlaceOfSupplyDropdown();
      
      if (!this.state.currentInvoice || !this.state.currentInvoice.items || this.state.currentInvoice.items.length === 0) {
        this.createNewInvoice();
      } else {
        this.populateInvoiceForm();
        this.calculateTotals();
      }

      this.renderInvoicesList();
      this.renderClientsList();
      this.renderProductsList();
      this.populateCompanySettings();
    if (typeof OSFSync !== 'undefined') OSFSync.init();
    }
  },

  loadState: function() {
    try {
      var savedComp = localStorage.getItem(this.STORAGE_KEYS.COMPANY);
      this.state.company = savedComp ? JSON.parse(savedComp) : Object.assign({}, DEFAULT_COMPANY_CONFIG);

      var savedClients = localStorage.getItem(this.STORAGE_KEYS.CLIENTS);
      this.state.clients = savedClients ? JSON.parse(savedClients) : DEFAULT_CLIENTS.slice();

      var savedProds = localStorage.getItem(this.STORAGE_KEYS.PRODUCTS);
      this.state.products = savedProds ? JSON.parse(savedProds) : DEFAULT_PRODUCTS.slice();

      var savedInvoices = localStorage.getItem(this.STORAGE_KEYS.INVOICES);
      this.state.invoices = savedInvoices ? JSON.parse(savedInvoices) : [];

      var savedDraft = localStorage.getItem(this.STORAGE_KEYS.ACTIVE_INV);
      this.state.currentInvoice = savedDraft ? JSON.parse(savedDraft) : null;
    } catch(e) {
      console.error("Error loading state from localStorage", e);
      this.state.company = Object.assign({}, DEFAULT_COMPANY_CONFIG);
      this.state.clients = DEFAULT_CLIENTS.slice();
      this.state.products = DEFAULT_PRODUCTS.slice();
      this.state.invoices = [];
    }
  },

  saveState: function() {
    try {
      localStorage.setItem(this.STORAGE_KEYS.COMPANY, JSON.stringify(this.state.company));
      localStorage.setItem(this.STORAGE_KEYS.CLIENTS, JSON.stringify(this.state.clients));
      localStorage.setItem(this.STORAGE_KEYS.PRODUCTS, JSON.stringify(this.state.products));
      localStorage.setItem(this.STORAGE_KEYS.INVOICES, JSON.stringify(this.state.invoices));
      localStorage.setItem(this.STORAGE_KEYS.ACTIVE_INV, JSON.stringify(this.state.currentInvoice));
    } catch(e) {
      console.warn("Storage save error", e);
    }
  },

  showToast: function(message, type) {
    type = type || 'success';
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<span>' + (type === 'success' ? '✓' : '⚠') + '</span><span>' + message + '</span>';
    container.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
  },

  switchTab: function(tabName) {
    this.state.activeTab = tabName;
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.view-section').forEach(function(sec) {
      sec.classList.toggle('active', sec.id === tabName + 'View');
    });

    if (tabName === 'invoiceHistory') this.renderInvoicesList();
    if (tabName === 'clientsMaster') this.renderClientsList();
    if (tabName === 'productsMaster') this.renderProductsList();
    if (tabName === 'settings') this.populateCompanySettings();
    if (typeof OSFSync !== 'undefined') OSFSync.init();
  },

  getNextInvoiceNumber: function() {
    var prefix = (this.state.company && this.state.company.invoicePrefix) || "OSF/2026-27/";
    var highestNum = 0;
    this.state.invoices.forEach(function(inv) {
      if (inv.invoiceNo && inv.invoiceNo.startsWith(prefix)) {
        var numPart = parseInt(inv.invoiceNo.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > highestNum) highestNum = numPart;
      }
    });
    var nextNum = Math.max(highestNum + 1, (this.state.company && this.state.company.startingInvoiceNumber) || 1);
    var padded = nextNum < 10 ? '0' + nextNum : String(nextNum);
    return prefix + padded;
  },

  createNewInvoice: function() {
    var todayStr = new Date().toISOString().split('T')[0];
    this.state.currentInvoice = {
      id: "INV_" + Date.now(),
      invoiceNo: this.getNextInvoiceNumber(),
      invoiceDate: todayStr,
      billType: "Only Labour Charges",
      placeOfSupply: (this.state.company && this.state.company.defaultPlaceOfSupply) || "Maharashtra (27)",
      poNumber: "NA",
      poDate: "NA",
      transport: "NA",
      vehicleNo: "",
      billedTo: {
        company: "",
        address: "",
        gstin: "",
        state: "Maharashtra (27)"
      },
      shippedTo: {
        company: "",
        address: "",
        gstin: "",
        state: "Maharashtra (27)"
      },
      items: [
        {
          id: "item_1",
          description: "Structure Fabrication",
          hsn: "995413",
          qty: 33193,
          unit: "KG",
          rate: 14.00,
          taxable: 464702.00,
          gstRate: 18,
          cgstAmt: 41823.18,
          sgstAmt: 41823.18,
          igstAmt: 0.00,
          total: 548348.36
        }
      ],
      totalQty: 33193,
      subTotal: 464702.00,
      cgstTotal: 41823.18,
      sgstTotal: 41823.18,
      igstTotal: 0.00,
      totalTax: 83646.36,
      roundOff: 0.00,
      grandTotal: 548348.00,
      amountInWords: "",
      taxInWords: "",
      terms: ((this.state.company && this.state.company.termsAndConditions) || []).slice()
    };
    this.populateInvoiceForm();
    this.calculateTotals();
    this.saveState();
    this.updateLivePreview();
    
  },

  populateInvoiceForm: function() {
    var inv = this.state.currentInvoice;
    if (!inv) return;

    var setVal = function(id, val) {
      var el = document.getElementById(id);
      if (el) el.value = (val !== undefined && val !== null) ? val : '';
    };

    setVal('invNumber', inv.invoiceNo);
    setVal('invDate', inv.invoiceDate);
    setVal('invBillType', inv.billType || 'Only Labour Charges');
    setVal('invPlaceOfSupply', inv.placeOfSupply || 'Maharashtra (27)');
    setVal('invPoNumber', inv.poNumber || 'NA');
    setVal('invPoDate', inv.poDate || inv.invoiceDate);
    setVal('invTransport', inv.transport || 'NA');
    setVal('invVehicleNo', inv.vehicleNo || '');

    setVal('billToCompany', (inv.billedTo && inv.billedTo.company) || '');
    setVal('billToAddress', (inv.billedTo && inv.billedTo.address) || '');
    setVal('billToGstin', (inv.billedTo && inv.billedTo.gstin) || '');

    setVal('shipToCompany', (inv.shippedTo && inv.shippedTo.company) || '');
    setVal('shipToAddress', (inv.shippedTo && inv.shippedTo.address) || '');
    setVal('shipToGstin', (inv.shippedTo && inv.shippedTo.gstin) || '');

    this.renderItemsTable();
  },

  renderItemsTable: function() {
    var tbody = document.getElementById('invoiceItemsTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    var self = this;
    var inv = this.state.currentInvoice;
    if (!inv || !inv.items) return;

    inv.items.forEach(function(item, idx) {
      var tr = document.createElement('tr');
      tr.id = "builderRow_" + idx;
      tr.innerHTML = `
        <td style="text-align: center; vertical-align: middle; font-weight: 600;">${idx + 1}</td>
        <td>
          <input type="text" class="form-control item-desc" data-index="${idx}" value="${item.description || ''}" placeholder="Description of goods/services" list="productsDatalist" />
        </td>
        <td>
          <input type="text" class="form-control item-hsn" data-index="${idx}" value="${item.hsn || '995413'}" style="width: 90px;" />
        </td>
        <td>
          <input type="number" step="any" class="form-control item-qty" data-index="${idx}" value="${item.qty !== undefined ? item.qty : 0}" style="width: 90px; text-align: right;" />
        </td>
        <td>
          <select class="form-control item-unit" data-index="${idx}" style="width: 85px;">
            ${UNITS.map(function(u) { return `<option value="${u}" ${item.unit === u ? 'selected' : ''}>${u}</option>`; }).join('')}
          </select>
        </td>
        <td>
          <input type="number" step="0.01" class="form-control item-rate" data-index="${idx}" value="${item.rate !== undefined ? item.rate : 0}" style="width: 105px; text-align: right;" />
        </td>
        <td id="taxableCell_${idx}" style="text-align: right; vertical-align: middle; font-weight: 600; font-family: var(--font-mono); font-size: 0.9rem;">
          ₹${parseFloat(item.taxable || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </td>
        <td>
          <select class="form-control item-gstrate" data-index="${idx}" style="width: 75px;">
            ${GST_RATES.map(function(r) { return `<option value="${r}" ${item.gstRate === r ? 'selected' : ''}>${r}%</option>`; }).join('')}
          </select>
        </td>
        <td id="taxCell_${idx}" style="text-align: right; vertical-align: middle; font-size: 0.85rem; font-family: var(--font-mono);">
          ₹${parseFloat((item.cgstAmt || 0) + (item.sgstAmt || 0) + (item.igstAmt || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </td>
        <td id="netCell_${idx}" style="text-align: right; vertical-align: middle; font-weight: 700; font-family: var(--font-mono); color: var(--primary-dark);">
          ₹${parseFloat(item.total || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </td>
        <td style="text-align: center; vertical-align: middle;">
          <button type="button" class="btn btn-danger btn-sm" onclick="OSFApp.removeItem(${idx})" title="Remove line item">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    this.bindItemTableInputs();
  },

  bindItemTableInputs: function() {
    var self = this;

    document.querySelectorAll('.item-desc').forEach(function(input) {
      var handler = function() {
        var idx = parseInt(this.dataset.index, 10);
        var val = this.value.trim();
        self.state.currentInvoice.items[idx].description = val;
        var matched = self.state.products.find(function(p) { return p.name.toLowerCase() === val.toLowerCase(); });
        if (matched) {
          self.state.currentInvoice.items[idx].hsn = matched.hsn || '995413';
          self.state.currentInvoice.items[idx].unit = matched.unit || 'KG';
          if (matched.defaultRate && (!self.state.currentInvoice.items[idx].rate || self.state.currentInvoice.items[idx].rate === 0)) {
            self.state.currentInvoice.items[idx].rate = matched.defaultRate;
          }
          if (matched.gstRate !== undefined) {
            self.state.currentInvoice.items[idx].gstRate = matched.gstRate;
          }
          self.renderItemsTable();
        }
        self.calculateTotals();
      };
      input.addEventListener('change', handler);
      input.addEventListener('input', handler);
    });

    document.querySelectorAll('.item-hsn').forEach(function(input) {
      input.addEventListener('input', function() {
        var idx = parseInt(this.dataset.index, 10);
        self.state.currentInvoice.items[idx].hsn = this.value;
        self.saveState();
      });
    });

    document.querySelectorAll('.item-qty').forEach(function(input) {
      var recalculate = function() {
        var idx = parseInt(this.dataset.index, 10);
        self.state.currentInvoice.items[idx].qty = parseFloat(this.value) || 0;
        self.calculateTotals();
      };
      input.addEventListener('input', recalculate);
      input.addEventListener('keyup', recalculate);
      input.addEventListener('change', recalculate);
    });

    document.querySelectorAll('.item-unit').forEach(function(select) {
      select.addEventListener('change', function() {
        var idx = parseInt(this.dataset.index, 10);
        self.state.currentInvoice.items[idx].unit = this.value;
        self.saveState();
      });
    });

    document.querySelectorAll('.item-rate').forEach(function(input) {
      var recalculate = function() {
        var idx = parseInt(this.dataset.index, 10);
        self.state.currentInvoice.items[idx].rate = parseFloat(this.value) || 0;
        self.calculateTotals();
      };
      input.addEventListener('input', recalculate);
      input.addEventListener('keyup', recalculate);
      input.addEventListener('change', recalculate);
    });

    document.querySelectorAll('.item-gstrate').forEach(function(select) {
      select.addEventListener('change', function() {
        var idx = parseInt(this.dataset.index, 10);
        self.state.currentInvoice.items[idx].gstRate = parseFloat(this.value) || 0;
        self.calculateTotals();
      });
    });
  },

  addItem: function() {
    this.state.currentInvoice.items.push({
      id: "item_" + Date.now(),
      description: "",
      hsn: "995413",
      qty: 1,
      unit: "KG",
      rate: 0.00,
      taxable: 0.00,
      gstRate: 18,
      cgstAmt: 0.00,
      sgstAmt: 0.00,
      igstAmt: 0.00,
      total: 0.00
    });
    this.renderItemsTable();
    this.calculateTotals();
  },

  removeItem: function(idx) {
    if (this.state.currentInvoice.items.length <= 1) {
      this.showToast("Invoice must contain at least 1 line item", "error");
      return;
    }
    this.state.currentInvoice.items.splice(idx, 1);
    this.renderItemsTable();
    this.calculateTotals();
  },

  calculateTotals: function() {
    var inv = this.state.currentInvoice;
    if (!inv) return;

    var isInterState = false;
    var placeOfSupply = (inv.placeOfSupply || "").trim();
    if (placeOfSupply && !placeOfSupply.toLowerCase().includes("maharashtra") && !placeOfSupply.includes("27")) {
      isInterState = true;
    }

    var totalQty = 0;
    var subTotal = 0;
    var cgstTotal = 0;
    var sgstTotal = 0;
    var igstTotal = 0;

    inv.items.forEach(function(item, idx) {
      var q = parseFloat(item.qty) || 0;
      var r = parseFloat(item.rate) || 0;
      var g = parseFloat(item.gstRate) || 0;

      var taxable = q * r;
      item.taxable = taxable;
      totalQty += q;
      subTotal += taxable;

      var taxAmount = taxable * (g / 100);

      if (isInterState) {
        item.cgstAmt = 0;
        item.sgstAmt = 0;
        item.igstAmt = taxAmount;
        igstTotal += taxAmount;
      } else {
        var halfTax = taxAmount / 2;
        item.cgstAmt = halfTax;
        item.sgstAmt = halfTax;
        item.igstAmt = 0;
        cgstTotal += halfTax;
        sgstTotal += halfTax;
      }

      var itemNet = taxable + taxAmount;
      item.total = itemNet;

      var taxableCell = document.getElementById("taxableCell_" + idx);
      if (taxableCell) taxableCell.innerText = "₹" + taxable.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

      var taxCell = document.getElementById("taxCell_" + idx);
      if (taxCell) taxCell.innerText = "₹" + taxAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

      var netCell = document.getElementById("netCell_" + idx);
      if (netCell) netCell.innerText = "₹" + itemNet.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    });

    var totalTax = isInterState ? igstTotal : (cgstTotal + sgstTotal);
    var rawGrandTotal = subTotal + totalTax;
    var roundedGrandTotal = Math.round(rawGrandTotal);
    var roundOff = roundedGrandTotal - rawGrandTotal;

    inv.totalQty = totalQty;
    inv.subTotal = subTotal;
    inv.cgstTotal = cgstTotal;
    inv.sgstTotal = sgstTotal;
    inv.igstTotal = igstTotal;
    inv.totalTax = totalTax;
    inv.roundOff = roundOff;
    inv.grandTotal = roundedGrandTotal;

    inv.amountInWords = numberToIndianWords(roundedGrandTotal);
    inv.taxInWords = numberToIndianWords(totalTax);

    var subTotalEl = document.getElementById('summarySubTotal');
    if (subTotalEl) subTotalEl.innerText = "₹" + subTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    var cgstRow = document.getElementById('summaryCgstRow');
    var sgstRow = document.getElementById('summarySgstRow');
    var igstRow = document.getElementById('summaryIgstRow');

    if (isInterState) {
      if (cgstRow) cgstRow.style.display = 'none';
      if (sgstRow) sgstRow.style.display = 'none';
      if (igstRow) {
        igstRow.style.display = 'flex';
        var igstEl = document.getElementById('summaryIgst');
        if (igstEl) igstEl.innerText = "₹" + igstTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
      }
    } else {
      if (cgstRow) {
        cgstRow.style.display = 'flex';
        var cgstEl = document.getElementById('summaryCgst');
        if (cgstEl) cgstEl.innerText = "₹" + cgstTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
      }
      if (sgstRow) {
        sgstRow.style.display = 'flex';
        var sgstEl = document.getElementById('summarySgst');
        if (sgstEl) sgstEl.innerText = "₹" + sgstTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
      }
      if (igstRow) igstRow.style.display = 'none';
    }

    var roundOffEl = document.getElementById('summaryRoundOff');
    if (roundOffEl) roundOffEl.innerText = (roundOff >= 0 ? "+₹" : "-₹") + Math.abs(roundOff).toFixed(2);

    var grandTotalEl = document.getElementById('summaryGrandTotal');
    if (grandTotalEl) grandTotalEl.innerText = "₹" + roundedGrandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    var amountWordsEl = document.getElementById('summaryAmountWords');
    if (amountWordsEl) amountWordsEl.innerText = inv.amountInWords;

    var taxWordsEl = document.getElementById('summaryTaxWords');
    if (taxWordsEl) taxWordsEl.innerText = inv.taxInWords;

    this.saveState();
    this.updateLivePreview();
    
  },

  bindEvents: function() {
    var self = this;

    document.querySelectorAll('.nav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self.switchTab(this.dataset.tab);
      });
    });

    ['invNumber', 'invDate', 'invBillType', 'invPlaceOfSupply', 'invPoNumber', 'invPoDate', 'invTransport', 'invVehicleNo'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', function() {
          var field = id === 'invNumber' ? 'invoiceNo' :
                      id === 'invDate' ? 'invoiceDate' :
                      id === 'invBillType' ? 'billType' :
                      id === 'invPlaceOfSupply' ? 'placeOfSupply' :
                      id === 'invPoNumber' ? 'poNumber' :
                      id === 'invPoDate' ? 'poDate' :
                      id === 'invTransport' ? 'transport' : 'vehicleNo';
          self.state.currentInvoice[field] = this.value;
          if (field === 'placeOfSupply' || field === 'billType') self.calculateTotals();
          else self.saveState();
        });
      }
    });

    ['billToCompany', 'billToAddress', 'billToGstin'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', function() {
          var key = id === 'billToCompany' ? 'company' : id === 'billToAddress' ? 'address' : 'gstin';
          self.state.currentInvoice.billedTo[key] = this.value;
          self.saveState();
        });
      }
    });

    ['shipToCompany', 'shipToAddress', 'shipToGstin'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', function() {
          var key = id === 'shipToCompany' ? 'company' : id === 'shipToAddress' ? 'address' : 'gstin';
          self.state.currentInvoice.shippedTo[key] = this.value;
          self.saveState();
        });
      }
    });

    var clientSelect = document.getElementById('clientQuickSelect');
    if (clientSelect) {
      clientSelect.addEventListener('change', function() {
        var cliId = this.value;
        if (!cliId) return;
        var selectedClient = self.state.clients.find(function(c) { return c.id === cliId; });
        if (selectedClient) {
          self.state.currentInvoice.billedTo = {
            company: selectedClient.company,
            address: selectedClient.address,
            gstin: selectedClient.gstin,
            state: selectedClient.state || "Maharashtra (27)"
          };
          self.state.currentInvoice.shippedTo = {
            company: selectedClient.company,
            address: selectedClient.address,
            gstin: selectedClient.gstin,
            state: selectedClient.state || "Maharashtra (27)"
          };
          self.populateInvoiceForm();
          self.calculateTotals();
          self.showToast("Client details auto-filled for " + selectedClient.company);
        }
      });
    }

    var copyShipBtn = document.getElementById('copyBillToShipBtn');
    if (copyShipBtn) {
      copyShipBtn.addEventListener('click', function() {
        self.state.currentInvoice.shippedTo = Object.assign({}, self.state.currentInvoice.billedTo);
        self.populateInvoiceForm();
        self.showToast("Copied Billed-To details into Shipped-To");
      });
    }
  },

  renderClientDropdowns: function() {
    var select = document.getElementById('clientQuickSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- Choose from Client Master --</option>' +
      this.state.clients.map(function(c) {
        return `<option value="${c.id}">${c.company} (${c.gstin || 'Unregistered'})</option>`;
      }).join('');
  },

  renderItemsMasterDropdown: function() {
    var datalist = document.getElementById('productsDatalist');
    if (!datalist) return;
    datalist.innerHTML = this.state.products.map(function(p) {
      return `<option value="${p.name}">HSN: ${p.hsn} | Unit: ${p.unit} | Default Rate: ₹${p.defaultRate}</option>`;
    }).join('');
  },

  renderPlaceOfSupplyDropdown: function() {
    var select = document.getElementById('invPlaceOfSupply');
    if (!select) return;
    select.innerHTML = INDIAN_STATES.map(function(s) {
      return `<option value="${s.name}">${s.name}</option>`;
    }).join('');
    select.value = "Maharashtra (27)";
  },

  saveCurrentInvoiceToHistory: function(silent) {
    this.calculateTotals();
    var inv = this.state.currentInvoice;
    if (!inv.invoiceNo) {
      if (!silent) this.showToast("Please enter an Invoice Number", "error");
      return;
    }
    if (!inv.billedTo || !inv.billedTo.company) {
      if (!silent) this.showToast("Please enter Client / Billed-to Name", "error");
      return;
    }

    var existingIdx = this.state.invoices.findIndex(function(i) { return i.invoiceNo === inv.invoiceNo || i.id === inv.id; });
    if (existingIdx >= 0) {
      this.state.invoices[existingIdx] = JSON.parse(JSON.stringify(inv));
      if (!silent) this.showToast("Invoice " + inv.invoiceNo + " updated in history!");
    } else {
      this.state.invoices.unshift(JSON.parse(JSON.stringify(inv)));
      if (!silent) this.showToast("Invoice " + inv.invoiceNo + " saved to history!");
    }
    this.saveState();
    this.renderInvoicesList();
    if (typeof OSFSync !== 'undefined') OSFSync.pushInvoice(inv);
  },

  renderInvoicesList: function() {
    var tbody = document.getElementById('invoicesHistoryTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (this.state.invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No saved invoices yet. Create your first invoice!</td></tr>';
      return;
    }

    var searchVal = (document.getElementById('invoiceSearchInput') ? document.getElementById('invoiceSearchInput').value : "").toLowerCase();

    var filtered = this.state.invoices.filter(function(inv) {
      if (!searchVal) return true;
      var comp = (inv.billedTo && inv.billedTo.company) || "";
      var no = inv.invoiceNo || "";
      return comp.toLowerCase().includes(searchVal) || no.toLowerCase().includes(searchVal);
    });

    filtered.forEach(function(inv) {
      var tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 700; font-family: var(--font-mono); color: var(--primary-light);">${inv.invoiceNo}</td>
        <td>${inv.invoiceDate || 'N/A'}</td>
        <td style="font-weight: 600;">${(inv.billedTo && inv.billedTo.company) || 'N/A'}</td>
        <td style="font-family: var(--font-mono);">${(inv.billedTo && inv.billedTo.gstin) || 'Unregistered'}</td>
        <td style="text-align: right; font-weight: 700; font-family: var(--font-mono);">₹${(inv.grandTotal || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
        <td><span class="badge badge-green">${inv.billType || 'Only Labour Charges'}</span></td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-outline btn-sm" onclick="OSFApp.loadInvoiceForEdit('${inv.id}')" title="Edit/Open">✏️ Open</button>
          <button class="btn btn-primary btn-sm" onclick="OSFApp.loadAndPrintInvoice('${inv.id}')" title="Print in New Tab">🖨️ Print Tab</button>
          <button class="btn btn-danger btn-sm" onclick="OSFApp.deleteInvoice('${inv.id}')" title="Delete">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  loadInvoiceForEdit: function(invId) {
    var found = this.state.invoices.find(function(i) { return i.id === invId; });
    if (found) {
      this.state.currentInvoice = JSON.parse(JSON.stringify(found));
      this.populateInvoiceForm();
      this.calculateTotals();
      this.switchTab('invoiceBuilder');
      this.showToast("Loaded Invoice " + found.invoiceNo + " for editing");
    }
  },

    getDynamicPdfTitle: function(inv) {
    inv = inv || this.state.currentInvoice;
    if (!inv) return "Invoice";

    var company = (inv.billedTo && inv.billedTo.company) ? inv.billedTo.company.trim() : "Invoice";
    
    // Extract strictly the FIRST WORD of company name (e.g. 'PM' from 'PM Industries...', 'Gloria' from 'Gloria engineers')
    var words = company.split(/[\s,-]+/);
    var firstWord = words[0] || "Invoice";
    firstWord = firstWord.replace(/[^a-zA-Z0-9]/g, '').trim();
    if (!firstWord) firstWord = "Invoice";

    // Extract bill number suffix (e.g. from 'OSF/2026-27/04' -> '04', or '05' from 'OSF/2026-27/05')
    var billNo = (inv.invoiceNo || "").trim();
    var billSuffix = billNo;
    if (billNo.indexOf('/') !== -1) {
      var parts = billNo.split('/');
      billSuffix = parts[parts.length - 1];
    } else if (billNo.indexOf('-') !== -1) {
      var parts = billNo.split('-');
      billSuffix = parts[parts.length - 1];
    }
    if (!billSuffix) billSuffix = "01";

    return firstWord + "-" + billSuffix;
  },

  printLiveInvoice: function() {
    this.calculateTotals();
    var defaultTitle = "Om Shanirajeshwar Fabrication | Tax Invoicing System";
    var pdfFileName = this.getDynamicPdfTitle(this.state.currentInvoice);
    
    // Set title for PDF save dialog
    document.title = pdfFileName;
    
    // Trigger Print / PDF Save
    window.print();

    // Restore tab title after printing
    setTimeout(function() {
      document.title = defaultTitle;
    }, 1500);
  },

  setPrintCopies: function(mode) {
    this.state.printCopies = mode;
    this.updateLivePreview();
    
  },

  updateLivePreview: function() {
    var container = document.getElementById("liveInvoiceContainer");
    if (!container) container = document.getElementById("liveInvoiceSheet");
    if (!container || !this.state.currentInvoice) return;

    var inv = this.state.currentInvoice;
    var mode = this.state.printCopies || "original_duplicate";

    var copyList = [];
    if (mode === "original") {
      copyList = ["ORIGINAL FOR RECIPIENT"];
    } else if (mode === "original_duplicate") {
      copyList = ["ORIGINAL FOR RECIPIENT", "DUPLICATE FOR TRANSPORTER"];
    } else if (mode === "triplicate") {
      copyList = ["ORIGINAL FOR RECIPIENT", "DUPLICATE FOR TRANSPORTER", "TRIPLICATE FOR SUPPLIER"];
    } else {
      copyList = ["ORIGINAL FOR RECIPIENT", "DUPLICATE FOR TRANSPORTER"];
    }

    var html = "";
    var self = this;
    copyList.forEach(function(label) {
      html += '<div class="invoice-sheet">' + self.generateInvoiceHTML(inv, label) + '</div>';
    });

    container.innerHTML = html;
  },

  deleteInvoice: function(invId) {
    if (!confirm("Are you sure you want to delete this invoice record?")) return;
    this.state.invoices = this.state.invoices.filter(function(i) { return i.id !== invId; });
    this.saveState();
    this.renderInvoicesList();
    this.showToast("Invoice deleted successfully");
    if (typeof OSFSync !== 'undefined') OSFSync.deleteInvoice(invId);
  },

  // --- Flat Master Table HTML Generator ---
  generateInvoiceHTML: function(inv, copyLabel) {
    copyLabel = copyLabel || "Original for Recipient";
    var comp = this.state.company || DEFAULT_COMPANY_CONFIG;
    var isInterState = false;
    var pos = (inv.placeOfSupply || "").trim();
    if (pos && !pos.toLowerCase().includes("maharashtra") && !pos.includes("27")) {
      isInterState = true;
    }

    var isOnlyLabour = (inv.billType === "Only Labour Charges" || !inv.billType);
    var firstRowTitle = isOnlyLabour ? "Only Labour Charges" : "With Labour & Material";

    var totalQty = 0;
    var totalTaxable = 0;
    var totalCgst = 0;
    var totalSgst = 0;
    var totalIgst = 0;
    var totalNet = 0;

    
    // Group Items by HSN for GST Summary Table
    var hsnMap = {};
    if (inv.items && inv.items.length > 0) {
      inv.items.forEach(function(item) {
        var hsn = (item.hsn || "995413").trim();
        if (!hsnMap[hsn]) {
          hsnMap[hsn] = {
            hsn: hsn,
            taxable: 0,
            gstRate: parseFloat(item.gstRate) || 18,
            cgstAmt: 0,
            sgstAmt: 0,
            igstAmt: 0,
            totalTax: 0
          };
        }
        var taxVal = parseFloat(item.taxable) || 0;
        hsnMap[hsn].taxable += taxVal;
        hsnMap[hsn].cgstAmt += parseFloat(item.cgstAmt) || 0;
        hsnMap[hsn].sgstAmt += parseFloat(item.sgstAmt) || 0;
        hsnMap[hsn].igstAmt += parseFloat(item.igstAmt) || 0;
        hsnMap[hsn].totalTax += (parseFloat(item.cgstAmt) || 0) + (parseFloat(item.sgstAmt) || 0) + (parseFloat(item.igstAmt) || 0);
      });
    } else {
      hsnMap["995413"] = { hsn: "995413", taxable: 0, gstRate: 18, cgstAmt: 0, sgstAmt: 0, igstAmt: 0, totalTax: 0 };
    }

    var gstSummaryRowsHtml = "";
    Object.keys(hsnMap).forEach(function(hsn) {
      var grp = hsnMap[hsn];
      var halfRate = (grp.gstRate / 2).toFixed(1).replace('.0', '');
      var fullRate = grp.gstRate.toFixed(1).replace('.0', '');
      gstSummaryRowsHtml += `
        <tr>
          <td style="border: 1px solid #000; padding: 2px 4px; font-weight: bold;">${grp.hsn}</td>
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: right;">₹${grp.taxable.toFixed(2)}</td>
          ${isInterState ? `
            <td style="border: 1px solid #000; padding: 2px 4px; text-align: center;">${fullRate}%</td>
            <td style="border: 1px solid #000; padding: 2px 4px; text-align: right;">₹${grp.igstAmt.toFixed(2)}</td>
          ` : `
            <td style="border: 1px solid #000; padding: 2px 4px; text-align: center;">${halfRate}%</td>
            <td style="border: 1px solid #000; padding: 2px 4px; text-align: right;">₹${grp.cgstAmt.toFixed(2)}</td>
            <td style="border: 1px solid #000; padding: 2px 4px; text-align: center;">${halfRate}%</td>
            <td style="border: 1px solid #000; padding: 2px 4px; text-align: right;">₹${grp.sgstAmt.toFixed(2)}</td>
          `}
          <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-weight: bold;">₹${grp.totalTax.toFixed(2)}</td>
        </tr>
      `;
    });

    var itemsRowsHtml = "";

    // 1. First Row: * Only Labour Charges / With Labour & Material (No HSN, no qty/rate/gst/net)
    itemsRowsHtml += `
      <tr class="inv-tally-item-row">
        <td class="text-center" style="font-weight: bold;">*</td>
        <td class="text-left" style="font-weight: bold; font-size: 10.5px;">${firstRowTitle}</td>
        <td class="text-center"></td>
        <td class="text-right"></td>
        <td class="text-center"></td>
        <td class="text-right"></td>
        <td class="text-right"></td>
        <td class="text-center"></td>
        <td class="text-right"></td>
        <td class="text-right"></td>
      </tr>
    `;

    // 2. Product Items (Zero Horizontal Inner Lines)
    if (inv.items && inv.items.length > 0) {
      inv.items.forEach(function(item, i) {
        totalQty += parseFloat(item.qty) || 0;
        totalTaxable += parseFloat(item.taxable) || 0;
        totalCgst += parseFloat(item.cgstAmt) || 0;
        totalSgst += parseFloat(item.sgstAmt) || 0;
        totalIgst += parseFloat(item.igstAmt) || 0;
        totalNet += parseFloat(item.total) || 0;

        itemsRowsHtml += `
          <tr class="inv-tally-item-row">
            <td class="text-center">${i + 1}</td>
            <td class="text-left" style="font-weight: 500;">${item.description || ''}</td>
            <td class="text-center">${item.hsn || '995413'}</td>
            <td class="text-right">${item.qty ? parseFloat(item.qty).toLocaleString('en-IN') : ''}</td>
            <td class="text-center">${item.unit || ''}</td>
            <td class="text-right">${item.rate ? parseFloat(item.rate).toFixed(2) : ''}</td>
            <td class="text-right" style="font-weight: 600;">${item.taxable ? parseFloat(item.taxable).toFixed(2) : ''}</td>
            <td class="text-center">${item.gstRate ? item.gstRate + '%' : ''}</td>
            <td class="text-right">${(item.cgstAmt || item.sgstAmt || item.igstAmt) ? parseFloat(item.cgstAmt + item.sgstAmt + item.igstAmt).toFixed(2) : ''}</td>
            <td class="text-right" style="font-weight: bold;">${item.total ? parseFloat(item.total).toFixed(2) : ''}</td>
          </tr>
        `;
      });
    }

    // 3. Single Clean Tally Filler Row
    itemsRowsHtml += `
      <tr class="inv-tally-filler-row">
        <td>&nbsp;</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    `;

    var totalTax = isInterState ? totalIgst : (totalCgst + totalSgst);
    var grandTotal = Math.round(totalTaxable + totalTax);
    var roundOff = (grandTotal - (totalTaxable + totalTax)).toFixed(2);

    var termsHtml = ((comp && comp.termsAndConditions) || []).map(function(t) {
      return `<li>${t}</li>`;
    }).join('');

    var logoSrc = (typeof OSF_LOGO_BASE64 !== 'undefined' && OSF_LOGO_BASE64) ? OSF_LOGO_BASE64 : ((comp && comp.logoUrl) || "assets/logo.png");

    var transportDetails = [inv.transport, inv.vehicleNo].filter(function(x){ return x && x.trim() && x.trim().toUpperCase() !== 'NA'; }).join(' / ') || 'NA';

    return `
      <table class="inv-outer-table">
        <colgroup>
          <col style="width: 30px;" />
          <col style="width: auto;" />
          <col style="width: 65px;" />
          <col style="width: 55px;" />
          <col style="width: 38px;" />
          <col style="width: 62px;" />
          <col style="width: 80px;" />
          <col style="width: 45px;" />
          <col style="width: 72px;" />
          <col style="width: 85px;" />
        </colgroup>

        <!-- TOP HEADER: Copy type & Title -->
        <tr>
          <td colspan="10" style="padding: 3px 6px; border-bottom: 1px solid #000;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 10.5px; font-weight: bold; color: #000000;">TAX INVOICE</div>
              <div class="inv-top-copy"><span class="inv-top-badge">${copyLabel}</span></div>
            </div>
          </td>
        </tr>

        <!-- COMPANY BRANDING: 3-COLUMN MATHEMATICAL CENTER -->
        <tr>
          <td colspan="10" style="padding: 6px 8px; border-bottom: 1.5px solid #000;">
            <table style="width: 100%; border: none; border-collapse: collapse;">
              <tr>
                <td style="width: 135px; vertical-align: middle; border: none; text-align: left; padding: 2px;">
                  <img src="${logoSrc}" class="inv-logo-large" alt="OSF Logo" />
                </td>
                <td style="vertical-align: middle; border: none; text-align: center;">
                  <div class="inv-company-name">${comp.companyName}</div>
                  <div class="inv-company-tagline">${comp.tagline || 'Industrial & Heavy Structural Fabrication, Shed & Engineering Works'}</div>
                  <div class="inv-company-details">
                    <div>${comp.address}</div>
                    <div style="margin-top: 1px;"><span class="inv-bold">GSTIN:</span> ${comp.gstin} &nbsp;|&nbsp; <span class="inv-bold">PAN:</span> ${comp.pan}</div>
                    <div><span class="inv-bold">Phone:</span> ${comp.phone} &nbsp;|&nbsp; <span class="inv-bold">Email:</span> ${comp.email} &nbsp;|&nbsp; <span class="inv-bold">Web:</span> ${comp.website || "www.omshanifab.in"}</div>
                  </div>
                </td>
                <td style="width: 135px; border: none;"></td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- INVOICE META BAR (PO / Ref No, PO Date, Transport) -->
        <tr>
          <td colspan="5" style="vertical-align: top; padding: 4px 6px;">
            <div class="inv-meta-label"><span class="inv-bold">Invoice No:</span> <span style="font-weight: bold; font-size: 11px;">${inv.invoiceNo}</span></div>
            <div class="inv-meta-label" style="margin-top: 2px;"><span class="inv-bold">Invoice Date:</span> ${inv.invoiceDate}</div>
            <div class="inv-meta-label" style="margin-top: 2px;"><span class="inv-bold">Place of Supply:</span> ${inv.placeOfSupply}</div>
          </td>
          <td colspan="5" style="vertical-align: top; padding: 4px 6px;">
            <div class="inv-meta-label"><span class="inv-bold">PO / Ref No:</span> <span style="font-weight: bold;">${inv.poNumber || 'NA'}</span></div>
            <div class="inv-meta-label" style="margin-top: 2px;"><span class="inv-bold">PO / Ref Date:</span> ${inv.poDate || 'NA'}</div>
            <div class="inv-meta-label" style="margin-top: 2px;"><span class="inv-bold">Transport / Dispatch:</span> ${transportDetails}</div>
          </td>
        </tr>

        <!-- BILLED TO & SHIPPED TO HEADERS -->
        <tr style="background-color: #fafafa;">
          <td colspan="5" style="font-weight: bold; font-size: 10.5px; padding: 3px 6px;">Billed To (Details of Receiver):</td>
          <td colspan="5" style="font-weight: bold; font-size: 10.5px; padding: 3px 6px;">Shipped To (Consignee):</td>
        </tr>
        <tr>
          <td colspan="5" style="padding: 4px 6px; vertical-align: top; height: 58px;">
            <div style="font-size: 11.5px; font-weight: bold;">${(inv.billedTo && inv.billedTo.company) || ''}</div>
            <div style="margin-top: 2px; line-height: 1.3;">${(inv.billedTo && inv.billedTo.address) || ''}</div>
            <div style="margin-top: 3px;"><span class="inv-bold">GSTIN/UIN:</span> ${(inv.billedTo && inv.billedTo.gstin) || 'Unregistered'}</div>
          </td>
          <td colspan="5" style="padding: 4px 6px; vertical-align: top; height: 58px;">
            <div style="font-size: 11.5px; font-weight: bold;">${(inv.shippedTo && inv.shippedTo.company) || (inv.billedTo && inv.billedTo.company) || ''}</div>
            <div style="margin-top: 2px; line-height: 1.3;">${(inv.shippedTo && inv.shippedTo.address) || (inv.billedTo && inv.billedTo.address) || ''}</div>
            <div style="margin-top: 3px;"><span class="inv-bold">GSTIN/UIN:</span> ${(inv.shippedTo && inv.shippedTo.gstin) || (inv.billedTo && inv.billedTo.gstin) || 'Unregistered'}</div>
          </td>
        </tr>

        <!-- ITEM HEADERS -->
        <tr>
          <th class="inv-item-header-th">Sr.</th>
          <th class="inv-item-header-th">Description of Goods / Services</th>
          <th class="inv-item-header-th">HSN/SAC</th>
          <th class="inv-item-header-th">Qty</th>
          <th class="inv-item-header-th">Unit</th>
          <th class="inv-item-header-th">Rate (₹)</th>
          <th class="inv-item-header-th">Taxable (₹)</th>
          <th class="inv-item-header-th">GST %</th>
          <th class="inv-item-header-th">Tax (₹)</th>
          <th class="inv-item-header-th">Net Amt (₹)</th>
        </tr>

        <!-- ITEMS + FILLER ROWS (Pure Tally Style) -->
        ${itemsRowsHtml}

        <!-- TOTAL / SUBTOTAL ROW -->
        <tr class="inv-items-total-row">
          <td colspan="3" class="text-right" style="padding: 4px 6px;">Total / Subtotal:</td>
          <td class="text-right">${totalQty.toLocaleString('en-IN')}</td>
          <td></td>
          <td></td>
          <td class="text-right">₹${totalTaxable.toFixed(2)}</td>
          <td></td>
          <td class="text-right">₹${totalTax.toFixed(2)}</td>
          <td class="text-right">₹${(totalTaxable + totalTax).toFixed(2)}</td>
        </tr>

        <!-- FULL WIDTH GST ANALYSIS -->

        <!-- FULL WIDTH AUTHENTIC TALLY GST TAX ANALYSIS TABLE -->
        <tr>
          <td colspan="10" style="padding: 4px 6px; background-color: #fafafa;">
            <div style="font-weight: bold; font-size: 9.5px; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.3px;">Tax Amount (in words) / Tax Analysis:</div>
            <table style="width: 100%; border: 1px solid #000; border-collapse: collapse; font-size: 9.5px; text-align: center; background: #ffffff;">
              <thead>
                <tr style="background-color: #f2f2f2; font-weight: bold;">
                  <th rowspan="2" style="border: 1px solid #000; padding: 3px 4px; vertical-align: middle;">HSN/SAC</th>
                  <th rowspan="2" style="border: 1px solid #000; padding: 3px 4px; vertical-align: middle;">Taxable Value (₹)</th>
                  ${isInterState ? `
                    <th colspan="2" style="border: 1px solid #000; padding: 2px 4px;">Integrated Tax</th>
                  ` : `
                    <th colspan="2" style="border: 1px solid #000; padding: 2px 4px;">Central Tax</th>
                    <th colspan="2" style="border: 1px solid #000; padding: 2px 4px;">State Tax</th>
                  `}
                  <th rowspan="2" style="border: 1px solid #000; padding: 3px 4px; vertical-align: middle;">Total Tax (₹)</th>
                </tr>
                <tr style="background-color: #f2f2f2; font-weight: bold;">
                  ${isInterState ? `
                    <th style="border: 1px solid #000; padding: 2px 4px;">Rate</th>
                    <th style="border: 1px solid #000; padding: 2px 4px;">Amount (₹)</th>
                  ` : `
                    <th style="border: 1px solid #000; padding: 2px 4px;">Rate</th>
                    <th style="border: 1px solid #000; padding: 2px 4px;">Amount (₹)</th>
                    <th style="border: 1px solid #000; padding: 2px 4px;">Rate</th>
                    <th style="border: 1px solid #000; padding: 2px 4px;">Amount (₹)</th>
                  `}
                </tr>
              </thead>
              <tbody>
                ${gstSummaryRowsHtml}
                <tr style="font-weight: bold; background-color: #fafafa; border-top: 1.5px solid #000;">
                  <td style="border: 1px solid #000; padding: 3px 4px; text-align: left; padding-left: 8px;">Total:</td>
                  <td style="border: 1px solid #000; padding: 3px 4px; text-align: right;">₹${totalTaxable.toFixed(2)}</td>
                  ${isInterState ? `
                    <td style="border: 1px solid #000; padding: 3px 4px;"></td>
                    <td style="border: 1px solid #000; padding: 3px 4px; text-align: right;">₹${totalIgst.toFixed(2)}</td>
                  ` : `
                    <td style="border: 1px solid #000; padding: 3px 4px;"></td>
                    <td style="border: 1px solid #000; padding: 3px 4px; text-align: right;">₹${totalCgst.toFixed(2)}</td>
                    <td style="border: 1px solid #000; padding: 3px 4px;"></td>
                    <td style="border: 1px solid #000; padding: 3px 4px; text-align: right;">₹${totalSgst.toFixed(2)}</td>
                  `}
                  <td style="border: 1px solid #000; padding: 3px 4px; text-align: right;">₹${totalTax.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>


        <!-- BANK DETAILS & CALCULATION TOTAL SUMMARY -->
        <tr>
          <td colspan="5" style="vertical-align: top; padding: 6px 8px;">
            <div class="inv-bank-section">
              <div style="font-weight: bold; text-decoration: underline; margin-bottom: 4px; font-size: 10.5px; color: #000000;">Bank Details for Payment (RTGS / NEFT / IMPS):</div>
              <div style="margin-top: 2px;"><span class="inv-bold">Bank Name:</span> ${comp.bankName}</div>
              <div style="margin-top: 2px;"><span class="inv-bold">Bank A/C No:</span> ${comp.accountNo}</div>
              <div style="margin-top: 2px;"><span class="inv-bold">RTGS/IFSC:</span> ${comp.ifscCode}</div>
              <div style="margin-top: 2px;"><span class="inv-bold">Branch:</span> ${comp.branch || 'Sambhaji Nagar, PCMC, Pune'}</div>
            </div>
          </td>
          <td colspan="5" style="vertical-align: top; padding: 6px 8px; background-color: #fafafa;">
            <table style="width: 100%; border: none; border-collapse: collapse; font-size: 11px;">
              ${isInterState ? `
                <tr>
                  <td style="border: none; padding: 2px 0;">Integrated GST (IGST):</td>
                  <td style="border: none; padding: 2px 0; text-align: right; font-weight: bold;">₹${totalIgst.toFixed(2)}</td>
                </tr>
              ` : `
                <tr>
                  <td style="border: none; padding: 2px 0;">Central GST (CGST):</td>
                  <td style="border: none; padding: 2px 0; text-align: right; font-weight: bold;">₹${totalCgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="border: none; padding: 2px 0;">State GST (SGST):</td>
                  <td style="border: none; padding: 2px 0; text-align: right; font-weight: bold;">₹${totalSgst.toFixed(2)}</td>
                </tr>
              `}
              <tr>
                <td style="border: none; padding: 2px 0;">Round Off:</td>
                <td style="border: none; padding: 2px 0; text-align: right; font-weight: bold;">${roundOff >= 0 ? '+' : ''}${roundOff}</td>
              </tr>
              <tr style="border-top: 1.5px solid #000;">
                <td style="border: none; padding: 4px 0; font-size: 12px; font-weight: 900; color: #000000;">Grand Total:</td>
                <td style="border: none; padding: 4px 0; font-size: 13.5px; font-weight: 900; text-align: right; color: #000000;">₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- AMOUNTS IN WORDS -->
        <tr>
          <td colspan="10" style="padding: 4px 6px;">
            <div><span class="inv-bold">Total GST in Words:</span> <span style="font-style: italic;">${numberToIndianWords(totalTax)}</span></div>
            <div style="margin-top: 2px;"><span class="inv-bold">Bill Amount in Words:</span> <span style="font-size: 11px; font-weight: bold;">${numberToIndianWords(grandTotal)}</span></div>
          </td>
        </tr>

        <!-- TERMS & CONDITIONS AND SIGNATURES -->
        <tr>
          <td colspan="5" style="vertical-align: top; padding: 4px 6px;">
            <div class="inv-tc-section">
              <div style="font-weight: bold; margin-bottom: 2px;">Terms & Conditions (E.& O.E.):</div>
              <ol>${termsHtml}</ol>
              <div style="font-weight: bold; margin-top: 3px; color: #333;">Thank You for Your Business !!</div>
            </div>
          </td>
          <td colspan="5" style="vertical-align: top; padding: 4px 6px;">
            <table style="width: 100%; height: 85px; border: none; border-collapse: collapse;">
              <tr>
                <td style="width: 50%; border: none; vertical-align: bottom; text-align: center; padding-bottom: 4px;">
                  <div style="border-top: 1px dashed #666; padding-top: 3px; font-size: 9.5px; font-weight: bold;">Receiver's Signature</div>
                </td>
                <td style="width: 50%; border: none; vertical-align: top; text-align: center; padding-top: 3px; padding-bottom: 4px;">
                  <div style="font-size: 10px; font-weight: bold; margin-bottom: 44px;">For ${comp.companyName}</div>
                  <div style="border-top: 1px solid #000; padding-top: 3px; font-size: 9.5px; font-weight: bold;">Authorised Signatory</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  },

  loadAndPrintInvoice: function(invId) {
    this.saveCurrentInvoiceToHistory(true);

    var inv = invId ? this.state.invoices.find(function(i) { return i.id === invId; }) : this.state.currentInvoice;
    if (!inv) return;

    // Save active invoice draft to localStorage
    localStorage.setItem(this.STORAGE_KEYS.ACTIVE_INV, JSON.stringify(inv));

    // Open dedicated standalone print.html
    var printUrl = 'print.html?id=' + encodeURIComponent(inv.id) + '&t=' + Date.now();
    var win = window.open(printUrl, '_blank');
    if (!win) {
      alert('Popup was blocked by your browser! Please allow popups to open print preview.');
    }
  },

  openPrintPreview: function(invId) {
    this.loadAndPrintInvoice(invId);
  },

  renderClientsList: function() {
    var tbody = document.getElementById('clientsMasterTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    this.state.clients.forEach(function(c) {
      var tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 700;">${c.company}</td>
        <td style="font-family: var(--font-mono);">${c.gstin || 'Unregistered'}</td>
        <td style="font-size: 0.85rem;">${c.address}</td>
        <td>${c.state || 'Maharashtra (27)'}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-outline btn-sm" onclick="OSFApp.editClientModal('${c.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="OSFApp.deleteClient('${c.id}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  openAddClientModal: function() {
    document.getElementById('clientModalTitle').innerText = "Add New Client";
    document.getElementById('clientEditId').value = "";
    document.getElementById('clientFormCompany').value = "";
    document.getElementById('clientFormGstin').value = "";
    document.getElementById('clientFormAddress').value = "";
    document.getElementById('clientFormState').value = "Maharashtra (27)";
    document.getElementById('clientModal').classList.add('active');
  },

  editClientModal: function(cliId) {
    var c = this.state.clients.find(function(item) { return item.id === cliId; });
    if (!c) return;
    document.getElementById('clientModalTitle').innerText = "Edit Client Profile";
    document.getElementById('clientEditId').value = c.id;
    document.getElementById('clientFormCompany').value = c.company || '';
    document.getElementById('clientFormGstin').value = c.gstin || '';
    document.getElementById('clientFormAddress').value = c.address || '';
    document.getElementById('clientFormState').value = c.state || 'Maharashtra (27)';
    document.getElementById('clientModal').classList.add('active');
  },

  saveClientFromModal: function() {
    var id = document.getElementById('clientEditId').value;
    var company = document.getElementById('clientFormCompany').value.trim();
    var gstin = document.getElementById('clientFormGstin').value.trim().toUpperCase();
    var address = document.getElementById('clientFormAddress').value.trim();
    var state = document.getElementById('clientFormState').value;

    if (!company) {
      this.showToast("Client company name is required", "error");
      return;
    }

    if (id) {
      var idx = this.state.clients.findIndex(function(c) { return c.id === id; });
      if (idx >= 0) {
        this.state.clients[idx].company = company;
        this.state.clients[idx].gstin = gstin;
        this.state.clients[idx].address = address;
        this.state.clients[idx].state = state;
        this.showToast("Client updated successfully!");
      }
    } else {
      this.state.clients.push({
        id: "CLI_" + Date.now(),
        company: company,
        gstin: gstin,
        address: address,
        state: state
      });
      this.showToast("New client added successfully!");
    }

    this.saveState();
    this.renderClientsList();
    this.renderClientDropdowns();
    document.getElementById('clientModal').classList.remove('active');
  },

  deleteClient: function(cliId) {
    if (!confirm("Are you sure you want to delete this client?")) return;
    this.state.clients = this.state.clients.filter(function(c) { return c.id !== cliId; });
    this.saveState();
    this.renderClientsList();
    this.renderClientDropdowns();
    this.showToast("Client removed");
  },

  renderProductsList: function() {
    var tbody = document.getElementById('productsMasterTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    this.state.products.forEach(function(p) {
      var tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 700;">${p.name}</td>
        <td style="font-family: var(--font-mono);">${p.hsn || '995413'}</td>
        <td><span class="badge badge-blue">${p.unit || 'KG'}</span></td>
        <td style="text-align: right; font-family: var(--font-mono); font-weight: 600;">₹${parseFloat(p.defaultRate || 0).toFixed(2)}</td>
        <td style="text-align: center;"><span class="badge badge-amber">${p.gstRate}%</span></td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-outline btn-sm" onclick="OSFApp.editProductModal('${p.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="OSFApp.deleteProduct('${p.id}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  openAddProductModal: function() {
    document.getElementById('productModalTitle').innerText = "Add Item / Service";
    document.getElementById('productEditId').value = "";
    document.getElementById('productFormName').value = "";
    document.getElementById('productFormHsn').value = "995413";
    document.getElementById('productFormUnit').value = "KG";
    document.getElementById('productFormRate').value = "0.00";
    document.getElementById('productFormGst').value = "18";
    document.getElementById('productModal').classList.add('active');
  },

  editProductModal: function(pId) {
    var p = this.state.products.find(function(item) { return item.id === pId; });
    if (!p) return;
    document.getElementById('productModalTitle').innerText = "Edit Item / Service";
    document.getElementById('productEditId').value = p.id;
    document.getElementById('productFormName').value = p.name || '';
    document.getElementById('productFormHsn').value = p.hsn || '995413';
    document.getElementById('productFormUnit').value = p.unit || 'KG';
    document.getElementById('productFormRate').value = p.defaultRate || 0;
    document.getElementById('productFormGst').value = p.gstRate !== undefined ? p.gstRate : 18;
    document.getElementById('productModal').classList.add('active');
  },

  saveProductFromModal: function() {
    var id = document.getElementById('productEditId').value;
    var name = document.getElementById('productFormName').value.trim();
    var hsn = document.getElementById('productFormHsn').value.trim();
    var unit = document.getElementById('productFormUnit').value;
    var rate = parseFloat(document.getElementById('productFormRate').value) || 0;
    var gstRate = parseFloat(document.getElementById('productFormGst').value) || 0;

    if (!name) {
      this.showToast("Product / Service name is required", "error");
      return;
    }

    if (id) {
      var idx = this.state.products.findIndex(function(p) { return p.id === id; });
      if (idx >= 0) {
        this.state.products[idx].name = name;
        this.state.products[idx].hsn = hsn;
        this.state.products[idx].unit = unit;
        this.state.products[idx].defaultRate = rate;
        this.state.products[idx].gstRate = gstRate;
        this.showToast("Item updated successfully!");
      }
    } else {
      this.state.products.push({
        id: "PRD_" + Date.now(),
        name: name,
        hsn: hsn,
        unit: unit,
        defaultRate: rate,
        gstRate: gstRate
      });
      this.showToast("New item added to catalog!");
    }

    this.saveState();
    this.renderProductsList();
    this.renderItemsMasterDropdown();
    document.getElementById('productModal').classList.remove('active');
  },

  deleteProduct: function(pId) {
    if (!confirm("Are you sure you want to delete this item?")) return;
    this.state.products = this.state.products.filter(function(p) { return p.id !== pId; });
    this.saveState();
    this.renderProductsList();
    this.renderItemsMasterDropdown();
    this.showToast("Item deleted");
  },

  populateCompanySettings: function() {
    var comp = this.state.company;
    if (!comp) return;

    var setVal = function(id, val) {
      var el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('settCompanyName', comp.companyName);
    setVal('settTagline', comp.tagline);
    setVal('settGstin', comp.gstin);
    setVal('settPan', comp.pan);
    setVal('settPhone', comp.phone);
    setVal('settEmail', comp.email);
    setVal('settWebsite', comp.website);
    setVal('settAddress', comp.address);
    setVal('settBankName', comp.bankName);
    setVal('settAccountNo', comp.accountNo);
    setVal('settIfsc', comp.ifscCode);
    setVal('settBranch', comp.branch);
    setVal('settInvoicePrefix', comp.invoicePrefix || 'OSF/2026-27/');
    setVal('settStartingNo', comp.startingInvoiceNumber || 1);
    setVal('settTerms', (comp.termsAndConditions || []).join('\n'));

    this.renderDashboardBankDetails();
  },

  renderDashboardBankDetails: function() {
    var comp = this.state.company;
    if (!comp) return;
    var elBank = document.getElementById('dashBankName');
    var elAcc = document.getElementById('dashAccountNo');
    var elIfsc = document.getElementById('dashIfsc');
    var elBranch = document.getElementById('dashBranch');

    if (elBank) elBank.innerText = comp.bankName || 'TJSB Bank';
    if (elAcc) elAcc.innerText = comp.accountNo || '044120100003853';
    if (elIfsc) elIfsc.innerText = comp.ifscCode || 'TJSB0000044';
    if (elBranch) elBranch.innerText = comp.branch || 'Sambhaji Nagar, PCMC, Pune';
  },

  saveCompanySettings: function() {
    if (!this.state.company) this.state.company = {};

    var getVal = function(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    this.state.company.companyName = getVal('settCompanyName') || 'Om Shanirajeshwar Fabrication';
    this.state.company.tagline = getVal('settTagline');
    this.state.company.gstin = getVal('settGstin').toUpperCase();
    this.state.company.pan = getVal('settPan').toUpperCase();
    this.state.company.phone = getVal('settPhone');
    this.state.company.email = getVal('settEmail');
    this.state.company.website = getVal('settWebsite');
    this.state.company.address = getVal('settAddress');
    this.state.company.bankName = getVal('settBankName');
    this.state.company.accountNo = getVal('settAccountNo');
    this.state.company.ifscCode = getVal('settIfsc').toUpperCase();
    this.state.company.branch = getVal('settBranch');
    this.state.company.invoicePrefix = getVal('settInvoicePrefix') || 'OSF/2026-27/';
    this.state.company.startingInvoiceNumber = parseInt(getVal('settStartingNo'), 10) || 1;
    
    var termsEl = document.getElementById('settTerms');
    var termsText = termsEl ? termsEl.value : '';
    this.state.company.termsAndConditions = termsText.split('\n').map(function(t){ return t.trim(); }).filter(Boolean);

    this.saveState();
    this.renderDashboardBankDetails();
    this.showToast("Company profile & settings saved successfully!");
  },

  downloadBackupJSON: function() {
    var backupData = {
      app: "OSF_TAX_INVOICING_SYSTEM",
      version: "2026.1",
      exportedAt: new Date().toISOString(),
      company: this.state.company,
      clients: this.state.clients,
      products: this.state.products,
      invoices: this.state.invoices
    };

    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    var dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "OSF_Invoicing_Backup_" + new Date().toISOString().slice(0,10) + ".json");
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    this.showToast("Backup JSON file downloaded!");
  },

  importBackupJSON: function(fileInput) {
    var file = fileInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    var self = this;
    reader.onload = function(e) {
      try {
        var imported = JSON.parse(e.target.result);
        if (imported.app !== "OSF_TAX_INVOICING_SYSTEM") {
          if (!confirm("This backup file does not appear to be an OSF format file. Proceed with import?")) return;
        }
        if (imported.company) self.state.company = imported.company;
        if (Array.isArray(imported.clients)) self.state.clients = imported.clients;
        if (Array.isArray(imported.products)) self.state.products = imported.products;
        if (Array.isArray(imported.invoices)) self.state.invoices = imported.invoices;

        self.saveState();
        self.init();
        self.showToast("Backup data restored successfully!");
      } catch(err) {
        alert("Error parsing backup file: " + err.message);
      }
    };
    reader.readAsText(file);
  }
};

document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('invoiceItemsTbody')) {
    OSFApp.init();
  }
});
