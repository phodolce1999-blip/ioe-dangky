(function () {
  'use strict';

  var KHOI_LOP_OPTIONS = [
    'Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5',
    'Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9',
    'Lớp 10', 'Lớp 11', 'Lớp 12',
  ];

  var STATUS_LABELS = {
    pending: { text: 'Chờ duyệt', cls: 'pending' },
    approved: { text: 'Đã duyệt', cls: 'approved' },
    rejected: { text: 'Đã từ chối', cls: 'rejected' },
  };

  var tableBody = document.getElementById('tableBody');
  var searchInput = document.getElementById('searchInput');
  var filterKhoiLop = document.getElementById('filterKhoiLop');
  var filterTrangThai = document.getElementById('filterTrangThai');
  var refreshBtn = document.getElementById('refreshBtn');
  var logoutBtn = document.getElementById('logoutBtn');
  var toast = document.getElementById('toast');

  var currentData = [];
  var searchDebounceTimer = null;

  // ---------- Khởi tạo ----------

  function populateKhoiLopSelects() {
    KHOI_LOP_OPTIONS.forEach(function (kl) {
      var o1 = document.createElement('option');
      o1.value = kl; o1.textContent = kl;
      filterKhoiLop.appendChild(o1);

      var o2 = document.createElement('option');
      o2.value = kl; o2.textContent = kl;
      document.getElementById('edit_khoi_lop').appendChild(o2);
    });
  }

  function checkAuthThenInit() {
    fetch('/api/admin/me')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.authenticated) {
          window.location.href = '/admin/login.html';
          return;
        }
        populateKhoiLopSelects();
        loadStats();
        loadData();
      })
      .catch(function () {
        window.location.href = '/admin/login.html';
      });
  }

  // ---------- Toast ----------

  function showToast(message, isError) {
    toast.textContent = message;
    toast.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(function () { toast.className = 'toast'; }, 3000);
  }

  // ---------- Tải dữ liệu ----------

  function loadStats() {
    fetch('/api/admin/thong-ke')
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) return;
        document.getElementById('statTotal').textContent = res.data.total;
        document.getElementById('statPending').textContent = res.data.pending;
        document.getElementById('statApproved').textContent = res.data.approved;
        document.getElementById('statRejected').textContent = res.data.rejected;
      });
  }

  function loadData() {
    tableBody.innerHTML = '<tr class="empty-row"><td colspan="8" class="loading-cell">Đang tải dữ liệu...</td></tr>';

    var params = new URLSearchParams({
      q: searchInput.value.trim(),
      khoi_lop: filterKhoiLop.value,
      trang_thai: filterTrangThai.value,
    });

    fetch('/api/admin/hoso?' + params.toString())
      .then(function (r) {
        if (r.status === 401) { window.location.href = '/admin/login.html'; return null; }
        return r.json();
      })
      .then(function (res) {
        if (!res) return;
        if (!res.ok) { showToast(res.error || 'Lỗi tải dữ liệu', true); return; }
        currentData = res.data;
        renderTable(currentData);
      })
      .catch(function () { showToast('Không thể kết nối tới máy chủ.', true); });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function renderTable(list) {
    if (!list.length) {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="8">Không có hồ sơ nào phù hợp.</td></tr>';
      return;
    }

    tableBody.innerHTML = list.map(function (h, idx) {
      var status = STATUS_LABELS[h.trang_thai] || { text: h.trang_thai, cls: '' };
      return (
        '<tr id="row-' + h.id + '">' +
          '<td>' + (idx + 1) + '</td>' +
          '<td>' + (escapeHtml(h.ma_thi_sinh) || '<span style="color:#aaa;">—</span>') + '</td>' +
          '<td>' + escapeHtml(h.ho_ten) + '</td>' +
          '<td>' + escapeHtml(h.khoi_lop) + '</td>' +
          '<td>' + escapeHtml(h.ho_ten_phu_huynh) + '</td>' +
          '<td>' + escapeHtml(h.sdt_phu_huynh) + '</td>' +
          '<td><span class="status ' + status.cls + '" id="status-' + h.id + '">' + status.text + '</span></td>' +
          '<td>' +
            '<button class="action-btn btn-view" data-action="view" data-id="' + h.id + '">Xem</button>' +
            '<button class="action-btn btn-edit" data-action="edit" data-id="' + h.id + '">Sửa</button>' +
            '<button class="action-btn btn-approve" data-action="duyet" data-id="' + h.id + '">Duyệt</button>' +
            '<button class="action-btn btn-reject" data-action="tuchoi" data-id="' + h.id + '">Từ chối</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function findById(id) { return currentData.find(function (h) { return h.id === id; }); }

  // ---------- Modal helpers ----------

  function openModal(id) { document.getElementById(id).classList.add('show'); }
  function closeModal(id) { document.getElementById(id).classList.remove('show'); }

  document.querySelectorAll('[data-close]').forEach(function (el) {
    el.addEventListener('click', function () { closeModal(el.getAttribute('data-close')); });
  });
  document.querySelectorAll('.modal-backdrop').forEach(function (backdrop) {
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) backdrop.classList.remove('show');
    });
  });

  // ---------- Xem chi tiết ----------

  function showViewModal(h) {
    var rows = [
      ['Mã thí sinh', h.ma_thi_sinh || '(Chưa gán)'],
      ['Họ tên thí sinh', h.ho_ten],
      ['Năm sinh', h.nam_sinh || '—'],
      ['Khối lớp', h.khoi_lop],
      ['Họ tên phụ huynh', h.ho_ten_phu_huynh],
      ['Năm sinh phụ huynh', h.nam_sinh_phu_huynh || '—'],
      ['Số điện thoại', h.sdt_phu_huynh],
      ['Nghề nghiệp', h.nghe_nghiep_phu_huynh || '—'],
      ['Địa chỉ', h.dia_chi || '—'],
      ['Email', h.email || '—'],
      ['Ghi chú của phụ huynh', h.ghi_chu || '—'],
      ['Ghi chú nội bộ', h.admin_note || '—'],
      ['Trạng thái', (STATUS_LABELS[h.trang_thai] || {}).text || h.trang_thai],
      ['Ngày đăng ký', new Date(h.ngay_dang_ky).toLocaleString('vi-VN')],
      ['Cập nhật lần cuối', new Date(h.ngay_cap_nhat).toLocaleString('vi-VN')],
    ];
    document.getElementById('viewModalBody').innerHTML = rows.map(function (r) {
      return '<div class="detail-row"><span class="label">' + escapeHtml(r[0]) + '</span><span class="value">' + escapeHtml(r[1]) + '</span></div>';
    }).join('');
    openModal('viewModal');
  }

  // ---------- Sửa hồ sơ ----------

  function showEditModal(h) {
    document.getElementById('edit_id').value = h.id;
    document.getElementById('edit_ma_thi_sinh').value = h.ma_thi_sinh || '';
    document.getElementById('edit_ho_ten').value = h.ho_ten || '';
    document.getElementById('edit_nam_sinh').value = h.nam_sinh || '';
    document.getElementById('edit_khoi_lop').value = h.khoi_lop || '';
    document.getElementById('edit_ho_ten_phu_huynh').value = h.ho_ten_phu_huynh || '';
    document.getElementById('edit_nam_sinh_phu_huynh').value = h.nam_sinh_phu_huynh || '';
    document.getElementById('edit_sdt_phu_huynh').value = h.sdt_phu_huynh || '';
    document.getElementById('edit_nghe_nghiep_phu_huynh').value = h.nghe_nghiep_phu_huynh || '';
    document.getElementById('edit_dia_chi').value = h.dia_chi || '';
    document.getElementById('edit_email').value = h.email || '';
    document.getElementById('edit_ghi_chu').value = h.ghi_chu || '';
    document.getElementById('edit_admin_note').value = h.admin_note || '';
    openModal('editModal');
  }

  document.getElementById('editForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('edit_id').value;
    var payload = {
      ma_thi_sinh: document.getElementById('edit_ma_thi_sinh').value,
      ho_ten: document.getElementById('edit_ho_ten').value,
      nam_sinh: document.getElementById('edit_nam_sinh').value,
      khoi_lop: document.getElementById('edit_khoi_lop').value,
      ho_ten_phu_huynh: document.getElementById('edit_ho_ten_phu_huynh').value,
      nam_sinh_phu_huynh: document.getElementById('edit_nam_sinh_phu_huynh').value,
      sdt_phu_huynh: document.getElementById('edit_sdt_phu_huynh').value,
      nghe_nghiep_phu_huynh: document.getElementById('edit_nghe_nghiep_phu_huynh').value,
      dia_chi: document.getElementById('edit_dia_chi').value,
      email: document.getElementById('edit_email').value,
      ghi_chu: document.getElementById('edit_ghi_chu').value,
      admin_note: document.getElementById('edit_admin_note').value,
    };

    var saveBtn = document.getElementById('saveEditBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu...';

    fetch('/api/admin/hoso/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (data) { return { status: r.status, data: data }; }); })
      .then(function (result) {
        if (result.status === 200 && result.data.ok) {
          closeModal('editModal');
          showToast('Đã lưu thay đổi hồ sơ.');
          loadData();
          loadStats();
        } else {
          showToast(result.data.error || 'Không thể lưu thay đổi.', true);
        }
      })
      .catch(function () { showToast('Không thể kết nối tới máy chủ.', true); })
      .finally(function () {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Lưu thay đổi';
      });
  });

  // ---------- Duyệt / Từ chối (dùng modal xác nhận tự viết thay vì confirm() mặc định) ----------

  var pendingConfirmAction = null;

  function askConfirm(title, message, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    pendingConfirmAction = onConfirm;
    openModal('confirmModal');
  }

  document.getElementById('confirmOkBtn').addEventListener('click', function () {
    var action = pendingConfirmAction;
    pendingConfirmAction = null;
    closeModal('confirmModal');
    if (action) action();
  });

  function updateTrangThai(id, action, label) {
    fetch('/api/admin/hoso/' + id + '/' + action, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(function (r) { return r.json().then(function (data) { return { status: r.status, data: data }; }); })
      .then(function (result) {
        if (result.status === 200 && result.data.ok) {
          showToast('Đã ' + label + ' hồ sơ thành công!');
          loadData();
          loadStats();
        } else {
          showToast(result.data.error || 'Không thể cập nhật trạng thái.', true);
        }
      })
      .catch(function () { showToast('Không thể kết nối tới máy chủ.', true); });
  }

  // ---------- Sự kiện chung trên bảng (event delegation) ----------

  tableBody.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var action = btn.getAttribute('data-action');
    var h = findById(id);
    if (!h) return;

    if (action === 'view') return showViewModal(h);
    if (action === 'edit') return showEditModal(h);
    if (action === 'duyet') {
      return askConfirm(
        'Duyệt hồ sơ',
        'Bạn có chắc chắn muốn DUYỆT hồ sơ của "' + h.ho_ten + '"?',
        function () { updateTrangThai(id, 'duyet', 'duyệt'); }
      );
    }
    if (action === 'tuchoi') {
      return askConfirm(
        'Từ chối hồ sơ',
        'Bạn có chắc chắn muốn TỪ CHỐI hồ sơ của "' + h.ho_ten + '"?',
        function () { updateTrangThai(id, 'tu-choi', 'từ chối'); }
      );
    }
  });

  // ---------- Toolbar ----------

  searchInput.addEventListener('input', function () {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(loadData, 350);
  });
  filterKhoiLop.addEventListener('change', loadData);
  filterTrangThai.addEventListener('change', loadData);
  refreshBtn.addEventListener('click', function () { loadData(); loadStats(); });

  logoutBtn.addEventListener('click', function () {
    fetch('/api/admin/logout', { method: 'POST' }).finally(function () {
      window.location.href = '/admin/login.html';
    });
  });

  // ---------- Khởi chạy ----------

  checkAuthThenInit();
})();
