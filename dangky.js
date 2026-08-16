(function () {
  'use strict';

  // Phải khớp với config.khoiLopOptions ở server (server.js sẽ validate lại lần nữa).
  var KHOI_LOP_OPTIONS = [
    'Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5',
    'Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9',
    'Lớp 10', 'Lớp 11', 'Lớp 12',
  ];

  var khoiLopSelect = document.getElementById('khoi_lop');
  KHOI_LOP_OPTIONS.forEach(function (kl) {
    var opt = document.createElement('option');
    opt.value = kl;
    opt.textContent = kl;
    khoiLopSelect.appendChild(opt);
  });

  var form = document.getElementById('dangKyForm');
  var alertBox = document.getElementById('alertBox');
  var confirmBox = document.getElementById('confirmBox');
  var submitBtn = document.getElementById('submitBtn');

  function clearErrors() {
    document.querySelectorAll('.form-group').forEach(function (g) {
      g.classList.remove('has-error');
      var et = g.querySelector('.error-text');
      if (et) et.textContent = '';
    });
    alertBox.className = 'alert';
    alertBox.textContent = '';
  }

  function showFieldErrors(errors) {
    Object.keys(errors).forEach(function (field) {
      var input = form.querySelector('[name="' + field + '"]');
      if (!input) return;
      var group = input.closest('.form-group');
      if (!group) return;
      group.classList.add('has-error');
      var et = group.querySelector('.error-text');
      if (et) et.textContent = errors[field];
    });
  }

  function showAlert(type, message) {
    alertBox.className = 'alert alert-' + type + ' show';
    alertBox.textContent = message;
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function fillText(id, value) {
    document.getElementById(id).textContent = (value === '' || value == null) ? '(Không có)' : value;
  }

  function renderConfirm(hoSo) {
    fillText('c_ma_thi_sinh', hoSo.ma_thi_sinh);
    fillText('c_ho_ten', hoSo.ho_ten);
    fillText('c_nam_sinh', hoSo.nam_sinh);
    fillText('c_khoi_lop', hoSo.khoi_lop);
    fillText('c_ho_ten_ph', hoSo.ho_ten_phu_huynh);
    fillText('c_nam_sinh_ph', hoSo.nam_sinh_phu_huynh);
    fillText('c_sdt_ph', hoSo.sdt_phu_huynh);
    fillText('c_nghe_nghiep', hoSo.nghe_nghiep_phu_huynh);
    fillText('c_dia_chi', hoSo.dia_chi);
    fillText('c_email', hoSo.email);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();

    var formData = new FormData(form);
    var payload = {};
    formData.forEach(function (value, key) { payload[key] = value; });

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Đang gửi...';

    fetch('/api/dangky', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
      .then(function (result) {
        if (result.status === 201 && result.data.ok) {
          form.style.display = 'none';
          renderConfirm(result.data.data);
          confirmBox.classList.add('show');
        } else if (result.status === 422 && result.data.details) {
          showFieldErrors(result.data.details);
          showAlert('error', 'Vui lòng kiểm tra lại các trường được đánh dấu đỏ bên dưới.');
        } else {
          showAlert('error', result.data.error || 'Có lỗi xảy ra, vui lòng thử lại.');
        }
      })
      .catch(function () {
        showAlert('error', 'Không thể kết nối tới máy chủ. Vui lòng thử lại sau.');
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Gửi đăng ký';
      });
  });
})();
