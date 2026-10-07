/* ============================================================
 * API WRAPPER
 * ============================================================ */
const API = {
  token: null,
  user: null,
  permissions: null,

  call(action, payload) {
  const apiUrl = window.APP_CONFIG && window.APP_CONFIG.API_URL;
  if (!apiUrl || apiUrl.indexOf('AKfycb') === -1) {
    return Promise.reject(new Error('API_URL belum dikonfigurasi...'));
  }

  const body = JSON.stringify({
    action: action,
    token: API.token,
    payload: payload || {}
  });

  // Retry logic untuk handle CORS intermitten dari Apps Script
  function doFetch(attempt) {
    return fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body,
      redirect: 'follow',
      cache: 'no-store'
    })
    .then(function(response) {
      if (!response.ok) throw new Error('HTTP error: ' + response.status);
      return response.json();
    })
    .catch(function(err) {
      // Kalau error jaringan/CORS, retry sampai 3 kali
      const isNetworkError = 
        err.message.indexOf('Failed to fetch') !== -1 ||
        err.message.indexOf('NetworkError') !== -1 ||
        err.message.indexOf('CORS') !== -1 ||
        err.name === 'TypeError';

      if (isNetworkError && attempt < 3) {
        console.warn('⚠️ CORS/network error, retry ' + (attempt + 1) + '/3 untuk ' + action);
        return new Promise(function(resolve) {
          setTimeout(resolve, 300 * (attempt + 1));
        }).then(function() {
          return doFetch(attempt + 1);
        });
      }
      throw err;
    });
  }

  return doFetch(0)
    .then(function(res) {
      if (!res || typeof res !== 'object') {
        throw new Error('Respons server tidak valid: ' + JSON.stringify(res));
      }
      return res;
    });
},

  saveSession(token, user) {
    API.token = token;
    API.user = user;
    try {
      sessionStorage.setItem('auth_token', token);
      sessionStorage.setItem('auth_user', JSON.stringify(user));
    } catch (e) {}
  },

  loadSession() {
    try {
      const t = sessionStorage.getItem('auth_token');
      const u = sessionStorage.getItem('auth_user');
      if (t && u) {
        API.token = t;
        API.user = JSON.parse(u);
        return true;
      }
    } catch (e) {}
    return false;
  },

  clearSession() {
    API.token = null;
    API.user = null;
    API.permissions = null;
    try {
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_user');
    } catch (e) {}
  },

  hasPerm(module, action) {
    if (!API.permissions) return false;
    const mod = API.permissions[module];
    if (!mod) return false;
    return mod[action] === true;
  }
};

/* ============================================================
 * TOAST NOTIFICATION
 * ============================================================ */
const Toast = {
  show(type, message, title) {
    const container = document.getElementById('toastContainer');
    const icons = {
      success: 'check-circle-fill',
      danger: 'exclamation-triangle-fill',
      warning: 'exclamation-circle-fill',
      info: 'info-circle-fill'
    };
    const titles = {
      success: 'Berhasil',
      danger: 'Gagal',
      warning: 'Perhatian',
      info: 'Info'
    };
    const el = document.createElement('div');
    el.className = 'app-toast ' + type;
    el.innerHTML = `
      <i class="bi bi-${icons[type] || 'info-circle'} toast-icon"></i>
      <div class="toast-body">
        <div class="toast-title">${title || titles[type] || 'Info'}</div>
        <div class="toast-message">${UI.escape(message)}</div>
      </div>
      <button class="toast-close" type="button"><i class="bi bi-x-lg"></i></button>
    `;
    container.appendChild(el);
    el.querySelector('.toast-close').onclick = () => el.remove();
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      el.style.transition = 'all 0.3s';
      setTimeout(() => el.remove(), 300);
    }, 4000);
  },
  success(msg, title) { Toast.show('success', msg, title); },
  error(msg, title)   { Toast.show('danger', msg, title); },
  warning(msg, title) { Toast.show('warning', msg, title); },
  info(msg, title)    { Toast.show('info', msg, title); }
};

/* ============================================================
 * UI HELPERS
 * ============================================================ */
const UI = {
  showLoader() {
    const el = document.getElementById('globalLoader');
    if (el) el.classList.remove('d-none');
  },
  hideLoader() {
    const el = document.getElementById('globalLoader');
    if (el) el.classList.add('d-none');
  },
  escape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
  formatNumber(n) {
    return new Intl.NumberFormat('id-ID').format(n || 0);
  },
  formatRupiah(n) {
    return 'Rp ' + UI.formatNumber(Math.round(n || 0));
  },
  formatDate(iso, withTime) {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const opts = { day: '2-digit', month: 'short', year: 'numeric' };
      if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
      return d.toLocaleDateString('id-ID', opts);
    } catch (e) { return iso; }
  },
  confirm(message, title) {
    return new Promise((resolve) => {
      const id = 'confirm_' + Date.now();
      const html = `
        <div class="modal fade" id="${id}" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered modal-sm">
            <div class="modal-content">
              <div class="modal-header">
                <h6 class="modal-title">${title || 'Konfirmasi'}</h6>
              </div>
              <div class="modal-body">${UI.escape(message)}</div>
              <div class="modal-footer">
                <button class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Batal</button>
                <button class="btn btn-sm btn-primary" id="${id}_yes">Ya, Lanjutkan</button>
              </div>
            </div>
          </div>
        </div>
      `;
      const div = document.createElement('div');
      div.innerHTML = html;
      document.body.appendChild(div);
      const modal = new bootstrap.Modal(document.getElementById(id));
      document.getElementById(id + '_yes').onclick = () => {
        modal.hide();
        resolve(true);
      };
      document.getElementById(id).addEventListener('hidden.bs.modal', () => {
        div.remove();
        resolve(false);
      });
      modal.show();
    });
  }
};

/* ============================================================
 * CLOCK (Realtime)
 * ============================================================ */
const Clock = {
  timer: null,
  start() {
    Clock.stop();
    Clock.update();
    Clock.timer = setInterval(Clock.update, 1000);
  },
  stop() {
    if (Clock.timer) { clearInterval(Clock.timer); Clock.timer = null; }
  },
  update() {
    const now = new Date();
    const timeEl = document.getElementById('clockTime');
    const dateEl = document.getElementById('clockDate');
    if (!timeEl || !dateEl) return;

    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    timeEl.textContent = `${hh}:${mm}:${ss}`;

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    dateEl.textContent =
      `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }
};

/* ============================================================
 * ROUTER
 * ============================================================ */
const Router = {
  currentPage: null,
  pageMeta: {
    dashboard:    { title: 'Dashboard',       path: 'Beranda / Dashboard',       tpl: 'tpl-page-dashboard' },
    books:        { title: 'Katalog Buku',    path: 'Beranda / Katalog Buku',    tpl: 'tpl-page-books' },
    members:      { title: 'Anggota',         path: 'Beranda / Anggota',         tpl: 'tpl-page-members' },
    loans:        { title: 'Peminjaman',      path: 'Beranda / Peminjaman',      tpl: 'tpl-page-loans' },
    returns:      { title: 'Pengembalian',    path: 'Beranda / Pengembalian',    tpl: 'tpl-page-returns' },
    fines:        { title: 'Denda',           path: 'Beranda / Denda',           tpl: 'tpl-page-fines' },
    reservations: { title: 'Reservasi',       path: 'Beranda / Reservasi',       tpl: 'tpl-page-reservations' },
    reports:      { title: 'Laporan',         path: 'Beranda / Laporan',         tpl: 'tpl-page-reports' },
    settings:     { title: 'Pengaturan',      path: 'Beranda / Pengaturan',      tpl: 'tpl-page-settings' }
  },

  go(pageId) {
    if (!pageId) pageId = 'dashboard';
    if (!Router.pageMeta[pageId]) pageId = 'dashboard';

    const meta = Router.pageMeta[pageId];
    const tplEl = document.getElementById(meta.tpl);
    if (!tplEl) {
      Toast.error('Halaman tidak ditemukan: ' + pageId);
      return;
    }

    // Cek permission untuk halaman tertentu
    const requiredPerm = {
      books: 'BOOKS:view',
      members: 'MEMBERS:view',
      loans: 'LOANS:view',
      returns: 'RETURNS:view',
      fines: 'FINES:view',
      reservations: 'RESERVATIONS:view',
      reports: 'REPORTS:view',
      settings: 'SETTINGS:view'
    }[pageId];

    if (requiredPerm) {
      const [mod, act] = requiredPerm.split(':');
      if (!API.hasPerm(mod, act)) {
        Router.showForbidden();
        return;
      }
    }

    // Update content
    const content = document.getElementById('pageContent');
    content.innerHTML = tplEl.innerHTML;

    // Update breadcrumb
    document.getElementById('breadcrumbTitle').textContent = meta.title;
    document.getElementById('breadcrumbPath').textContent = meta.path;

    // Update sidebar active
    document.querySelectorAll('.sidebar-link').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageId);
    });

    Router.currentPage = pageId;
    location.hash = pageId;

    // Tutup sidebar di mobile
    if (window.innerWidth < 992) {
      document.getElementById('sidebar').classList.remove('mobile-open');
      document.getElementById('sidebarBackdrop').classList.remove('show');
    }

    // Panggil initializer halaman jika ada
    const initFn = 'initPage_' + pageId;
    if (typeof window[initFn] === 'function') {
      try { window[initFn](); } catch (e) {
        console.error('Error initializing ' + pageId, e);
      }
    }
  },

  /**
   * Cari halaman pertama yang boleh diakses user.
   * Urutan prioritas: dashboard → books → members → loans → dst.
   */
  findFirstAccessiblePage() {
    const order = [
      { id: 'dashboard', perm: null },
      { id: 'books', perm: 'BOOKS:view' },
      { id: 'members', perm: 'MEMBERS:view' },
      { id: 'loans', perm: 'LOANS:view' },
      { id: 'returns', perm: 'RETURNS:view' },
      { id: 'fines', perm: 'FINES:view' },
      { id: 'reservations', perm: 'RESERVATIONS:view' },
      { id: 'reports', perm: 'REPORTS:view' },
      { id: 'settings', perm: 'SETTINGS:view' }
    ];
    for (const p of order) {
      if (!p.perm) return p.id;
      const [mod, act] = p.perm.split(':');
      if (API.hasPerm(mod, act)) return p.id;
    }
    return 'dashboard';
  },

  showForbidden() {
    const tpl = document.getElementById('tpl-page-403');
    if (!tpl) return;
    document.getElementById('pageContent').innerHTML = tpl.innerHTML;
    document.getElementById('breadcrumbTitle').textContent = 'Akses Ditolak';
    document.getElementById('breadcrumbPath').textContent = 'Beranda / 403';
  },

  init() {
    window.addEventListener('hashchange', () => {
      const page = location.hash.replace('#', '') || 'dashboard';
      Router.go(page);
    });
  }
};

/* ============================================================
 * SIDEBAR CONTROL
 * ============================================================ */
const Sidebar = {
  init() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('mainArea');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const closeBtn = document.getElementById('sidebarCloseBtn');
    const backdrop = document.getElementById('sidebarBackdrop');

    // Restore state
    const collapsed = localStorage.getItem('sidebar_collapsed') === '1';
    if (collapsed && window.innerWidth >= 992) {
      sidebar.classList.add('collapsed');
      main.classList.add('sidebar-collapsed');
    }

    toggleBtn.onclick = () => {
      if (window.innerWidth < 992) {
        sidebar.classList.toggle('mobile-open');
        backdrop.classList.toggle('show');
      } else {
        sidebar.classList.toggle('collapsed');
        main.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebar_collapsed',
          sidebar.classList.contains('collapsed') ? '1' : '0');
      }
    };

    if (closeBtn) {
      closeBtn.onclick = () => {
        sidebar.classList.remove('mobile-open');
        backdrop.classList.remove('show');
      };
    }
    backdrop.onclick = () => {
      sidebar.classList.remove('mobile-open');
      backdrop.classList.remove('show');
    };

    // Hide menu sesuai permission
    document.querySelectorAll('.sidebar-link[data-perm]').forEach(el => {
      const [mod, act] = el.dataset.perm.split(':');
      if (!API.hasPerm(mod, act)) {
        el.style.display = 'none';
      }
    });
  }
};

/* ============================================================
 * APP SHELL
 * ============================================================ */
var App = {
  container: null,
  publicConfig: null,

  async init() {
  App.container = document.getElementById('app');

  // Public config diambil via API POST juga
  try {
    const res = await API.call('getPublicConfig');
    if (res && res.success) {
      App.publicConfig = res.data || {};
    } else {
      App.publicConfig = { schoolName: 'SMP', libraryName: 'Perpustakaan' };
    }
  } catch (e) {
    App.publicConfig = { schoolName: 'SMP', libraryName: 'Perpustakaan' };
  }

  // Cek sesi
  if (API.loadSession()) {
    try {
      const res = await API.call('getCurrentUser');
      if (res && res.success) {
        API.user = res.data;
        await App.loadPermissions();
        return App.renderShell();
      }
    } catch (e) {}
    API.clearSession();
  }

  App.renderLogin();
},

  async loadPermissions() {
    // Ambil permission untuk role user
    try {
      const res = await API.call('listRolePermissions', {
        roleId: API.user.role_id
      });
      if (res && res.success) {
        const map = {};
        (res.data || []).forEach(p => {
          map[p.module_code] = {
            view: p.can_view === true || p.can_view === 'TRUE',
            create: p.can_create === true || p.can_create === 'TRUE',
            update: p.can_update === true || p.can_update === 'TRUE',
            delete: p.can_delete === true || p.can_delete === 'TRUE',
            export: p.can_export === true || p.can_export === 'TRUE'
          };
        });
        API.permissions = map;
      }
    } catch (e) {
      API.permissions = {};
    }
  },

async loadPublicConfig() {
  try {
    const res = await API.call('getPublicConfig');
    if (res && res.success) {
      App.publicConfig = res.data || {};
    } else {
      App.publicConfig = { schoolName: 'SMP', libraryName: 'Perpustakaan' };
    }
  } catch (e) {
    App.publicConfig = { schoolName: 'SMP', libraryName: 'Perpustakaan' };
  }
},

    renderSidebarLogo() {
    const logoUrl = App.publicConfig.logoUrl || '';
    const imgEl = document.getElementById('sidebarLogoImg');
    const iconEl = document.getElementById('sidebarLogoIcon');
    if (!imgEl || !iconEl) return;

    if (logoUrl) {
      imgEl.src = logoUrl;
      imgEl.classList.remove('d-none');
      iconEl.classList.add('d-none');
      imgEl.onerror = () => {
        imgEl.classList.add('d-none');
        iconEl.classList.remove('d-none');
      };
    } else {
      imgEl.classList.add('d-none');
      iconEl.classList.remove('d-none');
    }
  },

  renderLogin() {
    const tpl = document.getElementById('tpl-login').innerHTML;
    App.container.innerHTML = tpl;

    document.getElementById('loginSchoolName').textContent =
      App.publicConfig.schoolName || 'SMP';
    document.getElementById('loginLibraryName').textContent =
      App.publicConfig.libraryName || 'Perpustakaan';
    const addrEl = document.getElementById('loginSchoolAddress');
    if (addrEl) {
      const addr = App.publicConfig.schoolAddress || '';
      const city = App.publicConfig.schoolCity || '';
      const full = [addr, city].filter(Boolean).join(', ');
      addrEl.textContent = full;
    }  
    document.getElementById('loginAppVersion').textContent =
      (App.publicConfig.appName || '') + ' v' + (App.publicConfig.version || '');

          // === LOGO DI LOGIN ===
    const logoUrl = App.publicConfig.logoUrl || '';
    const logoImg = document.getElementById('loginLogoImg');
    const logoIcon = document.getElementById('loginLogoIcon');
    if (logoUrl && logoImg && logoIcon) {
      logoImg.src = logoUrl;
      logoImg.classList.remove('d-none');
      logoIcon.classList.add('d-none');
      logoImg.onerror = () => {
        logoImg.classList.add('d-none');
        logoIcon.classList.remove('d-none');
      };
    } else if (logoImg && logoIcon) {
      logoImg.classList.add('d-none');
      logoIcon.classList.remove('d-none');
    }

    document.getElementById('togglePasswordBtn').onclick = function() {
      const input = document.getElementById('loginPassword');
      const icon = document.getElementById('togglePasswordIcon');
      if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye-slash';
      } else {
        input.type = 'password';
        icon.className = 'bi bi-eye';
      }
    };

    document.getElementById('loginForm').onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      if (!email || !password) {
        Toast.warning('Email dan password wajib diisi.');
        return;
      }

      UI.showLoader();
      const btn = document.getElementById('loginSubmitBtn');
      btn.disabled = true;

      try {
        const res = await API.call('loginManual', { email, password });
        if (!res.success) {
          Toast.error(res.message);
          return;
        }
        API.saveSession(res.data.token, res.data.user);
        await App.loadPermissions();

        if (res.data.mustChangePassword) {
          App.showPasswordChangeModal();
        } else {
          App.renderShell();
        }
      } catch (err) {
        Toast.error('Gagal login: ' + err.message);
      } finally {
        UI.hideLoader();
        btn.disabled = false;
      }
    };

    document.getElementById('loginGoogleBtn').onclick = () => {
      App.openGoogleLoginModal();
    };
  },

    openGoogleLoginModal() {
    const modalEl = document.getElementById('googleLoginModal');
    if (!modalEl) {
      Toast.error('Modal login Google tidak ditemukan.');
      return;
    }

    // Reset form
    const emailInput = document.getElementById('googleLoginEmail');
    const alertEl = document.getElementById('googleLoginAlert');
    if (emailInput) emailInput.value = '';
    if (alertEl) alertEl.innerHTML = '';

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // Focus ke input setelah modal terbuka
    modalEl.addEventListener('shown.bs.modal', () => {
      if (emailInput) emailInput.focus();
    }, { once: true });

    // Submit handler (attach sekali saja)
    const btn = document.getElementById('btnSubmitGoogleLogin');
    btn.onclick = async () => {
      const email = document.getElementById('googleLoginEmail').value.trim();
      if (!email) {
        App.showGoogleAlert('warning', 'Email wajib diisi.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        App.showGoogleAlert('danger', 'Format email tidak valid.');
        return;
      }

      UI.showLoader();
      btn.disabled = true;

      try {
        const res = await API.call('loginWithGoogle', { email });
        UI.hideLoader();
        btn.disabled = false;

        if (!res.success) {
          App.showGoogleAlert('danger', res.message);
          return;
        }

        // Sukses
        API.saveSession(res.data.token, res.data.user);
        await App.loadPermissions();

        modal.hide();

        if (res.data.mustChangePassword) {
          App.showPasswordChangeModal();
        } else {
          App.renderShell();
        }
      } catch (err) {
        UI.hideLoader();
        btn.disabled = false;
        App.showGoogleAlert('danger', 'Gagal login: ' + err.message);
      }
    };

    // Enter key submit
    if (emailInput) {
      emailInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          btn.click();
        }
      };
    }
  },

  showGoogleAlert(type, message) {
    const el = document.getElementById('googleLoginAlert');
    if (!el) return;
    const icons = {
      success: 'check-circle-fill',
      danger: 'exclamation-triangle-fill',
      warning: 'exclamation-circle-fill',
      info: 'info-circle-fill'
    };
    el.innerHTML = `
      <div class="alert alert-${type} py-2 small mb-0">
        <i class="bi bi-${icons[type] || 'info-circle'} me-1"></i>
        ${UI.escape(message)}
      </div>
    `;
  },

  renderShell() {
    const sidebarTpl = document.getElementById('tpl-sidebar').innerHTML;

    App.container.innerHTML = `
      <div class="app-shell">
        ${sidebarTpl}
        <div class="main-area" id="mainArea">
          <header class="app-topbar">
            <button class="topbar-toggle-btn" id="sidebarToggleBtn" title="Toggle Sidebar">
              <i class="bi bi-list"></i>
            </button>
            <div class="topbar-breadcrumb">
              <div class="breadcrumb-title" id="breadcrumbTitle">Dashboard</div>
              <div class="breadcrumb-path" id="breadcrumbPath">Beranda / Dashboard</div>
            </div>
            <div class="topbar-right">
              <div class="digital-clock">
                <div class="clock-time" id="clockTime">--:--:--</div>
                <div class="clock-date" id="clockDate">Memuat...</div>
              </div>
              <div class="topbar-user">
                <div class="topbar-avatar" id="topbarAvatar">A</div>
                <div class="topbar-user-info">
                  <div class="topbar-user-name" id="topbarUserName">-</div>
                  <div class="topbar-user-role" id="topbarUserRole">-</div>
                </div>
                <button class="btn-logout" id="logoutBtn" title="Keluar">
                  <i class="bi bi-box-arrow-right"></i>
                </button>
              </div>
            </div>
          </header>
          <main class="page-content" id="pageContent"></main>
        </div>
      </div>
    `;

    // Fill user info
    const initials = App.getInitials(API.user.full_name);
    document.getElementById('topbarAvatar').textContent = initials;
    document.getElementById('topbarUserName').textContent = API.user.full_name;
    document.getElementById('topbarUserRole').textContent = API.user.role_id;

    const sidebarAvatar = document.getElementById('sidebarAvatar');
    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarUserRole = document.getElementById('sidebarUserRole');
    const sidebarLibraryName = document.getElementById('sidebarLibraryName');
    if (sidebarAvatar) sidebarAvatar.textContent = initials;
    if (sidebarUserName) sidebarUserName.textContent = API.user.full_name;
    if (sidebarUserRole) sidebarUserRole.textContent = API.user.role_id;
    if (sidebarLibraryName) {
    // Perpendek nama untuk sidebar
    const fullName = App.publicConfig.libraryName || 'Perpustakaan';
    // Hapus kata "Perpustakaan" di awal supaya lebih ringkas
    const shortName = fullName.replace(/^Perpustakaan\s+/i, '');
    sidebarLibraryName.textContent = shortName;
    }
    // === LOGO DI SIDEBAR ===
    App.renderSidebarLogo();

    // Sidebar links
    document.querySelectorAll('.sidebar-link').forEach(el => {
      el.onclick = (e) => {
        e.preventDefault();
        Router.go(el.dataset.page);
      };
    });

    // Logout
    document.getElementById('logoutBtn').onclick = async () => {
      const yes = await UI.confirm('Yakin ingin keluar dari aplikasi?', 'Konfirmasi Logout');
      if (!yes) return;
      UI.showLoader();
      try { await API.call('logout'); } catch (e) {}
      API.clearSession();
      Clock.stop();
      UI.hideLoader();
      App.renderLogin();
    };

        // Init components
    Sidebar.init();
    Clock.start();
    Router.init();

    // Go to initial page — cek permission dulu
    let initial = location.hash.replace('#', '') || 'dashboard';
    const requiredPerm = {
      books: 'BOOKS:view',
      members: 'MEMBERS:view',
      loans: 'LOANS:view',
      returns: 'RETURNS:view',
      fines: 'FINES:view',
      reservations: 'RESERVATIONS:view',
      reports: 'REPORTS:view',
      settings: 'SETTINGS:view'
    }[initial];

    if (requiredPerm) {
      const parts = requiredPerm.split(':');
      if (!API.hasPerm(parts[0], parts[1])) {
        initial = Router.findFirstAccessiblePage();
      }
    }
    Router.go(initial);
  },

  getInitials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  },

  showPasswordChangeModal() {
    const html = `
      <div class="modal fade" id="pwdChangeModal" data-bs-backdrop="static"
           data-bs-keyboard="false" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Ganti Password</h5>
            </div>
            <div class="modal-body">
              <div class="alert alert-warning small">
                <i class="bi bi-exclamation-triangle me-1"></i>
                Anda wajib mengganti password sebelum melanjutkan.
              </div>
              <div class="mb-3">
                <label class="form-label small">Password Lama</label>
                <input type="password" class="form-control" id="oldPwd">
              </div>
              <div class="mb-3">
                <label class="form-label small">Password Baru</label>
                <input type="password" class="form-control" id="newPwd">
                <small class="text-muted">Min 8 karakter, ada huruf besar, huruf kecil, dan angka.</small>
              </div>
              <div class="mb-3">
                <label class="form-label small">Konfirmasi Password Baru</label>
                <input type="password" class="form-control" id="confirmPwd">
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-primary w-100" id="submitPwdBtn">Simpan Password Baru</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
    const modal = new bootstrap.Modal(document.getElementById('pwdChangeModal'));
    modal.show();

    document.getElementById('submitPwdBtn').onclick = async () => {
      const oldP = document.getElementById('oldPwd').value;
      const newP = document.getElementById('newPwd').value;
      const confP = document.getElementById('confirmPwd').value;

      if (!oldP || !newP || !confP) {
        Toast.warning('Semua field wajib diisi.');
        return;
      }
      if (newP !== confP) {
        Toast.error('Konfirmasi password tidak cocok.');
        return;
      }

      UI.showLoader();
      try {
        const res = await API.call('changeOwnPassword', {
          oldPassword: oldP,
          newPassword: newP
        });
        if (!res.success) {
          Toast.error(res.message);
          return;
        }
        Toast.success('Password berhasil diubah.');
        setTimeout(() => {
          modal.hide();
          div.remove();
          App.renderShell();
        }, 800);
      } catch (e) {
        Toast.error(e.message);
      } finally {
        UI.hideLoader();
      }
    };
  }
};

/* ============================================================
 * PAGE: DASHBOARD
 * ============================================================ */
function initPage_dashboard() {
  DashboardPage.load();
}

