let allUsersData = [];

document.addEventListener('DOMContentLoaded', async () => {
    // بررسی وضعیت ورود کاربر
    if (typeof pb === 'undefined' || !pb.authStore.isValid) {
        window.location.href = 'login.html';
        return;
    }

    await loadUsers();
});

// پر کردن دراپ‌داون اداره‌ها از روی کاربران با نقش department
function populateDepartmentDropdown(users) {
    const deptSelect = document.getElementById('user-department');
    if (!deptSelect) return;

    deptSelect.innerHTML = '<option value="">انتخاب اداره (ویژه کارشناسان)</option>';

    const departments = users.filter(u => u.role === 'department');
    departments.forEach(dept => {
        const nameDisplay = dept.name || dept.username || dept.email || dept.id;
        deptSelect.innerHTML += `<option value="${dept.id}">${nameDisplay}</option>`;
    });
}

// بارگذاری لیست تمامی کاربران از پاکت‌بیس
async function loadUsers() {
    try {
        const records = await pb.collection('users').getFullList({
            sort: '-created',
            expand: 'department_rel'
        });
        allUsersData = records;
        populateDepartmentDropdown(allUsersData);
        
        // در صورت وجود فیلتر مجدداً اعمال می‌شود، در غیر این صورت کل کاربران رندر می‌شوند
        filterUsersTable();
    } catch (err) {
        console.error("خطا در بارگذاری لیست کاربران:", err);
        const tbody = document.getElementById('users-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-red-500 font-bold">خطا در دریافت اطلاعات کاربران.</td></tr>`;
        }
    }
}

