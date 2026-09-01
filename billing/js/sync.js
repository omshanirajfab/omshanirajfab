/**
 * Om Shanirajeshwar Fabrication (OSF) - Real-Time Cloud Sync Engine
 * Powered by Google Cloud Firestore (Firebase)
 */

var OSFSync = {
  db: null,
  isInitialized: false,
  isLive: false,
  unsubscribeInvoices: null,
  unsubscribeClients: null,
  unsubscribeProducts: null,

  // Default Firebase Web Configuration (OSF Invoicing Project)
  config: {
    apiKey: "AIzaSyD-PlaceholderKeyForOSFInvoicingApp",
    authDomain: "osf-billing-cloud.firebaseapp.com",
    projectId: "osf-billing-cloud",
    storageBucket: "osf-billing-cloud.appspot.com",
    messagingSenderId: "108500262330",
    appId: "1:108500262330:web:osf9850026233"
  },

  STORAGE_KEYS: {
    SYNC_PIN: "osf_sync_pin",
    SYNC_ENABLED: "osf_sync_enabled",
    CUSTOM_FIREBASE_CONFIG: "osf_custom_firebase_config"
  },

  init: function() {
    // 100% AUTOMATIC ZERO-PIN CLOUD SYNC ON EVERY DEVICE
    var pin = localStorage.getItem(this.STORAGE_KEYS.SYNC_PIN) || "OSF_PRIMARY_WORKSPACE";
    
    // Load custom config if saved
    var savedConf = localStorage.getItem(this.STORAGE_KEYS.CUSTOM_FIREBASE_CONFIG);
    if (savedConf) {
      try { this.config = JSON.parse(savedConf); } catch(e) {}
    }

    // Auto-connect instantly on any phone, laptop or tablet without asking for PIN
    this.connect(pin);
  },

  connect: function(pin) {
    pin = (pin || "").trim().toUpperCase();
    if (!pin) {
      if (typeof OSFApp !== 'undefined') OSFApp.showToast("Please enter a Business Sync PIN", "error");
      return;
    }

    localStorage.setItem(this.STORAGE_KEYS.SYNC_PIN, pin);
    localStorage.setItem(this.STORAGE_KEYS.SYNC_ENABLED, "true");
    this.updateStatusBadge("connecting", "Connecting to Cloud...");

    try {
      if (typeof firebase === 'undefined') {
        console.warn("Firebase SDK not loaded, working in Offline/Local mode");
        this.updateStatusBadge("offline", "Offline Mode (Local Storage)");
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(this.config);
      }
      this.db = firebase.firestore();
      this.isInitialized = true;

      // Start Realtime Listeners for this PIN/Company namespace
      this.startRealtimeSync(pin);
    } catch (err) {
      console.error("Firebase init error:", err);
      this.updateStatusBadge("offline", "Local Mode Active");
    }
  },

  disconnect: function() {
    if (this.unsubscribeInvoices) this.unsubscribeInvoices();
    if (this.unsubscribeClients) this.unsubscribeClients();
    if (this.unsubscribeProducts) this.unsubscribeProducts();

    localStorage.setItem(this.STORAGE_KEYS.SYNC_ENABLED, "false");
    this.isLive = false;
    this.updateStatusBadge("ready", "Cloud Sync Paused (Local Mode)");
    if (typeof OSFApp !== 'undefined') OSFApp.showToast("Cloud sync paused. Working locally.");
  },

  startRealtimeSync: function(pin) {
    if (!this.db) return;
    var self = this;
    var companyRef = this.db.collection("osf_tenants").doc(pin);

    this.updateStatusBadge("syncing", "Syncing with Cloud...");

    // 1. Invoices Realtime Listener
    this.unsubscribeInvoices = companyRef.collection("invoices").onSnapshot(function(snapshot) {
      var cloudInvoices = [];
      snapshot.forEach(function(doc) {
        cloudInvoices.push(doc.data());
      });

      if (cloudInvoices.length > 0 && typeof OSFApp !== 'undefined') {
        // Merge cloud invoices with local invoices (newest first)
        cloudInvoices.sort(function(a, b) {
          return (b.createdAt || 0) - (a.createdAt || 0);
        });
        OSFApp.state.invoices = cloudInvoices;
        OSFApp.saveState();
        OSFApp.renderInvoicesList();
      }

      self.isLive = true;
      self.updateStatusBadge("live", "🟢 Real-Time Cloud Sync Active");
    }, function(error) {
      console.warn("Firestore invoice sync warning:", error);
      self.updateStatusBadge("ready", "Local Mode (" + pin + ")");
    });

    // 2. Clients Realtime Listener
    this.unsubscribeClients = companyRef.collection("clients").onSnapshot(function(snapshot) {
      var cloudClients = [];
      snapshot.forEach(function(doc) {
        cloudClients.push(doc.data());
      });

      if (cloudClients.length > 0 && typeof OSFApp !== 'undefined') {
        OSFApp.state.clients = cloudClients;
        OSFApp.saveState();
        OSFApp.renderClientsTable();
        OSFApp.renderClientDropdowns();
      }
    }, function(err) {});
  },

  // Push single invoice to cloud
  pushInvoice: function(inv) {
    if (!this.isInitialized || !this.db) return;
    var pin = localStorage.getItem(this.STORAGE_KEYS.SYNC_PIN);
    if (!pin) return;

    try {
      var docRef = this.db.collection("osf_tenants").doc(pin).collection("invoices").doc(inv.id);
      docRef.set(JSON.parse(JSON.stringify(inv)), { merge: true });
    } catch(e) {
      console.error("Cloud push invoice error:", e);
    }
  },

  // Delete invoice from cloud
  deleteInvoice: function(invId) {
    if (!this.isInitialized || !this.db) return;
    var pin = localStorage.getItem(this.STORAGE_KEYS.SYNC_PIN);
    if (!pin) return;

    try {
      this.db.collection("osf_tenants").doc(pin).collection("invoices").doc(invId).delete();
    } catch(e) {
      console.error("Cloud delete invoice error:", e);
    }
  },

  // Push client to cloud
  pushClient: function(client) {
    if (!this.isInitialized || !this.db) return;
    var pin = localStorage.getItem(this.STORAGE_KEYS.SYNC_PIN);
    if (!pin) return;

    try {
      this.db.collection("osf_tenants").doc(pin).collection("clients").doc(client.id).set(JSON.parse(JSON.stringify(client)), { merge: true });
    } catch(e) {}
  },

  // Push entire local database to cloud (Initial Sync)
  pushAllToCloud: function() {
    var pin = (document.getElementById("syncPinInput") ? document.getElementById("syncPinInput").value : "").trim().toUpperCase();
    if (!pin) pin = localStorage.getItem(this.STORAGE_KEYS.SYNC_PIN) || "OSF-27";

    this.connect(pin);

    if (!this.db) {
      if (typeof OSFApp !== 'undefined') OSFApp.showToast("Cloud connection active locally", "info");
      return;
    }

    var self = this;
    var companyRef = this.db.collection("osf_tenants").doc(pin);

    // Batch push invoices
    if (typeof OSFApp !== 'undefined') {
      OSFApp.state.invoices.forEach(function(inv) {
        companyRef.collection("invoices").doc(inv.id).set(JSON.parse(JSON.stringify(inv)), { merge: true });
      });
      OSFApp.state.clients.forEach(function(c) {
        companyRef.collection("clients").doc(c.id).set(JSON.parse(JSON.stringify(c)), { merge: true });
      });
      OSFApp.showToast("All invoices and clients uploaded to Cloud!");
    }
  },

  updateStatusBadge: function(state, text) {
    var badge = document.getElementById("cloudSyncStatusBadge");
    if (badge) {
      badge.innerText = text;
      badge.className = "cloud-status-badge " + state;
    }
  }
};
