document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
    });
  }

  var form = document.querySelector('.quote-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.querySelector('#f-name').value.trim();
      var phone = form.querySelector('#f-phone').value.trim();
      var work = form.querySelector('#f-work').value;
      var location = (form.querySelector('#f-location') ? form.querySelector('#f-location').value.trim() : '');
      var area = (form.querySelector('#f-area') ? form.querySelector('#f-area').value.trim() : '');
      var message = form.querySelector('#f-message').value.trim();

      var subject = encodeURIComponent('Fabrication Enquiry: ' + (work || 'General') + (location ? ' - ' + location : '') + ' — ' + name);
      var body = encodeURIComponent(
        'Client Name: ' + name + '\n' +
        'Phone Number: ' + phone + '\n' +
        'Work Type: ' + work + '\n' +
        (location ? 'Site Location / Area: ' + location + '\n' : '') +
        (area ? 'Approx. Plot / Shed Area: ' + area + '\n' : '') +
        '\nRequirement Details:\n' + message
      );

      window.location.href = 'mailto:omshanirajfab@gmail.com?subject=' + subject + '&body=' + body;
    });
  }

  // ---------- Admin Passcode Lock Modal Logic ----------
  var lockModalHTML = `
    <div id="adminLockOverlay" class="admin-lock-overlay" role="dialog" aria-modal="true">
      <div class="admin-lock-card">
        <div class="admin-lock-strip"></div>
        <div class="admin-lock-body">
          <div class="admin-lock-icon">🔒</div>
          <h3>Admin Authorization</h3>
          <p>Enter administrative PIN to access Billintor &amp; Content Management Portal.</p>
          <input type="password" id="adminPinInput" class="admin-lock-input" placeholder="Enter Master Password" maxlength="50" autocomplete="off">
          <div class="admin-lock-actions">
            <button type="button" id="adminPinSubmit" class="admin-lock-btn-unlock">Unlock Portal</button>
            <button type="button" id="adminPinCancel" class="admin-lock-btn-cancel">Cancel</button>
          </div>
          <div id="adminPinErr" class="admin-lock-err">⚠️ Incorrect password. Access denied.</div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', lockModalHTML);

  var overlay = document.getElementById('adminLockOverlay');
  var pinInput = document.getElementById('adminPinInput');
  var pinSubmit = document.getElementById('adminPinSubmit');
  var pinCancel = document.getElementById('adminPinCancel');
  var pinErr = document.getElementById('adminPinErr');
  var lockCard = overlay.querySelector('.admin-lock-card');
  var targetUrl = 'billing/';

  function openLockModal(url) {
    if (url) targetUrl = url;
    pinInput.value = '';
    pinErr.classList.remove('visible');
    overlay.classList.add('active');
    setTimeout(function () {
      pinInput.focus();
    }, 150);
  }

  function closeLockModal() {
    overlay.classList.remove('active');
    pinInput.value = '';
    pinErr.classList.remove('visible');
  }

  function verifyPasscode() {
    var val = pinInput.value.trim();
    var masterPassword = 'Pawanjali@241997';

    if (val === masterPassword) {
      pinErr.classList.remove('visible');
      closeLockModal();
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } else {
      pinErr.classList.add('visible');
      lockCard.classList.remove('shake');
      void lockCard.offsetWidth; // trigger reflow
      lockCard.classList.add('shake');
      pinInput.select();
    }
  }

  // Attach lock modal trigger to manage-content links & billing links
  document.querySelectorAll('.manage-content-link, a[href*="billing"]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      var href = el.getAttribute('href');
      openLockModal(href && href !== '#' ? href : 'billing/');
    });
  });

  if (pinSubmit) pinSubmit.addEventListener('click', verifyPasscode);
  if (pinCancel) pinCancel.addEventListener('click', closeLockModal);

  if (pinInput) {
    pinInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        verifyPasscode();
      } else if (e.key === 'Escape') {
        closeLockModal();
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        closeLockModal();
      }
    });
  }
});