// رندر کردن جدول کاربران با اعمال دسترسی‌ها
function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-slate-400 font-bold">هیچ کاربری یافت نشد.</td></tr>`;
        return;
    }

    const currentUser = pb.authStore.model;
    const currentRole = currentUser?.role || '';

    let html = '';
    users.forEach((user, index) => {
        const isEven = index % 2 === 0;
        const bgRow = isEven ? 'bg-white' : 'bg-slate-50/70';

        // نام اداره از رابطه department_rel
        const deptObj = user.expand?.department_rel;
        const deptName = deptObj
            ? (deptObj.name || deptObj.username || '---')
            : (user.department_rel || '---');

        // برچسب فارسی نقش‌ها
        const roleBadges = {
            'admin_site': '<span class="bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded border border-red-200">مدیر سایت</span>',
            'admin_general': '<span class="bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded border border-purple-200">مدیر کل</span>',
            'department': '<span class="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded border border-blue-200">مدیر اداره</span>',
            'expert': '<span class="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200">کارشناس</span>'
        };

        const roleDisplay = roleBadges[user.role] || `<span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">${user.role || '---'}</span>`;

        // ۱. بررسی دسترسی ویرایش
        const canEdit = (
            currentRole === 'admin_site' ||
            currentRole === 'admin_general' ||
            currentUser.id === user.id ||
            (currentRole === 'department' && user.department_rel === currentUser.id)
        );

        // ۲. بررسی دسترسی حذف
        const canDelete = (
            currentRole === 'admin_site' ||
            currentRole === 'admin_general' ||
            (currentRole === 'department' && user.department_rel === currentUser.id)
        );

        let actionButtons = '';
        if (canEdit) {
            actionButtons += `<button onclick="openUserModal('${user.id}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-lg transition text-xs">ویرایش</button>`;
        }
        if (canDelete) {
            actionButtons += `<button onclick="deleteUser('${user.id}', '${user.name || user.username}')" class="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-1 rounded-lg transition text-xs">حذف</button>`;
        }
        if (!canEdit && !canDelete) {
            actionButtons = `<span class="text-slate-400 text-xs italic">بدون دسترسی</span>`;
        }

        // آدرس تصویر آواتار در صورت وجود
        const avatarUrl = user.avatar
            ? pb.files.getUrl(user, user.avatar, { thumb: '100x100' })
            : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || 'User') + '&background=random';

        html += `
            <tr class="${bgRow} border-b border-slate-100 hover:bg-slate-100/50 transition">
                <td class="p-3 font-bold text-slate-900 flex items-center gap-3">
                    <img src="${avatarUrl}" class="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm" alt="آواتار">
                    <span>${user.name || '---'}</span>
                </td>
                <td class="p-3 font-mono dir-ltr text-right text-slate-700">${user.username || user.email || '---'}</td>
                <td class="p-3 font-semibold text-slate-700">${deptName}</td>
                <td class="p-3">${roleDisplay}</td>
                <td class="p-3 text-slate-500 text-xs">${typeof formatDateToFa === 'function' ? formatDateToFa(user.created) : user.created}</td>
                <td class="p-3 text-center">
                    <div class="flex justify-center items-center gap-2">
                        ${actionButtons}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// فیلتر آنی جدول کاربران بر اساس متن جستجو و نقش
function filterUsersTable() {
    const searchVal = (document.getElementById('user-search-input')?.value || '').trim().toLowerCase();
    const roleVal = document.getElementById('user-role-filter')?.value || '';

    const filtered = allUsersData.filter(user => {
        const name = (user.name || '').toLowerCase();
        const username = (user.username || '').toLowerCase();
        const deptObj = user.expand?.department_rel;
        const deptName = (deptObj ? (deptObj.name || deptObj.username || '') : (user.department_rel || '')).toLowerCase();

        const matchesSearch = name.includes(searchVal) || username.includes(searchVal) || deptName.includes(searchVal);
        const matchesRole = !roleVal || user.role === roleVal;

        return matchesSearch && matchesRole;
    });

    renderUsersTable(filtered);
}

// باز کردن مودال ایجاد یا ویرایش کاربر
function openUserModal(userId = null) {
    const modal = document.getElementById('user-modal');
    const form = document.getElementById('user-form');
    const modalTitle = document.getElementById('modal-title');
    const passInput = document.getElementById('user-password');
    const passStar = document.getElementById('password-required-star');
    const passHint = document.getElementById('password-hint');

    const currentUser = pb.authStore.model;
    const currentRole = currentUser?.role || '';

    const roleSelect = document.getElementById('user-role');
    const deptSelect = document.getElementById('user-department');

    form.reset();

    // مدیریت دسترسی فیلدهای فرم بر اساس نقش کاربر لاگین شده
    if (roleSelect) {
        const adminSiteOpt = roleSelect.querySelector('option[value="admin_site"]');
        if (adminSiteOpt) {
            // مدیر کل نباید بتواند کاربر با نقش مدیر سایت بسازد
            if (currentRole === 'admin_general') {
                adminSiteOpt.disabled = true;
                adminSiteOpt.classList.add('hidden');
            } else {
                adminSiteOpt.disabled = false;
                adminSiteOpt.classList.remove('hidden');
            }
        }

        if (currentRole === 'department') {
            roleSelect.value = 'expert';
            roleSelect.disabled = true; // مدیر اداره فقط کارشناس می‌سازد
        } else {
            roleSelect.disabled = false;
        }
    }

    if (deptSelect) {
        if (currentRole === 'department') {
            deptSelect.value = currentUser.id; // خودکار انتخاب شدن خود اداره
            deptSelect.disabled = true; // غیرقابل تغییر
        } else {
            deptSelect.disabled = false;
        }
    }

    if (userId) {
        // حالت ویرایش
        const user = allUsersData.find(u => u.id === userId);
        if (!user) return;

        modalTitle.innerText = 'ویرایش کاربر';
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-name').value = user.name || '';
        
        const usernameInput = document.getElementById('user-username');
        if (usernameInput) usernameInput.value = user.username || '';

        if (roleSelect) roleSelect.value = user.role || 'expert';
        if (deptSelect) deptSelect.value = user.department_rel || '';

        passInput.removeAttribute('required');
        if (passStar) passStar.classList.add('hidden');
        if (passHint) passHint.classList.remove('hidden');
    } else {
        // حالت ایجاد کاربر جدید
        modalTitle.innerText = 'ایجاد کاربر جدید';
        document.getElementById('user-id').value = '';
        
        const usernameInput = document.getElementById('user-username');
        if (usernameInput) usernameInput.value = '';

        passInput.setAttribute('required', 'required');
        if (passStar) passStar.classList.remove('hidden');
        if (passHint) passHint.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// بستن مودال کاربر
function closeUserModal() {
    const modal = document.getElementById('user-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// ثبت یا بروزرسانی فرم کاربر
async function handleUserFormSubmit(event) {
    event.preventDefault();

    const userId = document.getElementById('user-id').value;
    const name = document.getElementById('user-name').value.trim();
    const username = document.getElementById('user-username').value.trim();
    const password = document.getElementById('user-password').value;

    const currentUser = pb.authStore.model;
    const currentRole = currentUser?.role || '';

    const roleSelect = document.getElementById('user-role');
    const deptSelect = document.getElementById('user-department');

    // استخراج دقیق نقش و اداره حتی در صورت disabled بودن selectها
    let role = roleSelect ? roleSelect.value : 'expert';
    if (currentRole === 'department') {
        role = 'expert';
    }

    let departmentRel = deptSelect ? deptSelect.value : '';
    if (currentRole === 'department') {
        departmentRel = currentUser.id;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('username', username);
    formData.append('email', `${username}@sahab.local`);
    formData.append('role', role);
    formData.append('department_rel', departmentRel);
    formData.append('emailVisibility', 'true');

    // افزودن تصویر آواتار در صورت انتخاب فایل
    const avatarInput = document.getElementById('user-avatar');
    if (avatarInput && avatarInput.files && avatarInput.files[0]) {
        formData.append('avatar', avatarInput.files[0]);
    }

    // اضافه کردن کلمه عبور فقط در صورت پر بودن یا هنگام ساخت جدید
    if (password) {
        formData.append('password', password);
        formData.append('passwordConfirm', password);
    }

    const btnSave = document.getElementById('btn-save-user');
    btnSave.disabled = true;
    btnSave.innerText = 'در حال ذخیره...';

    try {
        if (userId) {
            // ویرایش کاربر موجود
            await pb.collection('users').update(userId, formData);
        } else {
            // ایجاد کاربر جدید
            await pb.collection('users').create(formData);
        }

        closeUserModal();
        await loadUsers();
    } catch (err) {
        console.error("خطا در ذخیره‌سازی کاربر:", err);
        const errDetails = err.data?.data ? JSON.stringify(err.data.data) : (err.message || 'مشکلی رخ داده است.');
        alert("خطا در ذخیره‌سازی کاربر: " + errDetails);
    } finally {
        btnSave.disabled = false;
        btnSave.innerText = 'ذخیره کاربر';
    }
}
// حذف کاربر
async function deleteUser(userId, userName) {
    if (!confirm(`آیا از حذف کاربر «${userName}» اطمینان دارید؟`)) {
        return;
    }

    try {
        await pb.collection('users').delete(userId);
        await loadUsers();
    } catch (err) {
        console.error("خطا در حذف کاربر:", err);
        alert("خطا در حذف کاربر: " + (err.message || 'امکان حذف وجود ندارد.'));
    }
}