const DashboardPage = {
  async load() {
    UI.showLoader();
    try {
      const res = await API.call('getDashboardData');
      if (!res.success) {
        Toast.error(res.message);
        return;
      }
      DashboardPage.render(res.data);
    } catch (e) {
      Toast.error('Gagal memuat dashboard: ' + e.message);
    } finally {
      UI.hideLoader();
    }
  },

    render(data) {
    const gen = document.getElementById('dashGeneratedAt');
    if (gen) gen.textContent = 'Diperbarui: ' + data.generatedAt;

    DashboardPage.renderSummary(data.summary || {});
    DashboardPage.renderChart(data.dailyChart || []);
    DashboardPage.renderMonthlyChart(data.monthlyChart || []);
    DashboardPage.renderReservationStats(data.reservationStats || {});
    DashboardPage.renderLibraryStats(data.libraryStats || {});
    DashboardPage.renderTopStudents(data.topStudents || []);
    DashboardPage.renderPopularBooks(data.popularBooks || []);
    DashboardPage.renderOverdue(data.overdue || {});
    DashboardPage.renderDebtors(data.fines || {});
    DashboardPage.renderActivity(data.recentActivity || []);
  },

  renderMonthlyChart(chart) {
    const container = document.getElementById('dashMonthlyChart');
    if (!container) return;
    if (!chart || chart.length === 0) {
      container.innerHTML = '<div class="empty-row w-100">Belum ada data</div>';
      return;
    }
    const max = Math.max.apply(null, chart.map(c => c.count).concat([1]));
    container.innerHTML = chart.map(c => {
      const pct = (c.count / max) * 100;
      const label = c.label + ': ' + c.count + ' peminjaman';
      return `
        <div class="bar-wrap">
          <div class="bar" style="height: ${Math.max(pct, 1)}%; background: linear-gradient(180deg, #7c4dff, #4285f4)"
               data-bs-toggle="tooltip" data-bs-placement="top"
               title="${UI.escape(label)}"></div>
          <div class="bar-label-small">${c.label.split(' ')[0]}</div>
        </div>
      `;
    }).join('');

    // Init Bootstrap tooltip
    if (window.bootstrap && bootstrap.Tooltip) {
      container.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function(el) {
        new bootstrap.Tooltip(el);
      });
    }
  },

  renderReservationStats(stats) {
    const el1 = document.getElementById('dashActiveReservations');
    const el2 = document.getElementById('dashReadyReservations');
    if (el1) el1.textContent = (stats.waiting || 0) + (stats.ready || 0);
    if (el2) el2.textContent = stats.ready || 0;
  },

  renderLibraryStats(stats) {
    const el1 = document.getElementById('dashLoansThisMonth');
    const el2 = document.getElementById('dashLoansThisYear');
    if (el1) el1.textContent = stats.loansThisMonth || 0;
    if (el2) el2.textContent = stats.loansThisYear || 0;
  },

    renderSummary(s) {
    const el = document.getElementById('dashSummaryRow');
    if (!el) return;

    const cards = [
      { label: 'Judul Buku', value: s.totalTitles || 0, icon: 'book', color: 'blue' },
      { label: 'Total Eksemplar', value: s.totalCopies || 0, icon: 'collection', color: 'teal' },
      { label: 'Tersedia', value: s.availableCopies || 0, icon: 'check-circle', color: 'green' },
      { label: 'Dipinjam', value: s.onLoanCopies || 0, icon: 'arrow-up-right', color: 'yellow' },
      { label: 'Rusak', value: s.damagedCopies || 0, icon: 'tools', color: 'orange', click: 'damaged' },
      { label: 'Hilang', value: s.lostCopies || 0, icon: 'x-circle', color: 'red', click: 'lost' },
      { label: 'Siswa Aktif', value: s.totalStudents || 0, icon: 'people', color: 'purple' },
      { label: 'Guru/Staf', value: s.totalStaff || 0, icon: 'person-badge', color: 'pink' }
    ];

    el.innerHTML = cards.map(c => {
      const clickable = c.click ? 'stat-card-clickable' : '';
      const onclick = c.click
        ? `onclick="DashboardPage.openDamagedLost('${c.click}')"`
        : '';
      const hint = c.click
        ? `<div class="stat-hint"><i class="bi bi-eye me-1"></i>Klik untuk detail</div>`
        : '';

      return `
        <div class="col-6 col-md-4 col-lg-3">
          <div class="card stat-card ${clickable}" ${onclick} style="${c.click ? 'cursor:pointer' : ''}">
            <div class="card-body d-flex align-items-center gap-3">
              <div class="stat-icon bg-icon-${c.color}">
                <i class="bi bi-${c.icon}"></i>
              </div>
              <div>
                <div class="stat-value">${UI.formatNumber(c.value)}</div>
                <div class="stat-label">${c.label}</div>
              </div>
            </div>
            ${hint}
          </div>
        </div>
      `;
    }).join('');
  },

  renderChart(chart) {
    const container = document.getElementById('dashChart');
    if (!container) return;
    if (!chart || chart.length === 0) {
      container.innerHTML = '<div class="empty-row w-100">Belum ada data</div>';
      return;
    }
    const max = Math.max.apply(null, chart.map(c => c.count).concat([1]));
    container.innerHTML = chart.map(c => {
      const pct = (c.count / max) * 100;
      const label = c.date + ': ' + c.count + ' peminjaman';
      const shortLabel = c.shortLabel || c.date.substring(5); // fallback "10-07"
      return `
        <div class="bar-wrap">
          <div class="bar" style="height: ${pct}%"
               data-bs-toggle="tooltip" data-bs-placement="top"
               title="${UI.escape(label)}"></div>
          <div class="bar-label-small">${UI.escape(shortLabel)}</div>
        </div>
      `;
    }).join('');

    if (window.bootstrap && bootstrap.Tooltip) {
      container.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function(el) {
        new bootstrap.Tooltip(el);
      });
    }
  },

  renderTopStudents(list) {
    const tbody = document.getElementById('dashTopStudents');
    if (!tbody) return;
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Belum ada data</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((s, i) => `
      <tr>
        <td class="text-muted">${i + 1}</td>
        <td>${UI.escape(s.full_name)}</td>
        <td><span class="badge bg-light text-dark">${UI.escape(s.class_name)}</span></td>
        <td class="text-end fw-semibold">${s.loan_count}</td>
      </tr>
    `).join('');
  },

  renderPopularBooks(list) {
    const tbody = document.getElementById('dashPopularBooks');
    if (!tbody) return;
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-row">Belum ada data</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((b, i) => `
      <tr>
        <td class="text-muted">${i + 1}</td>
        <td>${UI.escape(b.title)}</td>
        <td class="text-end fw-semibold">${b.loan_count}</td>
      </tr>
    `).join('');
  },

  renderOverdue(data) {
    const badge = document.getElementById('dashOverdueBadge');
    if (badge) badge.textContent = data.total || 0;

    const tbody = document.getElementById('dashOverdue');
    if (!tbody) return;
    if (!data.top10 || data.top10.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-row">Tidak ada keterlambatan</td></tr>';
      return;
    }
    tbody.innerHTML = data.top10.map(o => `
      <tr>
        <td>
          <div>${UI.escape(o.member_name)}</div>
          <small class="text-muted">${UI.escape(o.member_identifier || '')}</small>
        </td>
        <td>${UI.escape(o.book_title)}</td>
        <td class="text-end"><span class="badge bg-danger">${o.days_late} hari</span></td>
      </tr>
    `).join('');
  },

  renderDebtors(fines) {
    const badge = document.getElementById('dashFineBadge');
    if (badge) badge.textContent = UI.formatRupiah(fines.outstanding || 0);

    const tbody = document.getElementById('dashTopDebtors');
    if (!tbody) return;

    if (!fines.top10 || fines.top10.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-row">Tidak ada tunggakan</td></tr>';
      return;
    }

    tbody.innerHTML = fines.top10.map(d => {
      const info = d.member_info || {};
      const identifier = info.identifier || '-';
      const sub = info.class_name || info.unit_label || '';
      const meta = sub ? `${identifier} • ${sub}` : identifier;

      return `
        <tr>
          <td>${UI.escape(info.name || '-')}</td>
          <td><small class="text-muted">${UI.escape(meta)}</small></td>
          <td class="text-end fw-semibold text-danger">${UI.formatRupiah(d.balance)}</td>
        </tr>
      `;
    }).join('');
  },

  renderActivity(logs) {
    const tbody = document.getElementById('dashRecentActivity');
    if (!tbody) return;
    if (!logs || logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Belum ada aktivitas</td></tr>';
      return;
    }
    tbody.innerHTML = logs.map(l => `
      <tr>
        <td><small>${UI.formatDate(l.event_time, true)}</small></td>
        <td><span class="badge bg-secondary">${UI.escape(l.action)}</span></td>
        <td><small>${UI.escape(l.entity_type)} / ${UI.escape(l.entity_id)}</small></td>
        <td>
          <span class="badge bg-${l.status === 'SUCCESS' ? 'success' : 'danger'}">
            ${UI.escape(l.status)}
          </span>
        </td>
        <td><small>${UI.escape(l.notes || '-')}</small></td>
      </tr>
    `).join('');
  },
    async openDamagedLost(type) {
    const modalEl = document.getElementById('damagedLostModal');
    if (!modalEl) { Toast.error('Modal tidak ditemukan.'); return; }

    const titleEl = document.getElementById('damagedLostTitle');
    const bodyEl = document.getElementById('damagedLostBody');
    const countEl = document.getElementById('damagedLostCount');

    const isLost = type === 'lost';
    titleEl.innerHTML = isLost
      ? '<i class="bi bi-x-circle me-2 text-danger"></i>Daftar Buku Hilang'
      : '<i class="bi bi-tools me-2 text-warning"></i>Daftar Buku Rusak';
    bodyEl.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    countEl.textContent = '';

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    try {
      const action = isLost ? 'getLostCopies' : 'getDamagedCopies';
      const res = await API.call(action, {});
      if (!res.success) {
        bodyEl.innerHTML = '<div class="alert alert-danger m-3">' + UI.escape(res.message) + '</div>';
        return;
      }

      const items = res.data || [];
      countEl.textContent = items.length + ' eksemplar';

      if (items.length === 0) {
        bodyEl.innerHTML = `
          <div class="text-center py-5 text-muted">
            <i class="bi bi-check-circle" style="font-size:48px;color:#34a853"></i>
            <div class="mt-2">Tidak ada buku ${isLost ? 'hilang' : 'rusak'} 🎉</div>
          </div>
        `;
        return;
      }

      DashboardPage.renderDamagedLostTable(bodyEl, items, isLost);
    } catch (e) {
      bodyEl.innerHTML = '<div class="alert alert-danger m-3">' + UI.escape(e.message) + '</div>';
    }
  },

  renderDamagedLostTable(container, items, isLost) {
    const totalValue = items.reduce(function(sum, c) {
      return sum + (parseFloat(c.acquisition_cost) || 0);
    }, 0);

    container.innerHTML = `
      <div class="p-3">
        ${totalValue > 0 ? `
          <div class="alert alert-warning small py-2 mb-3">
            <i class="bi bi-cash-coin me-1"></i>
            <strong>Estimasi nilai ${isLost ? 'kerugian' : 'perbaikan'}:</strong>
            ${UI.formatRupiah(totalValue)}
          </div>
        ` : ''}

        <div class="table-responsive">
          <table class="table table-sm table-hover mb-0">
            <thead class="table-light">
              <tr>
                <th width="60">Cover</th>
                <th>Barcode</th>
                <th>Judul</th>
                <th>Rak</th>
                <th>Kondisi</th>
                <th class="text-end">Harga</th>
                <th class="text-end">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(function(c) {
                const cover = c.book_cover
                  ? `<img src="${UI.escape(c.book_cover)}" class="book-cover-thumb"
                          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                     <div class="book-cover-thumb-placeholder" style="display:none">
                       <i class="bi bi-book"></i>
                     </div>`
                  : `<div class="book-cover-thumb-placeholder"><i class="bi bi-book"></i></div>`;

                const condBadge = {
                  'NEW': 'bg-success',
                  'GOOD': 'bg-success',
                  'MINOR_DAMAGE': 'bg-warning text-dark',
                  'DAMAGED': 'bg-danger',
                  'LOST': 'bg-dark'
                }[c.condition] || 'bg-secondary';

                const statusBadge = {
                  'AVAILABLE': 'bg-success',
                  'ON_LOAN': 'bg-warning text-dark',
                  'RESERVED': 'bg-primary',
                  'REPAIR': 'bg-warning text-dark',
                  'LOST': 'bg-danger'
                }[c.availability_status] || 'bg-secondary';

                return `
                  <tr>
                    <td>${cover}</td>
                    <td><code class="small">${UI.escape(c.barcode)}</code></td>
                    <td>
                      <div class="fw-semibold small">${UI.escape(c.book_title)}</div>
                      ${c.accession_number ? `<small class="text-muted">${UI.escape(c.accession_number)}</small>` : ''}
                    </td>
                    <td class="small text-muted">${UI.escape(c.shelf_code)}</td>
                    <td>
                      <span class="badge ${condBadge}">${UI.escape(c.condition || '-')}</span>
                      <span class="badge ${statusBadge} ms-1">${UI.escape(c.availability_status || '-')}</span>
                    </td>
                    <td class="text-end small">
                      ${c.acquisition_cost
                        ? UI.formatRupiah(c.acquisition_cost)
                        : '<span class="text-muted">-</span>'}
                    </td>
                    <td class="text-end">
                      <button class="btn btn-sm btn-outline-primary"
                              onclick="DashboardPage.goToBook('${c.book_id}')"
                              title="Lihat Buku">
                        <i class="bi bi-box-arrow-up-right"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  goToBook(bookId) {
    // Tutup modal
    const modalEl = document.getElementById('damagedLostModal');
    if (modalEl) {
      const inst = bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();
    }

    // Pindah ke halaman Katalog Buku & buka detail
    Router.go('books');
    setTimeout(function() {
      if (typeof BooksPage !== 'undefined' && BooksPage.openDetail) {
        BooksPage.openDetail(bookId);
      }
    }, 600);
  }
};

/* ============================================================
 * PAGE: BOOKS
 * ============================================================ */
function initPage_books() {
  BooksPage.init();
}

const BooksPage = {
  // State
  state: {
    page: 1,
    pageSize: 20,
    query: '',
    categoryId: '',
    status: '',
    total: 0,
    items: [],
    editBookId: null,     // null = tambah baru
    editCopyId: null,     // null = tambah baru
    currentBookId: null,  // untuk modal detail
    cache: {
      categories: [],
      publishers: [],
      shelves: [],
      authors: []
    }
  },

  // ============ INIT ============
      async init() {
    // Sembunyikan tombol yang butuh permission
    if (!can('BOOKS', 'create')) {
      ['btnAddBook', 'btnAddCopy'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    }

    BooksPage.bindEvents();
    await BooksPage.loadMasterData();
    await BooksPage.load();
  },

  bindEvents() {
    // Search: debounce 400ms
    let searchTimer;
    const searchInput = document.getElementById('booksSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          BooksPage.state.query = e.target.value.trim();
          BooksPage.state.page = 1;
          BooksPage.load();
        }, 400);
      });
    }

    document.getElementById('booksCategoryFilter').addEventListener('change', (e) => {
      BooksPage.state.categoryId = e.target.value;
      BooksPage.state.page = 1;
      BooksPage.load();
    });

    document.getElementById('booksStatusFilter').addEventListener('change', (e) => {
      BooksPage.state.status = e.target.value;
      BooksPage.state.page = 1;
      BooksPage.load();
    });

    document.getElementById('btnAddBook').addEventListener('click', () => {
      BooksPage.openBookForm(null);
    });

    document.getElementById('btnSaveBook').addEventListener('click', () => {
      BooksPage.saveBook();
    });

    document.getElementById('btnSaveCopy').addEventListener('click', () => {
      BooksPage.saveCopy();
    });

    document.getElementById('btnAddCopy').addEventListener('click', () => {
      BooksPage.openCopyForm(null, BooksPage.state.currentBookId);
    });

    // ==== Barcode mode toggle (single) ====
    document.querySelectorAll('input[name="barcodeMode"]').forEach(el => {
      el.addEventListener('change', () => {
        BooksPage.updateBarcodeModeUI();
        if (el.value === 'AUTO') BooksPage.previewSingleAuto();
      });
    });

    // ==== Bulk mode toggle ====
    document.querySelectorAll('input[name="bulkBarcodeMode"]').forEach(el => {
      el.addEventListener('change', () => BooksPage.updateBulkModeUI());
    });

    // ==== Bulk quantity change → refresh preview ====
    const bulkQty = document.getElementById('bulkQuantity');
    if (bulkQty) {
      let bulkTimer;
      bulkQty.addEventListener('input', function() {
        clearTimeout(bulkTimer);
        bulkTimer = setTimeout(function() {
          const mode = document.querySelector('input[name="bulkBarcodeMode"]:checked');
          if (mode && mode.value === 'AUTO') {
            BooksPage.previewBulkAuto();
          }
        }, 500);
      });
    }

    // ==== Acquisition type change → refresh preview ====
    const bulkAcqType = document.getElementById('bulkAcqType');
    if (bulkAcqType) {
      bulkAcqType.addEventListener('change', function() {
        const mode = document.querySelector('input[name="bulkBarcodeMode"]:checked');
        if (mode && mode.value === 'AUTO') BooksPage.previewBulkAuto();
      });
    }

    const singleAcqType = document.getElementById('copyAcqType');
    if (singleAcqType) {
      singleAcqType.addEventListener('change', function() {
        const mode = document.querySelector('input[name="barcodeMode"]:checked');
        if (mode && mode.value === 'AUTO') BooksPage.previewSingleAuto();
      });
    }
  },

  // ============ MASTER DATA ============
  async loadMasterData() {
    try {
      const [catRes, pubRes, shRes, authRes] = await Promise.all([
        API.call('listCategories', { activeOnly: true }),
        API.call('listPublishers'),
        API.call('listShelves'),
        API.call('listAuthors')
      ]);

      BooksPage.state.cache.categories = (catRes.success ? catRes.data : []) || [];
      BooksPage.state.cache.publishers = (pubRes.success ? pubRes.data : []) || [];
      BooksPage.state.cache.shelves = (shRes.success ? shRes.data : []) || [];
      BooksPage.state.cache.authors = (authRes.success ? authRes.data : []) || [];

      BooksPage.fillSelects();
    } catch (e) {
      console.error('loadMasterData error', e);
    }
  },

  fillSelects() {
    // Filter kategori
    const filterCat = document.getElementById('booksCategoryFilter');
    if (filterCat) {
      filterCat.innerHTML = '<option value="">Semua Kategori</option>' +
        BooksPage.state.cache.categories.map(c =>
          `<option value="${c.category_id}">${UI.escape(c.category_name)}</option>`
        ).join('');
    }

    // Form kategori
    const formCat = document.getElementById('bookCategory');
    if (formCat) {
      formCat.innerHTML = '<option value="">-- Pilih Kategori --</option>' +
        BooksPage.state.cache.categories.map(c =>
          `<option value="${c.category_id}">${UI.escape(c.category_name)}</option>`
        ).join('');
    }

    // Form penerbit
    const formPub = document.getElementById('bookPublisher');
    if (formPub) {
      formPub.innerHTML = '<option value="">-- Pilih Penerbit --</option>' +
        BooksPage.state.cache.publishers.map(p =>
          `<option value="${p.publisher_id}">${UI.escape(p.publisher_name)}</option>`
        ).join('');
    }

    // Form rak (buku)
    const formShelf = document.getElementById('bookShelf');
    if (formShelf) {
      formShelf.innerHTML = '<option value="">-- Pilih Rak --</option>' +
        BooksPage.state.cache.shelves.map(s =>
          `<option value="${s.shelf_id}">${UI.escape(s.shelf_code + ' - ' + s.shelf_name)}</option>`
        ).join('');
    }

    // Form rak (copy)
    const copyShelf = document.getElementById('copyShelf');
    if (copyShelf) {
      copyShelf.innerHTML = '<option value="">-- Ikuti Rak Buku --</option>' +
        BooksPage.state.cache.shelves.map(s =>
          `<option value="${s.shelf_id}">${UI.escape(s.shelf_code + ' - ' + s.shelf_name)}</option>`
        ).join('');
    }

    // Form rak (bulk copy)
    const bulkShelf = document.getElementById('bulkShelf');
    if (bulkShelf) {
      bulkShelf.innerHTML = '<option value="">-- Ikuti Rak Buku --</option>' +
        BooksPage.state.cache.shelves.map(s =>
          `<option value="${s.shelf_id}">${UI.escape(s.shelf_code + ' - ' + s.shelf_name)}</option>`
        ).join('');
    }
  },

  // ============ LOAD LIST ============
  async load() {
    UI.showLoader();
    try {
      const res = await API.call('searchBooks', {
        query: BooksPage.state.query,
        categoryId: BooksPage.state.categoryId,
        status: BooksPage.state.status,
        page: BooksPage.state.page,
        pageSize: BooksPage.state.pageSize
      });

      if (!res.success) {
        Toast.error(res.message);
        return;
      }

      BooksPage.state.items = res.data.items || [];
      BooksPage.state.total = res.data.total || 0;
      BooksPage.renderTable(res.data);
    } catch (e) {
      Toast.error('Gagal memuat buku: ' + e.message);
    } finally {
      UI.hideLoader();
    }
  },

  renderTable(data) {
    const tbody = document.getElementById('booksTableBody');
    const totalBadge = document.getElementById('booksTotalBadge');
    if (totalBadge) totalBadge.textContent = data.total || 0;

    const info = document.getElementById('booksPageInfo');
    if (info) {
      info.textContent = `Halaman ${data.page} dari ${data.totalPages || 1}`;
    }

    if (!BooksPage.state.items.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-row">
        ${BooksPage.state.query || BooksPage.state.categoryId || BooksPage.state.status
          ? 'Tidak ada buku yang cocok dengan filter'
          : 'Belum ada buku. Klik "Tambah Buku" untuk memulai.'}
      </td></tr>`;
      BooksPage.renderPagination(data);
      return;
    }

    // Ambil penulis per buku (dari cache relasi — kita fetch sekali)
    const rows = BooksPage.state.items.map(b => {
      const cat = BooksPage.state.cache.categories.find(c => c.category_id === b.category_id);
      const catName = cat ? cat.category_name : '-';

      const coverHtml = b.cover_url
        ? `<img src="${UI.escape(b.cover_url)}" class="book-cover-thumb"
                onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
           <div class="book-cover-thumb-placeholder" style="display:none">
             <i class="bi bi-book"></i>
           </div>`
        : `<div class="book-cover-thumb-placeholder"><i class="bi bi-book"></i></div>`;

      const statusClass = 'badge-status-' + (b.status || 'ACTIVE');

      const authorsText = (b.author_names && b.author_names.length)
        ? UI.escape(b.author_names.join(', '))
        : '<span class="text-muted">-</span>';

      return `
        <tr data-book-id="${b.book_id}">
          <td>${coverHtml}</td>
          <td>
            <div class="fw-semibold">${UI.escape(b.title)}</div>
            ${b.isbn ? `<small class="text-muted">ISBN: ${UI.escape(b.isbn)}</small>` : ''}
          </td>
          <td><span class="badge bg-light text-dark">${UI.escape(catName)}</span></td>
          <td class="text-muted small" data-authors-for="${b.book_id}">
            ${authorsText}
          </td>
          <td class="text-center">${b.total_copies || 0}</td>
          <td class="text-center">
            <span class="badge bg-${(b.available_copies || 0) > 0 ? 'success' : 'secondary'}">
              ${b.available_copies || 0}
            </span>
          </td>
          <td class="text-center">
            <span class="badge ${statusClass}">${UI.escape(b.status || 'ACTIVE')}</span>
          </td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" title="Detail"
                    onclick="BooksPage.openDetail('${b.book_id}')">
              <i class="bi bi-eye"></i>
            </button>
            ${can('BOOKS', 'update') ? `
              <button class="btn btn-sm btn-outline-secondary" title="Edit"
                      onclick="BooksPage.openBookForm('${b.book_id}')">
                <i class="bi bi-pencil"></i>
              </button>
            ` : ''}
            ${can('BOOKS', 'delete') ? `
              <button class="btn btn-sm btn-outline-danger" title="Arsipkan"
                      onclick="BooksPage.archiveBook('${b.book_id}', '${UI.escape(b.title)}')">
                <i class="bi bi-archive"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rows;

    // Load penulis untuk tiap buku (paralel, async)
    BooksPage.loadAuthorsForVisibleBooks();

    BooksPage.renderPagination(data);
  },

  async loadAuthorsForVisibleBooks() {
    // Kita bisa pakai data BOOK_AUTHORS via getBookDetail, tapi untuk listing
    // efisien kita ambil sekali lewat API baru — atau alternatif: pakai API existing
    // Untuk sekarang kita kosongkan dulu (akan muncul "-"); bisa dioptimasi nanti
    // dengan menambahkan API bulk.
    // TODO: tambah API 'getAuthorsByBookIds'
  },

  renderPagination(data) {
    const ul = document.getElementById('booksPagination');
    const info = document.getElementById('booksPaginationInfo');
    if (!ul) return;

    const total = data.total || 0;
    const page = data.page || 1;
    const totalPages = data.totalPages || 1;
    const pageSize = data.pageSize || 20;

    if (info) {
      const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
      const end = Math.min(page * pageSize, total);
      info.textContent = `Menampilkan ${start}-${end} dari ${total} buku`;
    }

    if (totalPages <= 1) {
      ul.innerHTML = '';
      return;
    }

    let html = '';
    // Prev
    html += `<li class="page-item ${page <= 1 ? 'disabled' : ''}">
      <a class="page-link" href="javascript:void(0)" onclick="BooksPage.goPage(${page - 1})">
        <i class="bi bi-chevron-left"></i>
      </a>
    </li>`;

    // Pages (tampilkan max 5)
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) {
      html += `<li class="page-item ${i === page ? 'active' : ''}">
        <a class="page-link" href="javascript:void(0)" onclick="BooksPage.goPage(${i})">${i}</a>
      </li>`;
    }

    // Next
    html += `<li class="page-item ${page >= totalPages ? 'disabled' : ''}">
      <a class="page-link" href="javascript:void(0)" onclick="BooksPage.goPage(${page + 1})">
        <i class="bi bi-chevron-right"></i>
      </a>
    </li>`;

    ul.innerHTML = html;
  },

  goPage(p) {
    if (p < 1 || p > Math.ceil(BooksPage.state.total / BooksPage.state.pageSize)) return;
    BooksPage.state.page = p;
    BooksPage.load();
  },

  // ============ FORM BUKU ============
  openBookForm(bookId) {
    BooksPage.state.editBookId = bookId;
    const isEdit = !!bookId;

    document.getElementById('bookFormTitle').textContent =
      isEdit ? 'Edit Buku' : 'Tambah Buku';

    // Reset form
    document.getElementById('bookForm').reset?.();
    document.getElementById('authorsList').innerHTML = '';
    document.getElementById('bookCoverUrl').value = '';
    document.getElementById('coverStatusText').textContent = '';
    BooksPage.renderCoverPreview('');

    if (isEdit) {
      UI.showLoader();
      API.call('getBookDetail', { bookId }).then(res => {
        UI.hideLoader();
        if (!res.success) { Toast.error(res.message); return; }
        BooksPage.fillBookForm(res.data);
        new bootstrap.Modal(document.getElementById('bookFormModal')).show();
      }).catch(e => {
        UI.hideLoader();
        Toast.error(e.message);
      });
    } else {
      // Default values
      document.getElementById('bookLanguage').value = 'Indonesia';
      document.getElementById('bookPublicationYear').value = new Date().getFullYear();
      new bootstrap.Modal(document.getElementById('bookFormModal')).show();
    }
  },

  fillBookForm(data) {
    const b = data.book;
    document.getElementById('bookTitle').value = b.title || '';
    document.getElementById('bookSubtitle').value = b.subtitle || '';
    document.getElementById('bookIsbn').value = b.isbn || '';
    document.getElementById('bookEdition').value = b.edition || '';
    document.getElementById('bookCategory').value = b.category_id || '';
    document.getElementById('bookType').value = b.book_type || '';
    document.getElementById('bookPublicationYear').value = b.publication_year || '';
    document.getElementById('bookLanguage').value = b.language || 'Indonesia';
    document.getElementById('bookPageCount').value = b.page_count || '';
    document.getElementById('bookPublisher').value = b.publisher_id || '';
    document.getElementById('bookShelf').value = b.shelf_id || '';
    document.getElementById('bookMinGrade').value = b.min_grade || '';
    document.getElementById('bookMaxGrade').value = b.max_grade || '';
    document.getElementById('bookDescription').value = b.description || '';
    document.getElementById('bookCoverUrl').value = b.cover_url || '';

    BooksPage.renderCoverPreview(b.cover_url || '');

    // Penulis
    document.getElementById('authorsList').innerHTML = '';
    (data.authors || []).forEach(a => {
      BooksPage.addAuthorRow(a.author_id);
    });
    if (!data.authors || data.authors.length === 0) {
      BooksPage.addAuthorRow();
    }
  },

  // ============ AUTHOR ROWS ============
  addAuthorRow(selectedId) {
    const container = document.getElementById('authorsList');
    const rowId = 'authorRow_' + Date.now() + '_' + Math.floor(Math.random() * 9999);

    const options = BooksPage.state.cache.authors.map(a =>
      `<option value="${a.author_id}" ${a.author_id === selectedId ? 'selected' : ''}>
        ${UI.escape(a.author_name)}
      </option>`
    ).join('');

    const html = `
      <div class="author-row" id="${rowId}">
        <select class="form-select form-select-sm author-select" style="flex:1">
          <option value="">-- Pilih Penulis --</option>
          ${options}
        </select>
        <button type="button" class="btn btn-sm btn-outline-secondary"
                onclick="BooksPage.promptAddAuthor('${rowId}')" title="Tambah penulis baru">
          <i class="bi bi-plus"></i>
        </button>
        <button type="button" class="btn-remove-author" title="Hapus"
                onclick="document.getElementById('${rowId}').remove()">
          <i class="bi bi-x-circle"></i>
        </button>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
  },

  getSelectedAuthors() {
    const rows = document.querySelectorAll('#authorsList .author-row');
    const ids = [];
    rows.forEach(r => {
      const sel = r.querySelector('.author-select');
      if (sel && sel.value) ids.push(sel.value);
    });
    return ids;
  },

  async promptAddAuthor(rowId) {
    const name = prompt('Nama penulis baru:');
    if (!name || !name.trim()) return;

    UI.showLoader();
    try {
      const res = await API.call('createAuthor', { author_name: name.trim() });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }

      // Tambah ke cache
      BooksPage.state.cache.authors.push(res.data);
      BooksPage.state.cache.authors.sort((a, b) =>
        a.author_name.localeCompare(b.author_name));

      // Tambah option ke semua select
      document.querySelectorAll('.author-select').forEach(sel => {
        const opt = document.createElement('option');
        opt.value = res.data.author_id;
        opt.textContent = res.data.author_name;
        sel.appendChild(opt);
      });

      // Pilih di row yang diminta
      if (rowId) {
        const row = document.getElementById(rowId);
        if (row) {
          const sel = row.querySelector('.author-select');
          if (sel) sel.value = res.data.author_id;
        }
      }

      Toast.success('Penulis "' + res.data.author_name + '" ditambahkan.');
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  async promptAddPublisher() {
    const name = prompt('Nama penerbit baru:');
    if (!name || !name.trim()) return;

    UI.showLoader();
    try {
      const res = await API.call('createPublisher', { publisher_name: name.trim() });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }

      BooksPage.state.cache.publishers.push(res.data);
      BooksPage.state.cache.publishers.sort((a, b) =>
        a.publisher_name.localeCompare(b.publisher_name));

      const sel = document.getElementById('bookPublisher');
      const opt = document.createElement('option');
      opt.value = res.data.publisher_id;
      opt.textContent = res.data.publisher_name;
      sel.appendChild(opt);
      sel.value = res.data.publisher_id;

      Toast.success('Penerbit "' + res.data.publisher_name + '" ditambahkan.');
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  // ============ COVER ============
  renderCoverPreview(url) {
    const img = document.getElementById('coverPreviewImg');
    const ph = document.getElementById('coverPlaceholder');
    if (!img || !ph) return;

    if (url) {
      img.src = url;
      img.classList.remove('d-none');
      ph.classList.add('d-none');
    } else {
      img.src = '';
      img.classList.add('d-none');
      ph.classList.remove('d-none');
    }
  },

  async onCoverFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Toast.warning('File harus berupa gambar.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      Toast.warning('Ukuran file maksimal 2MB.');
      return;
    }

    document.getElementById('coverStatusText').textContent = 'Mengupload...';
    UI.showLoader();

    try {
      const base64 = await BooksPage.fileToBase64(file);
      const res = await API.call('uploadBookCover', {
        fileName: file.name,
        mimeType: file.type,
        base64Data: base64
      });

      UI.hideLoader();

      if (!res.success) {
        document.getElementById('coverStatusText').textContent = '';
        Toast.error(res.message);
        return;
      }

      document.getElementById('bookCoverUrl').value = res.data.url;
      BooksPage.renderCoverPreview(res.data.url);
      document.getElementById('coverStatusText').textContent = '✓ Uploaded';

    } catch (e) {
      UI.hideLoader();
      document.getElementById('coverStatusText').textContent = '';
      Toast.error('Gagal upload: ' + e.message);
    }

    // Reset input
    event.target.value = '';
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  onCoverUrl() {
    const url = prompt('Masukkan URL cover:');
    if (url === null) return;
    document.getElementById('bookCoverUrl').value = url.trim();
    BooksPage.renderCoverPreview(url.trim());
  },

  // ============ SAVE BOOK ============
  async saveBook() {
    const bookId = BooksPage.state.editBookId;
    const isEdit = !!bookId;

    const title = document.getElementById('bookTitle').value.trim();
    const categoryId = document.getElementById('bookCategory').value;
    const bookType = document.getElementById('bookType').value;
    const publicationYear = document.getElementById('bookPublicationYear').value;

    // Validasi field wajib
    if (!title) { Toast.warning('Judul wajib diisi.'); return; }
    if (!categoryId) { Toast.warning('Kategori wajib dipilih.'); return; }
    if (!bookType) { Toast.warning('Tipe buku wajib dipilih.'); return; }
    if (!publicationYear) { Toast.warning('Tahun terbit wajib diisi.'); return; }

    const payload = {
      title,
      subtitle: document.getElementById('bookSubtitle').value.trim(),
      isbn: document.getElementById('bookIsbn').value.trim(),
      edition: document.getElementById('bookEdition').value.trim(),
      category_id: categoryId,
      book_type: bookType,
      publication_year: publicationYear,
      language: document.getElementById('bookLanguage').value.trim() || 'Indonesia',
      page_count: document.getElementById('bookPageCount').value,
      publisher_id: document.getElementById('bookPublisher').value,
      shelf_id: document.getElementById('bookShelf').value,
      min_grade: document.getElementById('bookMinGrade').value,
      max_grade: document.getElementById('bookMaxGrade').value,
      description: document.getElementById('bookDescription').value.trim(),
      cover_url: document.getElementById('bookCoverUrl').value.trim(),
      author_ids: BooksPage.getSelectedAuthors()
    };

    UI.showLoader();
    document.getElementById('btnSaveBook').disabled = true;

    try {
      const res = isEdit
        ? await API.call('updateBook', { bookId, ...payload })
        : await API.call('createBook', payload);

      UI.hideLoader();
      document.getElementById('btnSaveBook').disabled = false;

      if (!res.success) {
        Toast.error(res.message);
        return;
      }

      Toast.success(isEdit ? 'Buku berhasil diperbarui.' : 'Buku berhasil ditambahkan.');
      bootstrap.Modal.getInstance(document.getElementById('bookFormModal')).hide();
      BooksPage.load();
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnSaveBook').disabled = false;
      Toast.error(e.message);
    }
  },

  // ============ DETAIL BUKU ============
  async openDetail(bookId) {
    BooksPage.state.currentBookId = bookId;
    document.getElementById('bookDetailBody').innerHTML =
      '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

    // Sembunyikan tombol Tambah Eksemplar kalau tidak punya permission
    const btnAddCopy = document.getElementById('btnAddCopy');
    if (btnAddCopy) {
      btnAddCopy.style.display = can('BOOKS', 'create') ? '' : 'none';
    }

    const modal = new bootstrap.Modal(document.getElementById('bookDetailModal'));
    modal.show();

    try {
      const res = await API.call('getBookDetail', { bookId });
      if (!res.success) {
        document.getElementById('bookDetailBody').innerHTML =
          '<div class="alert alert-danger">' + UI.escape(res.message) + '</div>';
        return;
      }
      BooksPage.renderDetail(res.data);
    } catch (e) {
      document.getElementById('bookDetailBody').innerHTML =
        '<div class="alert alert-danger">' + UI.escape(e.message) + '</div>';
    }
  },

  renderDetail(data) {
    const b = data.book;
    const copies = data.copies || [];
    const authors = data.authors || [];
    const cat = data.category;
    const pub = data.publisher;

    document.getElementById('bookDetailTitle').textContent = b.title;

    const coverHtml = b.cover_url
      ? `<img src="${UI.escape(b.cover_url)}" class="detail-cover"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <div class="book-cover-thumb-placeholder" style="width:100%;height:auto;aspect-ratio:3/4;display:none;font-size:48px">
           <i class="bi bi-book"></i>
         </div>`
      : `<div class="book-cover-thumb-placeholder" style="width:100%;height:auto;aspect-ratio:3/4;font-size:48px">
           <i class="bi bi-book"></i>
         </div>`;

    const authorsText = authors.length
      ? authors.map(a => UI.escape(a.author_name)).join(', ')
      : '<span class="text-muted">-</span>';

    document.getElementById('bookDetailBody').innerHTML = `
      <div class="row g-3">
        <div class="col-md-3">${coverHtml}</div>
        <div class="col-md-9">
          <h5 class="mb-1">${UI.escape(b.title)}</h5>
          ${b.subtitle ? `<div class="text-muted mb-2">${UI.escape(b.subtitle)}</div>` : ''}

          <div class="row g-2 small">
            <div class="col-md-6"><strong>Kategori:</strong> ${UI.escape(cat ? cat.category_name : '-')}</div>
            <div class="col-md-6"><strong>Penulis:</strong> ${authorsText}</div>
            <div class="col-md-6"><strong>Penerbit:</strong> ${UI.escape(pub ? pub.publisher_name : '-')}</div>
            <div class="col-md-6"><strong>Tahun:</strong> ${UI.escape(b.publication_year || '-')}</div>
            <div class="col-md-6"><strong>ISBN:</strong> ${UI.escape(b.isbn || '-')}</div>
            <div class="col-md-6"><strong>Bahasa:</strong> ${UI.escape(b.language || '-')}</div>
            <div class="col-md-6"><strong>Halaman:</strong> ${UI.escape(b.page_count || '-')}</div>
            <div class="col-md-6"><strong>Tipe:</strong> ${UI.escape(b.book_type || '-')}</div>
          </div>

          ${b.description ? `<hr><div class="small">${UI.escape(b.description)}</div>` : ''}
        </div>

        <div class="col-12">
          <hr>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0"><i class="bi bi-collection me-2"></i>Eksemplar (${copies.length})</h6>
          </div>

          <div class="table-responsive">
            <table class="table table-sm table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th>Barcode</th>
                  <th>No. Inventaris</th>
                  <th>Rak</th>
                  <th>Kondisi</th>
                  <th>Status</th>
                  <th class="text-end">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${copies.length === 0
                  ? '<tr><td colspan="6" class="empty-row">Belum ada eksemplar</td></tr>'
                  : copies.map(c => `
                    <tr>
                      <td>${UI.escape(c.barcode)}</td>
                      <td>${UI.escape(c.accession_number || '-')}</td>
                      <td>${UI.escape(c.shelf_id || '-')}</td>
                      <td><span class="badge bg-light text-dark">${UI.escape(c.condition)}</span></td>
                      <td><span class="badge badge-avail-${c.availability_status}">${UI.escape(c.availability_status)}</span></td>
                      <td class="text-end">
                        ${can('BOOKS', 'update') ? `
                          <button class="btn btn-sm btn-outline-secondary"
                                  onclick="BooksPage.openCopyForm('${c.copy_id}', '${b.book_id}')">
                            <i class="bi bi-pencil"></i>
                          </button>
                        ` : ''}
                      </td>
                    </tr>
                  `).join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // ============ FORM EKSEMPLAR ============
    openCopyForm(copyId, bookId) {
    BooksPage.state.editCopyId = copyId;
    BooksPage.state.currentBookId = bookId;
    const isEdit = !!copyId;

    document.getElementById('copyFormTitle').textContent =
      isEdit ? 'Edit Eksemplar' : 'Tambah Eksemplar';

    document.getElementById('copyForm')?.reset();
    document.getElementById('copyBulkForm')?.reset();
    document.getElementById('copyAutoPreview').innerHTML = '';
    document.getElementById('bulkAutoPreview').innerHTML = '';
    document.getElementById('bulkManualBlock').classList.add('d-none');
    document.getElementById('bulkAutoBlock').classList.remove('d-none');

    // Sembunyikan tab Bulk jika EDIT (edit tidak support bulk)
    const tabsBar = document.getElementById('copyModeTabs');
    if (isEdit) {
      tabsBar.style.display = 'none';
      // Paksa ke tab Single
      const singleTab = document.getElementById('copyTabSingle');
      if (singleTab) new bootstrap.Tab(singleTab).show();
    } else {
      tabsBar.style.display = '';
      const singleTab = document.getElementById('copyTabSingle');
      if (singleTab) new bootstrap.Tab(singleTab).show();
    }

    // Sembunyikan modal detail
    const detailModal = bootstrap.Modal.getInstance(document.getElementById('bookDetailModal'));
    if (detailModal) detailModal.hide();

    if (isEdit) {
      API.call('getBookCopies', { bookId }).then(res => {
        if (!res.success) { Toast.error(res.message); return; }
        const copy = (res.data || []).find(c => c.copy_id === copyId);
        if (!copy) { Toast.error('Eksemplar tidak ditemukan'); return; }
        BooksPage.fillCopyForm(copy);
        setTimeout(() => {
          new bootstrap.Modal(document.getElementById('copyFormModal')).show();
        }, 300);
      });
    } else {
      document.getElementById('copyAcqDate').value = new Date().toISOString().substring(0, 10);
      document.getElementById('bulkAcqDate').value = new Date().toISOString().substring(0, 10);

      // Reset ke mode manual untuk single
      document.getElementById('barcodeModeManual').checked = true;
      document.getElementById('bulkModeAuto').checked = true;

      BooksPage.updateBarcodeModeUI();
      BooksPage.updateBulkModeUI();

      setTimeout(() => {
        new bootstrap.Modal(document.getElementById('copyFormModal')).show();
      }, 300);
    }
  },

  updateBarcodeModeUI() {
    const mode = document.querySelector('input[name="barcodeMode"]:checked').value;
    const autoBlock = document.getElementById('copyAutoBlock');
    const manualBlock = document.getElementById('copyManualBlock');

    if (mode === 'AUTO') {
      autoBlock.classList.remove('d-none');
      manualBlock.classList.add('d-none');
      BooksPage.previewSingleAuto();
    } else {
      autoBlock.classList.add('d-none');
      manualBlock.classList.remove('d-none');
    }
  },

  updateBulkModeUI() {
    const mode = document.querySelector('input[name="bulkBarcodeMode"]:checked').value;
    const autoBlock = document.getElementById('bulkAutoBlock');
    const manualBlock = document.getElementById('bulkManualBlock');

    if (mode === 'AUTO') {
      autoBlock.classList.remove('d-none');
      manualBlock.classList.add('d-none');
      BooksPage.previewBulkAuto();
    } else {
      autoBlock.classList.add('d-none');
      manualBlock.classList.remove('d-none');
    }
  },

  async previewSingleAuto() {
    const preview = document.getElementById('copyAutoPreview');
    if (!preview) return;
    preview.innerHTML = '<small class="text-muted">Memuat preview...</small>';

    try {
      const res = await API.call('previewBookCopyNumbers', {
        book_id: BooksPage.state.currentBookId,
        quantity: 1,
        acquisition_type: document.getElementById('copyAcqType').value
      });
      if (!res.success) {
        preview.innerHTML = '<div class="alert alert-warning small py-1 mb-0">' + UI.escape(res.message) + '</div>';
        return;
      }
      const s = res.data.firstSample;
      if (!s) {
        preview.innerHTML = '<div class="alert alert-warning small py-1 mb-0">Preview tidak tersedia.</div>';
        return;
      }
      preview.innerHTML = `
        <div class="alert alert-success small py-2 mb-0">
          <div><strong>Preview:</strong></div>
          <div>Barcode: <code>${UI.escape(s.barcode)}</code></div>
          <div>No. Inventaris: <code>${UI.escape(s.accession_number)}</code></div>
        </div>
      `;
    } catch (e) {
      preview.innerHTML = '<div class="alert alert-danger small py-1 mb-0">' + UI.escape(e.message) + '</div>';
    }
  },

  async previewBulkAuto() {
    const preview = document.getElementById('bulkAutoPreview');
    if (!preview) return;

    const qty = parseInt(document.getElementById('bulkQuantity').value, 10) || 0;
    if (qty < 1) {
      preview.innerHTML = '<small class="text-muted">Isi jumlah eksemplar dulu.</small>';
      return;
    }

    preview.innerHTML = '<small class="text-muted">Memuat preview...</small>';

    try {
      const res = await API.call('previewBookCopyNumbers', {
        book_id: BooksPage.state.currentBookId,
        quantity: qty,
        acquisition_type: document.getElementById('bulkAcqType').value
      });
      if (!res.success) {
        preview.innerHTML = '<div class="alert alert-warning small py-1 mb-0">' + UI.escape(res.message) + '</div>';
        return;
      }

      const first = res.data.firstSample;
      const last = res.data.lastSample;
      if (!first || !last) {
        preview.innerHTML = '<div class="alert alert-warning small py-1 mb-0">Preview tidak tersedia.</div>';
        return;
      }

      preview.innerHTML = `
        <div class="alert alert-success small py-2 mb-0">
          <div class="fw-semibold mb-1">Preview ${res.data.quantity} eksemplar:</div>
          <div class="row g-2">
            <div class="col-md-6">
              <div class="text-muted" style="font-size:11px">Barcode pertama</div>
              <code>${UI.escape(first.barcode)}</code>
            </div>
            <div class="col-md-6">
              <div class="text-muted" style="font-size:11px">Barcode terakhir</div>
              <code>${UI.escape(last.barcode)}</code>
            </div>
            <div class="col-md-6">
              <div class="text-muted" style="font-size:11px">No. Inventaris pertama</div>
              <code>${UI.escape(first.accession_number)}</code>
            </div>
            <div class="col-md-6">
              <div class="text-muted" style="font-size:11px">No. Inventaris terakhir</div>
              <code>${UI.escape(last.accession_number)}</code>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      preview.innerHTML = '<div class="alert alert-danger small py-1 mb-0">' + UI.escape(e.message) + '</div>';
    }
  },

  fillCopyForm(c) {
    document.getElementById('copyBarcode').value = c.barcode || '';
    document.getElementById('copyAccession').value = c.accession_number || '';
    document.getElementById('copyAcqDate').value =
      c.acquisition_date ? String(c.acquisition_date).substring(0, 10) : '';
    document.getElementById('copyAcqType').value = c.acquisition_type || 'PURCHASE';
    document.getElementById('copyNotes').value = c.notes || '';
    document.getElementById('copyCost').value = c.acquisition_cost || '';
    document.getElementById('copyCondition').value = c.condition || 'NEW';
    document.getElementById('copyShelf').value = c.shelf_id || '';
  },

    async saveCopy() {
    const copyId = BooksPage.state.editCopyId;
    const bookId = BooksPage.state.currentBookId;
    const isEdit = !!copyId;

    // Kalau EDIT — selalu single
    if (isEdit) {
      return BooksPage.saveSingleCopy();
    }

    // Cek tab aktif
    const bulkPane = document.getElementById('copyPaneBulk');
    const isBulkTab = bulkPane.classList.contains('active');

    if (isBulkTab) {
      return BooksPage.saveBulkCopies();
    } else {
      return BooksPage.saveSingleCopy();
    }
  },

  async saveSingleCopy() {
    const bookId = BooksPage.state.currentBookId;
    const mode = document.querySelector('input[name="barcodeMode"]:checked').value;

    const payload = {
      book_id: bookId,
      barcode_mode: mode,
      acquisition_date: document.getElementById('copyAcqDate').value,
      acquisition_type: document.getElementById('copyAcqType').value,
      acquisition_cost: document.getElementById('copyCost').value,
      shelf_id: document.getElementById('copyShelf').value,
      condition: document.getElementById('copyCondition').value,
      notes: document.getElementById('copyNotes').value.trim()
    };

    if (mode === 'MANUAL') {
      const barcode = document.getElementById('copyBarcode').value.trim();
      if (!barcode) { Toast.warning('Barcode wajib diisi di mode manual.'); return; }
      payload.barcode = barcode;
      payload.accession_number = document.getElementById('copyAccession').value.trim();
    }

    UI.showLoader();
    document.getElementById('btnSaveCopy').disabled = true;

    try {
      const res = await API.call('createBookCopy', payload);
      UI.hideLoader();
      document.getElementById('btnSaveCopy').disabled = false;

      if (!res.success) { Toast.error(res.message); return; }

      Toast.success('Eksemplar berhasil ditambahkan.');
      bootstrap.Modal.getInstance(document.getElementById('copyFormModal')).hide();
      BooksPage.load();
      setTimeout(() => BooksPage.openDetail(bookId), 400);
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnSaveCopy').disabled = false;
      Toast.error(e.message);
    }
  },

  async saveBulkCopies() {
    const bookId = BooksPage.state.currentBookId;
    const mode = document.querySelector('input[name="bulkBarcodeMode"]:checked').value;
    const quantity = parseInt(document.getElementById('bulkQuantity').value, 10);

    if (!quantity || quantity < 1) {
      Toast.warning('Jumlah eksemplar minimal 1.');
      return;
    }
    if (quantity > 500) {
      Toast.warning('Maksimal 500 eksemplar per batch.');
      return;
    }

    const payload = {
      book_id: bookId,
      quantity: quantity,
      barcode_mode: mode,
      acquisition_date: document.getElementById('bulkAcqDate').value,
      acquisition_type: document.getElementById('bulkAcqType').value,
      acquisition_cost: document.getElementById('bulkCost').value,
      shelf_id: document.getElementById('bulkShelf').value,
      condition: document.getElementById('bulkCondition').value,
      notes: document.getElementById('bulkNotes').value.trim()
    };

    if (mode === 'MANUAL') {
      const barcodesText = document.getElementById('bulkManualBarcodes').value.trim();
      const barcodes = barcodesText.split(/\r?\n/).map(function(s) { return s.trim(); }).filter(Boolean);

      if (barcodes.length !== quantity) {
        Toast.error('Jumlah barcode (' + barcodes.length + ') tidak sesuai dengan quantity (' + quantity + ').');
        return;
      }

      const inventoryText = document.getElementById('bulkManualInventory').value.trim();
      const inventories = inventoryText
        ? inventoryText.split(/\r?\n/).map(function(s) { return s.trim(); })
        : [];

      payload.manual_barcodes = barcodes;
      payload.manual_inventory = inventories;
    }

    const yes = await UI.confirm(
      'Tambah ' + quantity + ' eksemplar sekaligus?',
      'Konfirmasi Bulk'
    );
    if (!yes) return;

    UI.showLoader();
    document.getElementById('btnSaveCopy').disabled = true;

    try {
      const res = await API.call('bulkCreateBookCopies', payload);
      UI.hideLoader();
      document.getElementById('btnSaveCopy').disabled = false;

      if (!res.success) { Toast.error(res.message); return; }

      Toast.success(res.message || quantity + ' eksemplar ditambahkan.');
      bootstrap.Modal.getInstance(document.getElementById('copyFormModal')).hide();
      BooksPage.load();
      setTimeout(() => BooksPage.openDetail(bookId), 400);
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnSaveCopy').disabled = false;
      Toast.error(e.message);
    }
  },

  // ============ ARCHIVE ============
  async archiveBook(bookId, title) {
    const yes = await UI.confirm(
      `Arsipkan buku "${title}"? Buku yang diarsipkan tidak akan tampil di katalog utama, tapi data historis tetap tersimpan.`,
      'Konfirmasi Arsip'
    );
    if (!yes) return;

    UI.showLoader();
    try {
      const res = await API.call('archiveBook', { bookId });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      Toast.success('Buku diarsipkan.');
      BooksPage.load();
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  }
};

/* ============================================================
 * PAGE: MEMBERS (Siswa, Staf, Kelas)
 * ============================================================ */
function initPage_members() {
  MembersPage.init();
}

/* ============================================================
 * CSV PARSER HELPER
 * ============================================================ */
const CsvHelper = {
  /**
   * Parse CSV/TSV string → array of object.
   * Deteksi delimiter otomatis (, atau ; atau \t).
   */
  parse(text) {
    if (!text || !text.trim()) return [];

    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    // Deteksi delimiter
    const firstLine = lines[0];
    const delim = CsvHelper.detectDelimiter_(firstLine);

    const headers = CsvHelper.parseLine_(lines[0], delim).map(h =>
      h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '_'));

    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = CsvHelper.parseLine_(lines[i], delim);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = (cells[idx] || '').trim();
      });
      result.push(obj);
    }
    return result;
  },

  detectDelimiter_(line) {
    if (line.indexOf('\t') !== -1) return '\t';
    const commas = (line.match(/,/g) || []).length;
    const semis = (line.match(/;/g) || []).length;
    if (semis > commas) return ';';
    return ',';
  },

  parseLine_(line, delim) {
    // Simple CSV parser yang handle quoted values
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delim && !inQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells;
  }
};

/* ============================================================
 * PERMISSION HELPERS
 * ============================================================ */
/**
 * Cek permission user untuk modul & aksi tertentu.
 * Contoh: if (can('BOOKS', 'create')) { ... }
 */
function can(module, action) {
  return API.hasPerm(module, action);
}

/**
 * Terapkan visibility ke element berdasarkan permission.
 * Kalau tidak boleh → element di-hide (display:none).
 */
function applyPermission(elementOrSelector, module, action) {
  if (!can(module, action)) {
    const el = typeof elementOrSelector === 'string'
      ? document.querySelector(elementOrSelector)
      : elementOrSelector;
    if (el) el.style.display = 'none';
  }
}

const MembersPage = {
  state: {
    // Siswa
    students: {
      page: 1, pageSize: 20, total: 0,
      query: '', classId: '', status: '', items: []
    },
    // Staf
    staff: {
      query: '', staffType: '', status: '', items: []
    },
    // Kelas
    classes: {
      year: '', status: 'ACTIVE', items: []
    },
    // Edit modes
    editStudentId: null,
    editStaffId: null,
    editClassId: null,
    // Cache
    cache: {
      classes: [],
      staffList: [],
      grades: [],
      currentYear: ''
    }
  },

  // ============ INIT ============
    async init() {
    // Hide tombol yang butuh permission
    if (!can('MEMBERS', 'create')) {
      ['btnAddStudent', 'btnAddStaff', 'btnAddClass',
       'btnImportStudents', 'btnImportStaff'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    }
    if (!can('MEMBERS', 'view')) {
      // Kalau tidak boleh lihat anggota, sembunyikan tab cetak massal
      ['btnBulkCardStudent', 'btnBulkCardStaff'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    }

    MembersPage.bindEvents();
    await MembersPage.loadMasterData();
    await Promise.all([
      MembersPage.loadStudents(),
      MembersPage.loadStaff(),
      MembersPage.loadClasses()
    ]);
  },

  bindEvents() {
    // === SISWA ===
    let t1;
    const inpStudent = document.getElementById('studentsSearchInput');
    if (inpStudent) {
      inpStudent.addEventListener('input', e => {
        clearTimeout(t1);
        t1 = setTimeout(() => {
          MembersPage.state.students.query = e.target.value.trim();
          MembersPage.state.students.page = 1;
          MembersPage.loadStudents();
        }, 400);
      });
    }
    document.getElementById('studentsClassFilter').addEventListener('change', e => {
      MembersPage.state.students.classId = e.target.value;
      MembersPage.state.students.page = 1;
      MembersPage.loadStudents();
    });
    document.getElementById('studentsStatusFilter').addEventListener('change', e => {
      MembersPage.state.students.status = e.target.value;
      MembersPage.state.students.page = 1;
      MembersPage.loadStudents();
    });
    document.getElementById('btnAddStudent').addEventListener('click', () => {
      MembersPage.openStudentForm(null);
    });
    document.getElementById('btnSaveStudent').addEventListener('click', () => {
      MembersPage.saveStudent();
    });

    document.getElementById('btnBulkCardStudent').addEventListener('click', () => {
      MembersPage.openBulkCardModal('STUDENT');
    });

    // Toggle NIS mode
    document.querySelectorAll('input[name="nisMode"]').forEach(el => {
      el.addEventListener('change', () => MembersPage.updateNisModeUI());
    });
    document.getElementById('studentEnrollDate').addEventListener('change', () => {
      MembersPage.updateNisPreview();
    });

    // === STAF ===
    let t2;
    const inpStaff = document.getElementById('staffSearchInput');
    if (inpStaff) {
      inpStaff.addEventListener('input', e => {
        clearTimeout(t2);
        t2 = setTimeout(() => {
          MembersPage.state.staff.query = e.target.value.trim();
          MembersPage.loadStaff();
        }, 400);
      });
    }
    document.getElementById('staffTypeFilter').addEventListener('change', e => {
      MembersPage.state.staff.staffType = e.target.value;
      MembersPage.loadStaff();
    });
    document.getElementById('staffStatusFilter').addEventListener('change', e => {
      MembersPage.state.staff.status = e.target.value;
      MembersPage.loadStaff();
    });
    document.getElementById('btnAddStaff').addEventListener('click', () => {
      MembersPage.openStaffForm(null);
    });
    document.getElementById('btnSaveStaff').addEventListener('click', () => {
      MembersPage.saveStaff();
    });

    document.getElementById('btnBulkCardStaff').addEventListener('click', () => {
      MembersPage.openBulkCardModal('STAFF');
    });

    // === KELAS ===
    document.getElementById('classesYearFilter').addEventListener('change', e => {
      MembersPage.state.classes.year = e.target.value;
      MembersPage.loadClasses();
    });
    document.getElementById('classesStatusFilter').addEventListener('change', e => {
      MembersPage.state.classes.status = e.target.value;
      MembersPage.loadClasses();
    });
    document.getElementById('btnAddClass').addEventListener('click', () => {
      MembersPage.openClassForm(null);
    });
    document.getElementById('btnSaveClass').addEventListener('click', () => {
      MembersPage.saveClass();
    });
    // Bulk Card
    document.getElementById('btnGenerateBulkCard').addEventListener('click', () => {
      MembersPage.generateBulkCard();
    });

    // Import
    document.getElementById('btnImportStudents').addEventListener('click', () => {
      MembersPage.openImportModal('STUDENT');
    });
    document.getElementById('btnImportStaff').addEventListener('click', () => {
      MembersPage.openImportModal('STAFF');
    });
    document.querySelectorAll('input[name="importSource"]').forEach(el => {
      el.addEventListener('change', () => {
        const src = document.querySelector('input[name="importSource"]:checked').value;
        document.getElementById('importPasteArea').style.display = src === 'PASTE' ? '' : 'none';
        document.getElementById('importUploadArea').style.display = src === 'FILE' ? '' : 'none';
      });
    });
  },

  // ============ MASTER DATA ============
    async loadMasterData() {
    try {
      const [classRes, staffRes, configRes, gradeRes] = await Promise.all([
        API.call('listClasses', {}),
        API.call('searchStaff', {}),
        API.call('getAllConfig'),
        API.call('listGradeLevels', { status: 'ACTIVE' })
      ]);

      MembersPage.state.cache.classes = (classRes.success ? classRes.data : []) || [];
      MembersPage.state.cache.staffList = (staffRes.success ? staffRes.data : []) || [];
      MembersPage.state.cache.currentYear =
        (configRes.success && configRes.data.SCHOOL_YEAR) || '2026/2027';
      MembersPage.state.cache.grades = (gradeRes.success ? gradeRes.data : []) || [];

      MembersPage.fillSelects();
    } catch (e) {
      console.error('loadMasterData error', e);
    }
  },

    fillSelects() {
    const classes = MembersPage.state.cache.classes;
    const staffList = MembersPage.state.cache.staffList.filter(s =>
      s.staff_type === 'TEACHER' || s.staff_type === 'LIBRARIAN');
    const grades = MembersPage.state.cache.grades || [];

    // === DROPDOWN TINGKAT (form kelas) ===
    const fGrade = document.getElementById('classGrade');
    if (fGrade) {
      const gradeMap = {};
      grades.forEach(g => {
        const grp = g.grade_level_group;
        if (!gradeMap[grp]) gradeMap[grp] = [];
        gradeMap[grp].push(g);
      });
      const groupLabels = {
        SD: 'SD / MI',
        SMP: 'SMP / MTs',
        SMA: 'SMA / MA',
        SMK: 'SMK',
        MI: 'MI',
        MTS: 'MTs',
        MA: 'MA',
        OTHER: 'Lainnya'
      };
      let html = '<option value="">-- Pilih Tingkat --</option>';
      const order = ['SD', 'MI', 'SMP', 'MTS', 'SMA', 'MA', 'SMK', 'OTHER'];
      order.forEach(grp => {
        if (!gradeMap[grp] || !gradeMap[grp].length) return;
        html += `<optgroup label="${groupLabels[grp] || grp}">`;
        gradeMap[grp].forEach(g => {
          html += `<option value="${g.grade_id}">${UI.escape(g.grade_name)}</option>`;
        });
        html += '</optgroup>';
      });
      fGrade.innerHTML = html;
    }

    // Filter kelas (siswa)
    const fClassFilter = document.getElementById('studentsClassFilter');
    if (fClassFilter) {
      fClassFilter.innerHTML = '<option value="">Semua Kelas</option>' +
        classes.map(c =>
          `<option value="${c.class_id}">${UI.escape(c.class_name)} - ${UI.escape(c.academic_year)}</option>`
        ).join('');
    }

    // Form kelas (siswa)
    const fClass = document.getElementById('studentClass');
    if (fClass) {
      fClass.innerHTML = '<option value="">-- Pilih Kelas --</option>' +
        classes.map(c =>
          `<option value="${c.class_id}">${UI.escape(c.class_name)} - ${UI.escape(c.academic_year)}</option>`
        ).join('');
    }

    // Wali kelas (form kelas)
    const fHomeroom = document.getElementById('classHomeroom');
    if (fHomeroom) {
      fHomeroom.innerHTML = '<option value="">-- Pilih Wali Kelas --</option>' +
        staffList.map(s =>
          `<option value="${s.staff_id}">${UI.escape(s.full_name)}</option>`
        ).join('');
    }

    // Tahun ajaran filter (kelas)
    const yearFilter = document.getElementById('classesYearFilter');
    if (yearFilter) {
      const years = {};
      classes.forEach(c => { if (c.academic_year) years[c.academic_year] = true; });
      const yearList = Object.keys(years).sort().reverse();
      yearFilter.innerHTML = '<option value="">Semua Tahun Ajaran</option>' +
        yearList.map(y =>
          `<option value="${y}">${UI.escape(y)}</option>`
        ).join('');
    }
  },

  // ============================================================
  // SISWA
  // ============================================================
  async loadStudents() {
    UI.showLoader();
    try {
      const s = MembersPage.state.students;
      const res = await API.call('searchStudents', {
        query: s.query, classId: s.classId, status: s.status,
        page: s.page, pageSize: s.pageSize
      });
      if (!res.success) { Toast.error(res.message); return; }
      s.items = res.data.items || [];
      s.total = res.data.total || 0;
      MembersPage.renderStudents(res.data);
      document.getElementById('tabStudentsCount').textContent = s.total;
    } catch (e) {
      Toast.error('Gagal memuat siswa: ' + e.message);
    } finally {
      UI.hideLoader();
    }
  },

  renderStudents(data) {
    const tbody = document.getElementById('studentsTableBody');
    const s = MembersPage.state.students;

    if (!s.items.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-row">
        ${s.query || s.classId || s.status
          ? 'Tidak ada siswa yang cocok'
          : 'Belum ada siswa. Klik "Tambah Siswa" untuk memulai.'}
      </td></tr>`;
      MembersPage.renderStudentsPagination(data);
      return;
    }

    const classMap = {};
    MembersPage.state.cache.classes.forEach(c => { classMap[c.class_id] = c; });

    tbody.innerHTML = s.items.map(st => {
      const cls = classMap[st.class_id];
      const className = cls ? cls.class_name : '-';
      const initials = MembersPage.getInitials(st.full_name);
      const genderIcon = st.gender === 'MALE' ? 'gender-male' :
                         st.gender === 'FEMALE' ? 'gender-female' : 'gender-ambiguous';
      const statusClass = 'badge-status-' + (st.membership_status || 'ACTIVE');

      return `
        <tr>
          <td>
            <div class="student-avatar-sm">${UI.escape(initials)}</div>
          </td>
          <td><code>${UI.escape(st.nis)}</code></td>
          <td>
            <div class="fw-semibold">${UI.escape(st.full_name)}</div>
            ${st.nisn ? `<small class="text-muted">NISN: ${UI.escape(st.nisn)}</small>` : ''}
          </td>
          <td><i class="bi bi-${genderIcon}"></i></td>
          <td><span class="badge bg-light text-dark">${UI.escape(className)}</span></td>
          <td class="text-muted small">${UI.escape(st.academic_year || '-')}</td>
          <td class="text-center">
            <span class="badge ${statusClass}">${UI.escape(st.membership_status)}</span>
          </td>
          <td class="text-end">
            ${can('MEMBERS', 'view') ? `
              <button class="btn btn-sm btn-outline-success" title="Cetak Kartu"
                      onclick="MembersPage.printCard('STUDENT','${st.student_id}')">
                <i class="bi bi-printer"></i>
              </button>
            ` : ''}
            ${can('MEMBERS', 'update') ? `
              <button class="btn btn-sm btn-outline-secondary" title="Edit"
                      onclick="MembersPage.openStudentForm('${st.student_id}')">
                <i class="bi bi-pencil"></i>
              </button>
              <div class="btn-group">
                <button class="btn btn-sm btn-outline-primary dropdown-toggle" title="Ubah Status"
                        data-bs-toggle="dropdown">
                  <i class="bi bi-person-gear"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li><a class="dropdown-item" href="javascript:void(0)"
                         onclick="MembersPage.setStudentStatus('${st.student_id}','ACTIVE','${UI.escape(st.full_name)}')">
                    <i class="bi bi-check-circle text-success me-1"></i> Aktif
                  </a></li>
                  <li><a class="dropdown-item" href="javascript:void(0)"
                         onclick="MembersPage.setStudentStatus('${st.student_id}','SUSPENDED','${UI.escape(st.full_name)}')">
                    <i class="bi bi-pause-circle text-warning me-1"></i> Tangguhkan
                  </a></li>
                  <li><a class="dropdown-item" href="javascript:void(0)"
                         onclick="MembersPage.setStudentStatus('${st.student_id}','GRADUATED','${UI.escape(st.full_name)}')">
                    <i class="bi bi-mortarboard text-primary me-1"></i> Lulus
                  </a></li>
                  <li><a class="dropdown-item" href="javascript:void(0)"
                         onclick="MembersPage.setStudentStatus('${st.student_id}','INACTIVE','${UI.escape(st.full_name)}')">
                    <i class="bi bi-x-circle text-secondary me-1"></i> Nonaktif
                  </a></li>
                </ul>
              </div>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

    MembersPage.renderStudentsPagination(data);
  },

  renderStudentsPagination(data) {
    const s = MembersPage.state.students;
    const info = document.getElementById('studentsInfo');
    const pag = document.getElementById('studentsPagination');
    if (info) {
      const start = s.total === 0 ? 0 : (s.page - 1) * s.pageSize + 1;
      const end = Math.min(s.page * s.pageSize, s.total);
      info.textContent = `Menampilkan ${start}-${end} dari ${s.total} siswa`;
    }
    if (!pag) return;

    const totalPages = data.totalPages || 1;
    const page = s.page;
    if (totalPages <= 1) { pag.innerHTML = ''; return; }

    let html = '';
    html += `<li class="page-item ${page <= 1 ? 'disabled' : ''}">
      <a class="page-link" href="javascript:void(0)" onclick="MembersPage.goStudentPage(${page-1})">
        <i class="bi bi-chevron-left"></i></a></li>`;
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) {
      html += `<li class="page-item ${i === page ? 'active' : ''}">
        <a class="page-link" href="javascript:void(0)" onclick="MembersPage.goStudentPage(${i})">${i}</a></li>`;
    }
    html += `<li class="page-item ${page >= totalPages ? 'disabled' : ''}">
      <a class="page-link" href="javascript:void(0)" onclick="MembersPage.goStudentPage(${page+1})">
        <i class="bi bi-chevron-right"></i></a></li>`;
    pag.innerHTML = html;
  },

  goStudentPage(p) {
    const s = MembersPage.state.students;
    if (p < 1 || p > Math.ceil(s.total / s.pageSize)) return;
    s.page = p;
    MembersPage.loadStudents();
  },

  // ============ FORM SISWA ============
  async openStudentForm(studentId) {
    MembersPage.state.editStudentId = studentId;
    const isEdit = !!studentId;

    document.getElementById('studentFormTitle').textContent =
      isEdit ? 'Edit Siswa' : 'Tambah Siswa';
    document.getElementById('studentForm').reset?.();
    document.getElementById('studentPhotoUrl').value = '';
    MembersPage.renderPhotoPreview('STUDENT', '');

    // Set default tahun ajaran
    document.getElementById('studentAcademicYear').value =
      MembersPage.state.cache.currentYear;

    if (isEdit) {
      UI.showLoader();
      try {
        const res = await API.call('getStudentDetail', { studentId });
        UI.hideLoader();
        if (!res.success) { Toast.error(res.message); return; }
        MembersPage.fillStudentForm(res.data.student);
        new bootstrap.Modal(document.getElementById('studentFormModal')).show();
      } catch (e) {
        UI.hideLoader();
        Toast.error(e.message);
      }
    } else {
      // Set tanggal masuk default hari ini
      document.getElementById('studentEnrollDate').value =
        new Date().toISOString().substring(0, 10);
      document.getElementById('nisModeAuto').checked = true;
      MembersPage.updateNisModeUI();
      await MembersPage.updateNisPreview();
      new bootstrap.Modal(document.getElementById('studentFormModal')).show();
    }
  },

  fillStudentForm(s) {
    document.getElementById('studentName').value = s.full_name || '';
    document.getElementById('studentGender').value = s.gender || '';
    document.getElementById('studentNis').value = s.nis || '';
    document.getElementById('studentNisn').value = s.nisn || '';
    document.getElementById('studentClass').value = s.class_id || '';
    document.getElementById('studentAcademicYear').value = s.academic_year || '';
    document.getElementById('studentStatus').value = s.membership_status || 'ACTIVE';
    // Photo
    document.getElementById('studentPhotoUrl').value = s.photo_url || '';
    MembersPage.renderPhotoPreview('STUDENT', s.photo_url || '');
    document.getElementById('studentNotes').value = s.notes || '';
    document.getElementById('studentEnrollDate').value =
      s.enrollment_date ? String(s.enrollment_date).substring(0, 10) : '';

    // Mode: kalau edit, default MANUAL (karena NIS sudah ada)
    document.getElementById('nisModeManual').checked = true;
    MembersPage.updateNisModeUI();
  },

  updateNisModeUI() {
    const mode = document.querySelector('input[name="nisMode"]:checked').value;
    const autoBlock = document.getElementById('nisAutoBlock');
    const manualBlock = document.getElementById('nisManualBlock');

    if (mode === 'AUTO') {
      autoBlock.classList.remove('d-none');
      manualBlock.classList.add('d-none');
      MembersPage.updateNisPreview();
    } else {
      autoBlock.classList.add('d-none');
      manualBlock.classList.remove('d-none');
    }
  },

  async updateNisPreview() {
    const mode = document.querySelector('input[name="nisMode"]:checked').value;
    if (mode !== 'AUTO') return;

    const previewEl = document.getElementById('nisPreviewText');
    if (!previewEl) return;

    // Cek apakah ini edit — kalau edit dengan AUTO, peringatan
    if (MembersPage.state.editStudentId) {
      previewEl.innerHTML =
        '<span class="text-warning">⚠ Mengubah ke AUTO akan mengganti NIS lama.</span>';
      return;
    }

    // Untuk tambah baru: panggil backend preview? Kita tampilkan format saja.
    try {
      const res = await API.call('searchStudents', { pageSize: 1 });
      // Cukup tampilkan format. NIS asli akan di-generate saat simpan.
      const code = await MembersPage.fetchSchoolCode();
      const d = document.getElementById('studentEnrollDate').value;
      const date = d ? new Date(d) : new Date();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year2 = String(date.getFullYear()).slice(-2);
      previewEl.innerHTML =
        `Format NIS: <code>${code}.${month}${year2}.XXXX</code>`;
    } catch (e) {
      previewEl.textContent = 'Format NIS: ----';
    }
  },

  async fetchSchoolCode() {
    // Ambil dari config SCHOOL_NAME, mirror logic extractInitials_ di backend
    // Untuk simplifikasi, kita ambil config dan proses
    try {
      const res = await API.call('getAllConfig');
      if (!res.success) return 'SCH';
      const name = res.data.SCHOOL_NAME || 'SMP';
      const stopWords = ['SMP','SMA','SMK','MTS','MA','SD','MI','NEGERI','SWASTA','ISLAM','ISLAMI','IT','PLUS','THE','AND','DAN','DI','KE','DARI'];
      const words = name.replace(/[^A-Za-z\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);
      const sig = words.filter(w => stopWords.indexOf(w.toUpperCase()) === -1);
      const src = sig.length >= 2 ? sig : words;
      let init = src.map(w => w.charAt(0).toUpperCase()).join('');
      if (init.length < 2) init = words.map(w => w.charAt(0).toUpperCase()).join('');
      return init || 'SCH';
    } catch (e) {
      return 'SCH';
    }
  },

  async saveStudent() {
    const studentId = MembersPage.state.editStudentId;
    const isEdit = !!studentId;

    const fullName = document.getElementById('studentName').value.trim();
    const gender = document.getElementById('studentGender').value;
    const classId = document.getElementById('studentClass').value;
    const nisMode = document.querySelector('input[name="nisMode"]:checked').value;

    if (!fullName) { Toast.warning('Nama wajib diisi.'); return; }
    if (!gender) { Toast.warning('Jenis kelamin wajib dipilih.'); return; }
    if (!classId) { Toast.warning('Kelas wajib dipilih.'); return; }

    const payload = {
      full_name: fullName,
      gender,
      class_id: classId,
      nisn: document.getElementById('studentNisn').value.trim(),
      academic_year: document.getElementById('studentAcademicYear').value.trim(),
      membership_status: document.getElementById('studentStatus').value,
      notes: document.getElementById('studentNotes').value.trim(),
      enrollment_date: document.getElementById('studentEnrollDate').value,
      photo_url: document.getElementById('studentPhotoUrl').value.trim(),
      nis_mode: nisMode
    };

    if (nisMode === 'MANUAL') {
      const nis = document.getElementById('studentNis').value.trim();
      if (!nis) { Toast.warning('NIS wajib diisi di mode manual.'); return; }
      payload.nis = nis;
    }

    UI.showLoader();
    document.getElementById('btnSaveStudent').disabled = true;

    try {
      const res = isEdit
        ? await API.call('updateStudent', { studentId, ...payload })
        : await API.call('createStudent', payload);

      UI.hideLoader();
      document.getElementById('btnSaveStudent').disabled = false;

      if (!res.success) { Toast.error(res.message); return; }

      Toast.success(res.message || (isEdit ? 'Siswa diperbarui.' : 'Siswa ditambahkan.'));
      bootstrap.Modal.getInstance(document.getElementById('studentFormModal')).hide();
      MembersPage.loadStudents();
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnSaveStudent').disabled = false;
      Toast.error(e.message);
    }
  },

  async setStudentStatus(studentId, status, name) {
    const labels = { ACTIVE: 'Aktif', SUSPENDED: 'Ditangguhkan', GRADUATED: 'Lulus', INACTIVE: 'Nonaktif' };
    const yes = await UI.confirm(
      `Ubah status "${name}" menjadi "${labels[status]}"?`, 'Konfirmasi');
    if (!yes) return;

    UI.showLoader();
    try {
      const res = await API.call('setStudentStatus', { studentId, status });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      Toast.success('Status diperbarui.');
      MembersPage.loadStudents();
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  // ============================================================
  // STAF
  // ============================================================
  async loadStaff() {
    try {
      const s = MembersPage.state.staff;
      const res = await API.call('searchStaff', {
        query: s.query, staffType: s.staffType, status: s.status
      });
      if (!res.success) { Toast.error(res.message); return; }
      s.items = res.data || [];
      MembersPage.renderStaff();
      document.getElementById('tabStaffCount').textContent = s.items.length;
    } catch (e) {
      Toast.error('Gagal memuat staf: ' + e.message);
    }
  },

  renderStaff() {
    const tbody = document.getElementById('staffTableBody');
    const items = MembersPage.state.staff.items;

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-row">
        Belum ada staf. Klik "Tambah Staf" untuk memulai.
      </td></tr>`;
      return;
    }

    const typeLabels = {
      TEACHER: 'Guru', LIBRARIAN: 'Pustakawan',
      ADMIN: 'Administrasi', OTHER: 'Lainnya'
    };

    tbody.innerHTML = items.map(s => {
      const statusClass = 'badge-status-' + (s.membership_status || 'ACTIVE');
      return `
        <tr>
          <td><code>${UI.escape(s.employee_number || '-')}</code></td>
          <td>
            <div class="fw-semibold">${UI.escape(s.full_name)}</div>
            ${s.phone ? `<small class="text-muted">${UI.escape(s.phone)}</small>` : ''}
          </td>
          <td><span class="badge bg-light text-dark">${typeLabels[s.staff_type] || s.staff_type}</span></td>
          <td class="text-muted small">${UI.escape(s.department || '-')}</td>
          <td class="small">${UI.escape(s.email || '-')}</td>
          <td class="text-center">
            <span class="badge ${statusClass}">${UI.escape(s.membership_status)}</span>
          </td>
          <td class="text-end">
            ${can('MEMBERS', 'view') ? `
              <button class="btn btn-sm btn-outline-success" title="Cetak Kartu"
                      onclick="MembersPage.printCard('STAFF','${s.staff_id}')">
                <i class="bi bi-printer"></i>
              </button>
            ` : ''}
            ${can('MEMBERS', 'update') ? `
              <button class="btn btn-sm btn-outline-secondary"
                      onclick="MembersPage.openStaffForm('${s.staff_id}')">
                <i class="bi bi-pencil"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  async openStaffForm(staffId) {
    MembersPage.state.editStaffId = staffId;
    const isEdit = !!staffId;

    document.getElementById('staffFormTitle').textContent =
      isEdit ? 'Edit Staf' : 'Tambah Staf';
    document.getElementById('staffForm').reset?.();
    document.getElementById('staffPhotoUrl').value = '';
    MembersPage.renderPhotoPreview('STAFF', '');

    if (isEdit) {
      UI.showLoader();
      try {
        const res = await API.call('searchStaff', {});
        UI.hideLoader();
        if (!res.success) { Toast.error(res.message); return; }
        const staff = (res.data || []).find(s => s.staff_id === staffId);
        if (!staff) { Toast.error('Staf tidak ditemukan.'); return; }
        MembersPage.fillStaffForm(staff);
        new bootstrap.Modal(document.getElementById('staffFormModal')).show();
      } catch (e) {
        UI.hideLoader();
        Toast.error(e.message);
      }
    } else {
      new bootstrap.Modal(document.getElementById('staffFormModal')).show();
    }
  },

  fillStaffForm(s) {
    document.getElementById('staffName').value = s.full_name || '';
    document.getElementById('staffEmployeeNumber').value = s.employee_number || '';
    document.getElementById('staffType').value = s.staff_type || '';
    document.getElementById('staffDepartment').value = s.department || '';
    document.getElementById('staffEmail').value = s.email || '';
    document.getElementById('staffPhone').value = s.phone || '';
    document.getElementById('staffPhotoUrl').value = s.photo_url || '';
    MembersPage.renderPhotoPreview('STAFF', s.photo_url || '');
    document.getElementById('staffStatus').value = s.membership_status || 'ACTIVE';
  },

  async saveStaff() {
    const staffId = MembersPage.state.editStaffId;
    const isEdit = !!staffId;

    const fullName = document.getElementById('staffName').value.trim();
    const staffType = document.getElementById('staffType').value;

    if (!fullName) { Toast.warning('Nama wajib diisi.'); return; }
    if (!staffType) { Toast.warning('Tipe staf wajib dipilih.'); return; }

    const payload = {
      full_name: fullName,
      employee_number: document.getElementById('staffEmployeeNumber').value.trim(),
      staff_type: staffType,
      department: document.getElementById('staffDepartment').value.trim(),
      email: document.getElementById('staffEmail').value.trim(),
      phone: document.getElementById('staffPhone').value.trim(),
      photo_url: document.getElementById('staffPhotoUrl').value.trim(),
      membership_status: document.getElementById('staffStatus').value
    };

    UI.showLoader();
    document.getElementById('btnSaveStaff').disabled = true;

    try {
      const res = isEdit
        ? await API.call('updateStaff', { staffId, ...payload })
        : await API.call('createStaff', payload);

      UI.hideLoader();
      document.getElementById('btnSaveStaff').disabled = false;

      if (!res.success) { Toast.error(res.message); return; }
      Toast.success(isEdit ? 'Staf diperbarui.' : 'Staf ditambahkan.');
      bootstrap.Modal.getInstance(document.getElementById('staffFormModal')).hide();
      await MembersPage.loadMasterData();
      MembersPage.loadStaff();
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnSaveStaff').disabled = false;
      Toast.error(e.message);
    }
  },

  // ============================================================
  // KELAS
  // ============================================================
  async loadClasses() {
    try {
      const c = MembersPage.state.classes;
      const res = await API.call('listClasses', {
        academicYear: c.year, status: c.status
      });
      if (!res.success) { Toast.error(res.message); return; }
      c.items = res.data || [];
      // Hitung jumlah siswa per kelas
      MembersPage.renderClasses();
      document.getElementById('tabClassesCount').textContent = c.items.length;
    } catch (e) {
      Toast.error('Gagal memuat kelas: ' + e.message);
    }
  },

  renderClasses() {
    const tbody = document.getElementById('classesTableBody');
    const items = MembersPage.state.classes.items;
    const staffMap = {};
    MembersPage.state.cache.staffList.forEach(s => { staffMap[s.staff_id] = s; });

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Belum ada kelas</td></tr>';
      return;
    }

    // Hitung siswa per kelas dari data yang ada
    const studentCountByClass = {};
    const students = MembersPage.state.students.items || [];
    students.forEach(s => {
      if (!studentCountByClass[s.class_id]) studentCountByClass[s.class_id] = 0;
      studentCountByClass[s.class_id]++;
    });

    tbody.innerHTML = items.map(c => {
      const homeroom = c.homeroom_teacher_id ? staffMap[c.homeroom_teacher_id] : null;
      const statusClass = 'badge-status-' + (c.status || 'ACTIVE');
      return `
        <tr>
          <td><code>${UI.escape(c.class_id)}</code></td>
          <td><strong>${UI.escape(c.class_name)}</strong></td>
          <td><span class="badge bg-light text-dark">${UI.escape(MembersPage.getGradeName(c.grade_id))}</span></td>
          <td class="text-muted small">${UI.escape(c.academic_year)}</td>
          <td>${UI.escape(homeroom ? homeroom.full_name : '-')}</td>
          <td class="text-center">${studentCountByClass[c.class_id] || 0}</td>
          <td class="text-center">
            <span class="badge ${statusClass}">${UI.escape(c.status)}</span>
          </td>
          <td class="text-end">
            ${can('MEMBERS', 'update') ? `
              <button class="btn btn-sm btn-outline-secondary"
                      onclick="MembersPage.openClassForm('${c.class_id}')">
                <i class="bi bi-pencil"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  async openClassForm(classId) {
    MembersPage.state.editClassId = classId;
    const isEdit = !!classId;

    document.getElementById('classFormTitle').textContent =
      isEdit ? 'Edit Kelas' : 'Tambah Kelas';
    document.getElementById('classForm').reset?.();

    if (isEdit) {
      const cls = MembersPage.state.classes.items.find(c => c.class_id === classId);
      if (!cls) { Toast.error('Kelas tidak ditemukan.'); return; }
      document.getElementById('className').value = cls.class_name || '';
      document.getElementById('classGrade').value = cls.grade_id || '';
      document.getElementById('classYear').value = cls.academic_year || '';
      document.getElementById('classHomeroom').value = cls.homeroom_teacher_id || '';
      document.getElementById('classStatus').value = cls.status || 'ACTIVE';
    } else {
      document.getElementById('classYear').value =
        MembersPage.state.cache.currentYear;
    }
    new bootstrap.Modal(document.getElementById('classFormModal')).show();
  },

  async saveClass() {
    const classId = MembersPage.state.editClassId;
    const isEdit = !!classId;

    const className = document.getElementById('className').value.trim();
    const grade = document.getElementById('classGrade').value;
    const year = document.getElementById('classYear').value.trim();

    if (!className) { Toast.warning('Nama kelas wajib diisi.'); return; }
    if (!grade) { Toast.warning('Tingkat wajib dipilih.'); return; }
    if (!year) { Toast.warning('Tahun ajaran wajib diisi.'); return; }

    const payload = {
      class_name: className,
      grade_id: grade,
      academic_year: year,
      homeroom_teacher_id: document.getElementById('classHomeroom').value,
      status: document.getElementById('classStatus').value
    };

    UI.showLoader();
    document.getElementById('btnSaveClass').disabled = true;

    try {
      const res = isEdit
        ? await API.call('updateClass', { classId, ...payload })
        : await API.call('createClass', payload);

      UI.hideLoader();
      document.getElementById('btnSaveClass').disabled = false;

      if (!res.success) { Toast.error(res.message); return; }
      Toast.success(isEdit ? 'Kelas diperbarui.' : 'Kelas ditambahkan.');
      bootstrap.Modal.getInstance(document.getElementById('classFormModal')).hide();
      await MembersPage.loadMasterData();
      await MembersPage.loadClasses();
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnSaveClass').disabled = false;
      Toast.error(e.message);
    }
  },

    getGradeName(gradeId) {
    if (!gradeId) return '-';
    // Kalau format lama (angka murni), tampilkan sebagai "Kelas X"
    if (/^\d+$/.test(String(gradeId))) {
      return 'Kelas ' + gradeId;
    }
    const g = (MembersPage.state.cache.grades || []).find(x => x.grade_id === gradeId);
    return g ? g.grade_name : gradeId;
  },

  async promptAddGradeLevel() {
    const id = 'addGradeModal_' + Date.now();
    const html = `
      <div class="modal fade" id="${id}" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h6 class="modal-title">Tambah Tingkat Baru</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-2">
                <label class="form-label small">Nomor Tingkat <span class="text-danger">*</span></label>
                <input type="number" class="form-control form-control-sm" id="${id}_num" min="0" max="99">
              </div>
              <div class="mb-2">
                <label class="form-label small">Nama Tampilan <span class="text-danger">*</span></label>
                <input type="text" class="form-control form-control-sm" id="${id}_name"
                       placeholder="Contoh: Kelas 7">
              </div>
              <div class="mb-2">
                <label class="form-label small">Grup Jenjang <span class="text-danger">*</span></label>
                <select class="form-select form-select-sm" id="${id}_group">
                  <option value="">-- Pilih --</option>
                  <option value="SD">SD</option>
                  <option value="MI">MI</option>
                  <option value="SMP">SMP</option>
                  <option value="MTS">MTs</option>
                  <option value="SMA">SMA</option>
                  <option value="MA">MA</option>
                  <option value="SMK">SMK</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Batal</button>
              <button class="btn btn-primary btn-sm" id="${id}_save">Simpan</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);

    const modal = new bootstrap.Modal(document.getElementById(id));
    document.getElementById(id).addEventListener('hidden.bs.modal', () => div.remove());

    document.getElementById(id + '_save').onclick = async () => {
      const num = parseInt(document.getElementById(id + '_num').value, 10);
      const name = document.getElementById(id + '_name').value.trim();
      const group = document.getElementById(id + '_group').value;

      if (isNaN(num) || num < 0) { Toast.warning('Nomor tingkat tidak valid.'); return; }
      if (!name) { Toast.warning('Nama wajib diisi.'); return; }
      if (!group) { Toast.warning('Grup wajib dipilih.'); return; }

      UI.showLoader();
      try {
        const res = await API.call('createGradeLevel', {
          grade_number: num,
          grade_name: name,
          grade_level_group: group
        });
        UI.hideLoader();
        if (!res.success) { Toast.error(res.message); return; }

        Toast.success('Tingkat "' + name + '" ditambahkan.');

        // Reload master data & pilih otomatis
        await MembersPage.loadMasterData();
        const fGrade = document.getElementById('classGrade');
        if (fGrade) fGrade.value = res.data.grade_id;

        modal.hide();
      } catch (e) {
        UI.hideLoader();
        Toast.error(e.message);
      }
    };

    modal.show();
  },

    // ============================================================
  // PHOTO UPLOAD
  // ============================================================
  renderPhotoPreview(type, url) {
    const imgId = type === 'STUDENT' ? 'studentPhotoImg' : 'staffPhotoImg';
    const phId = type === 'STUDENT' ? 'studentPhotoPlaceholder' : 'staffPhotoPlaceholder';
    const urlId = type === 'STUDENT' ? 'studentPhotoUrl' : 'staffPhotoUrl';

    const img = document.getElementById(imgId);
    const ph = document.getElementById(phId);
    if (!img || !ph) return;

    if (url) {
      img.src = url;
      img.classList.remove('d-none');
      ph.classList.add('d-none');
    } else {
      img.src = '';
      img.classList.add('d-none');
      ph.classList.remove('d-none');
    }
  },

  async onPhotoFile(event, type) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Toast.warning('File harus gambar.');
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      Toast.warning('Maksimal 1.5MB.');
      return;
    }

    const statusId = type === 'STUDENT' ? 'studentPhotoStatus' : 'staffPhotoStatus';
    const targetId = type === 'STUDENT'
      ? MembersPage.state.editStudentId
      : MembersPage.state.editStaffId;

    if (!targetId) {
      Toast.warning('Simpan data anggota terlebih dahulu sebelum upload foto.');
      event.target.value = '';
      return;
    }

    document.getElementById(statusId).textContent = 'Mengupload...';
    UI.showLoader();

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await API.call('uploadMemberPhoto', {
        fileName: file.name,
        mimeType: file.type,
        base64Data: base64,
        targetType: type,
        targetId: targetId
      });

      UI.hideLoader();

      if (!res.success) {
        document.getElementById(statusId).textContent = 'Max 1.5MB';
        Toast.error(res.message);
        return;
      }

      const urlFieldId = type === 'STUDENT' ? 'studentPhotoUrl' : 'staffPhotoUrl';
      document.getElementById(urlFieldId).value = res.data.url;
      MembersPage.renderPhotoPreview(type, res.data.url);
      document.getElementById(statusId).textContent = '✓ Terupload';

      // Auto-save ke backend
      if (type === 'STUDENT') {
        await API.call('updateStudent', {
          studentId: targetId,
          photo_url: res.data.url
        });
      } else {
        await API.call('updateStaff', {
          staffId: targetId,
          photo_url: res.data.url
        });
      }

      Toast.success('Foto berhasil disimpan.');
    } catch (e) {
      UI.hideLoader();
      document.getElementById(statusId).textContent = 'Max 1.5MB';
      Toast.error('Gagal upload: ' + e.message);
    }

    event.target.value = '';
  },

  // ============================================================
  // PRINT CARD
  // ============================================================
    async printCard(memberType, memberId) {
    UI.showLoader();
    try {
      const res = await API.call('getCardData', { memberType, memberId });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      MembersPage.openCardPreview([res.data], 'Kartu Anggota');
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  openBulkCardModal(type) {
    document.getElementById('bulkCardType').value = type;
    document.getElementById('bulkCardTitle').textContent =
      type === 'STUDENT' ? 'Cetak Kartu Massal — Siswa' : 'Cetak Kartu Massal — Guru & Staf';

    // Toggle filter class/staffType
    if (type === 'STUDENT') {
      document.getElementById('bulkCardClassWrap').style.display = '';
      document.getElementById('bulkCardStaffTypeWrap').style.display = 'none';
      // Fill class dropdown
      const sel = document.getElementById('bulkCardClass');
      sel.innerHTML = '<option value="">Semua Kelas</option>' +
        MembersPage.state.cache.classes.map(c =>
          `<option value="${c.class_id}">${UI.escape(c.class_name)} - ${UI.escape(c.academic_year)}</option>`
        ).join('');
    } else {
      document.getElementById('bulkCardClassWrap').style.display = 'none';
      document.getElementById('bulkCardStaffTypeWrap').style.display = '';
    }

    new bootstrap.Modal(document.getElementById('bulkCardModal')).show();
  },

    async generateBulkCard() {
    const type = document.getElementById('bulkCardType').value;
    const classId = type === 'STUDENT' ? document.getElementById('bulkCardClass').value : '';
    const staffType = type === 'STAFF' ? document.getElementById('bulkCardStaffType').value : '';
    const status = document.getElementById('bulkCardStatus').value;

    const payload = {
      memberType: type,
      classId: classId,
      staffType: staffType,
      status: status
    };

    UI.showLoader();
    document.getElementById('btnGenerateBulkCard').disabled = true;

    try {
      const res = await API.call('getBulkCardData', payload);
      UI.hideLoader();
      document.getElementById('btnGenerateBulkCard').disabled = false;

      if (!res.success) { Toast.error(res.message); return; }

      bootstrap.Modal.getInstance(document.getElementById('bulkCardModal')).hide();
      MembersPage.openCardPreview(res.data.cards, res.data.count + ' Kartu');
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnGenerateBulkCard').disabled = false;
      Toast.error(e.message);
    }
  },

  showCardDownloadModal(data, label) {
    const id = 'cardModal_' + Date.now();
    const html = `
      <div class="modal fade" id="${id}" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h6 class="modal-title">
                <i class="bi bi-check-circle text-success me-1"></i>${label} Berhasil
              </h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center">
              <i class="bi bi-file-earmark-pdf text-danger" style="font-size:56px"></i>
              <div class="mt-3 fw-semibold">${UI.escape(data.filename)}</div>
              <div class="text-muted small mt-1">PDF tersimpan di Google Drive</div>
              <div class="mt-3 d-grid gap-2">
                <a class="btn btn-primary" href="${data.downloadUrl}" target="_blank">
                  <i class="bi bi-download me-1"></i>Download PDF
                </a>
                <a class="btn btn-outline-secondary" href="${data.url}" target="_blank">
                  <i class="bi bi-box-arrow-up-right me-1"></i>Buka di Drive
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
    const modal = new bootstrap.Modal(document.getElementById(id));
    document.getElementById(id).addEventListener('hidden.bs.modal', () => div.remove());
    modal.show();
  },

    // ============================================================
  // CARD PREVIEW (HTML ID-1 presisi)
  // ============================================================
  openCardPreview(cards, title) {
    const tpl = document.getElementById('tpl-page-card');
    if (!tpl) { Toast.error('Template kartu tidak ditemukan.'); return; }

    // Buat container modal full-screen
    const id = 'cardPreviewModal_' + Date.now();
    const html = `
      <div class="modal fade" id="${id}" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-fullscreen modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-body p-0">
              ${tpl.innerHTML}
            </div>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);

    // Generate HTML kartu
    const area = div.querySelector('#cardPrintArea');
    area.innerHTML = '';
    cards.forEach(card => {
      area.appendChild(MembersPage.buildCardFront(card));
      area.appendChild(MembersPage.buildCardBack(card));
    });

    // Setup event listener untuk dropdown copies
    const copiesSelect = div.querySelector('#cardPrintCopies');
    if (copiesSelect) {
      // Simpan data kartu untuk re-generate
      MembersPage.state.currentCards = cards;
      copiesSelect.onchange = () => {
        MembersPage.regenerateCardArea(area, cards, parseInt(copiesSelect.value, 10));
      };
    }

    // Simpan reference ke DOM
    MembersPage.state.cardPreviewModalEl = div;
    MembersPage.state.cardPreviewArea = area;

    const modal = new bootstrap.Modal(document.getElementById(id));
    document.getElementById(id).addEventListener('hidden.bs.modal', () => {
      div.remove();
      MembersPage.state.cardPreviewModalEl = null;
      MembersPage.state.cardPreviewArea = null;
    });

    // Update judul
    const titleEl = div.querySelector('.card-toolbar h5');
    if (titleEl) titleEl.innerHTML = '<i class="bi bi-credit-card-2-front me-2"></i>' + UI.escape(title);

    modal.show();
  },

    buildCardFront(card) {
    const el = document.createElement('div');
    el.className = 'id-card id-card-front';

    const photoHtml = card.photo_url
      ? `<img src="${UI.escape(card.photo_url)}" alt="Foto"
              onerror="this.parentNode.innerHTML='<div class=\\'card-photo-placeholder\\'>FOTO<br>3x4</div>'">`
      : '<div class="card-photo-placeholder">FOTO<br>3x4</div>';

    const logoHtml = card.logo_url
      ? `<img src="${UI.escape(card.logo_url)}" alt="Logo" class="card-logo"
              onerror="this.style.display='none'">`
      : '';

    // Alamat + kota
    const alamatLengkap = [card.alamat, card.kota].filter(Boolean).join(', ');
    const alamatHtml = alamatLengkap
      ? `<div class="card-subtitle">${UI.escape(alamatLengkap)}</div>`
      : '';

    // Generate barcode (ID harus unik)
    const barcodeId = 'barcode_' + Math.random().toString(36).substring(2, 10);
    const barcodeValue = String(card.nis || '').replace(/\W/g, '').substring(0, 20) || '0000000000';

    el.innerHTML = `
      <div class="card-header-band">
        ${logoHtml}
        <div class="card-header-text">
          <div class="school-name">${UI.escape(card.sekolah)}</div>
          <div class="card-title">Kartu Anggota Perpustakaan</div>
          ${alamatHtml}
        </div>
      </div>

      <div class="card-body-content">
        <div class="card-photo">${photoHtml}</div>
        <div class="card-info">
          <div class="info-row">
            <div class="info-label">No. Anggota</div>
            <div class="info-value big">${UI.escape(card.nis)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Nama</div>
            <div class="info-value">${UI.escape(card.nama_lengkap)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">${card.jenis === 'STUDENT' ? 'Kelas' : 'Unit'}</div>
            <div class="info-value">${UI.escape(card.kelas)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Berlaku</div>
            <div class="info-value">Selama jadi anggota</div>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <div class="footer-barcode">
          <svg id="${barcodeId}" class="card-barcode-svg" data-barcode-value="${barcodeValue}"></svg>
          <div class="barcode-text">${UI.escape(card.nis)}</div>
        </div>
        <div class="footer-ttd">
          <div class="ttd-city-date">${UI.escape(card.kota)}, ${UI.escape(card.today)}</div>
          <div class="ttd-label">Kepala Perpustakaan</div>
          <div class="ttd-name">${UI.escape(card.kepala_perpus || '________________')}</div>
        </div>
      </div>
    `;

    // Render barcode dengan JsBarcode setelah element masuk DOM
    setTimeout(() => {
      const svgEl = el.querySelector('#' + barcodeId);
      if (!svgEl) return;
      if (typeof JsBarcode === 'undefined') {
        console.warn('JsBarcode belum dimuat.');
        return;
      }
      try {
        JsBarcode(svgEl, barcodeValue, {
          format: 'CODE128',
          width: 1.1,
          height: 30,
          displayValue: false,
          margin: 0,
          background: 'transparent',
          lineColor: '#1f2937'
        });
      } catch (e) {
        console.error('Barcode error:', e);
      }
    }, 50);

    return el;
  },

  buildCardBack(card) {
    const el = document.createElement('div');
    el.className = 'id-card id-card-back';

    const rules = [
      'Kartu ini wajib dibawa setiap kunjungan, peminjaman, dan pengembalian buku.',
      'Kartu tidak boleh dipinjamkan kepada orang lain.',
      'Peminjaman maksimal 3 buku selama 7 hari.',
      'Keterlambatan pengembalian dikenakan denda Rp 500/hari.',
      'Kerusakan/kehilangan buku menjadi tanggung jawab anggota.',
      'Kartu yang hilang harus segera dilaporkan ke pustakawan.'
    ];

    el.innerHTML = `
      <div class="back-header">Tata Tertib Perpustakaan</div>
      <ol class="rules-list">
        ${rules.map(r => '<li>' + UI.escape(r) + '</li>').join('')}
      </ol>
      <div class="back-footer">
        ${UI.escape(card.perpustakaan)} • ${UI.escape(card.kota)}
      </div>
    `;
    return el;
  },

    doPrintCard() {
    const modalEl = MembersPage.state.cardPreviewModalEl;
    const printArea = MembersPage.state.cardPreviewArea;

    if (!printArea) {
      Toast.error('Area kartu tidak ditemukan.');
      return;
    }

    // ============================================================
    // TEKNIK: Pindahkan konten kartu ke #printRoot di <body>
    // lalu print, lalu kembalikan.
    // ============================================================

    // 1. Buat #printRoot
    const printRoot = document.createElement('div');
    printRoot.id = 'printRoot';
    printRoot.style.cssText = 'display:none;';

    // 2. Clone konten kartu dari preview
    const clonedArea = printArea.cloneNode(true);
    clonedArea.style.background = 'transparent';
    printRoot.appendChild(clonedArea);

    // 3. Sembunyikan #app & modal sementara
    const appEl = document.getElementById('app');
    const originalAppDisplay = appEl ? appEl.style.display : '';
    if (appEl) appEl.style.display = 'none';

    // Sembunyikan modal Bootstrap
    let modalInstance = null;
    if (modalEl) {
      const modalElInner = modalEl.querySelector('.modal');
      if (modalElInner) {
        modalInstance = bootstrap.Modal.getInstance(modalElInner);
      }
    }

    // 4. Sembunyikan backdrop modal manual
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(b => { b.style.display = 'none'; });

    // 5. Sembunyikan modal container
    if (modalEl) modalEl.style.display = 'none';

    // 6. Tambahkan printRoot ke body
    document.body.appendChild(printRoot);

    // 7. Re-render barcode di cloned area
    setTimeout(() => {
      const barcodeEls = printRoot.querySelectorAll('.card-barcode-svg');
      barcodeEls.forEach((svg, idx) => {
        // Ambil value dari data attribute
        const value = svg.getAttribute('data-barcode-value');
        if (value) {
          try {
            JsBarcode(svg, value, {
              format: 'CODE128',
              width: 1.1,
              height: 30,
              displayValue: false,
              margin: 0,
              background: 'transparent',
              lineColor: '#1f2937'
            });
          } catch (e) {
            console.error('Barcode re-render error:', e);
          }
        }
      });

      // 8. Print
      window.print();

      // 9. Cleanup — kembalikan tampilan normal
      setTimeout(() => {
        printRoot.remove();
        if (appEl) appEl.style.display = originalAppDisplay;
        if (modalEl) modalEl.style.display = '';
        backdrops.forEach(b => { b.style.display = ''; });
        if (modalInstance) modalInstance.show();
      }, 300);
    }, 100);
  },

  closeCardPreview() {
    const modalEl = MembersPage.state.cardPreviewModalEl;
    if (modalEl) {
      const modalInstance = bootstrap.Modal.getInstance(modalEl.querySelector('.modal'));
      if (modalInstance) modalInstance.hide();
    }
  },

    regenerateCardArea(area, cards, perPage) {
    // perPage tidak mengubah jumlah kartu, tapi gap/ukuran grid.
    // Kita pakai perPage untuk menghitung berapa banyak kartu per baris/halaman.
    // Untuk saat ini kita hanya update CSS gap berdasarkan perPage.
    // Layout grid tetap 2 kolom.

    // Redraw area
    area.innerHTML = '';
    cards.forEach(card => {
      area.appendChild(MembersPage.buildCardFront(card));
      area.appendChild(MembersPage.buildCardBack(card));
    });

    // Update CSS gap dinamis
    const gap = perPage <= 4 ? 4 : (perPage <= 6 ? 3 : 2);
    area.style.gap = gap + 'mm';
  },

    // ============================================================
  // IMPORT BULK
  // ============================================================
  importState: {
    targetType: null,
    parsedRows: [],
    rawText: ''
  },

  openImportModal(targetType) {
    MembersPage.importState.targetType = targetType;
    MembersPage.importState.parsedRows = [];
    MembersPage.importState.rawText = '';

    const modal = document.getElementById('importModal');
    const title = document.getElementById('importModalTitle');
    const hint = document.getElementById('importFormatHint');
    const detail = document.getElementById('importFormatDetail');

    if (targetType === 'STUDENT') {
      title.textContent = 'Import Siswa';
      hint.textContent = 'Format CSV untuk Siswa';
      detail.innerHTML = 'nis, nisn, full_name, gender, class_name, academic_year, enrollment_date, status<br>' +
        '<em>Wajib: full_name, gender (MALE/FEMALE), class_name</em><br>' +
        '<em>Contoh kelas: 7A, 8B (harus sudah ada di tab Kelas)</em>';
    } else {
      title.textContent = 'Import Guru & Staf';
      hint.textContent = 'Format CSV untuk Staf';
      detail.innerHTML = 'employee_number, full_name, staff_type, department, email, phone, status<br>' +
        '<em>Wajib: full_name, staff_type (TEACHER/LIBRARIAN/ADMIN/OTHER)</em>';
    }

    // Reset ke step 1
    document.getElementById('importStep1').style.display = '';
    document.getElementById('importStep2').style.display = 'none';
    document.getElementById('importStep3').style.display = 'none';
    document.getElementById('importPasteText').value = '';
    document.getElementById('importFileName').textContent = '';
    document.getElementById('importModeInsert').checked = true;
    document.getElementById('importSourcePaste').checked = true;
    document.getElementById('importPasteArea').style.display = '';
    document.getElementById('importUploadArea').style.display = 'none';

    new bootstrap.Modal(modal).show();
  },

  onImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    document.getElementById('importFileName').textContent = '📄 ' + file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      MembersPage.importState.rawText = e.target.result || '';
      Toast.success('File dimuat. Klik "Parse & Preview" untuk lanjut.');
    };
    reader.readAsText(file);
  },

  parseImportData() {
    const src = document.querySelector('input[name="importSource"]:checked').value;
    let text = '';

    if (src === 'PASTE') {
      text = document.getElementById('importPasteText').value;
    } else {
      text = MembersPage.importState.rawText;
      if (!text) {
        Toast.warning('Belum ada file yang di-upload.');
        return;
      }
    }

    if (!text.trim()) {
      Toast.warning('Data kosong. Silakan paste atau upload file CSV.');
      return;
    }

    try {
      const rows = CsvHelper.parse(text);
      if (!rows.length) {
        Toast.error('Tidak bisa parse data. Periksa header CSV.');
        return;
      }

      MembersPage.importState.parsedRows = rows;
      MembersPage.showImportPreview(rows);
    } catch (e) {
      Toast.error('Gagal parse: ' + e.message);
    }
  },

  showImportPreview(rows) {
    document.getElementById('importStep1').style.display = 'none';
    document.getElementById('importStep2').style.display = '';
    document.getElementById('importPreviewCount').textContent = rows.length;
    document.getElementById('importReadyCount').textContent = rows.length;

    // Ambil semua header unik
    const headerSet = {};
    rows.forEach(r => Object.keys(r).forEach(k => { headerSet[k] = true; }));
    const headers = Object.keys(headerSet);

    // Render table
    const thead = document.querySelector('#importPreviewTable thead');
    const tbody = document.querySelector('#importPreviewTable tbody');

    thead.innerHTML = '<tr><th>#</th>' +
      headers.map(h => `<th>${UI.escape(h)}</th>`).join('') + '</tr>';

    tbody.innerHTML = rows.slice(0, 100).map((r, i) => {
      return '<tr><td class="text-muted">' + (i + 1) + '</td>' +
        headers.map(h => `<td class="small">${UI.escape(r[h] || '')}</td>`).join('') +
        '</tr>';
    }).join('');

    if (rows.length > 100) {
      tbody.innerHTML += `<tr><td colspan="${headers.length + 1}" class="text-center text-muted small">
        ... dan ${rows.length - 100} baris lainnya (hanya 100 pertama ditampilkan)
      </td></tr>`;
    }
  },

  backToImportStep1() {
    document.getElementById('importStep1').style.display = '';
    document.getElementById('importStep2').style.display = 'none';
    document.getElementById('importStep3').style.display = 'none';
  },

  async executeImport() {
    const rows = MembersPage.importState.parsedRows;
    const type = MembersPage.importState.targetType;
    const mode = document.querySelector('input[name="importMode"]:checked').value;

    if (!rows.length) return;

    const yes = await UI.confirm(
      `Import ${rows.length} baris dengan mode ${mode === 'UPSERT' ? 'Update/Tambah' : 'Tambah Baru'}?`,
      'Konfirmasi Import'
    );
    if (!yes) return;

    UI.showLoader();
    document.getElementById('btnExecuteImport').disabled = true;

    try {
      const action = type === 'STUDENT' ? 'importStudents' : 'importStaff';
      const res = await API.call(action, { rows, mode });
      UI.hideLoader();
      document.getElementById('btnExecuteImport').disabled = false;

      if (!res.success) {
        Toast.error(res.message);
        return;
      }

      MembersPage.showImportResult(res.data);
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnExecuteImport').disabled = false;
      Toast.error(e.message);
    }
  },

  showImportResult(data) {
    document.getElementById('importStep2').style.display = 'none';
    document.getElementById('importStep3').style.display = '';

    const successRate = data.total > 0 ? (data.success / data.total) : 0;
    const icon = document.getElementById('importResultIcon');
    const title = document.getElementById('importResultTitle');
    const sub = document.getElementById('importResultSubtitle');

    if (data.failed === 0) {
      icon.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i>';
      title.textContent = 'Import Berhasil!';
    } else if (data.success === 0) {
      icon.innerHTML = '<i class="bi bi-x-circle-fill text-danger"></i>';
      title.textContent = 'Import Gagal Total';
    } else {
      icon.innerHTML = '<i class="bi bi-exclamation-triangle-fill text-warning"></i>';
      title.textContent = 'Import Selesai dengan Peringatan';
    }

    sub.textContent = data.success + ' dari ' + data.total + ' baris berhasil diproses.';

    document.getElementById('importStatTotal').textContent = data.total || 0;
    document.getElementById('importStatSuccess').textContent = data.success || 0;
    document.getElementById('importStatFailed').textContent = data.failed || 0;
    document.getElementById('importStatUpdated').textContent = data.updated || 0;

    // Failed list
    const failed = (data.results || []).filter(r => !r.success);
    if (failed.length > 0) {
      document.getElementById('importFailedList').style.display = '';
      document.getElementById('importFailedTableBody').innerHTML = failed.map(r =>
        `<tr><td class="text-muted">${r.row}</td><td class="text-danger small">${UI.escape(r.message)}</td></tr>`
      ).join('');
    } else {
      document.getElementById('importFailedList').style.display = 'none';
    }

    // Refresh data
    if (MembersPage.importState.targetType === 'STUDENT') {
      MembersPage.loadStudents();
    } else {
      MembersPage.loadStaff();
    }
  },

  finishImport() {
    bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
    MembersPage.importState.parsedRows = [];
    MembersPage.importState.rawText = '';
  },

  // ============ UTILS ============
  getInitials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
};

/* ============================================================
 * PAGE: LOANS (Peminjaman)
 * ============================================================ */
function initPage_loans() {
  LoansPage.init();
}

const LoansPage = {
  state: {
    // Transaksi baru
    borrowerType: 'STUDENT',
    selectedBorrower: null,       // { member_type, member_id, full_name, ... , stats }
    cart: [],                     // array of { copy_id, barcode, book_title, book_id }
    maxLoans: 3,
    loanDays: 7,

    // Daftar aktif
    list: {
      page: 1, pageSize: 20, total: 0,
      query: '', status: 'ACTIVE', borrowerType: '',
      items: []
    },
    currentLoanId: null
  },

    async init() {
    // Cek permission
    if (!can('LOANS', 'create')) {
      const btn = document.getElementById('btnSubmitLoan');
      if (btn) btn.style.display = 'none';
    }
    LoansPage.bindEvents();
    LoansPage.loadConfig();
    LoansPage.updateDueDatePreview();
    LoansPage.loadActiveLoans();
  },

  async loadConfig() {
    try {
      const res = await API.call('getAllConfig');
      if (res.success) {
        LoansPage.state.maxLoans = parseInt(res.data.MAX_ACTIVE_LOANS || '3', 10);
        LoansPage.state.loanDays = parseInt(res.data.DEFAULT_LOAN_DAYS || '7', 10);
        LoansPage.updateDueDatePreview();
      }
    } catch (e) {}
  },

  bindEvents() {
    // === Borrower type ===
    document.querySelectorAll('input[name="borrowerType"]').forEach(el => {
      el.addEventListener('change', () => {
        LoansPage.state.borrowerType = el.value;
        LoansPage.state.selectedBorrower = null;
        document.getElementById('borrowerSearchInput').value = '';
        document.getElementById('borrowerSearchInput').placeholder =
          el.value === 'STUDENT' ? 'Cari nama atau NIS...' : 'Cari nama atau NIP...';
        LoansPage.renderBorrowerCard();
        LoansPage.updateSubmitState();
      });
    });

    // === Search borrower ===
    let bt;
    document.getElementById('borrowerSearchInput').addEventListener('input', e => {
      clearTimeout(bt);
      const q = e.target.value.trim();
      if (q.length < 2) {
        LoansPage.hideBorrowerResults();
        return;
      }
      bt = setTimeout(() => LoansPage.searchBorrowers(q), 300);
    });
    document.getElementById('borrowerSearchInput').addEventListener('blur', () => {
      setTimeout(() => LoansPage.hideBorrowerResults(), 200);
    });

    // === Search buku ===
    let bt2;
    document.getElementById('bookSearchInput').addEventListener('input', e => {
      clearTimeout(bt2);
      const q = e.target.value.trim();
      if (q.length < 2) {
        LoansPage.hideBookResults();
        return;
      }
      bt2 = setTimeout(() => LoansPage.searchBooks(q), 300);
    });
    document.getElementById('bookSearchInput').addEventListener('blur', () => {
      setTimeout(() => LoansPage.hideBookResults(), 200);
    });

    // === Submit ===
    document.getElementById('btnSubmitLoan').addEventListener('click', () => {
      LoansPage.submitLoan();
    });

    // === Daftar aktif ===
    let lt;
    document.getElementById('loansSearchInput').addEventListener('input', e => {
      clearTimeout(lt);
      lt = setTimeout(() => {
        LoansPage.state.list.query = e.target.value.trim();
        LoansPage.state.list.page = 1;
        LoansPage.loadActiveLoans();
      }, 400);
    });
    document.getElementById('loansStatusFilter').addEventListener('change', e => {
      LoansPage.state.list.status = e.target.value;
      LoansPage.state.list.page = 1;
      LoansPage.loadActiveLoans();
    });
    document.getElementById('loansBorrowerFilter').addEventListener('change', e => {
      LoansPage.state.list.borrowerType = e.target.value;
      LoansPage.state.list.page = 1;
      LoansPage.loadActiveLoans();
    });
    document.getElementById('btnRefreshLoans').addEventListener('click', () => {
      LoansPage.loadActiveLoans();
    });
    document.getElementById('btnCancelLoan').addEventListener('click', () => {
      LoansPage.cancelCurrentLoan();
    });
    document.getElementById('btnCloseStruk').addEventListener('click', () => {
      bootstrap.Modal.getInstance(document.getElementById('loanSuccessModal')).hide();
      LoansPage.resetForm();
    });
  },

  // ============ BORROWER SEARCH ============
  async searchBorrowers(query) {
    try {
      const res = await API.call('searchMembers', { query });
      if (!res.success) return;
      // Filter sesuai borrowerType
      const items = (res.data || []).filter(m =>
        m.member_type === LoansPage.state.borrowerType);
      LoansPage.renderBorrowerResults(items);
    } catch (e) {
      console.error(e);
    }
  },

  renderBorrowerResults(items) {
    const container = document.getElementById('borrowerSearchResults');
    if (!items.length) {
      container.innerHTML = '<div class="p-3 text-muted small text-center">Tidak ada hasil</div>';
      container.classList.remove('d-none');
      return;
    }

    container.innerHTML = items.map(m => `
      <div class="dropdown-item" onclick="LoansPage.pickBorrower('${m.member_type}','${m.member_id}')">
        <div class="item-title">${UI.escape(m.full_name)}</div>
        <div class="item-sub">
          ${m.member_type === 'STUDENT' ? 'NIS' : 'NIP'}: ${UI.escape(m.identifier || '-')}
        </div>
      </div>
    `).join('');
    container.classList.remove('d-none');
  },

  hideBorrowerResults() {
    document.getElementById('borrowerSearchResults').classList.add('d-none');
  },

  async pickBorrower(memberType, memberId) {
    LoansPage.hideBorrowerResults();
    document.getElementById('borrowerSearchInput').value = '';

    UI.showLoader();
    try {
      const res = await API.call('getMemberInfo', { memberType, memberId });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }

      const info = res.data;
      const balanceRes = await API.call('getMemberBalance', {
        borrowerType: memberType, memberId
      });
      info.balance = (balanceRes.success ? balanceRes.data.balance : 0) || 0;

      LoansPage.state.selectedBorrower = {
        member_type: memberType,
        member_id: memberId,
        full_name: info.member.full_name,
        identifier: memberType === 'STUDENT' ? info.member.nis : info.member.employee_number,
        class_id: info.member.class_id || '',
        activeLoans: info.activeLoanCount || 0,
        balance: info.balance
      };

      LoansPage.renderBorrowerCard();
      LoansPage.updateSubmitState();
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  renderBorrowerCard() {
    const card = document.getElementById('borrowerCard');
    const b = LoansPage.state.selectedBorrower;

    if (!b) {
      card.classList.add('d-none');
      return;
    }

    const remaining = LoansPage.state.maxLoans - b.activeLoans;
    const balanceClass = b.balance > 0 ? 'text-danger' : 'text-success';

    card.innerHTML = `
      <div class="borrower-card">
        <button class="btn-remove-borrower" onclick="LoansPage.clearBorrower()">
          <i class="bi bi-x-lg"></i>
        </button>
        <div class="borrower-name">${UI.escape(b.full_name)}</div>
        <div class="borrower-meta">
          ${b.member_type === 'STUDENT' ? 'Siswa' : 'Guru/Staf'}
          • ${UI.escape(b.identifier || '-')}
        </div>
        <div class="borrower-stats">
          <div class="borrower-stat">
            <div class="stat-value">${b.activeLoans}/${LoansPage.state.maxLoans}</div>
            <div class="stat-label">Pinjam Aktif</div>
          </div>
          <div class="borrower-stat">
            <div class="stat-value text-primary">${remaining}</div>
            <div class="stat-label">Sisa Kuota</div>
          </div>
          <div class="borrower-stat">
            <div class="stat-value ${balanceClass}">${UI.formatRupiah(b.balance)}</div>
            <div class="stat-label">Denda</div>
          </div>
        </div>
        ${remaining <= 0 ? '<div class="alert alert-warning small py-1 mt-2 mb-0"><i class="bi bi-exclamation-triangle me-1"></i>Kuota pinjam sudah penuh!</div>' : ''}
        ${b.balance > 0 ? '<div class="alert alert-warning small py-1 mt-2 mb-0"><i class="bi bi-info-circle me-1"></i>Ada tunggakan denda. Harap diingatkan.</div>' : ''}
      </div>
    `;
    card.classList.remove('d-none');
  },

  clearBorrower() {
    LoansPage.state.selectedBorrower = null;
    LoansPage.renderBorrowerCard();
    LoansPage.updateSubmitState();
  },

  // ============ BOOK SEARCH ============
  async searchBooks(query) {
    try {
      const res = await API.call('searchBooks', {
        query, status: 'ACTIVE', page: 1, pageSize: 10
      });
      if (!res.success) return;
      const items = (res.data.items || []).filter(b => b.available_copies > 0);
      LoansPage.renderBookResults(items);
    } catch (e) {
      console.error(e);
    }
  },

  renderBookResults(items) {
    const container = document.getElementById('bookSearchResults');
    if (!items.length) {
      container.innerHTML = '<div class="p-3 text-muted small text-center">Tidak ada buku dengan eksemplar tersedia</div>';
      container.classList.remove('d-none');
      return;
    }
    container.innerHTML = items.map(b => `
      <div class="dropdown-item" onclick="LoansPage.showCopiesPicker('${b.book_id}','${UI.escape(b.title)}')">
        <div class="item-title">${UI.escape(b.title)}</div>
        <div class="item-sub">
          ${b.available_copies} eksemplar tersedia
          ${b.isbn ? ' • ISBN: ' + UI.escape(b.isbn) : ''}
        </div>
      </div>
    `).join('');
    container.classList.remove('d-none');
  },

  hideBookResults() {
    document.getElementById('bookSearchResults').classList.add('d-none');
  },

  async showCopiesPicker(bookId, bookTitle) {
    LoansPage.hideBookResults();
    document.getElementById('bookSearchInput').value = '';

    UI.showLoader();
    try {
      const res = await API.call('getBookCopies', { bookId });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }

      const copies = (res.data || []).filter(c => c.availability_status === 'AVAILABLE');
      if (copies.length === 0) {
        Toast.warning('Tidak ada eksemplar tersedia untuk buku ini.');
        return;
      }
      LoansPage.renderCopiesModal(bookTitle, copies);
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  renderCopiesModal(bookTitle, copies) {
    const id = 'copiesPicker_' + Date.now();
    const html = `
      <div class="modal fade" id="${id}" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h6 class="modal-title">Pilih Eksemplar</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-2 small text-muted">${UI.escape(bookTitle)}</div>
              <div class="list-group list-group-flush" style="max-height:320px;overflow-y:auto">
                ${copies.map(c => `
                  <button class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                          onclick="LoansPage.addToCart('${c.copy_id}','${c.barcode}','${UI.escape(bookTitle)}','${c.book_id}','${id}')">
                    <div>
                      <div class="fw-semibold small">${UI.escape(c.barcode)}</div>
                      <div class="text-muted" style="font-size:11px">
                        ${UI.escape(c.accession_number || 'Tanpa no. inv')}
                        • Kondisi: ${UI.escape(c.condition)}
                      </div>
                    </div>
                    <i class="bi bi-plus-circle text-primary"></i>
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
    const modal = new bootstrap.Modal(document.getElementById(id));
    document.getElementById(id).addEventListener('hidden.bs.modal', () => div.remove());
    modal.show();
  },

  addToCart(copyId, barcode, bookTitle, bookId, modalId) {
    // Tutup modal picker
    const modalEl = document.getElementById(modalId);
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();

    // Cek duplikat
    if (LoansPage.state.cart.find(c => c.copy_id === copyId)) {
      Toast.warning('Eksemplar ini sudah ada di keranjang.');
      return;
    }

    // Cek kuota
    const b = LoansPage.state.selectedBorrower;
    if (b) {
      const remaining = LoansPage.state.maxLoans - b.activeLoans;
      if (LoansPage.state.cart.length >= remaining) {
        Toast.warning(`Kuota pinjam tersisa ${remaining}. Tidak bisa tambah lagi.`);
        return;
      }
    } else {
      if (LoansPage.state.cart.length >= LoansPage.state.maxLoans) {
        Toast.warning(`Maksimal ${LoansPage.state.maxLoans} eksemplar per transaksi.`);
        return;
      }
    }

    LoansPage.state.cart.push({
      copy_id: copyId,
      barcode: barcode,
      book_id: bookId,
      book_title: bookTitle
    });
    LoansPage.renderCart();
    LoansPage.updateSubmitState();
  },

  renderCart() {
    const container = document.getElementById('cartList');
    const cart = LoansPage.state.cart;

    document.getElementById('cartCounter').textContent =
      cart.length + ' eksemplar';

    if (!cart.length) {
      container.innerHTML = `
        <div class="empty-cart">
          <i class="bi bi-inbox"></i>
          <div class="small text-muted">Belum ada buku dipilih</div>
        </div>`;
      return;
    }

    container.innerHTML = cart.map((c, i) => `
      <div class="cart-item">
        <div class="cart-thumb"><i class="bi bi-book"></i></div>
        <div class="cart-info">
          <div class="cart-title">${UI.escape(c.book_title)}</div>
          <div class="cart-meta">Barcode: ${UI.escape(c.barcode)}</div>
        </div>
        <button class="btn-remove-cart" onclick="LoansPage.removeFromCart(${i})">
          <i class="bi bi-x-circle"></i>
        </button>
      </div>
    `).join('');
  },

  removeFromCart(index) {
    LoansPage.state.cart.splice(index, 1);
    LoansPage.renderCart();
    LoansPage.updateSubmitState();
  },

  updateSubmitState() {
    const btn = document.getElementById('btnSubmitLoan');
    const ready = LoansPage.state.selectedBorrower && LoansPage.state.cart.length > 0;
    btn.disabled = !ready;
  },

  updateDueDatePreview() {
    const el = document.getElementById('dueDatePreview');
    if (!el) return;
    const d = new Date();
    d.setDate(d.getDate() + LoansPage.state.loanDays);
    el.textContent = UI.formatDate(d.toISOString().substring(0, 10));
  },

  // ============ SUBMIT LOAN ============
  async submitLoan() {
    const b = LoansPage.state.selectedBorrower;
    const cart = LoansPage.state.cart;
    if (!b || !cart.length) return;

    const yes = await UI.confirm(
      `Proses peminjaman ${cart.length} buku untuk ${b.full_name}?`,
      'Konfirmasi'
    );
    if (!yes) return;

    UI.showLoader();
    document.getElementById('btnSubmitLoan').disabled = true;

    try {
      const payload = {
        borrower_type: b.member_type,
        copy_ids: cart.map(c => c.copy_id)
      };
      if (b.member_type === 'STUDENT') payload.student_id = b.member_id;
      else payload.staff_id = b.member_id;

      const res = await API.call('createLoan', payload);
      UI.hideLoader();

      if (!res.success) {
        Toast.error(res.message);
        document.getElementById('btnSubmitLoan').disabled = false;
        return;
      }

      // Tampilkan struk
      document.getElementById('strukLoanNumber').textContent = res.data.loanNumber;
      document.getElementById('strukBorrower').textContent = b.full_name;
      document.getElementById('strukBookCount').textContent = res.data.totalBooks + ' buku';
      document.getElementById('strukDueDate').textContent = UI.formatDate(res.data.dueDate);
      new bootstrap.Modal(document.getElementById('loanSuccessModal')).show();

      // Reload daftar aktif
      LoansPage.loadActiveLoans();
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnSubmitLoan').disabled = false;
      Toast.error(e.message);
    }
  },

  resetForm() {
    LoansPage.state.selectedBorrower = null;
    LoansPage.state.cart = [];
    LoansPage.renderBorrowerCard();
    LoansPage.renderCart();
    LoansPage.updateSubmitState();
  },

  // ============ DAFTAR AKTIF ============
  async loadActiveLoans() {
    UI.showLoader();
    try {
      const l = LoansPage.state.list;
      const res = await API.call('searchLoans', {
        query: l.query, status: l.status, borrowerType: l.borrowerType,
        page: l.page, pageSize: l.pageSize
      });
      if (!res.success) { Toast.error(res.message); return; }
      l.items = res.data.items || [];
      l.total = res.data.total || 0;
      LoansPage.renderActiveLoans(res.data);
      document.getElementById('tabActiveLoansCount').textContent = l.total;
    } catch (e) {
      Toast.error('Gagal memuat daftar: ' + e.message);
    } finally {
      UI.hideLoader();
    }
  },

  renderActiveLoans(data) {
    const tbody = document.getElementById('loansTableBody');
    const l = LoansPage.state.list;

    if (!l.items.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">
        Tidak ada transaksi
      </td></tr>`;
      LoansPage.renderLoansPagination(data);
      return;
    }

    // Fetch detail penuh untuk setiap loan — atau tampilkan seadanya
    // Untuk performa, kita panggil getLoanDetail per loan secara paralel
    LoansPage.enrichLoansAndRender(l.items, tbody, data);
  },

  async enrichLoansAndRender(loans, tbody, data) {
    try {
      // Fetch detail secara paralel
      const details = await Promise.all(
        loans.map(ln => API.call('getLoanDetail', { loanId: ln.loan_id })
          .then(r => r.success ? r.data : null)
          .catch(() => null))
      );

      const rows = loans.map((ln, idx) => {
        const detail = details[idx] || {};
        const borrower = detail.borrower || {};
        const borrowerName = borrower.full_name || '-';
        const bookCount = (detail.details || []).filter(d => d.detail_status === 'BORROWED').length;

        // Status badge
        const statusBadge = {
          ACTIVE: 'bg-primary',
          PARTIALLY_RETURNED: 'bg-warning text-dark',
          COMPLETED: 'bg-success',
          CANCELLED: 'bg-secondary'
        }[ln.loan_status] || 'bg-secondary';

        const statusLabel = {
          ACTIVE: 'Aktif',
          PARTIALLY_RETURNED: 'Kembali Sebagian',
          COMPLETED: 'Selesai',
          CANCELLED: 'Dibatalkan'
        }[ln.loan_status] || ln.loan_status;

        return `
          <tr>
            <td>
              <div class="fw-semibold small">${UI.escape(ln.loan_number)}</div>
              <small class="text-muted">${ln.borrower_type === 'STUDENT' ? 'Siswa' : 'Staf'}</small>
            </td>
            <td>${UI.escape(borrowerName)}</td>
            <td class="small">${UI.formatDate(ln.loan_date, true)}</td>
            <td class="text-center">
              <span class="badge bg-light text-dark">${bookCount} buku</span>
            </td>
            <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-primary"
                      onclick="LoansPage.openDetail('${ln.loan_id}')">
                <i class="bi bi-eye"></i>
              </button>
              ${ln.loan_status === 'ACTIVE' ? `
                <button class="btn btn-sm btn-outline-danger"
                        onclick="LoansPage.quickCancel('${ln.loan_id}','${UI.escape(ln.loan_number)}')">
                  <i class="bi bi-x-circle"></i>
                </button>
              ` : ''}
            </td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rows;
      LoansPage.renderLoansPagination(data);
    } catch (e) {
      console.error(e);
      Toast.error('Gagal memuat detail: ' + e.message);
    }
  },

  renderLoansPagination(data) {
    const l = LoansPage.state.list;
    const info = document.getElementById('loansInfo');
    const pag = document.getElementById('loansPagination');
    if (info) {
      const start = l.total === 0 ? 0 : (l.page - 1) * l.pageSize + 1;
      const end = Math.min(l.page * l.pageSize, l.total);
      info.textContent = `Menampilkan ${start}-${end} dari ${l.total}`;
    }
    if (!pag) return;

    const totalPages = data.totalPages || 1;
    if (totalPages <= 1) { pag.innerHTML = ''; return; }

    let html = '';
    html += `<li class="page-item ${l.page <= 1 ? 'disabled' : ''}">
      <a class="page-link" href="javascript:void(0)" onclick="LoansPage.goPage(${l.page - 1})">
        <i class="bi bi-chevron-left"></i></a></li>`;
    const start = Math.max(1, l.page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) {
      html += `<li class="page-item ${i === l.page ? 'active' : ''}">
        <a class="page-link" href="javascript:void(0)" onclick="LoansPage.goPage(${i})">${i}</a></li>`;
    }
    html += `<li class="page-item ${l.page >= totalPages ? 'disabled' : ''}">
      <a class="page-link" href="javascript:void(0)" onclick="LoansPage.goPage(${l.page + 1})">
        <i class="bi bi-chevron-right"></i></a></li>`;
    pag.innerHTML = html;
  },

  goPage(p) {
    const l = LoansPage.state.list;
    if (p < 1 || p > Math.ceil(l.total / l.pageSize)) return;
    l.page = p;
    LoansPage.loadActiveLoans();
  },

  async openDetail(loanId) {
    LoansPage.state.currentLoanId = loanId;
    document.getElementById('loanDetailBody').innerHTML =
      '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    new bootstrap.Modal(document.getElementById('loanDetailModal')).show();

    try {
      const res = await API.call('getLoanDetail', { loanId });
      if (!res.success) {
        document.getElementById('loanDetailBody').innerHTML =
          '<div class="alert alert-danger">' + UI.escape(res.message) + '</div>';
        return;
      }
      LoansPage.renderLoanDetail(res.data);
    } catch (e) {
      document.getElementById('loanDetailBody').innerHTML =
        '<div class="alert alert-danger">' + UI.escape(e.message) + '</div>';
    }
  },

  renderLoanDetail(data) {
    const ln = data.loan;
    const details = data.details || [];
    const borrower = data.borrower || {};

    document.getElementById('loanDetailTitle').textContent = ln.loan_number;

    document.getElementById('loanDetailBody').innerHTML = `
      <div class="row g-2 small mb-3">
        <div class="col-md-6"><strong>Peminjam:</strong> ${UI.escape(borrower.full_name || '-')}</div>
        <div class="col-md-6"><strong>Tipe:</strong> ${ln.borrower_type === 'STUDENT' ? 'Siswa' : 'Guru/Staf'}</div>
        <div class="col-md-6"><strong>Tgl Pinjam:</strong> ${UI.formatDate(ln.loan_date, true)}</div>
        <div class="col-md-6"><strong>Status:</strong> ${UI.escape(ln.loan_status)}</div>
        ${ln.notes ? `<div class="col-12"><strong>Catatan:</strong> ${UI.escape(ln.notes)}</div>` : ''}
      </div>

      <table class="table table-sm table-hover">
        <thead class="table-light">
          <tr>
            <th>Barcode</th>
            <th>Judul</th>
            <th>Jatuh Tempo</th>
            <th>Status</th>
            <th class="text-end">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${details.map(d => {
            const statusBadge = {
              BORROWED: 'bg-primary',
              RETURNED: 'bg-success',
              LOST: 'bg-danger',
              CANCELLED: 'bg-secondary'
            }[d.detail_status] || 'bg-secondary';
            return `
              <tr>
                <td>${UI.escape(d.barcode || '-')}</td>
                <td>${UI.escape(d.book_title || '-')}</td>
                <td class="small">${UI.formatDate(d.due_date)}</td>
                <td><span class="badge ${statusBadge}">${UI.escape(d.detail_status)}</span></td>
                <td class="text-end">
                  ${d.detail_status === 'BORROWED' ? `
                    <button class="btn btn-sm btn-outline-warning"
                            onclick="LoansPage.renewDetail('${d.loan_detail_id}')">
                      <i class="bi bi-arrow-clockwise"></i> Perpanjang
                    </button>
                  ` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  async renewDetail(loanDetailId) {
    const yes = await UI.confirm(
      'Perpanjang peminjaman buku ini? (Hanya bisa H-2 sebelum jatuh tempo dan jika tidak ada antrean reservasi)',
      'Konfirmasi Perpanjangan'
    );
    if (!yes) return;

    UI.showLoader();
    try {
      const res = await API.call('renewLoanDetail', { loanDetailId });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      Toast.success(`Berhasil diperpanjang hingga ${UI.formatDate(res.data.newDueDate)}`);
      LoansPage.openDetail(LoansPage.state.currentLoanId);
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  async quickCancel(loanId, loanNumber) {
    const reason = prompt(`Alasan pembatalan transaksi ${loanNumber}:`);
    if (!reason || !reason.trim()) return;

    UI.showLoader();
    try {
      const res = await API.call('cancelLoan', { loanId, reason: reason.trim() });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      Toast.success('Transaksi dibatalkan.');
      LoansPage.loadActiveLoans();
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  async cancelCurrentLoan() {
    const loanId = LoansPage.state.currentLoanId;
    if (!loanId) return;

    const reason = prompt('Alasan pembatalan:');
    if (!reason || !reason.trim()) return;

    UI.showLoader();
    try {
      const res = await API.call('cancelLoan', { loanId, reason: reason.trim() });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      Toast.success('Transaksi dibatalkan.');
      bootstrap.Modal.getInstance(document.getElementById('loanDetailModal')).hide();
      LoansPage.loadActiveLoans();
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  }
};

/* ============================================================
 * PAGE: RETURNS (Pengembalian)
 * ============================================================ */
function initPage_returns() {
  ReturnsPage.init();
}

const ReturnsPage = {
  state: {
    // Proses
    searchResults: [],
    selectedDetail: null,   // { loan_detail_id, copy_id, book_title, barcode, due_date, late_days, fine_amount }
    
    // Riwayat
    history: {
      page: 1, pageSize: 20, total: 0,
      from: '', to: ''
    },
    finePerDay: 500,     
    fineEnabled: true    
  },

    async init() {
      // Cek permissions
    if (!can('RETURNS', 'create')) {
      const paneProcess = document.getElementById('paneProcessReturn');
      if (paneProcess) {
        setTimeout(() => {
          const historyTab = document.getElementById('tabReturnHistory');
          if (historyTab) historyTab.click();
        }, 100);
      }
    }

    // Load config dulu — penting untuk preview denda
    await ReturnsPage.loadConfig();

    ReturnsPage.bindEvents();
    ReturnsPage.loadHistory();
  },

    async loadConfig() {
    try {
      const res = await API.call('getAllConfig');
      if (res.success) {
        const rawFine = res.data.FINE_PER_DAY;
        ReturnsPage.state.finePerDay = parseFloat(rawFine) || 500;

        const rawEnabled = res.data.FINE_ENABLED;
        // Terima TRUE/true/1/yes (case-insensitive)
        ReturnsPage.state.fineEnabled =
          String(rawEnabled).toUpperCase() === 'TRUE' ||
          rawEnabled === true ||
          rawEnabled === 1;
      } else {
        // Fallback kalau gagal
        ReturnsPage.state.finePerDay = 500;
        ReturnsPage.state.fineEnabled = true;
      }
    } catch (e) {
      console.error('ReturnsPage.loadConfig error', e);
      ReturnsPage.state.finePerDay = 500;
      ReturnsPage.state.fineEnabled = true;
    }
  },

  bindEvents() {
    // Search
    let t;
    document.getElementById('returnSearchInput').addEventListener('input', e => {
      clearTimeout(t);
      const q = e.target.value.trim();
      if (q.length < 2) {
        ReturnsPage.hideResults();
        return;
      }
      t = setTimeout(() => ReturnsPage.search(q), 300);
    });
    document.getElementById('returnSearchInput').addEventListener('blur', () => {
      setTimeout(() => ReturnsPage.hideResults(), 200);
    });

    document.getElementById('btnFilterReturns').addEventListener('click', () => {
      ReturnsPage.state.history.from = document.getElementById('returnFromDate').value;
      ReturnsPage.state.history.to = document.getElementById('returnToDate').value;
      ReturnsPage.state.history.page = 1;
      ReturnsPage.loadHistory();
    });
  },

  // ============ SEARCH ============
  async search(query) {
    try {
      // Search by loan number atau nama
      const res = await API.call('searchLoans', {
        query,
        status: 'ACTIVE',  // hanya transaksi aktif
        page: 1, pageSize: 10
      });

      // Bisa juga search by barcode — coba cek ke loans
      if (!res.success) return;
      ReturnsPage.renderResults(res.data.items || [], query);
    } catch (e) {
      console.error(e);
    }
  },

  renderResults(loans, query) {
    const container = document.getElementById('returnSearchResults');
    if (!loans.length) {
      container.innerHTML = '<div class="p-3 text-muted small text-center">Tidak ditemukan. Coba nomor transaksi atau nama.</div>';
      container.classList.remove('d-none');
      return;
    }
    container.innerHTML = loans.map(ln => `
      <div class="dropdown-item" onclick="ReturnsPage.pickLoan('${ln.loan_id}')">
        <div class="item-title">${UI.escape(ln.loan_number)}</div>
        <div class="item-sub">${UI.formatDate(ln.loan_date, true)}</div>
      </div>
    `).join('');
    container.classList.remove('d-none');
  },

  hideResults() {
    document.getElementById('returnSearchResults').classList.add('d-none');
  },

  async pickLoan(loanId) {
    ReturnsPage.hideResults();
    document.getElementById('returnSearchInput').value = '';

    UI.showLoader();
    try {
      const res = await API.call('getLoanDetail', { loanId });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }

      const details = (res.data.details || []).filter(d => d.detail_status === 'BORROWED');
      if (!details.length) {
        Toast.warning('Tidak ada buku yang sedang dipinjam dari transaksi ini.');
        return;
      }

      ReturnsPage.state.searchResults = details;
      ReturnsPage.renderReturnBookList(details, res.data.borrower);
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  renderReturnBookList(details, borrower) {
    const container = document.getElementById('returnBookList');
    const html = `
      <div class="mb-2 small">
        <strong>Peminjam:</strong> ${UI.escape(borrower.full_name || '-')}
      </div>
      <div style="max-height:340px;overflow-y:auto">
        ${details.map(d => {
          const due = new Date(d.due_date);
          const today = new Date(); today.setHours(0,0,0,0);
          const daysLate = Math.max(0, Math.round((today - due) / 86400000));
          const lateBadge = daysLate > 0
            ? `<span class="badge bg-danger">Terlambat ${daysLate} hari</span>`
            : `<span class="badge bg-success">Tepat waktu</span>`;
          return `
            <div class="return-book-item" onclick="ReturnsPage.selectDetail('${d.loan_detail_id}')">
              <div class="item-book">
                <div class="book-title">${UI.escape(d.book_title || '-')}</div>
                <div class="book-meta">
                  Barcode: ${UI.escape(d.barcode || '-')} • Jatuh tempo: ${UI.formatDate(d.due_date)}
                </div>
                <div class="mt-1">${lateBadge}</div>
              </div>
              <i class="bi bi-chevron-right text-muted"></i>
            </div>
          `;
        }).join('')}
      </div>
    `;
    container.innerHTML = html;
  },

  selectDetail(loanDetailId) {
    const detail = ReturnsPage.state.searchResults.find(d => d.loan_detail_id === loanDetailId);
    if (!detail) return;
    ReturnsPage.state.selectedDetail = detail;

    // Highlight
    document.querySelectorAll('.return-book-item').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.return-book-item').forEach(el => {
      if (el.getAttribute('onclick').indexOf(loanDetailId) !== -1) {
        el.classList.add('selected');
      }
    });

    ReturnsPage.renderReturnForm(detail);
  },

    renderReturnForm(detail) {
    const area = document.getElementById('returnFormArea');
    const due = new Date(detail.due_date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const daysLate = Math.max(0, Math.round((today - due) / 86400000));

    // Pakai config dari state, dengan fallback aman
    const finePerDay = parseFloat(ReturnsPage.state.finePerDay) || 500;
    const fineEnabled = ReturnsPage.state.fineEnabled !== false &&
                        ReturnsPage.state.fineEnabled !== 'FALSE';
    const estimatedFine = (fineEnabled && daysLate > 0) ? daysLate * finePerDay : 0;

    // Info harga buku untuk preview denda kerusakan
    const bookPrice = parseFloat(detail.acquisition_cost || 0);

    area.innerHTML = `
      <div class="return-form-card">
        <div class="book-header">
          <h6 class="mb-1">${UI.escape(detail.book_title || '-')}</h6>
          <div class="text-muted small">
            Barcode: <code>${UI.escape(detail.barcode || '-')}</code> • 
            Jatuh tempo: ${UI.formatDate(detail.due_date)}
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label small">Kondisi Buku Saat Kembali <span class="text-danger">*</span></label>
          <div class="row g-2" id="conditionOptions">
            <div class="col-6 col-md-4">
              <input type="radio" class="btn-check" name="conditionIn" id="condNEW" value="NEW">
              <label class="btn btn-outline-success w-100 btn-sm" for="condNEW">
                <i class="bi bi-star-fill"></i><br>Baru
              </label>
            </div>
            <div class="col-6 col-md-4">
              <input type="radio" class="btn-check" name="conditionIn" id="condGOOD" value="GOOD" checked>
              <label class="btn btn-outline-success w-100 btn-sm" for="condGOOD">
                <i class="bi bi-check-circle"></i><br>Baik
              </label>
            </div>
            <div class="col-6 col-md-4">
              <input type="radio" class="btn-check" name="conditionIn" id="condMINOR" value="MINOR_DAMAGE">
              <label class="btn btn-outline-warning w-100 btn-sm" for="condMINOR">
                <i class="bi bi-tools"></i><br>Rusak Ringan
              </label>
            </div>
            <div class="col-6 col-md-4">
              <input type="radio" class="btn-check" name="conditionIn" id="condDAMAGED" value="DAMAGED">
              <label class="btn btn-outline-warning w-100 btn-sm" for="condDAMAGED">
                <i class="bi bi-exclamation-triangle"></i><br>Rusak Berat
              </label>
            </div>
            <div class="col-6 col-md-4">
              <input type="radio" class="btn-check" name="conditionIn" id="condLOST" value="LOST">
              <label class="btn btn-outline-danger w-100 btn-sm" for="condLOST">
                <i class="bi bi-x-circle"></i><br>Hilang
              </label>
            </div>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label small">Catatan Kerusakan / Keterangan</label>
          <textarea class="form-control form-control-sm" id="returnDamageNotes"
                    rows="2" placeholder="Contoh: Sampul lepas, halaman 20-25 robek"></textarea>
        </div>

        ${daysLate > 0 ? `
          <div class="fine-preview-box mb-3">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="small text-muted">Denda Keterlambatan</div>
                <div class="small">${daysLate} hari × ${UI.formatRupiah(finePerDay)}</div>
              </div>
              <div class="amount">${UI.formatRupiah(estimatedFine)}</div>
            </div>
          </div>
        ` : `
          <div class="alert alert-success py-2 small mb-3">
            <i class="bi bi-check-circle me-1"></i>Tidak ada denda keterlambatan.
          </div>
        `}

        <!-- === INFO DENDA KERUSAKAN === -->
        <div id="damageChargeBlock" style="display:none">
          <div class="alert alert-warning small py-2 mb-3">
            <i class="bi bi-exclamation-triangle me-1"></i>
            <strong>Denda kerusakan/hilang akan otomatis ditagihkan</strong> ke anggota.
            <div class="mt-1">
              Nominal:
              ${bookPrice > 0
                ? `<strong class="text-danger">${UI.formatRupiah(bookPrice)}</strong>
                   <span class="text-muted">(harga perolehan buku)</span>`
                : `<span class="text-muted">Harga buku tidak tersedia. 
                     Hubungi admin untuk input manual.</span>`
              }
            </div>
          </div>
        </div>

        <div class="d-flex gap-2">
          <button class="btn btn-secondary" onclick="ReturnsPage.clearSelection()">Batal</button>
          <button class="btn btn-primary flex-fill" id="btnConfirmReturn"
                  onclick="ReturnsPage.submitReturn()">
            <i class="bi bi-check-lg me-1"></i>Proses Pengembalian
          </button>
        </div>
      </div>
    `;

    // Auto-toggle info denda kerusakan
    setTimeout(function() {
      const radios = document.querySelectorAll('input[name="conditionIn"]');
      const block = document.getElementById('damageChargeBlock');
      if (!block) return;

      function updateBlock() {
        const selected = document.querySelector('input[name="conditionIn"]:checked');
        if (!selected) return;
        const cond = selected.value;
        block.style.display = (cond === 'DAMAGED' || cond === 'LOST') ? '' : 'none';
      }

      radios.forEach(function(r) {
        r.addEventListener('change', updateBlock);
      });
      updateBlock();
    }, 100);
  },

  clearSelection() {
    ReturnsPage.state.selectedDetail = null;
    document.getElementById('returnFormArea').innerHTML = `
      <div class="empty-cart text-center py-5">
        <i class="bi bi-arrow-left-circle" style="font-size:48px;color:#d1d5db"></i>
        <div class="text-muted mt-2">
          Pilih buku dari daftar di kiri untuk memproses pengembalian
        </div>
      </div>
    `;
    document.querySelectorAll('.return-book-item').forEach(el => el.classList.remove('selected'));
  },

  async submitReturn() {
    const detail = ReturnsPage.state.selectedDetail;
    if (!detail) return;

    const condition = document.querySelector('input[name="conditionIn"]:checked').value;
    const damageNotes = document.getElementById('returnDamageNotes').value.trim();

    const yes = await UI.confirm(
      `Konfirmasi pengembalian buku dengan kondisi "${condition}"?`,
      'Konfirmasi'
    );
    if (!yes) return;

    UI.showLoader();
    document.getElementById('btnConfirmReturn').disabled = true;

    try {
      const res = await API.call('createReturn', {
        loan_detail_id: detail.loan_detail_id,
        condition_in: condition,
        damage_notes: damageNotes,
        notes: ''
      });
      UI.hideLoader();

      if (!res.success) {
        Toast.error(res.message);
        document.getElementById('btnConfirmReturn').disabled = false;
        return;
      }

      if (res.data.fineAmount > 0) {
        Toast.success(
          `${res.message}\nDenda: ${UI.formatRupiah(res.data.fineAmount)}`,
          'Pengembalian Berhasil'
        );
      } else {
        Toast.success(res.message);
      }

      // Refresh: cari ulang loan
      const loanId = (ReturnsPage.state.searchResults[0] || {}).loan_id;
      ReturnsPage.clearSelection();
      document.getElementById('returnSearchInput').value = '';
      document.getElementById('returnBookList').innerHTML = '';
      ReturnsPage.state.searchResults = [];

      // Reload riwayat
      ReturnsPage.loadHistory();
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnConfirmReturn').disabled = false;
      Toast.error(e.message);
    }
  },

  // ============ HISTORY ============
  async loadHistory() {
    try {
      const h = ReturnsPage.state.history;
      const res = await API.call('searchReturns', {
        from: h.from, to: h.to,
        page: h.page, pageSize: h.pageSize
      });
      if (!res.success) { Toast.error(res.message); return; }
      ReturnsPage.renderHistory(res.data);
    } catch (e) {
      console.error(e);
    }
  },

  renderHistory(data) {
    const tbody = document.getElementById('returnsTableBody');
    const items = data.items || [];
    const h = ReturnsPage.state.history;
    h.total = data.total || 0;

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Belum ada pengembalian</td></tr>';
      ReturnsPage.renderHistoryPagination(data);
      return;
    }

    // Enrich dengan detail
    ReturnsPage.enrichHistory(items, tbody, data);
  },

  async enrichHistory(items, tbody, data) {
    try {
      const enriched = await Promise.all(
        items.map(r => API.call('getReturnDetail', { returnId: r.return_id })
          .then(res => res.success ? res.data : { return: r })
          .catch(() => ({ return: r })))
      );

      const rows = enriched.map(e => {
        const r = e.return || {};
        const book = e.book || {};
        const condBadge = {
          NEW: 'bg-success',
          GOOD: 'bg-success',
          MINOR_DAMAGE: 'bg-warning text-dark',
          DAMAGED: 'bg-danger',
          LOST: 'bg-dark'
        }[r.condition_in] || 'bg-secondary';

        return `
          <tr>
            <td><code>${UI.escape(r.return_number || '-')}</code></td>
            <td class="small">${UI.formatDate(r.return_date, true)}</td>
            <td>${UI.escape(book.title || '-')}</td>
            <td><span class="badge ${condBadge}">${UI.escape(r.condition_in)}</span></td>
            <td class="text-center">
              ${r.late_days > 0
                ? `<span class="badge bg-danger">${r.late_days} hari</span>`
                : '<span class="text-muted small">-</span>'}
            </td>
            <td class="text-end">
              ${r.fine_amount > 0
                ? `<strong class="text-danger">${UI.formatRupiah(r.fine_amount)}</strong>`
                : '<span class="text-muted small">-</span>'}
            </td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rows;
      ReturnsPage.renderHistoryPagination(data);
    } catch (e) {
      console.error(e);
    }
  },

  renderHistoryPagination(data) {
    const h = ReturnsPage.state.history;
    const info = document.getElementById('returnsInfo');
    const pag = document.getElementById('returnsPagination');
    if (info) {
      const start = h.total === 0 ? 0 : (h.page - 1) * h.pageSize + 1;
      const end = Math.min(h.page * h.pageSize, h.total);
      info.textContent = `Menampilkan ${start}-${end} dari ${h.total}`;
    }
    if (!pag) return;
    const totalPages = data.totalPages || 1;
    if (totalPages <= 1) { pag.innerHTML = ''; return; }

    let html = '';
    html += `<li class="page-item ${h.page <= 1 ? 'disabled' : ''}">
      <a class="page-link" href="javascript:void(0)" onclick="ReturnsPage.goPage(${h.page - 1})">
        <i class="bi bi-chevron-left"></i></a></li>`;
    const start = Math.max(1, h.page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) {
      html += `<li class="page-item ${i === h.page ? 'active' : ''}">
        <a class="page-link" href="javascript:void(0)" onclick="ReturnsPage.goPage(${i})">${i}</a></li>`;
    }
    html += `<li class="page-item ${h.page >= totalPages ? 'disabled' : ''}">
      <a class="page-link" href="javascript:void(0)" onclick="ReturnsPage.goPage(${h.page + 1})">
        <i class="bi bi-chevron-right"></i></a></li>`;
    pag.innerHTML = html;
  },

  goPage(p) {
    const h = ReturnsPage.state.history;
    if (p < 1 || p > Math.ceil(h.total / h.pageSize)) return;
    h.page = p;
    ReturnsPage.loadHistory();
  }
};

/* ============================================================
 * PAGE: FINES
 * ============================================================ */
function initPage_fines() {
  FinesPage.init();
}

const FinesPage = {
  state: {
    // Outstanding
    outstanding: [],
    // History
    history: {
      page: 1, pageSize: 20, total: 0,
      query: '', transactionType: '', from: '', to: '',
      items: []
    },
    // Current member for modals
    currentMember: null,   // { borrower_type, member_id, full_name, identifier, balance }
    chargeReturns: [],      // untuk mode BOOK_PRICE
    chargeMemberType: 'STUDENT',
    selectedChargeMember: null
  },

    async init() {
    // Kalau tidak boleh bayar/waiver, sembunyikan tombol di modal
    if (!can('FINES', 'create') && !can('FINES', 'update')) {
      // Hide buttons setelah modal render (delegation)
      setTimeout(() => {
        document.querySelectorAll('[onclick*="openPayment"], [onclick*="openWaiver"]')
          .forEach(el => el.style.display = 'none');
      }, 500);
    }

    FinesPage.bindEvents();
    await Promise.all([
      FinesPage.loadSummary(),
      FinesPage.loadOutstanding(),
      FinesPage.loadHistory()
    ]);
  },

  bindEvents() {
    document.getElementById('btnRefreshOutstanding').addEventListener('click', () => {
      FinesPage.loadSummary();
      FinesPage.loadOutstanding();
    });

    document.getElementById('txTypeFilter').addEventListener('change', e => {
      FinesPage.state.history.transactionType = e.target.value;
      FinesPage.state.history.page = 1;
      FinesPage.loadHistory();
    });

    // Search debounce untuk riwayat
    let txTimer;
    const txSearch = document.getElementById('txSearchInput');
    if (txSearch) {
      txSearch.addEventListener('input', e => {
        clearTimeout(txTimer);
        txTimer = setTimeout(() => {
          FinesPage.state.history.query = e.target.value.trim();
          FinesPage.state.history.page = 1;
          FinesPage.loadHistory();
        }, 400);
      });
    }

    document.getElementById('btnFilterTx').addEventListener('click', () => {
      FinesPage.state.history.from = document.getElementById('txFromDate').value;
      FinesPage.state.history.to = document.getElementById('txToDate').value;
      FinesPage.state.history.page = 1;
      FinesPage.loadHistory();
    });

    // Tombol Buat Tagihan Manual
    document.getElementById('btnAddFineCharge').addEventListener('click', () => {
      FinesPage.openChargeMemberModal();
    });

    // Toggle tipe pemesan di modal pilih anggota
    document.querySelectorAll('input[name="chargeBorrowerType"]').forEach(el => {
      el.addEventListener('change', () => {
        FinesPage.state.chargeMemberType = el.value;
        FinesPage.state.selectedChargeMember = null;
        document.getElementById('chargeMemberSearch').value = '';
        document.getElementById('chargeMemberSearch').placeholder =
          el.value === 'STUDENT' ? 'Cari nama atau NIS...' : 'Cari nama atau NIP...';
        document.getElementById('chargeMemberResults').classList.add('d-none');
      });
    });

    // Search member di modal
    let chgTimer;
    document.getElementById('chargeMemberSearch').addEventListener('input', e => {
      clearTimeout(chgTimer);
      const q = e.target.value.trim();
      if (q.length < 2) {
        document.getElementById('chargeMemberResults').classList.add('d-none');
        return;
      }
      chgTimer = setTimeout(() => FinesPage.searchChargeMember(q), 300);
    });

    document.getElementById('btnSubmitPayment').addEventListener('click', () => {
      FinesPage.submitPayment();
    });
    document.getElementById('btnSubmitWaiver').addEventListener('click', () => {
      FinesPage.submitWaiver();
    });
    document.getElementById('btnSubmitCharge').addEventListener('click', () => {
      FinesPage.submitCharge();
    });

    // Charge mode toggle
    document.querySelectorAll('input[name="chargeMode"]').forEach(el => {
      el.addEventListener('change', () => {
        const mode = document.querySelector('input[name="chargeMode"]:checked').value;
        document.getElementById('chargeAmountBlock').style.display =
          mode === 'FIXED' ? '' : 'none';
        document.getElementById('chargeReturnBlock').style.display =
          mode === 'BOOK_PRICE' ? '' : 'none';
      });
    });
  },

  // ============ SUMMARY ============
  async loadSummary() {
    try {
      const res = await API.call('getFineSummary');
      if (!res.success) return;
      const s = res.data;
      document.getElementById('finesSummaryRow').innerHTML = `
        <div class="col-md-3">
          <div class="summary-card bg-charge">
            <div class="label"><i class="bi bi-receipt me-1"></i>Total Tagihan</div>
            <div class="value">${UI.formatRupiah(s.totalCharge)}</div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="summary-card bg-paid">
            <div class="label"><i class="bi bi-cash-coin me-1"></i>Sudah Dibayar</div>
            <div class="value">${UI.formatRupiah(s.totalPaid)}</div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="summary-card bg-waived">
            <div class="label"><i class="bi bi-x-circle me-1"></i>Dihapus</div>
            <div class="value">${UI.formatRupiah(s.totalWaived)}</div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="summary-card bg-outstanding">
            <div class="label"><i class="bi bi-exclamation-circle me-1"></i>Belum Lunas</div>
            <div class="value">${UI.formatRupiah(s.outstanding)}</div>
          </div>
        </div>
      `;
    } catch (e) { console.error(e); }
  },

  // ============ OUTSTANDING ============
  async loadOutstanding() {
    UI.showLoader();
    try {
      const res = await API.call('listOutstandingFines');
      if (!res.success) { Toast.error(res.message); return; }
      FinesPage.state.outstanding = res.data || [];
      FinesPage.renderOutstanding();
      document.getElementById('tabOutstandingCount').textContent =
        FinesPage.state.outstanding.length;
    } catch (e) {
      Toast.error(e.message);
    } finally {
      UI.hideLoader();
    }
  },

  renderOutstanding() {
    const tbody = document.getElementById('outstandingTableBody');
    const items = FinesPage.state.outstanding;

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Tidak ada tunggakan 🎉</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(it => {
      const info = it.member_info || {};
      const type = it.borrower_type === 'STUDENT' ? 'Siswa' : 'Guru/Staf';
      const sub = it.borrower_type === 'STUDENT'
        ? (info.class_name || '')
        : (info.unit_label || '');

      return `
        <tr>
          <td><strong>${UI.escape(info.name || '-')}</strong></td>
          <td><code>${UI.escape(info.identifier || '-')}</code></td>
          <td><span class="badge bg-light text-dark">${type}</span></td>
          <td class="small text-muted">${UI.escape(sub)}</td>
          <td class="text-end"><strong class="text-danger">${UI.formatRupiah(it.balance)}</strong></td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary"
                    onclick="FinesPage.openMemberDetail('${it.borrower_type}','${it.member_id}')">
              <i class="bi bi-list-ul"></i> Detail
            </button>
            <button class="btn btn-sm btn-success"
                    onclick="FinesPage.openPayment('${it.borrower_type}','${it.member_id}','${UI.escape(info.name)}',${it.balance})">
              <i class="bi bi-cash-coin"></i> Bayar
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ============ HISTORY ============
    async loadHistory() {
    try {
      const h = FinesPage.state.history;
      const res = await API.call('listFineTransactions', {
        query: h.query,
        transactionType: h.transactionType,
        from: h.from,
        to: h.to,
        page: h.page,
        pageSize: h.pageSize
      });
      if (!res.success) { Toast.error(res.message); return; }
      FinesPage.renderHistory(res.data);
    } catch (e) {
      console.error('loadHistory error:', e);
    }
  },

  renderHistory(data) {
    const tbody = document.getElementById('txTableBody');
    const items = data.items || [];
    const h = FinesPage.state.history;
    h.total = data.total || 0;

    const typeLabels = {
      CHARGE: 'Tagihan',
      PAYMENT: 'Pembayaran',
      WAIVER: 'Penghapusan',
      ADJUSTMENT: 'Penyesuaian'
    };
    const typeBadges = {
      CHARGE: 'bg-danger',
      PAYMENT: 'bg-success',
      WAIVER: 'bg-warning text-dark',
      ADJUSTMENT: 'bg-info'
    };

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Belum ada transaksi</td></tr>';
      FinesPage.renderHistoryPagination(data);
      return;
    }

    tbody.innerHTML = items.map(function(tx) {
      const amt = parseFloat(tx.amount) || 0;
      const isCharge = amt > 0;
      const amountClass = isCharge ? 'text-danger fw-semibold' : 'text-success fw-semibold';
      const amountText = (isCharge ? '+' : '') + UI.formatRupiah(Math.abs(amt));

      const methodLabel = tx.payment_method
        ? ({ CASH: 'Tunai', TRANSFER: 'Transfer', OTHER: 'Lainnya' }[tx.payment_method] || tx.payment_method)
        : '-';

      return `
        <tr>
          <td><code>${UI.escape(tx.payment_number)}</code></td>
          <td class="small">${UI.formatDate(tx.transaction_date, true)}</td>
          <td>
            <div class="fw-semibold small">${UI.escape(tx.member_name || '-')}</div>
            <small class="text-muted">${UI.escape(tx.member_identifier || '')}</small>
          </td>
          <td><span class="badge ${typeBadges[tx.transaction_type] || 'bg-secondary'}">${typeLabels[tx.transaction_type] || tx.transaction_type}</span></td>
          <td class="text-end ${amountClass}">${amountText}</td>
          <td class="small">${UI.escape(methodLabel)}</td>
          <td><small class="text-muted">${UI.escape(tx.notes || '-')}</small></td>
        </tr>
      `;
    }).join('');

    FinesPage.renderHistoryPagination(data);
  },

  renderHistoryPagination(data) {
    const h = FinesPage.state.history;
    const info = document.getElementById('txInfo');
    const pag = document.getElementById('txPagination');
    if (info) {
      const start = h.total === 0 ? 0 : (h.page - 1) * h.pageSize + 1;
      const end = Math.min(h.page * h.pageSize, h.total);
      info.textContent = 'Menampilkan ' + start + '-' + end + ' dari ' + h.total;
    }
    if (!pag) return;

    const totalPages = data.totalPages || 1;
    if (totalPages <= 1) { pag.innerHTML = ''; return; }

    let html = '';
    html += '<li class="page-item ' + (h.page <= 1 ? 'disabled' : '') + '">' +
      '<a class="page-link" href="javascript:void(0)" onclick="FinesPage.goTxPage(' + (h.page - 1) + ')">' +
      '<i class="bi bi-chevron-left"></i></a></li>';

    const start = Math.max(1, h.page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) {
      html += '<li class="page-item ' + (i === h.page ? 'active' : '') + '">' +
        '<a class="page-link" href="javascript:void(0)" onclick="FinesPage.goTxPage(' + i + ')">' + i + '</a></li>';
    }

    html += '<li class="page-item ' + (h.page >= totalPages ? 'disabled' : '') + '">' +
      '<a class="page-link" href="javascript:void(0)" onclick="FinesPage.goTxPage(' + (h.page + 1) + ')">' +
      '<i class="bi bi-chevron-right"></i></a></li>';

    pag.innerHTML = html;
  },

  goTxPage(p) {
    const h = FinesPage.state.history;
    if (p < 1 || p > Math.ceil(h.total / h.pageSize)) return;
    h.page = p;
    FinesPage.loadHistory();
  },

  resetTxFilter() {
    const h = FinesPage.state.history;
    h.query = '';
    h.transactionType = '';
    h.from = '';
    h.to = '';
    h.page = 1;
    document.getElementById('txSearchInput').value = '';
    document.getElementById('txTypeFilter').value = '';
    document.getElementById('txFromDate').value = '';
    document.getElementById('txToDate').value = '';
    FinesPage.loadHistory();
  },

  // ============ BUAT TAGIHAN MANUAL ============
  openChargeMemberModal() {
    FinesPage.state.selectedChargeMember = null;
    FinesPage.state.chargeMemberType = 'STUDENT';
    document.getElementById('chgBtStudent').checked = true;
    document.getElementById('chargeMemberSearch').value = '';
    document.getElementById('chargeMemberResults').classList.add('d-none');

    new bootstrap.Modal(document.getElementById('chargeMemberModal')).show();
  },

  async searchChargeMember(query) {
    try {
      const res = await API.call('searchMembers', { query });
      if (!res.success) return;
      const items = (res.data || []).filter(function(m) {
        return m.member_type === FinesPage.state.chargeMemberType;
      });
      FinesPage.renderChargeMemberResults(items);
    } catch (e) {}
  },

  renderChargeMemberResults(items) {
    const c = document.getElementById('chargeMemberResults');
    if (!items.length) {
      c.innerHTML = '<div class="p-3 text-muted small text-center">Tidak ada hasil</div>';
      c.classList.remove('d-none');
      return;
    }
    c.innerHTML = items.map(function(m) {
      return '<div class="dropdown-item" onclick="FinesPage.pickChargeMember(\'' +
        m.member_type + '\',\'' + m.member_id + '\',\'' +
        UI.escape(m.full_name) + '\',\'' + UI.escape(m.identifier || '') + '\')">' +
        '<div class="item-title">' + UI.escape(m.full_name) + '</div>' +
        '<div class="item-sub">' + UI.escape(m.identifier || '') + '</div>' +
        '</div>';
    }).join('');
    c.classList.remove('d-none');
  },

  pickChargeMember(memberType, memberId, fullName, identifier) {
    FinesPage.state.selectedChargeMember = {
      borrower_type: memberType,
      member_id: memberId,
      full_name: fullName,
      identifier: identifier
    };

    // Tutup modal pilih anggota
    const memberModal = bootstrap.Modal.getInstance(document.getElementById('chargeMemberModal'));
    if (memberModal) memberModal.hide();

    // Buka modal Buat Tagihan
    setTimeout(function() {
      FinesPage.openChargeModal(memberType, memberId, fullName);
    }, 300);
  },

  // ============ MEMBER DETAIL MODAL ============
  async openMemberDetail(borrowerType, memberId) {
    document.getElementById('memberBalanceBody').innerHTML =
      '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    new bootstrap.Modal(document.getElementById('memberBalanceModal')).show();

    try {
      const [balanceRes, historyRes] = await Promise.all([
        API.call('getMemberBalance', { borrowerType, memberId }),
        API.call('getMemberFineHistory', { borrowerType, memberId })
      ]);

      FinesPage.state.currentMember = {
        borrower_type: borrowerType,
        member_id: memberId,
        balance: balanceRes.success ? balanceRes.data.balance : 0
      };

      // Render
      const history = historyRes.success ? historyRes.data.transactions : [];
      const balance = FinesPage.state.currentMember.balance;

      // Cari nama anggota
      let memberName = 'Anggota';
      const found = FinesPage.state.outstanding.find(o =>
        o.member_id === memberId && o.borrower_type === borrowerType);
      if (found && found.member_info) memberName = found.member_info.name;

      document.getElementById('memberBalanceTitle').textContent =
        'Detail Denda: ' + memberName;

      document.getElementById('memberBalanceBody').innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div>
            <div class="text-muted small">Saldo Saat Ini</div>
            <div class="fs-4 fw-bold ${balance > 0 ? 'text-danger' : 'text-success'}">
              ${UI.formatRupiah(balance)}
            </div>
          </div>
          <div class="text-end">
            <button class="btn btn-sm btn-success me-1"
                    onclick="FinesPage.openPayment('${borrowerType}','${memberId}','${UI.escape(memberName)}',${balance})">
              <i class="bi bi-cash-coin me-1"></i>Bayar
            </button>
            <button class="btn btn-sm btn-warning"
                    onclick="FinesPage.openWaiver('${borrowerType}','${memberId}','${UI.escape(memberName)}',${balance})">
              <i class="bi bi-x-circle me-1"></i>Waiver
            </button>
          </div>
        </div>

        <h6 class="mb-2"><i class="bi bi-clock-history me-1"></i>Riwayat Transaksi</h6>
        <div class="border rounded">
          ${history.length === 0
            ? '<div class="text-center text-muted small p-3">Belum ada transaksi</div>'
            : history.map(tx => {
              const amt = parseFloat(tx.amount) || 0;
              const isPositive = amt > 0;
              const typeLabels = {
                CHARGE: 'Tagihan',
                PAYMENT: 'Pembayaran',
                WAIVER: 'Penghapusan',
                ADJUSTMENT: 'Penyesuaian'
              };
              const typeIcons = {
                CHARGE: 'receipt',
                PAYMENT: 'cash-coin',
                WAIVER: 'x-circle',
                ADJUSTMENT: 'sliders'
              };
              return `
                <div class="balance-timeline-item">
                  <div class="tx-icon ${tx.transaction_type}">
                    <i class="bi bi-${typeIcons[tx.transaction_type] || 'circle'}"></i>
                  </div>
                  <div class="tx-body">
                    <div class="tx-title">${typeLabels[tx.transaction_type] || tx.transaction_type}</div>
                    <div class="tx-meta">${UI.formatDate(tx.transaction_date, true)}</div>
                    ${tx.notes ? `<div class="tx-meta">${UI.escape(tx.notes)}</div>` : ''}
                  </div>
                  <div class="tx-amount ${isPositive ? 'positive' : 'negative'}">
                    ${isPositive ? '+' : ''}${UI.formatRupiah(Math.abs(amt))}
                  </div>
                </div>
              `;
            }).join('')}
        </div>
      `;
    } catch (e) {
      document.getElementById('memberBalanceBody').innerHTML =
        '<div class="alert alert-danger">' + UI.escape(e.message) + '</div>';
    }
  },

  // ============ PAYMENT ============
  openPayment(borrowerType, memberId, name, balance) {
    FinesPage.state.currentMember = {
      borrower_type: borrowerType,
      member_id: memberId,
      full_name: name,
      balance: balance
    };

    document.getElementById('payMemberName').textContent = name;
    document.getElementById('payMemberBalance').textContent = UI.formatRupiah(balance);
    document.getElementById('payAmount').value = '';
    document.getElementById('payMethod').value = 'CASH';
    document.getElementById('payRef').value = '';
    document.getElementById('payNotes').value = '';

    // Tutup modal detail kalau terbuka
    const detailModal = bootstrap.Modal.getInstance(document.getElementById('memberBalanceModal'));
    if (detailModal) detailModal.hide();

    setTimeout(() => {
      new bootstrap.Modal(document.getElementById('paymentModal')).show();
    }, 300);
  },

  setPayFull() {
    const b = FinesPage.state.currentMember.balance;
    document.getElementById('payAmount').value = Math.round(b);
  },

  setPayHalf() {
    const b = FinesPage.state.currentMember.balance;
    document.getElementById('payAmount').value = Math.round(b / 2);
  },

  async submitPayment() {
    const m = FinesPage.state.currentMember;
    if (!m) return;

    const amount = parseFloat(document.getElementById('payAmount').value);
    const method = document.getElementById('payMethod').value;

    if (!amount || amount <= 0) {
      Toast.warning('Jumlah bayar harus > 0.');
      return;
    }
    if (amount > m.balance + 0.01) {
      Toast.warning('Jumlah bayar melebihi saldo.');
      return;
    }

    UI.showLoader();
    document.getElementById('btnSubmitPayment').disabled = true;

    try {
      const res = await API.call('recordFinePayment', {
        borrower_type: m.borrower_type,
        student_id: m.borrower_type === 'STUDENT' ? m.member_id : '',
        staff_id: m.borrower_type === 'STAFF' ? m.member_id : '',
        amount: amount,
        payment_method: method,
        reference_number: document.getElementById('payRef').value.trim(),
        notes: document.getElementById('payNotes').value.trim()
      });

      UI.hideLoader();
      document.getElementById('btnSubmitPayment').disabled = false;

      if (!res.success) { Toast.error(res.message); return; }

      Toast.success(
        `Pembayaran ${UI.formatRupiah(amount)} dicatat. Sisa saldo: ${UI.formatRupiah(res.data.remainingBalance)}`
      );
      bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
      FinesPage.loadSummary();
      FinesPage.loadOutstanding();
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnSubmitPayment').disabled = false;
      Toast.error(e.message);
    }
  },

  // ============ WAIVER ============
  openWaiver(borrowerType, memberId, name, balance) {
    FinesPage.state.currentMember = {
      borrower_type: borrowerType,
      member_id: memberId,
      full_name: name,
      balance: balance
    };

    document.getElementById('waiveMemberName').textContent = name;
    document.getElementById('waiveMemberBalance').textContent = UI.formatRupiah(balance);
    document.getElementById('waiveAmount').value = '';
    document.getElementById('waiveReason').value = '';

    const detailModal = bootstrap.Modal.getInstance(document.getElementById('memberBalanceModal'));
    if (detailModal) detailModal.hide();

    setTimeout(() => {
      new bootstrap.Modal(document.getElementById('waiverModal')).show();
    }, 300);
  },

  async submitWaiver() {
    const m = FinesPage.state.currentMember;
    if (!m) return;

    const amount = parseFloat(document.getElementById('waiveAmount').value);
    const reason = document.getElementById('waiveReason').value.trim();

    if (!amount || amount <= 0) {
      Toast.warning('Jumlah harus > 0.');
      return;
    }
    if (amount > m.balance + 0.01) {
      Toast.warning('Jumlah melebihi saldo.');
      return;
    }
    if (!reason) {
      Toast.warning('Alasan wajib diisi.');
      return;
    }

    const yes = await UI.confirm(
      `Hapus denda ${UI.formatRupiah(amount)} untuk ${m.full_name}?`,
      'Konfirmasi Penghapusan'
    );
    if (!yes) return;

    UI.showLoader();
    document.getElementById('btnSubmitWaiver').disabled = true;

    try {
      const res = await API.call('waiveFine', {
        borrower_type: m.borrower_type,
        student_id: m.borrower_type === 'STUDENT' ? m.member_id : '',
        staff_id: m.borrower_type === 'STAFF' ? m.member_id : '',
        amount: amount,
        reason: reason
      });

      UI.hideLoader();
      document.getElementById('btnSubmitWaiver').disabled = false;

      if (!res.success) { Toast.error(res.message); return; }
      Toast.success('Denda dihapus.');
      bootstrap.Modal.getInstance(document.getElementById('waiverModal')).hide();
      FinesPage.loadSummary();
      FinesPage.loadOutstanding();
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnSubmitWaiver').disabled = false;
      Toast.error(e.message);
    }
  },

  // ============ CHARGE MANUAL ============
  async openChargeModal(borrowerType, memberId, name) {
    FinesPage.state.currentMember = {
      borrower_type: borrowerType,
      member_id: memberId,
      full_name: name
    };
    document.getElementById('chargeMemberName').textContent = name;
    document.getElementById('chargeAmount').value = '';
    document.getElementById('chargeDesc').value = '';
    document.getElementById('chargeModeFixed').checked = true;
    document.getElementById('chargeAmountBlock').style.display = '';
    document.getElementById('chargeReturnBlock').style.display = 'none';

    // Ambil list return untuk opsi BOOK_PRICE
    try {
      const res = await API.call('searchReturns', { page: 1, pageSize: 50 });
      if (res.success) {
        FinesPage.state.chargeReturns = res.data.items || [];
        const sel = document.getElementById('chargeReturnId');
        sel.innerHTML = '<option value="">-- Pilih Return --</option>' +
          FinesPage.state.chargeReturns.map(r =>
            `<option value="${r.return_id}">${UI.escape(r.return_number)} - ${UI.formatDate(r.return_date)}</option>`
          ).join('');
      }
    } catch (e) {}

    new bootstrap.Modal(document.getElementById('chargeModal')).show();
  },

  async submitCharge() {
    const m = FinesPage.state.currentMember;
    if (!m) return;

    const mode = document.querySelector('input[name="chargeMode"]:checked').value;
    const desc = document.getElementById('chargeDesc').value.trim();
    if (!desc) { Toast.warning('Deskripsi wajib diisi.'); return; }

    const payload = {
      borrower_type: m.borrower_type,
      student_id: m.borrower_type === 'STUDENT' ? m.member_id : '',
      staff_id: m.borrower_type === 'STAFF' ? m.member_id : '',
      mode: mode,
      description: desc
    };

    if (mode === 'FIXED') {
      const amount = parseFloat(document.getElementById('chargeAmount').value);
      if (!amount || amount <= 0) {
        Toast.warning('Nominal harus > 0.');
        return;
      }
      payload.amount = amount;
    } else {
      const returnId = document.getElementById('chargeReturnId').value;
      if (!returnId) {
        Toast.warning('Pilih return terlebih dahulu.');
        return;
      }
      payload.return_id = returnId;
    }

    UI.showLoader();
    document.getElementById('btnSubmitCharge').disabled = true;

    try {
      const res = await API.call('createFineCharge', payload);
      UI.hideLoader();
      document.getElementById('btnSubmitCharge').disabled = false;

      if (!res.success) { Toast.error(res.message); return; }
      Toast.success(`Tagihan ${UI.formatRupiah(res.data.amount)} dibuat.`);
      bootstrap.Modal.getInstance(document.getElementById('chargeModal')).hide();
      FinesPage.loadSummary();
      FinesPage.loadOutstanding();
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnSubmitCharge').disabled = false;
      Toast.error(e.message);
    }
  }
};

/* ============================================================
 * PAGE: RESERVATIONS
 * ============================================================ */
function initPage_reservations() {
  ReservationsPage.init();
}

const ReservationsPage = {
  state: {
    list: {
      query: '', status: 'READY',
      from: '', to: '',
      items: []
    },
    historyStatus: '',
    borrowerType: 'STUDENT',
    selectedBorrower: null,
    selectedBook: null
  },

      async init() {
    // Sembunyikan tombol Reservasi Baru kalau tidak punya izin/roles create
    if (!can('RESERVATIONS', 'create')) {
      const btn = document.getElementById('btnAddReservation');
      if (btn) btn.style.display = 'none';
    }
    ReservationsPage.bindEvents();
    await ReservationsPage.load();
    ReservationsPage.loadNotificationBadge();
  },

  async loadNotificationBadge() {
    try {
      const res = await API.call('getMyReadyReservations');
      if (!res.success) return;
      const items = res.data || [];

      const badge = document.getElementById('sidebarReservationBadge');
      if (badge) {
        if (items.length > 0) {
          badge.textContent = items.length;
          badge.style.display = '';
        } else {
          badge.style.display = 'none';
        }
      }

      // Toast info di halaman
      if (items.length > 0) {
        const area = document.getElementById('reservationAlertArea');
        if (area) {
          area.innerHTML = `
            <div class="alert alert-success d-flex align-items-center gap-2">
              <i class="bi bi-bookmark-check-fill fs-5"></i>
              <div>
                <strong>${items.length} buku siap diambil!</strong>
                <div class="small">
                  ${items.map(i => i.book_title).join(', ')}
                </div>
              </div>
            </div>
          `;
          area.style.display = '';
        }
      }
    } catch (e) {
      console.error('Badge error:', e);
    }
  },

  bindEvents() {
    let t;
    document.getElementById('resSearchInput').addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => {
        ReservationsPage.state.list.query = e.target.value.trim();
        ReservationsPage.load();
      }, 400);
    });

        document.getElementById('resStatusFilter').addEventListener('change', e => {
      ReservationsPage.state.list.status = e.target.value;
      ReservationsPage.load();
    });

    document.getElementById('resFromDate').addEventListener('change', e => {
      ReservationsPage.state.list.from = e.target.value;
      ReservationsPage.load();
    });

    document.getElementById('resToDate').addEventListener('change', e => {
      ReservationsPage.state.list.to = e.target.value;
      ReservationsPage.load();
    });

    document.getElementById('btnRefreshRes').addEventListener('click', () => {
      ReservationsPage.load();
    });

    document.getElementById('btnAddReservation').addEventListener('click', () => {
      ReservationsPage.openForm();
    });

    document.getElementById('btnSubmitReservation').addEventListener('click', () => {
      ReservationsPage.submit();
    });

    // Borrower type toggle
    document.querySelectorAll('input[name="resBorrowerType"]').forEach(el => {
      el.addEventListener('change', () => {
        ReservationsPage.state.borrowerType = el.value;
        ReservationsPage.state.selectedBorrower = null;
        document.getElementById('resBorrowerSearch').value = '';
        document.getElementById('resBorrowerCard').classList.add('d-none');
      });
    });

    // Search borrower
    let bt;
    document.getElementById('resBorrowerSearch').addEventListener('input', e => {
      clearTimeout(bt);
      const q = e.target.value.trim();
      if (q.length < 2) { ReservationsPage.hideBorrowerResults(); return; }
      bt = setTimeout(() => ReservationsPage.searchBorrowers(q), 300);
    });
    document.getElementById('resBorrowerSearch').addEventListener('blur', () => {
      setTimeout(() => ReservationsPage.hideBorrowerResults(), 200);
    });

    // Search book
    let bkt;
    document.getElementById('resBookSearch').addEventListener('input', e => {
      clearTimeout(bkt);
      const q = e.target.value.trim();
      if (q.length < 2) { ReservationsPage.hideBookResults(); return; }
      bkt = setTimeout(() => ReservationsPage.searchBooks(q), 300);
    });
    document.getElementById('resBookSearch').addEventListener('blur', () => {
      setTimeout(() => ReservationsPage.hideBookResults(), 200);
    });

    // History filter
    document.getElementById('btnFilterHistory').addEventListener('click', () => {
      ReservationsPage.state.historyStatus = document.getElementById('resHistoryFilter').value;
      ReservationsPage.loadHistory();
    });
  },

  // ============ LIST ============
    async load() {
    UI.showLoader();
    try {
      const l = ReservationsPage.state.list;
      const res = await API.call('listReservations', {
        status: l.status, page: 1, pageSize: 200
      });
      if (!res.success) { Toast.error(res.message); return; }

      let items = res.data.items || [];

      // Filter query
      if (l.query) {
        const q = l.query.toLowerCase();
        items = items.filter(function(r) {
          return String(r.reservation_number).toLowerCase().indexOf(q) !== -1;
        });
      }

      // Filter tanggal
      if (l.from) {
        const fromDate = new Date(l.from);
        fromDate.setHours(0, 0, 0, 0);
        items = items.filter(function(r) {
          const d = new Date(r.reservation_date);
          return d >= fromDate;
        });
      }
      if (l.to) {
        const toDate = new Date(l.to);
        toDate.setHours(23, 59, 59, 999);
        items = items.filter(function(r) {
          const d = new Date(r.reservation_date);
          return d <= toDate;
        });
      }

      l.items = items;
      ReservationsPage.render();
      document.getElementById('tabActiveResCount').textContent = l.items.length;
    } catch (e) {
      Toast.error(e.message);
    } finally {
      UI.hideLoader();
    }
  },

  clearDateFilter() {
    ReservationsPage.state.list.from = '';
    ReservationsPage.state.list.to = '';
    document.getElementById('resFromDate').value = '';
    document.getElementById('resToDate').value = '';
    ReservationsPage.load();
  },

  async render() {
    const tbody = document.getElementById('resTableBody');
    const items = ReservationsPage.state.list.items;

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Tidak ada reservasi</td></tr>';
      return;
    }

    // Pre-load sekali untuk semua (batch, bukan N+1)
    const [studentsRes, staffRes, booksRes] = await Promise.all([
      API.call('searchStudents', { pageSize: 1000 }),
      API.call('searchStaff', {}),
      API.call('searchBooks', { pageSize: 1000, status: '' })
    ]);

    const studentMap = {};
    ((studentsRes.success ? studentsRes.data.items : []) || []).forEach(function(s) {
      studentMap[s.student_id] = s;
    });
    const staffMap = {};
    ((staffRes.success ? staffRes.data : []) || []).forEach(function(s) {
      staffMap[s.staff_id] = s;
    });
    const bookMap = {};
    ((booksRes.success ? booksRes.data.items : []) || []).forEach(function(b) {
      bookMap[b.book_id] = b;
    });

    const rows = items.map(function(r) {
      const borrower = r.borrower_type === 'STUDENT'
        ? studentMap[r.student_id]
        : staffMap[r.staff_id];
      const borrowerName = borrower ? borrower.full_name : '-';

      const book = bookMap[r.book_id];
      const bookTitle = book ? book.title : '-';

      const statusBadge = {
        WAITING: 'bg-warning text-dark',
        READY: 'bg-success'
      }[r.status] || 'bg-secondary';

      return `
          <tr>
          <td class="text-center"><span class="queue-badge ${r.status === 'READY' ? 'ready' : ''}">${r.queue_number}</span></td>
          <td><code>${UI.escape(r.reservation_number)}</code></td>
          <td>${UI.escape(borrowerName)}</td>
          <td>${UI.escape(bookTitle)}</td>
          <td class="small">${UI.formatDate(r.reservation_date)}</td>
          <td>
            <span class="badge ${statusBadge}">${UI.escape(r.status)}</span>
            ${r.status === 'READY' && r.expires_at ? `
              <div class="text-muted" style="font-size:10.5px;margin-top:2px">
                s/d ${UI.formatDate(r.expires_at, true)}
              </div>
            ` : ''}
          </td>
          <td class="small">${r.expires_at ? UI.formatDate(r.expires_at, true) : '-'}</td>
          <td class="text-end">
            ${r.status === 'READY' && can('RESERVATIONS', 'update') ? `
              <button class="btn btn-sm btn-success" title="Serahkan buku & proses pinjam"
                      onclick="ReservationsPage.fulfill('${r.reservation_id}')">
                <i class="bi bi-check-lg"></i> Penuhi
              </button>
            ` : ''}
            ${r.status === 'WAITING' && can('RESERVATIONS', 'update') ? `
              <button class="btn btn-sm btn-outline-primary" title="Tandai buku siap diambil"
                      onclick="ReservationsPage.markReady('${r.reservation_id}','${UI.escape(r.reservation_number)}')">
                <i class="bi bi-bookmark-check"></i> Tandai Siap
              </button>
            ` : ''}
            ${can('RESERVATIONS', 'update') ? `
              <button class="btn btn-sm btn-outline-danger" title="Batalkan"
                      onclick="ReservationsPage.cancel('${r.reservation_id}','${UI.escape(r.reservation_number)}')">
                <i class="bi bi-x-circle"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rows.join('');
  },

  async loadHistory() {
    try {
      const res = await API.call('listReservations', {
        status: ReservationsPage.state.historyStatus || '',
        page: 1, pageSize: 100
      });
      if (!res.success) return;

      const items = (res.data.items || []).filter(r =>
        r.status !== 'WAITING' && r.status !== 'READY');

      const tbody = document.getElementById('resHistoryTableBody');
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Belum ada riwayat</td></tr>';
        return;
      }
      tbody.innerHTML = items.map(r => {
        const statusBadge = {
          FULFILLED: 'bg-success',
          CANCELLED: 'bg-secondary',
          EXPIRED: 'bg-dark'
        }[r.status] || 'bg-secondary';
        return `
          <tr>
            <td><code>${UI.escape(r.reservation_number)}</code></td>
            <td>${UI.escape(r.borrower_type)}</td>
            <td>${UI.escape(r.book_id)}</td>
            <td class="small">${UI.formatDate(r.reservation_date)}</td>
            <td><span class="badge ${statusBadge}">${UI.escape(r.status)}</span></td>
            <td class="small">${r.fulfilled_at || r.cancelled_at ? UI.formatDate(r.fulfilled_at || r.cancelled_at, true) : '-'}</td>
          </tr>
        `;
      }).join('');
    } catch (e) {}
  },

  // ============ FORM ============
    openForm() {
    ReservationsPage.state.selectedBorrower = null;
    ReservationsPage.state.selectedBook = null;
    document.getElementById('resBorrowerSearch').value = '';
    document.getElementById('resBookSearch').value = '';
    document.getElementById('resNotes').value = '';
    document.getElementById('resBorrowerCard').classList.add('d-none');
    document.getElementById('resBookCard').classList.add('d-none');
    document.getElementById('btnSubmitReservation').disabled = true;

    // Kalau user hanya bisa reservasi untuk dirinya sendiri
    // (mis. siswa login), auto-lock ke dirinya.
    const selfOnly = !can('RESERVATIONS', 'update');

    if (selfOnly && API.user) {
      // Siswa: paksa pemesan = diri sendiri
      // Cari linked_student_id atau linked_staff_id di API.user
      const isStudent = !!API.user.linked_student_id;
      const isStaff = !!API.user.linked_staff_id;

      if (isStudent || isStaff) {
        // Kunci tab Siswa/Guru
        const btnGroup = document.querySelector('#reservationFormModal .btn-group');
        if (btnGroup) btnGroup.style.display = 'none';

        // Set borrower otomatis
        ReservationsPage.state.borrowerType = isStudent ? 'STUDENT' : 'STAFF';

        // Sembunyikan input pencarian pemesan
        const pemesanLabel = document.querySelector('label[for="resBorrowerSearch"]');
        const pemesanWrap = document.getElementById('resBorrowerSearch').closest('.mb-3');
        if (pemesanWrap) pemesanWrap.style.display = 'none';

        // Auto-set borrower (lazy load data member)
        ReservationsPage.autoSetSelfBorrower(isStudent ? 'STUDENT' : 'STAFF',
          isStudent ? API.user.linked_student_id : API.user.linked_staff_id);
      } else {
        // User login tapi tidak link ke siswa/staf — biarkan pilih (kasus pustakawan)
      }
    } else {
      // Pustakawan/Admin: tunjukkan tab normal
      const btnGroup = document.querySelector('#reservationFormModal .btn-group');
      if (btnGroup) btnGroup.style.display = '';

      const pemesanWrap = document.getElementById('resBorrowerSearch').closest('.mb-3');
      if (pemesanWrap) pemesanWrap.style.display = '';
    }

    new bootstrap.Modal(document.getElementById('reservationFormModal')).show();
  },

  async autoSetSelfBorrower(memberType, memberId) {
    try {
      const res = await API.call('getMemberInfo', { memberType, memberId });
      if (!res.success) { Toast.error(res.message); return; }

      const m = res.data.member;
      ReservationsPage.state.selectedBorrower = {
        member_type: memberType,
        member_id: memberId,
        full_name: m.full_name,
        identifier: memberType === 'STUDENT' ? m.nis : m.employee_number
      };

      const card = document.getElementById('resBorrowerCard');
      card.innerHTML = `
        <div class="reservation-card-info">
          <div class="small text-muted mb-1">Pemesan (otomatis)</div>
          <strong>${UI.escape(m.full_name)}</strong>
          <div class="text-muted small">
            ${UI.escape(ReservationsPage.state.selectedBorrower.identifier || '-')}
          </div>
        </div>
      `;
      card.classList.remove('d-none');
      ReservationsPage.updateSubmit();
    } catch (e) {
      Toast.error('Gagal memuat data: ' + e.message);
    }
  },

  // ============ BORROWER SEARCH ============
  async searchBorrowers(query) {
    try {
      const res = await API.call('searchMembers', { query });
      if (!res.success) return;
      const items = (res.data || []).filter(m =>
        m.member_type === ReservationsPage.state.borrowerType);
      ReservationsPage.renderBorrowerResults(items);
    } catch (e) {}
  },

  renderBorrowerResults(items) {
    const c = document.getElementById('resBorrowerResults');
    if (!items.length) {
      c.innerHTML = '<div class="p-3 text-muted small text-center">Tidak ada hasil</div>';
      c.classList.remove('d-none');
      return;
    }
    c.innerHTML = items.map(m => `
      <div class="dropdown-item" onclick="ReservationsPage.pickBorrower('${m.member_type}','${m.member_id}','${UI.escape(m.full_name)}','${UI.escape(m.identifier || '')}')">
        <div class="item-title">${UI.escape(m.full_name)}</div>
        <div class="item-sub">${UI.escape(m.identifier || '')}</div>
      </div>
    `).join('');
    c.classList.remove('d-none');
  },

  hideBorrowerResults() {
    document.getElementById('resBorrowerResults').classList.add('d-none');
  },

  pickBorrower(memberType, memberId, fullName, identifier) {
    ReservationsPage.hideBorrowerResults();
    document.getElementById('resBorrowerSearch').value = '';
    ReservationsPage.state.selectedBorrower = {
      member_type: memberType, member_id: memberId,
      full_name: fullName, identifier
    };
    const card = document.getElementById('resBorrowerCard');
    card.innerHTML = `
      <div class="reservation-card-info">
        <strong>${UI.escape(fullName)}</strong>
        <div class="text-muted small">${UI.escape(identifier)}</div>
      </div>
    `;
    card.classList.remove('d-none');
    ReservationsPage.updateSubmit();
  },

  // ============ BOOK SEARCH ============
  async searchBooks(query) {
    try {
      const res = await API.call('searchBooks', {
        query, page: 1, pageSize: 10
      });
      if (!res.success) return;
      const items = res.data.items || [];
      ReservationsPage.renderBookResults(items);
    } catch (e) {}
  },

  renderBookResults(items) {
    const c = document.getElementById('resBookResults');
    if (!items.length) {
      c.innerHTML = '<div class="p-3 text-muted small text-center">Tidak ada buku</div>';
      c.classList.remove('d-none');
      return;
    }
    c.innerHTML = items.map(b => `
      <div class="dropdown-item" onclick="ReservationsPage.pickBook('${b.book_id}','${UI.escape(b.title)}','${b.available_copies}','${b.total_copies}')">
        <div class="item-title">${UI.escape(b.title)}</div>
        <div class="item-sub">${b.available_copies}/${b.total_copies} tersedia</div>
      </div>
    `).join('');
    c.classList.remove('d-none');
  },

  hideBookResults() {
    document.getElementById('resBookResults').classList.add('d-none');
  },

  pickBook(bookId, title, available, total) {
    ReservationsPage.hideBookResults();
    document.getElementById('resBookSearch').value = '';
    ReservationsPage.state.selectedBook = {
      book_id: bookId, title, available_copies: available, total_copies: total
    };
    const card = document.getElementById('resBookCard');
    card.innerHTML = `
      <div class="reservation-card-info">
        <strong>${UI.escape(title)}</strong>
        <div class="text-muted small">
          ${available}/${total} tersedia
          ${available > 0 ? '<span class="text-success ms-2">✓ Siap dipinjam</span>' : '<span class="text-warning ms-2">⏳ Perlu antre</span>'}
        </div>
      </div>
    `;
    card.classList.remove('d-none');
    ReservationsPage.updateSubmit();
  },

  updateSubmit() {
    const ready = ReservationsPage.state.selectedBorrower && ReservationsPage.state.selectedBook;
    document.getElementById('btnSubmitReservation').disabled = !ready;
  },

  async submit() {
    const b = ReservationsPage.state.selectedBorrower;
    const bk = ReservationsPage.state.selectedBook;
    if (!b || !bk) return;

    UI.showLoader();
    document.getElementById('btnSubmitReservation').disabled = true;

    try {
      const payload = {
        borrower_type: b.member_type,
        book_id: bk.book_id,
        notes: document.getElementById('resNotes').value.trim()
      };
      if (b.member_type === 'STUDENT') payload.student_id = b.member_id;
      else payload.staff_id = b.member_id;

      const res = await API.call('createReservation', payload);
      UI.hideLoader();
      document.getElementById('btnSubmitReservation').disabled = false;

      if (!res.success) { Toast.error(res.message); return; }
      Toast.success(`Reservasi dibuat. Nomor antrean: ${res.data.queueNumber}`);
      bootstrap.Modal.getInstance(document.getElementById('reservationFormModal')).hide();
      ReservationsPage.load();
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnSubmitReservation').disabled = false;
      Toast.error(e.message);
    }
  },

  async fulfill(reservationId) {
    const yes = await UI.confirm(
      'Proses pemenuhan reservasi ini sebagai peminjaman?', 'Konfirmasi');
    if (!yes) return;

    UI.showLoader();
    try {
      const res = await API.call('fulfillReservation', { reservationId });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      Toast.success(`Reservasi dipenuhi. Nomor pinjam: ${res.data.loanNumber}`);
      ReservationsPage.load();
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

    async markReady(reservationId, number) {
    const yes = await UI.confirm(
      `Tandai reservasi ${number} sebagai SIAP? Buku akan dialokasikan khusus ` +
      `dan email notifikasi akan dikirim ke pemesan.`,
      'Konfirmasi Tandai Siap'
    );
    if (!yes) return;

    UI.showLoader();
    try {
      const res = await API.call('markReservationReady', { reservationId });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      Toast.success('Reservasi ditandai siap. Email terkirim ke pemesan.');
      ReservationsPage.load();
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  async cancel(reservationId, number) {
    const reason = prompt(`Alasan pembatalan reservasi ${number}:`);
    if (!reason || !reason.trim()) return;

    UI.showLoader();
    try {
      const res = await API.call('cancelReservation', {
        reservationId, reason: reason.trim()
      });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      Toast.success('Reservasi dibatalkan.');
      ReservationsPage.load();
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  }
};

/* ============================================================
 * PAGE: REPORTS
 * ============================================================ */
function initPage_reports() {
  ReportsPage.init();
}

const ReportsPage = {
  state: {
    currentReport: 'bookCatalog',
    lastData: null,           // { title, columns, rows, generatedAt }
    filters: {
      bookCatalog: { categoryId: '', status: 'ACTIVE' },
      activeLoans: {},
      overdue: {},
      studentHistory: { studentId: '' },
      byClass: { from: '', to: '' },
      damagedLost: {},
      outstandingFines: {},
      reservations: { status: '', from: '', to: '' }
    }
  },

  async init() {
    ReportsPage.bindEvents();
    await ReportsPage.loadMasterData();
    await ReportsPage.runReport();
  },

  bindEvents() {
    // Pilih jenis laporan
    document.querySelectorAll('.report-type-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.report-type-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ReportsPage.state.currentReport = btn.dataset.report;
        ReportsPage.renderFilters();
        ReportsPage.runReport();
      });
    });

    document.getElementById('btnRefreshReport').addEventListener('click', () => {
      ReportsPage.runReport();
    });

    document.getElementById('btnExportCsv').addEventListener('click', () => {
      ReportsPage.exportCsv();
    });

    document.getElementById('btnExportPdf').addEventListener('click', () => {
      ReportsPage.exportPdf();
    });
  },

  async loadMasterData() {
    try {
      const [catRes] = await Promise.all([API.call('listCategories', { activeOnly: true })]);
      ReportsPage.state.categories = (catRes.success ? catRes.data : []) || [];
    } catch (e) {
      ReportsPage.state.categories = [];
    }
  },

  // ============ FILTER RENDERING ============
  renderFilters() {
    const type = ReportsPage.state.currentReport;
    const el = document.getElementById('reportFilters');
    const f = ReportsPage.state.filters[type] || {};

    if (type === 'bookCatalog') {
      el.innerHTML = `
        <div class="col-md-4">
          <label class="form-label small mb-1">Kategori</label>
          <select class="form-select form-select-sm" id="filterCategory">
            <option value="">Semua Kategori</option>
            ${ReportsPage.state.categories.map(c =>
              `<option value="${c.category_id}" ${f.categoryId === c.category_id ? 'selected' : ''}>${UI.escape(c.category_name)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="col-md-4">
          <label class="form-label small mb-1">Status Buku</label>
          <select class="form-select form-select-sm" id="filterStatus">
            <option value="ACTIVE" ${f.status === 'ACTIVE' ? 'selected' : ''}>Aktif</option>
            <option value="" ${f.status === '' ? 'selected' : ''}>Semua Status</option>
            <option value="ARCHIVED" ${f.status === 'ARCHIVED' ? 'selected' : ''}>Diarsipkan</option>
          </select>
        </div>
        <div class="col-md-4 d-flex align-items-end">
          <button class="btn btn-sm btn-primary w-100" onclick="ReportsPage.applyFilters()">
            <i class="bi bi-funnel me-1"></i>Terapkan
          </button>
        </div>
      `;
    } else if (type === 'studentHistory') {
      el.innerHTML = `
        <div class="col-md-6">
          <label class="form-label small mb-1">Siswa</label>
          <select class="form-select form-select-sm" id="filterStudent">
            <option value="">-- Pilih Siswa --</option>
          </select>
        </div>
        <div class="col-md-6 d-flex align-items-end">
          <button class="btn btn-sm btn-primary w-100" onclick="ReportsPage.applyFilters()">
            <i class="bi bi-funnel me-1"></i>Tampilkan
          </button>
        </div>
      `;
      ReportsPage.loadStudentOptions(f.studentId);
    } else if (type === 'byClass') {
      el.innerHTML = `
        <div class="col-md-4">
          <label class="form-label small mb-1">Dari Tanggal</label>
          <input type="date" class="form-control form-control-sm" id="filterFrom" value="${f.from || ''}">
        </div>
        <div class="col-md-4">
          <label class="form-label small mb-1">Sampai Tanggal</label>
          <input type="date" class="form-control form-control-sm" id="filterTo" value="${f.to || ''}">
        </div>
        <div class="col-md-4 d-flex align-items-end">
          <button class="btn btn-sm btn-primary w-100" onclick="ReportsPage.applyFilters()">
            <i class="bi bi-funnel me-1"></i>Terapkan
          </button>
        </div>
      `;
        } else if (type === 'reservations') {
      el.innerHTML = `
        <div class="col-md-3">
          <label class="form-label small mb-1">Status</label>
          <select class="form-select form-select-sm" id="filterResStatus">
            <option value="">Semua Status</option>
            <option value="WAITING" ${f.status === 'WAITING' ? 'selected' : ''}>Menunggu</option>
            <option value="READY" ${f.status === 'READY' ? 'selected' : ''}>Siap Diambil</option>
            <option value="FULFILLED" ${f.status === 'FULFILLED' ? 'selected' : ''}>Terpenuhi</option>
            <option value="CANCELLED" ${f.status === 'CANCELLED' ? 'selected' : ''}>Dibatalkan</option>
            <option value="EXPIRED" ${f.status === 'EXPIRED' ? 'selected' : ''}>Kadaluarsa</option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label small mb-1">Dari Tanggal</label>
          <input type="date" class="form-control form-control-sm" id="filterResFrom" value="${f.from || ''}">
        </div>
        <div class="col-md-3">
          <label class="form-label small mb-1">Sampai Tanggal</label>
          <input type="date" class="form-control form-control-sm" id="filterResTo" value="${f.to || ''}">
        </div>
        <div class="col-md-3 d-flex align-items-end">
          <button class="btn btn-sm btn-primary w-100" onclick="ReportsPage.applyFilters()">
            <i class="bi bi-funnel me-1"></i>Terapkan
          </button>
        </div>
      `;
    } else {
      el.innerHTML = `
        <div class="col-12 text-muted small">
          <i class="bi bi-info-circle me-1"></i>Laporan ini tidak memerlukan filter.
        </div>
      `;
    }
  },

  async loadStudentOptions(selectedId) {
    try {
      const res = await API.call('searchStudents', { pageSize: 500 });
      if (!res.success) return;
      const sel = document.getElementById('filterStudent');
      if (!sel) return;
      sel.innerHTML = '<option value="">-- Pilih Siswa --</option>' +
        (res.data.items || []).map(s =>
          `<option value="${s.student_id}" ${s.student_id === selectedId ? 'selected' : ''}>${UI.escape(s.nis)} - ${UI.escape(s.full_name)}</option>`
        ).join('');
    } catch (e) {}
  },

  applyFilters() {
    const type = ReportsPage.state.currentReport;
    const f = ReportsPage.state.filters[type] || {};

    if (type === 'bookCatalog') {
      f.categoryId = document.getElementById('filterCategory').value;
      f.status = document.getElementById('filterStatus').value;
    } else if (type === 'studentHistory') {
      const sid = document.getElementById('filterStudent').value;
      if (!sid) { Toast.warning('Pilih siswa dulu.'); return; }
      f.studentId = sid;
    } else if (type === 'byClass') {
      f.from = document.getElementById('filterFrom').value;
      f.to = document.getElementById('filterTo').value;
    } else if (type === 'reservations') {
      f.status = document.getElementById('filterResStatus').value;
      f.from = document.getElementById('filterResFrom').value;
      f.to = document.getElementById('filterResTo').value;
    }

    ReportsPage.state.filters[type] = f;
    ReportsPage.runReport();
  },

  // ============ RUN REPORT ============
  async runReport() {
    const type = ReportsPage.state.currentReport;
    const f = ReportsPage.state.filters[type] || {};

    UI.showLoader();
    try {
      let res;
      switch (type) {
        case 'bookCatalog':
          res = await API.call('reportBookCatalog', f); break;
        case 'activeLoans':
          res = await API.call('reportActiveLoans', {}); break;
        case 'overdue':
          res = await API.call('reportOverdue', {}); break;
        case 'studentHistory':
          if (!f.studentId) {
            ReportsPage.renderEmpty('Pilih siswa untuk melihat riwayat.');
            UI.hideLoader();
            return;
          }
          res = await API.call('reportStudentHistory', { studentId: f.studentId });
          break;
        case 'byClass':
          res = await API.call('reportLoansByClass', f); break;
        case 'damagedLost':
          res = await API.call('reportDamagedLost', {}); break;
        case 'outstandingFines':
          res = await API.call('reportOutstandingFines', {}); break;
        case 'reservations':
          res = await API.call('reportReservations', f); break;
        default:
          res = { success: false, message: 'Jenis laporan tidak dikenal' };
      }

      UI.hideLoader();

      if (!res.success) {
        Toast.error(res.message);
        ReportsPage.renderEmpty(res.message);
        return;
      }

      ReportsPage.state.lastData = res.data;
      ReportsPage.renderTable(res.data);
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
      ReportsPage.renderEmpty(e.message);
    }
  },

  renderTable(data) {
    document.getElementById('reportTitle').textContent = data.title || 'Laporan';
    document.getElementById('reportRowCount').textContent = (data.rows || []).length + ' baris';

    const thead = document.getElementById('reportThead');
    const tbody = document.getElementById('reportTbody');

    // Detect kolom numeric
    const numericKeys = (data.columns || []).filter(c => {
      const sample = (data.rows || [])[0];
      if (!sample) return false;
      const v = sample[c.key];
      return typeof v === 'number' || (!isNaN(parseFloat(v)) && isFinite(v));
    }).map(c => c.key);

    // Header
    thead.innerHTML = '<tr>' + data.columns.map(c =>
      `<th class="${numericKeys.indexOf(c.key) !== -1 ? 'num' : ''}">${UI.escape(c.label)}</th>`
    ).join('') + '</tr>';

    // Body
    if (!data.rows || !data.rows.length) {
      tbody.innerHTML = `<tr><td colspan="${data.columns.length}" class="empty-row">Tidak ada data</td></tr>`;
      ReportsPage.updateExportButtons(false);
      return;
    }

    tbody.innerHTML = data.rows.map(row => '<tr>' + data.columns.map(c => {
      let v = row[c.key];
      const isNum = numericKeys.indexOf(c.key) !== -1;
      if (v === null || v === undefined || v === '') v = '-';
      if (isNum && typeof v === 'number') {
        // Format rupiah kalau key mengandung 'balance'/'amount'/'fine'
        if (/balance|amount|fine|cost/i.test(c.key)) {
          return `<td class="num">${UI.formatRupiah(v)}</td>`;
        }
        return `<td class="num">${UI.formatNumber(v)}</td>`;
      }
      return `<td>${UI.escape(v)}</td>`;
    }).join('') + '</tr>').join('');

    ReportsPage.updateExportButtons(true);
  },

  renderEmpty(msg) {
    document.getElementById('reportThead').innerHTML = '<tr><th class="text-center text-muted">Laporan</th></tr>';
    document.getElementById('reportTbody').innerHTML =
      `<tr><td class="empty-row">${UI.escape(msg || 'Tidak ada data')}</td></tr>`;
    document.getElementById('reportRowCount').textContent = '0 baris';
    ReportsPage.updateExportButtons(false);
  },

  updateExportButtons(enabled) {
    document.getElementById('btnExportCsv').disabled = !enabled;
    document.getElementById('btnExportPdf').disabled = !enabled;
  },

  // ============ EXPORT ============
  async exportCsv() {
    const data = ReportsPage.state.lastData;
    if (!data) return;

    UI.showLoader();
    try {
      const res = await API.call('exportReportCsvToDrive', { reportData: data });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }

      ReportsPage.showDownloadModal(res.data, 'CSV');
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  async exportPdf() {
    const data = ReportsPage.state.lastData;
    if (!data) return;

    UI.showLoader();
    try {
      const res = await API.call('exportReportPdf', { reportData: data });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }

      ReportsPage.showDownloadModal(res.data, 'PDF');
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  showDownloadModal(data, type) {
    const id = 'downloadModal_' + Date.now();
    const html = `
      <div class="modal fade" id="${id}" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h6 class="modal-title">Export ${type} Berhasil</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center">
              <i class="bi bi-file-earmark-${type === 'PDF' ? 'pdf text-danger' : 'csv text-success'}"
                 style="font-size:48px"></i>
              <div class="mt-3 fw-semibold">${UI.escape(data.filename)}</div>
              <div class="text-muted small mt-1">File disimpan di folder Reports Google Drive</div>
              <div class="mt-3 d-grid gap-2">
                <a class="btn btn-primary" href="${data.downloadUrl}" target="_blank">
                  <i class="bi bi-download me-1"></i>Download
                </a>
                <a class="btn btn-outline-secondary" href="${data.url}" target="_blank">
                  <i class="bi bi-box-arrow-up-right me-1"></i>Buka di Drive
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
    const modal = new bootstrap.Modal(document.getElementById(id));
    document.getElementById(id).addEventListener('hidden.bs.modal', () => div.remove());
    modal.show();
  }
};

/* ============================================================
 * PAGE: SETTINGS
 * ============================================================ */
function initPage_settings() {
  SettingsPage.init();
}

const SettingsPage = {
  state: {
    config: {},
    users: [],
    userListFilters: { query: '', roleId: '', status: '' },
    roles: [],
    currentRoleId: '',
    permissions: [],
    editingUserId: null,
    editingGradeId: null,
    editingShelfId: null,
    grades: [],
    shelves: [],
    info: null
  },

    async init() {
    // Cek permission
    if (!can('SETTINGS', 'update')) {
      // Sembunyikan tombol Simpan
      document.querySelectorAll('[onclick*="saveGroup"]')
        .forEach(el => el.style.display = 'none');
    }
    if (!can('USERS', 'create')) {
      const btn = document.getElementById('btnAddUser');
      if (btn) btn.style.display = 'none';
      const btnImport = document.getElementById('btnImportUsers');
      if (btnImport) btnImport.style.display = 'none';
    }

    SettingsPage.bindEvents();
    await Promise.all([
      SettingsPage.loadConfig(),
      SettingsPage.loadRoles(),
      SettingsPage.loadUsers(),
      SettingsPage.loadInfo(),
      SettingsPage.loadGradeLevels(),
      SettingsPage.loadShelves()
    ]);
  },

  bindEvents() {
    // Tab Users
    let ut;
    document.getElementById('usersSearchInput').addEventListener('input', e => {
      clearTimeout(ut);
      ut = setTimeout(() => {
        SettingsPage.state.userListFilters.query = e.target.value.trim();
        SettingsPage.renderUsers();
      }, 300);
    });
    document.getElementById('usersRoleFilter').addEventListener('change', e => {
      SettingsPage.state.userListFilters.roleId = e.target.value;
      SettingsPage.renderUsers();
    });
    document.getElementById('usersStatusFilter').addEventListener('change', e => {
      SettingsPage.state.userListFilters.status = e.target.value;
      SettingsPage.renderUsers();
    });
    document.getElementById('btnAddUser').addEventListener('click', () => {
      SettingsPage.openUserForm(null);
    });
    document.getElementById('btnSaveUser').addEventListener('click', () => {
      SettingsPage.saveUser();
    });
    document.getElementById('userLinkedType').addEventListener('change', () => {
      SettingsPage.onLinkedTypeChange();
    });
    document.getElementById('btnImportUsers').addEventListener('click', () => {
      SettingsPage.openImportUserModal();
    });
    document.querySelectorAll('input[name="importUserSource"]').forEach(el => {
      el.addEventListener('change', () => {
        const src = document.querySelector('input[name="importUserSource"]:checked').value;
        document.getElementById('importUserPasteArea').style.display = src === 'PASTE' ? '' : 'none';
        document.getElementById('importUserUploadArea').style.display = src === 'FILE' ? '' : 'none';
      });
    });

    // Tab Grades
    document.getElementById('gradesGroupFilter').addEventListener('change', () => {
      SettingsPage.loadGradeLevels();
    });
    document.getElementById('gradesStatusFilter').addEventListener('change', () => {
      SettingsPage.loadGradeLevels();
    });
    document.getElementById('btnAddGrade').addEventListener('click', () => {
      SettingsPage.openGradeForm(null);
    });

    // Tab Roles
    document.getElementById('roleSelector').addEventListener('change', e => {
      SettingsPage.state.currentRoleId = e.target.value;
      SettingsPage.loadPermissions();
    });
  },

  // ============ CONFIG ============
    async loadConfig() {
    try {
      const res = await API.call('getAllConfig');
      if (!res.success) { Toast.error(res.message); return; }
      SettingsPage.state.config = res.data;

      const c = res.data;
      const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v !== undefined && v !== null ? v : '';
      };
      const setCheck = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.checked = v === 'TRUE' || v === true || v === 'true';
      };

      // === IDENTITAS ===
      setVal('cfg_SCHOOL_NAME', c.SCHOOL_NAME);
      setVal('cfg_LIBRARY_NAME', c.LIBRARY_NAME);
      setVal('cfg_SCHOOL_ADDRESS', c.SCHOOL_ADDRESS);
      setVal('cfg_SCHOOL_CITY', c.SCHOOL_CITY);
      setVal('cfg_LIBRARY_HEAD_NAME', c.LIBRARY_HEAD_NAME);
      setVal('cfg_SCHOOL_YEAR', c.SCHOOL_YEAR);
      setVal('cfg_APP_TIMEZONE', c.APP_TIMEZONE);

      // === LOGO ===
      setVal('cfg_SCHOOL_LOGO_URL', c.SCHOOL_LOGO_URL);
      SettingsPage.renderLogoPreview(c.SCHOOL_LOGO_URL || '');

      // === PEMINJAMAN ===
      setVal('cfg_MAX_ACTIVE_LOANS', c.MAX_ACTIVE_LOANS);
      setVal('cfg_DEFAULT_LOAN_DAYS', c.DEFAULT_LOAN_DAYS);
      setVal('cfg_MAX_RENEWALS', c.MAX_RENEWALS);
      setCheck('cfg_LOAN_ALLOW_STUDENT', c.LOAN_ALLOW_STUDENT);
      setCheck('cfg_LOAN_ALLOW_STAFF', c.LOAN_ALLOW_STAFF);

      // === DENDA ===
      setVal('cfg_FINE_PER_DAY', c.FINE_PER_DAY);
      setCheck('cfg_FINE_ENABLED', c.FINE_ENABLED);

      // === FITUR ===
      setCheck('cfg_RESERVATION_ENABLED', c.RESERVATION_ENABLED);

      // === POLA BARCODE & INVENTARIS ===
      setVal('cfg_BOOK_CODE_PREFIX', c.BOOK_CODE_PREFIX);
      setVal('cfg_BARCODE_PATTERN', c.BARCODE_PATTERN);
      setVal('cfg_INVENTORY_PATTERN', c.INVENTORY_PATTERN);
      setVal('cfg_ACQ_SOURCE_BOS', c.ACQ_SOURCE_BOS);
      setVal('cfg_ACQ_SOURCE_DONATION', c.ACQ_SOURCE_DONATION);
      setVal('cfg_ACQ_SOURCE_PURCHASE', c.ACQ_SOURCE_PURCHASE);
      setVal('cfg_ACQ_SOURCE_TRANSFER', c.ACQ_SOURCE_TRANSFER);
      setVal('cfg_ACQ_SOURCE_OTHER', c.ACQ_SOURCE_OTHER);
    } catch (e) {
      Toast.error('Gagal load config: ' + e.message);
    }
  },

  async saveGroup(groupName) {
    const updates = {};

        if (groupName === 'identity') {
      updates.SCHOOL_NAME = document.getElementById('cfg_SCHOOL_NAME').value.trim();
      updates.LIBRARY_NAME = document.getElementById('cfg_LIBRARY_NAME').value.trim();
      updates.SCHOOL_ADDRESS = document.getElementById('cfg_SCHOOL_ADDRESS').value.trim();
      updates.SCHOOL_CITY = document.getElementById('cfg_SCHOOL_CITY').value.trim();
      updates.LIBRARY_HEAD_NAME = document.getElementById('cfg_LIBRARY_HEAD_NAME').value.trim();
      updates.SCHOOL_YEAR = document.getElementById('cfg_SCHOOL_YEAR').value.trim();
      updates.APP_TIMEZONE = document.getElementById('cfg_APP_TIMEZONE').value.trim();
      updates.SCHOOL_LOGO_URL = document.getElementById('cfg_SCHOOL_LOGO_URL').value.trim();
    } else if (groupName === 'loan') {
      updates.MAX_ACTIVE_LOANS = document.getElementById('cfg_MAX_ACTIVE_LOANS').value;
      updates.DEFAULT_LOAN_DAYS = document.getElementById('cfg_DEFAULT_LOAN_DAYS').value;
      updates.MAX_RENEWALS = document.getElementById('cfg_MAX_RENEWALS').value;
      updates.LOAN_ALLOW_STUDENT = document.getElementById('cfg_LOAN_ALLOW_STUDENT').checked ? 'TRUE' : 'FALSE';
      updates.LOAN_ALLOW_STAFF = document.getElementById('cfg_LOAN_ALLOW_STAFF').checked ? 'TRUE' : 'FALSE';
    } else if (groupName === 'fine') {
      updates.FINE_ENABLED = document.getElementById('cfg_FINE_ENABLED').checked ? 'TRUE' : 'FALSE';
      updates.FINE_PER_DAY = document.getElementById('cfg_FINE_PER_DAY').value;
    } else if (groupName === 'feature') {
      updates.RESERVATION_ENABLED = document.getElementById('cfg_RESERVATION_ENABLED').checked ? 'TRUE' : 'FALSE';
    } else if (groupName === 'pattern') {
      updates.BOOK_CODE_PREFIX = document.getElementById('cfg_BOOK_CODE_PREFIX').value.trim() || 'LIB';
      updates.BARCODE_PATTERN = document.getElementById('cfg_BARCODE_PATTERN').value.trim() || '{PREFIX}{YY}{SEQ4}';
      updates.INVENTORY_PATTERN = document.getElementById('cfg_INVENTORY_PATTERN').value.trim() || '{SEQ3}/{SOURCE}/{YYYY}';
      updates.ACQ_SOURCE_BOS = document.getElementById('cfg_ACQ_SOURCE_BOS').value.trim() || 'BOS';
      updates.ACQ_SOURCE_DONATION = document.getElementById('cfg_ACQ_SOURCE_DONATION').value.trim() || 'DON';
      updates.ACQ_SOURCE_PURCHASE = document.getElementById('cfg_ACQ_SOURCE_PURCHASE').value.trim() || 'BLI';
      updates.ACQ_SOURCE_TRANSFER = document.getElementById('cfg_ACQ_SOURCE_TRANSFER').value.trim() || 'TRF';
      updates.ACQ_SOURCE_OTHER = document.getElementById('cfg_ACQ_SOURCE_OTHER').value.trim() || 'LAI';
    }

    UI.showLoader();
    try {
      const keys = Object.keys(updates);
      for (const key of keys) {
        const res = await API.call('setConfigValue', { key, value: updates[key] });
        if (!res.success) {
          Toast.error(`Gagal menyimpan ${key}: ${res.message}`);
          UI.hideLoader();
          return;
        }
      }
      UI.hideLoader();
      Toast.success('Konfigurasi berhasil disimpan.');
      await SettingsPage.loadConfig();

      // Refresh publicConfig di client
      await App.loadPublicConfig();

      // Refresh nama di sidebar
      const newName = updates.LIBRARY_NAME || SettingsPage.state.config.LIBRARY_NAME;
      const sidebarLib = document.getElementById('sidebarLibraryName');
      if (sidebarLib && newName) {
        const shortName = String(newName).replace(/^Perpustakaan\s+/i, '');
        sidebarLib.textContent = shortName;
      }

      // Refresh logo di sidebar
      App.renderSidebarLogo();
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

    // ============ POLA BARCODE & INVENTARIS ============
    previewPattern() {
    const preview = document.getElementById('patternPreview');
    if (!preview) return;

    const prefix = document.getElementById('cfg_BOOK_CODE_PREFIX').value.trim() || 'LIB';
    const bcPattern = document.getElementById('cfg_BARCODE_PATTERN').value.trim() || '{PREFIX}{YY}{SEQ4}';
    const invPattern = document.getElementById('cfg_INVENTORY_PATTERN').value.trim() || '{SEQ3}/{SOURCE}/{YYYY}';
    const source = document.getElementById('cfg_ACQ_SOURCE_BOS').value.trim() || 'BOS';

    const now = new Date();
    const year = now.getFullYear();
    const year2 = String(year).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const seq = 1;

    function apply(pattern) {
      return pattern
        .replace(/\{PREFIX\}/g, prefix)
        .replace(/\{YY\}/g, year2)
        .replace(/\{YYYY\}/g, String(year))
        .replace(/\{MM\}/g, month)
        .replace(/\{SEQ\}/g, String(seq).padStart(4, '0'))
        .replace(/\{SEQ3\}/g, String(seq).padStart(3, '0'))
        .replace(/\{SEQ4\}/g, String(seq).padStart(4, '0'))
        .replace(/\{SEQ6\}/g, String(seq).padStart(6, '0'))
        .replace(/\{SOURCE\}/g, source);
    }

    preview.innerHTML = `
      <div class="alert alert-success small py-2 mb-0">
        <div class="fw-semibold mb-1">Preview Pola (contoh urutan #1):</div>
        <div>Barcode: <code>${UI.escape(apply(bcPattern))}</code></div>
        <div>No. Inventaris: <code>${UI.escape(apply(invPattern))}</code></div>
      </div>
    `;
  },

    // ============ LOGO ============
  renderLogoPreview(url) {
    const img = document.getElementById('logoPreviewImg');
    const ph = document.getElementById('logoPlaceholder');
    const removeBtn = document.getElementById('logoRemoveBtn');
    if (!img || !ph) return;

    if (url) {
      img.src = url;
      img.classList.remove('d-none');
      ph.classList.add('d-none');
      if (removeBtn) removeBtn.classList.remove('d-none');
    } else {
      img.src = '';
      img.classList.add('d-none');
      ph.classList.remove('d-none');
      if (removeBtn) removeBtn.classList.add('d-none');
    }
  },

  async onLogoFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Toast.warning('File harus berupa gambar.');
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      Toast.warning('Ukuran logo maksimal 1MB.');
      return;
    }

    document.getElementById('logoStatusText').textContent = 'Mengupload...';
    UI.showLoader();

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await API.call('uploadSchoolLogo', {
        fileName: file.name,
        mimeType: file.type,
        base64Data: base64
      });

      UI.hideLoader();

      if (!res.success) {
        document.getElementById('logoStatusText').textContent = 'Max 1MB • PNG/JPG/SVG';
        Toast.error(res.message);
        return;
      }

      document.getElementById('cfg_SCHOOL_LOGO_URL').value = res.data.url;
      SettingsPage.renderLogoPreview(res.data.url);
      document.getElementById('logoStatusText').textContent = '✓ Terupload';

    } catch (e) {
      UI.hideLoader();
      document.getElementById('logoStatusText').textContent = 'Max 1MB • PNG/JPG/SVG';
      Toast.error('Gagal upload: ' + e.message);
    }

    event.target.value = '';
  },

  onLogoUrl() {
    const url = prompt('Masukkan URL logo:');
    if (url === null) return;
    const trimmed = url.trim();
    document.getElementById('cfg_SCHOOL_LOGO_URL').value = trimmed;
    SettingsPage.renderLogoPreview(trimmed);
  },

  removeLogo() {
    document.getElementById('cfg_SCHOOL_LOGO_URL').value = '';
    SettingsPage.renderLogoPreview('');
    Toast.info('Logo dihapus. Klik Simpan untuk menyimpan perubahan.');
  },

  // ============ USERS ============
  async loadUsers() {
    try {
      const res = await API.call('listUsers', {});
      if (!res.success) { Toast.error(res.message); return; }
      SettingsPage.state.users = res.data || [];
      SettingsPage.renderUsers();
      document.getElementById('tabUsersCount').textContent = SettingsPage.state.users.length;
    } catch (e) {
      Toast.error(e.message);
    }
  },

  renderUsers() {
    const f = SettingsPage.state.userListFilters;
    let items = SettingsPage.state.users.slice();

    if (f.query) {
      const q = f.query.toLowerCase();
      items = items.filter(u =>
        String(u.email).toLowerCase().indexOf(q) !== -1 ||
        String(u.full_name || '').toLowerCase().indexOf(q) !== -1);
    }
    if (f.roleId) items = items.filter(u => u.role_id === f.roleId);
    if (f.status) items = items.filter(u => u.status === f.status);

    const tbody = document.getElementById('usersTableBody');
    const roleMap = {};
    SettingsPage.state.roles.forEach(r => { roleMap[r.role_id] = r; });

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Tidak ada user</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(u => {
      const role = roleMap[u.role_id];
      const roleName = role ? role.role_name : u.role_id;
      const statusBadge = {
        ACTIVE: 'bg-success',
        INACTIVE: 'bg-secondary',
        LOCKED: 'bg-danger'
      }[u.status] || 'bg-secondary';
      const authLabel = {
        GOOGLE: 'Google',
        MANUAL: 'Manual',
        BOTH: 'Keduanya'
      }[u.auth_provider] || u.auth_provider;
      const isSelf = API.user && API.user.user_id === u.user_id;

      return `
        <tr>
          <td><code>${UI.escape(u.email)}</code></td>
          <td>${UI.escape(u.full_name)}</td>
          <td><span class="role-badge ${u.role_id}">${UI.escape(roleName)}</span></td>
          <td><small class="text-muted">${UI.escape(authLabel)}</small></td>
          <td class="small">${u.last_login_at ? UI.formatDate(u.last_login_at, true) : '-'}</td>
          <td><span class="badge ${statusBadge}">${UI.escape(u.status)}</span></td>
          <td class="text-end">
            ${can('USERS', 'update') ? `
              <button class="btn btn-sm btn-outline-secondary" title="Edit"
                      onclick="SettingsPage.openUserForm('${u.user_id}')">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-warning" title="Reset Password"
                      onclick="SettingsPage.resetPassword('${u.user_id}','${UI.escape(u.full_name)}')">
                <i class="bi bi-key"></i>
              </button>
              ${!isSelf ? `
                <button class="btn btn-sm btn-outline-${u.status === 'ACTIVE' ? 'danger' : 'success'}"
                        title="${u.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}"
                        onclick="SettingsPage.toggleUserStatus('${u.user_id}','${u.status}','${UI.escape(u.full_name)}')">
                  <i class="bi bi-${u.status === 'ACTIVE' ? 'pause-circle' : 'play-circle'}"></i>
                </button>
              ` : ''}
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  async openUserForm(userId) {
    SettingsPage.state.editingUserId = userId;
    const isEdit = !!userId;

    document.getElementById('userFormTitle').textContent =
      isEdit ? 'Edit User' : 'Tambah User';
    document.getElementById('userForm').reset?.();
    document.getElementById('userLinkedPickerWrap').classList.add('d-none');
    document.getElementById('userPasswordBlock').classList.remove('d-none');
    document.getElementById('userEmail').disabled = false;

    // Fill role options
    const roleSel = document.getElementById('userRole');
    roleSel.innerHTML = '<option value="">-- Pilih Role --</option>' +
      SettingsPage.state.roles.map(r =>
        `<option value="${r.role_id}">${UI.escape(r.role_name)}</option>`
      ).join('');

    if (isEdit) {
      const u = SettingsPage.state.users.find(x => x.user_id === userId);
      if (!u) { Toast.error('User tidak ditemukan'); return; }
      document.getElementById('userEmail').value = u.email;
      document.getElementById('userEmail').disabled = true; // email tidak diubah di form ini
      document.getElementById('userFullName').value = u.full_name;
      document.getElementById('userRole').value = u.role_id;
      document.getElementById('userAuthProvider').value = u.auth_provider || 'BOTH';
      document.getElementById('userStatus').value = u.status;

      // Hide password block for edit
      document.getElementById('userPasswordBlock').classList.add('d-none');

      // Linked
      if (u.linked_student_id) {
        document.getElementById('userLinkedType').value = 'STUDENT';
        await SettingsPage.onLinkedTypeChange(u.linked_student_id);
      } else if (u.linked_staff_id) {
        document.getElementById('userLinkedType').value = 'STAFF';
        await SettingsPage.onLinkedTypeChange(u.linked_staff_id);
      }
    }

    new bootstrap.Modal(document.getElementById('userFormModal')).show();
  },

  async onLinkedTypeChange(selectedId) {
    const type = document.getElementById('userLinkedType').value;
    const wrap = document.getElementById('userLinkedPickerWrap');
    const sel = document.getElementById('userLinkedId');

    if (!type) {
      wrap.classList.add('d-none');
      return;
    }

    wrap.classList.remove('d-none');
    sel.innerHTML = '<option value="">-- Memuat... --</option>';

    try {
      if (type === 'STUDENT') {
        const res = await API.call('searchStudents', { pageSize: 500 });
        if (res.success) {
          sel.innerHTML = '<option value="">-- Pilih Siswa --</option>' +
            (res.data.items || []).map(s =>
              `<option value="${s.student_id}" ${s.student_id === selectedId ? 'selected' : ''}>${UI.escape(s.nis)} - ${UI.escape(s.full_name)}</option>`
            ).join('');
        }
      } else if (type === 'STAFF') {
        const res = await API.call('searchStaff', {});
        if (res.success) {
          sel.innerHTML = '<option value="">-- Pilih Staf --</option>' +
            (res.data || []).map(s =>
              `<option value="${s.staff_id}" ${s.staff_id === selectedId ? 'selected' : ''}>${UI.escape(s.full_name)}</option>`
            ).join('');
        }
      }
    } catch (e) {}
  },

  async saveUser() {
    const userId = SettingsPage.state.editingUserId;
    const isEdit = !!userId;

    const email = document.getElementById('userEmail').value.trim();
    const fullName = document.getElementById('userFullName').value.trim();
    const roleId = document.getElementById('userRole').value;
    const authProvider = document.getElementById('userAuthProvider').value;
    const status = document.getElementById('userStatus').value;
    const linkedType = document.getElementById('userLinkedType').value;
    const linkedId = document.getElementById('userLinkedId').value;

    if (!email) { Toast.warning('Email wajib diisi.'); return; }
    if (!fullName) { Toast.warning('Nama wajib diisi.'); return; }
    if (!roleId) { Toast.warning('Role wajib dipilih.'); return; }

    const payload = {
      email, full_name: fullName, role_id: roleId,
      auth_provider: authProvider, status: status,
      linked_student_id: linkedType === 'STUDENT' ? linkedId : '',
      linked_staff_id: linkedType === 'STAFF' ? linkedId : ''
    };

    if (!isEdit) {
      const pwd = document.getElementById('userInitialPassword').value.trim();
      if (pwd) payload.initial_password = pwd;
    }

    UI.showLoader();
    document.getElementById('btnSaveUser').disabled = true;

    try {
      let res;
      if (isEdit) {
        res = await API.call('updateUser', { userId, ...payload });
      } else {
        res = await API.call('createUser', payload);
      }

      UI.hideLoader();
      document.getElementById('btnSaveUser').disabled = false;

      if (!res.success) { Toast.error(res.message); return; }

      if (!isEdit && res.data.initialPassword) {
        // Tampilkan password awal
        const info = `
          User berhasil dibuat!<br><br>
          <strong>Email:</strong> ${UI.escape(email)}<br>
          <strong>Password Awal:</strong> <code>${res.data.initialPassword}</code><br><br>
          <em>User wajib ganti password saat login pertama.</em>
        `;
        const modal = document.createElement('div');
        modal.innerHTML = `
          <div class="modal fade" id="pwdInfoModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
              <div class="modal-content">
                <div class="modal-header"><h6 class="modal-title">User Baru Dibuat</h6></div>
                <div class="modal-body small">${info}</div>
                <div class="modal-footer">
                  <button class="btn btn-primary btn-sm w-100"
                          data-bs-dismiss="modal" onclick="SettingsPage.loadUsers()">
                    Mengerti
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        const m = new bootstrap.Modal(document.getElementById('pwdInfoModal'));
        document.getElementById('pwdInfoModal').addEventListener('hidden.bs.modal', () => modal.remove());
        m.show();
      } else {
        Toast.success(isEdit ? 'User diperbarui.' : 'User ditambahkan.');
        SettingsPage.loadUsers();
      }

      bootstrap.Modal.getInstance(document.getElementById('userFormModal')).hide();
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnSaveUser').disabled = false;
      Toast.error(e.message);
    }
  },

  async resetPassword(userId, name) {
    const yes = await UI.confirm(
      `Reset password "${name}" ke password default? User wajib ganti saat login berikutnya.`,
      'Konfirmasi Reset Password'
    );
    if (!yes) return;

    UI.showLoader();
    try {
      const res = await API.call('resetUserPassword', { userId });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      Toast.success(`Password direset. Default: ${res.data.defaultPassword}`);
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  async toggleUserStatus(userId, currentStatus, name) {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = newStatus === 'ACTIVE' ? 'aktifkan' : 'nonaktifkan';
    const yes = await UI.confirm(`Yakin ${actionLabel} user "${name}"?`, 'Konfirmasi');
    if (!yes) return;

    UI.showLoader();
    try {
      const res = await API.call('setUserStatus', { userId, status: newStatus });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      Toast.success(`User di${actionLabel}.`);
      SettingsPage.loadUsers();
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  // ============ ROLES & PERMISSIONS ============
  async loadRoles() {
    try {
      const res = await API.call('listRoles');
      if (!res.success) return;
      SettingsPage.state.roles = res.data || [];
      // Fill role selector di tab Permissions
      document.getElementById('roleSelector').innerHTML =
        '<option value="">-- Pilih Role --</option>' +
        SettingsPage.state.roles.map(r =>
          `<option value="${r.role_id}">${UI.escape(r.role_name)} (${r.role_code})</option>`
        ).join('');

      // Fill role filter di tab Users
      const userRoleFilter = document.getElementById('usersRoleFilter');
      if (userRoleFilter) {
        userRoleFilter.innerHTML = '<option value="">Semua Role</option>' +
          SettingsPage.state.roles.map(r =>
            `<option value="${r.role_id}">${UI.escape(r.role_name)}</option>`
          ).join('');
      }
    } catch (e) {}
  },

  async loadPermissions() {
    const roleId = SettingsPage.state.currentRoleId;
    const tbody = document.getElementById('permissionTableBody');

    if (!roleId) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Pilih role terlebih dahulu</td></tr>';
      return;
    }

    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Memuat...</td></tr>';

    try {
      const res = await API.call('listRolePermissions', { roleId });
      if (!res.success) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-row">' + UI.escape(res.message) + '</td></tr>';
        return;
      }
      SettingsPage.state.permissions = res.data || [];
      SettingsPage.renderPermissions();
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">' + UI.escape(e.message) + '</td></tr>';
    }
  },

  renderPermissions() {
    const tbody = document.getElementById('permissionTableBody');
    const perms = SettingsPage.state.permissions;

    if (!perms.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Role ini belum memiliki permission</td></tr>';
      return;
    }

    const moduleLabels = {
      BOOKS: 'Katalog Buku',
      MEMBERS: 'Anggota',
      LOANS: 'Peminjaman',
      RETURNS: 'Pengembalian',
      RESERVATIONS: 'Reservasi',
      FINES: 'Denda',
      REPORTS: 'Laporan',
      SETTINGS: 'Pengaturan',
      USERS: 'Pengguna'
    };

    const canEdit = can('SETTINGS', 'update');
    tbody.innerHTML = perms.map(p => `
      <tr data-role="${p.role_id}" data-module="${p.module_code}">
        <td><strong>${UI.escape(moduleLabels[p.module_code] || p.module_code)}</strong></td>
        <td class="text-center"><input type="checkbox" class="form-check-input perm-check" data-action="view" ${p.can_view ? 'checked' : ''} ${canEdit ? '' : 'disabled'}></td>
        <td class="text-center"><input type="checkbox" class="form-check-input perm-check" data-action="create" ${p.can_create ? 'checked' : ''} ${canEdit ? '' : 'disabled'}></td>
        <td class="text-center"><input type="checkbox" class="form-check-input perm-check" data-action="update" ${p.can_update ? 'checked' : ''} ${canEdit ? '' : 'disabled'}></td>
        <td class="text-center"><input type="checkbox" class="form-check-input perm-check" data-action="delete" ${p.can_delete ? 'checked' : ''} ${canEdit ? '' : 'disabled'}></td>
        <td class="text-center"><input type="checkbox" class="form-check-input perm-check" data-action="export" ${p.can_export ? 'checked' : ''} ${canEdit ? '' : 'disabled'}></td>
        <td class="text-end">
          ${canEdit ? `
            <button class="btn btn-sm btn-primary"
                    onclick="SettingsPage.savePermissionRow('${p.role_id}','${p.module_code}',this)">
              <i class="bi bi-check-lg"></i>
            </button>
          ` : '<i class="bi bi-lock text-muted"></i>'}
        </td>
      </tr>
    `).join('');
  },

  async savePermissionRow(roleId, moduleCode, btn) {
    const row = btn.closest('tr');
    const checks = row.querySelectorAll('.perm-check');
    const payload = { roleId, moduleCode };
    checks.forEach(c => {
      payload['can_' + c.dataset.action] = c.checked;
    });

    UI.showLoader();
    try {
      const res = await API.call('updatePermission', payload);
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      Toast.success('Permission disimpan.');
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  // ============ INFO ============
  async loadInfo() {
    try {
      const res = await API.call('getDashboardData');
      if (!res.success) return;
      const summary = res.data.summary || {};

      // Aplikasi
      document.getElementById('infoAppBody').innerHTML = `
        <table class="table table-sm mb-0">
          <tr><td class="text-muted">Nama Aplikasi</td><td class="text-end"><strong>Perpustakaan Digital</strong></td></tr>
          <tr><td class="text-muted">Versi</td><td class="text-end">2.0.0</td></tr>
          <tr><td class="text-muted">Backend</td><td class="text-end">Google Apps Script</td></tr>
          <tr><td class="text-muted">Database</td><td class="text-end">Google Sheets</td></tr>
          <tr><td class="text-muted">Total Sheet</td><td class="text-end">21 sheet</td></tr>
        </table>
      `;

      // Storage
      document.getElementById('infoStorageBody').innerHTML = `
        <table class="table table-sm mb-0">
          <tr><td class="text-muted">Spreadsheet</td><td class="text-end small">DB_Perpustakaan_Digital</td></tr>
          <tr><td class="text-muted">Folder Root</td><td class="text-end small">LibraryApp_Digital</td></tr>
          <tr><td class="text-muted">Sub-folder</td><td class="text-end small">Covers • Photos • Reports • Backups • KAP_SISWA • KAP_GURU</td></tr>
          <tr><td class="text-muted">Total Records</td><td class="text-end">Data aktif</td></tr>
        </table>
      `;

      // Summary
      document.getElementById('infoSummaryBody').innerHTML = `
        <div class="row g-2">
          <div class="col-md-3 col-6">
            <div class="border rounded p-2 text-center">
              <div class="fw-bold fs-5">${UI.formatNumber(summary.totalTitles || 0)}</div>
              <div class="small text-muted">Judul Buku</div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="border rounded p-2 text-center">
              <div class="fw-bold fs-5">${UI.formatNumber(summary.totalCopies || 0)}</div>
              <div class="small text-muted">Eksemplar</div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="border rounded p-2 text-center">
              <div class="fw-bold fs-5">${UI.formatNumber(summary.totalStudents || 0)}</div>
              <div class="small text-muted">Siswa</div>
            </div>
          </div>
          <div class="col-md-3 col-6">
            <div class="border rounded p-2 text-center">
              <div class="fw-bold fs-5">${UI.formatNumber(summary.totalStaff || 0)}</div>
              <div class="small text-muted">Guru/Staf</div>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      document.getElementById('infoAppBody').innerHTML =
        '<div class="alert alert-danger small">' + UI.escape(e.message) + '</div>';
    }
  },

    // ============ GRADE LEVELS ============
  async loadGradeLevels() {
    try {
      const group = document.getElementById('gradesGroupFilter').value;
      const status = document.getElementById('gradesStatusFilter').value;
      const res = await API.call('listGradeLevels', {
        gradeLevelGroup: group, status: status
      });
      if (!res.success) { Toast.error(res.message); return; }
      SettingsPage.state.grades = res.data || [];
      SettingsPage.renderGrades(res.data || []);
    } catch (e) {
      Toast.error(e.message);
    }
  },

  renderGrades(items) {
    const tbody = document.getElementById('gradesTableBody');
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Belum ada tingkat</td></tr>';
      return;
    }

    const groupLabels = {
      SD: 'SD', MI: 'MI', SMP: 'SMP', MTS: 'MTs',
      SMA: 'SMA', MA: 'MA', SMK: 'SMK', OTHER: 'Lainnya'
    };
    const groupColors = {
      SD: 'bg-info text-dark',
      MI: 'bg-info text-dark',
      SMP: 'bg-primary',
      MTS: 'bg-primary',
      SMA: 'bg-success',
      MA: 'bg-success',
      SMK: 'bg-warning text-dark',
      OTHER: 'bg-secondary'
    };

    tbody.innerHTML = items.map(g => {
      const statusClass = 'badge-status-' + (g.status || 'ACTIVE');
      return `
        <tr>
          <td><code>${UI.escape(g.grade_id)}</code></td>
          <td class="text-center">${g.grade_number}</td>
          <td><strong>${UI.escape(g.grade_name)}</strong></td>
          <td><span class="badge ${groupColors[g.grade_level_group] || 'bg-secondary'}">
            ${UI.escape(groupLabels[g.grade_level_group] || g.grade_level_group)}
          </span></td>
          <td class="text-center text-muted small">${g.sort_order || 0}</td>
          <td class="text-center">
            <span class="badge ${statusClass}">${UI.escape(g.status)}</span>
          </td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-secondary"
                    onclick="SettingsPage.openGradeForm('${g.grade_id}')">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger"
                    onclick="SettingsPage.deleteGrade('${g.grade_id}','${UI.escape(g.grade_name)}')">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  openGradeForm(gradeId) {
    SettingsPage.state.editingGradeId = gradeId;
    const isEdit = !!gradeId;
    const id = 'gradeFormModal_' + Date.now();

    let grade = { grade_number: '', grade_name: '', grade_level_group: '', sort_order: '', status: 'ACTIVE' };
    if (isEdit) {
      // Cari dari tabel
      const rows = SettingsPage.state.grades || [];
      const found = rows.find(g => g.grade_id === gradeId);
      if (found) grade = found;
    }

    const html = `
      <div class="modal fade" id="${id}" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h6 class="modal-title">${isEdit ? 'Edit' : 'Tambah'} Tingkat Kelas</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-2">
                <label class="form-label small">Nomor Tingkat <span class="text-danger">*</span></label>
                <input type="number" class="form-control form-control-sm" id="${id}_num"
                       value="${grade.grade_number}" min="0" max="99">
              </div>
              <div class="mb-2">
                <label class="form-label small">Nama Tampilan <span class="text-danger">*</span></label>
                <input type="text" class="form-control form-control-sm" id="${id}_name"
                       value="${UI.escape(grade.grade_name)}" placeholder="Contoh: Kelas 7">
              </div>
              <div class="mb-2">
                <label class="form-label small">Grup Jenjang <span class="text-danger">*</span></label>
                <select class="form-select form-select-sm" id="${id}_group">
                  <option value="">-- Pilih --</option>
                  ${['SD','MI','SMP','MTS','SMA','MA','SMK','OTHER'].map(g =>
                    `<option value="${g}" ${grade.grade_level_group === g ? 'selected' : ''}>${g}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="mb-2">
                <label class="form-label small">Urutan Tampil (opsional)</label>
                <input type="number" class="form-control form-control-sm" id="${id}_sort"
                       value="${grade.sort_order || ''}" min="0">
                <small class="text-muted">Kosongkan untuk otomatis (nomor × 10).</small>
              </div>
              ${isEdit ? `
              <div class="mb-2">
                <label class="form-label small">Status</label>
                <select class="form-select form-select-sm" id="${id}_status">
                  <option value="ACTIVE" ${grade.status === 'ACTIVE' ? 'selected' : ''}>Aktif</option>
                  <option value="INACTIVE" ${grade.status === 'INACTIVE' ? 'selected' : ''}>Nonaktif</option>
                </select>
              </div>` : ''}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Batal</button>
              <button class="btn btn-primary btn-sm" id="${id}_save">Simpan</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
    const modal = new bootstrap.Modal(document.getElementById(id));
    document.getElementById(id).addEventListener('hidden.bs.modal', () => div.remove());

    document.getElementById(id + '_save').onclick = async () => {
      const num = parseInt(document.getElementById(id + '_num').value, 10);
      const name = document.getElementById(id + '_name').value.trim();
      const group = document.getElementById(id + '_group').value;
      const sortOrder = document.getElementById(id + '_sort').value;
      const status = isEdit ? document.getElementById(id + '_status').value : 'ACTIVE';

      if (isNaN(num)) { Toast.warning('Nomor tingkat tidak valid.'); return; }
      if (!name) { Toast.warning('Nama wajib diisi.'); return; }
      if (!group) { Toast.warning('Grup wajib dipilih.'); return; }

      const payload = {
        grade_number: num,
        grade_name: name,
        grade_level_group: group,
        sort_order: sortOrder ? parseInt(sortOrder, 10) : (num * 10),
        status: status
      };

      UI.showLoader();
      try {
        const res = isEdit
          ? await API.call('updateGradeLevel', { gradeId, ...payload })
          : await API.call('createGradeLevel', payload);
        UI.hideLoader();
        if (!res.success) { Toast.error(res.message); return; }
        Toast.success(isEdit ? 'Tingkat diperbarui.' : 'Tingkat ditambahkan.');
        SettingsPage.loadGradeLevels();
        modal.hide();
      } catch (e) {
        UI.hideLoader();
        Toast.error(e.message);
      }
    };

    modal.show();
  },

  async deleteGrade(gradeId, name) {
    const yes = await UI.confirm(
      `Hapus tingkat "${name}"? Tindakan ini tidak bisa dibatalkan.`,
      'Konfirmasi Hapus'
    );
    if (!yes) return;

    UI.showLoader();
    try {
      const res = await API.call('deleteGradeLevel', { gradeId });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      Toast.success('Tingkat dihapus.');
      SettingsPage.loadGradeLevels();
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

    // ============ SHELVES (RAK) ============
  async loadShelves() {
    try {
      const res = await API.call('listShelves');
      if (!res.success) return;
      SettingsPage.state.shelves = res.data || [];
      SettingsPage.renderShelves();
    } catch (e) {
      console.error('loadShelves error', e);
    }
  },

  renderShelves() {
    const tbody = document.getElementById('shelvesTableBody');
    if (!tbody) return;

    const items = SettingsPage.state.shelves;
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Belum ada rak</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(function(s) {
      const statusClass = 'badge-status-' + (s.status || 'ACTIVE');
      return `
        <tr>
          <td><code>${UI.escape(s.shelf_code)}</code></td>
          <td>${UI.escape(s.shelf_name)}</td>
          <td class="small text-muted">${UI.escape(s.room_name || '-')}</td>
          <td class="text-center">
            <span class="badge ${statusClass}">${UI.escape(s.status || 'ACTIVE')}</span>
          </td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-secondary" title="Edit"
                    onclick="SettingsPage.openShelfForm('${s.shelf_id}')">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" title="Hapus"
                    onclick="SettingsPage.deleteShelf('${s.shelf_id}','${UI.escape(s.shelf_name)}')">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  openShelfForm(shelfId) {
    SettingsPage.state.editingShelfId = shelfId;
    const isEdit = !!shelfId;
    const id = 'shelfFormModal_' + Date.now();

    let shelf = { shelf_code: '', shelf_name: '', room_name: '', floor: '', description: '', status: 'ACTIVE' };
    if (isEdit) {
      const found = SettingsPage.state.shelves.find(function(s) { return s.shelf_id === shelfId; });
      if (found) shelf = found;
    }

    const html = `
      <div class="modal fade" id="${id}" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h6 class="modal-title">${isEdit ? 'Edit' : 'Tambah'} Rak</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-2">
                <label class="form-label small">Kode Rak <span class="text-danger">*</span></label>
                <input type="text" class="form-control form-control-sm" id="${id}_code"
                       value="${UI.escape(shelf.shelf_code)}" placeholder="R-A01">
                <small class="text-muted">Contoh: R-A01, R-B02</small>
              </div>
              <div class="mb-2">
                <label class="form-label small">Nama Rak <span class="text-danger">*</span></label>
                <input type="text" class="form-control form-control-sm" id="${id}_name"
                       value="${UI.escape(shelf.shelf_name)}" placeholder="Rak A01">
              </div>
              <div class="row g-2 mb-2">
                <div class="col-8">
                  <label class="form-label small">Ruangan</label>
                  <input type="text" class="form-control form-control-sm" id="${id}_room"
                         value="${UI.escape(shelf.room_name || '')}" placeholder="Ruang Perpustakaan">
                </div>
                <div class="col-4">
                  <label class="form-label small">Lantai</label>
                  <input type="text" class="form-control form-control-sm" id="${id}_floor"
                         value="${UI.escape(shelf.floor || '')}" placeholder="1">
                </div>
              </div>
              <div class="mb-2">
                <label class="form-label small">Keterangan</label>
                <textarea class="form-control form-control-sm" id="${id}_desc" rows="2"
                          placeholder="Rak pelajaran, rak fiksi, dll">${UI.escape(shelf.description || '')}</textarea>
              </div>
              ${isEdit ? `
              <div class="mb-2">
                <label class="form-label small">Status</label>
                <select class="form-select form-select-sm" id="${id}_status">
                  <option value="ACTIVE" ${shelf.status === 'ACTIVE' ? 'selected' : ''}>Aktif</option>
                  <option value="INACTIVE" ${shelf.status === 'INACTIVE' ? 'selected' : ''}>Nonaktif</option>
                </select>
              </div>` : ''}
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Batal</button>
              <button class="btn btn-primary btn-sm" id="${id}_save">Simpan</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
    const modal = new bootstrap.Modal(document.getElementById(id));
    document.getElementById(id).addEventListener('hidden.bs.modal', function() { div.remove(); });

    document.getElementById(id + '_save').onclick = async function() {
      const code = document.getElementById(id + '_code').value.trim();
      const name = document.getElementById(id + '_name').value.trim();
      const room = document.getElementById(id + '_room').value.trim();
      const floor = document.getElementById(id + '_floor').value.trim();
      const desc = document.getElementById(id + '_desc').value.trim();
      const status = isEdit ? document.getElementById(id + '_status').value : 'ACTIVE';

      if (!code) { Toast.warning('Kode rak wajib diisi.'); return; }
      if (!name) { Toast.warning('Nama rak wajib diisi.'); return; }

      const payload = {
        shelf_code: code,
        shelf_name: name,
        room_name: room,
        floor: floor,
        description: desc,
        status: status
      };

      UI.showLoader();
        try {
          const res = isEdit
            ? await API.call('updateShelf', { shelfId: shelfId, ...payload })
            : await API.call('createShelf', payload);
          UI.hideLoader();
          if (!res.success) { Toast.error(res.message); return; }
          Toast.success(isEdit ? 'Rak diperbarui.' : 'Rak ditambahkan.');

          // ✅ Tunggu loadShelves selesai dulu
          await SettingsPage.loadShelves();

          // ✅ Baru copy data yang sudah fresh ke cache BooksPage
          if (typeof BooksPage !== 'undefined' && BooksPage.state && BooksPage.state.cache) {
            BooksPage.state.cache.shelves = SettingsPage.state.shelves.slice();
            BooksPage.fillSelects();
          }

          modal.hide();
        } catch (e) {
          UI.hideLoader();
          Toast.error(e.message);
        }
    };

    modal.show();
  },

  async deleteShelf(shelfId, name) {
    const yes = await UI.confirm(
      'Hapus rak "' + name + '"? Tindakan ini tidak bisa dibatalkan.',
      'Konfirmasi Hapus'
    );
    if (!yes) return;

    UI.showLoader();
    try {
      const res = await API.call('deleteShelf', { shelfId: shelfId });
      UI.hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      Toast.success('Rak dihapus.');
      SettingsPage.loadShelves();
    } catch (e) {
      UI.hideLoader();
      Toast.error(e.message);
    }
  },

  // ============================================================
  // IMPORT USERS
  // ============================================================
  importUserState: {
    parsedRows: [],
    rawText: ''
  },

  openImportUserModal() {
    SettingsPage.importUserState.parsedRows = [];
    SettingsPage.importUserState.rawText = '';

    document.getElementById('importUserStep1').style.display = '';
    document.getElementById('importUserStep2').style.display = 'none';
    document.getElementById('importUserStep3').style.display = 'none';
    document.getElementById('importUserPasteText').value = '';
    document.getElementById('importUserFileName').textContent = '';
    document.getElementById('importUserModeInsert').checked = true;
    document.getElementById('importUserSourcePaste').checked = true;
    document.getElementById('importUserPasteArea').style.display = '';
    document.getElementById('importUserUploadArea').style.display = 'none';

    new bootstrap.Modal(document.getElementById('importUserModal')).show();
  },

  onImportUserFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    document.getElementById('importUserFileName').textContent = '📄 ' + file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      SettingsPage.importUserState.rawText = e.target.result || '';
      Toast.success('File dimuat.');
    };
    reader.readAsText(file);
  },

  parseImportUserData() {
    const src = document.querySelector('input[name="importUserSource"]:checked').value;
    let text = src === 'PASTE'
      ? document.getElementById('importUserPasteText').value
      : SettingsPage.importUserState.rawText;

    if (!text || !text.trim()) {
      Toast.warning('Data kosong.');
      return;
    }

    try {
      const rows = CsvHelper.parse(text);
      if (!rows.length) {
        Toast.error('Tidak bisa parse. Periksa header CSV.');
        return;
      }
      SettingsPage.importUserState.parsedRows = rows;
      SettingsPage.showImportUserPreview(rows);
    } catch (e) {
      Toast.error('Gagal parse: ' + e.message);
    }
  },

  showImportUserPreview(rows) {
    document.getElementById('importUserStep1').style.display = 'none';
    document.getElementById('importUserStep2').style.display = '';
    document.getElementById('importUserPreviewCount').textContent = rows.length;
    document.getElementById('importUserReadyCount').textContent = rows.length;

    const headerSet = {};
    rows.forEach(r => Object.keys(r).forEach(k => { headerSet[k] = true; }));
    const headers = Object.keys(headerSet);

    const thead = document.querySelector('#importUserPreviewTable thead');
    const tbody = document.querySelector('#importUserPreviewTable tbody');

    thead.innerHTML = '<tr><th>#</th>' + headers.map(h =>
      `<th>${UI.escape(h)}</th>`).join('') + '</tr>';

    tbody.innerHTML = rows.slice(0, 100).map((r, i) =>
      '<tr><td class="text-muted">' + (i + 1) + '</td>' +
      headers.map(h => `<td class="small">${UI.escape(r[h] || '')}</td>`).join('') + '</tr>'
    ).join('');
  },

  backToImportUserStep1() {
    document.getElementById('importUserStep1').style.display = '';
    document.getElementById('importUserStep2').style.display = 'none';
    document.getElementById('importUserStep3').style.display = 'none';
  },

  async executeImportUser() {
    const rows = SettingsPage.importUserState.parsedRows;
    const mode = document.querySelector('input[name="importUserMode"]:checked').value;
    if (!rows.length) return;

    const yes = await UI.confirm(
      `Import ${rows.length} user dengan mode ${mode}?`, 'Konfirmasi');
    if (!yes) return;

    UI.showLoader();
    document.getElementById('btnExecuteImportUser').disabled = true;

    try {
      const res = await API.call('importUsers', { rows, mode });
      UI.hideLoader();
      document.getElementById('btnExecuteImportUser').disabled = false;

      if (!res.success) { Toast.error(res.message); return; }
      SettingsPage.showImportUserResult(res.data);
    } catch (e) {
      UI.hideLoader();
      document.getElementById('btnExecuteImportUser').disabled = false;
      Toast.error(e.message);
    }
  },

  showImportUserResult(data) {
    document.getElementById('importUserStep2').style.display = 'none';
    document.getElementById('importUserStep3').style.display = '';

    const icon = document.getElementById('importUserResultIcon');
    const title = document.getElementById('importUserResultTitle');
    const sub = document.getElementById('importUserResultSubtitle');

    if (data.failed === 0) {
      icon.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i>';
      title.textContent = 'Import Berhasil!';
    } else if (data.success === 0) {
      icon.innerHTML = '<i class="bi bi-x-circle-fill text-danger"></i>';
      title.textContent = 'Import Gagal Total';
    } else {
      icon.innerHTML = '<i class="bi bi-exclamation-triangle-fill text-warning"></i>';
      title.textContent = 'Selesai dengan Peringatan';
    }
    sub.textContent = data.success + ' dari ' + data.total + ' user berhasil diproses.';

    document.getElementById('importUserStatTotal').textContent = data.total || 0;
    document.getElementById('importUserStatSuccess').textContent = data.success || 0;
    document.getElementById('importUserStatFailed').textContent = data.failed || 0;
    document.getElementById('importUserStatUpdated').textContent = data.updated || 0;

    // Passwords
    const pwds = data.generatedPasswords || [];
    if (pwds.length > 0) {
      document.getElementById('importUserGeneratedPasswords').style.display = '';
      document.getElementById('importUserPwdTableBody').innerHTML = pwds.map(p =>
        `<tr><td><code>${UI.escape(p.email)}</code></td>
         <td><code class="text-primary fw-bold">${UI.escape(p.password)}</code></td></tr>`
      ).join('');
    } else {
      document.getElementById('importUserGeneratedPasswords').style.display = 'none';
    }

    // Failed
    const failed = (data.results || []).filter(r => !r.success);
    if (failed.length > 0) {
      document.getElementById('importUserFailedList').style.display = '';
      document.getElementById('importUserFailedTableBody').innerHTML = failed.map(r =>
        `<tr><td class="text-muted">${r.row}</td><td class="text-danger small">${UI.escape(r.message)}</td></tr>`
      ).join('');
    } else {
      document.getElementById('importUserFailedList').style.display = 'none';
    }

    SettingsPage.loadUsers();
  },

  finishImportUser() {
    bootstrap.Modal.getInstance(document.getElementById('importUserModal')).hide();
    SettingsPage.importUserState.parsedRows = [];
    SettingsPage.importUserState.rawText = '';
  },

};

// App.init() dipanggil dari index.html setelah scripts.js + template di-load.
// Tidak ada fallback di sini untuk menghindari double-init & konflik dengan splash screen.
