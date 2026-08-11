let allUsersData = [];

const ROLE_LABELS = {
    'admin_site': 'مدیر سایت',
    'admin_general': 'مدیر کل',
    'department': 'مدیر اداره',
    'expert': 'کارشناس'
};

document.addEventListener('DOMContentLoaded', async () => {
    // بررسی اولیه وجود SDK و توکن محلی
    if (typeof pb === 'undefined' || !pb.authStore.isValid) {
        window.location.href = 'login.html';
        return;
    }

    // استعلام صحت توکن از سرور PocketBase
    try {
        await pb.collection('users').authRefresh();
    } catch (authErr) {
        console.warn("نشست کاربر منقضی یا باطل شده است:", authErr);
        pb.authStore.clear();
        window.location.href = 'login.html';
        return;
    }

    const currentUser = pb.authStore.model;
    const currentRole = currentUser?.role || 'expert';

    // تفکیک رابط کاربری بر اساس نقش
    if (currentRole === 'expert') {
        const tableContainer = document.getElementById('users-table-container');
        const btnCreate = document.getElementById('btn-open-create-modal');
        const expertProfile = document.getElementById('expert-profile-container');

        if (tableContainer) tableContainer.classList.add('hidden');
        if (btnCreate) btnCreate.classList.add('hidden');
        if (expertProfile) expertProfile.classList.remove('hidden');

        await setupExpertProfile(currentUser);
    } else {
        await loadUsers();
    }
});

// تنظیم فرم اختصاصی کارشناس
async function setupExpertProfile(currentUser) {
    if (!currentUser) return;

    let freshUser = currentUser;

    try {
        freshUser = await pb.collection('users').getOne(currentUser.id, { expand: 'department_rel' });
    } catch (fetchErr) {
        console.warn("عدم موفقیت در بروزرسانی اطلاعات از سرور، استفاده از داده‌های محلی:", fetchErr);
    }

    document.getElementById('profile-name').value = freshUser.name || '';
    const profileUsernameInput = document.getElementById('profile-username');
    if (profileUsernameInput) {
        profileUsernameInput.value = freshUser.email || freshUser.username || '';
        profileUsernameInput.disabled = true;
        profileUsernameInput.classList.add('bg-slate-100', 'text-slate-500', 'cursor-not-allowed');
    }

    const avatarUrl = freshUser.avatar
        ? pb.files.getUrl(freshUser, freshUser.avatar, { thumb: '100x100' })
        : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(freshUser.name || 'User') + '&background=random';

    const avatarImg = document.getElementById('profile-avatar-preview');
    if (avatarImg) avatarImg.src = avatarUrl;

    const roleText = ROLE_LABELS[freshUser.role] || freshUser.role || 'کارشناس';
    const roleBadge = document.getElementById('profile-role-badge');
    if (roleBadge) roleBadge.innerHTML = `<span class="bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-lg border border-emerald-200">${roleText}</span>`;

    const infoRole = document.getElementById('profile-info-role');
    if (infoRole) infoRole.innerText = roleText;

    const deptObj = freshUser.expand?.department_rel;
    const deptName = deptObj ? (deptObj.name || deptObj.username || '---') : 'تعیین نشده';
    const infoDept = document.getElementById('profile-info-department');
    if (infoDept) infoDept.innerText = deptName;
}

// ثبت تغییرات فرم اختصاصی کارشناس
async function handleProfileFormSubmit(event) {
    event.preventDefault();

    const currentUser = pb.authStore.model;
    const name = document.getElementById('profile-name').value.trim();
    const username = document.getElementById('profile-username').value.trim();
    const password = document.getElementById('profile-password').value;
    const avatarInput = document.getElementById('profile-avatar');

    const formData = new FormData();
    formData.append('name', name);
    // عدم ارسال username در صورت عدم تغییر جهت جلوگیری از خطاهای ولیدیشن

    if (avatarInput && avatarInput.files && avatarInput.files[0]) {
        formData.append('avatar', avatarInput.files[0]);
    }

    const btnSave = document.getElementById('btn-save-profile');
    btnSave.disabled = true;
    btnSave.innerText = 'در حال ذخیره‌سازی...';

    try {
        const updatedUser = await pb.collection('users').update(currentUser.id, formData);
        pb.authStore.save(pb.authStore.token, updatedUser); // بروزرسانی authStore محلی

        if (password) {
            await pb.send('/api/custom-change-password', {
                method: 'POST',
                body: {
                    targetUserId: currentUser.id,
                    newPassword: password
                }
            });

            if (typeof Swal !== 'undefined') {
                await Swal.fire({
                    title: 'موفقیت‌آمیز',
                    text: 'کلمه عبور با موفقیت تغییر یافت. لطفاً با کلمه عبور جدید مجدداً وارد شوید.',
                    icon: 'success',
                    confirmButtonText: 'تایید',
                    confirmButtonColor: '#4f46e5'
                });
            } else {
                alert('کلمه عبور با موفقیت تغییر یافت. لطفاً با کلمه عبور جدید مجدداً وارد شوید.');
            }
            pb.authStore.clear();
            window.location.href = 'login.html';
            return;
        }

        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                title: 'موفقیت‌آمیز',
                text: 'اطلاعات حساب کاربری با موفقیت بروزرسانی شد.',
                icon: 'success',
                confirmButtonText: 'تایید',
                confirmButtonColor: '#4f46e5'
            });
        } else {
            alert('اطلاعات حساب کاربری با موفقیت بروزرسانی شد.');
        }
        await setupExpertProfile(updatedUser);
        document.getElementById('profile-password').value = '';
    } catch (err) {
        console.error("خطا در بروزرسانی پروفایل:", err);
        const errDetails = err.data?.data ? JSON.stringify(err.data.data) : (err.message || 'مشکلی رخ داده است.');
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'خطا در ثبت تغییرات',
                text: errDetails,
                icon: 'error',
                confirmButtonText: 'متوجه شدم',
                confirmButtonColor: '#ef4444'
            });
        } else {
            alert("خطا در ثبت تغییرات: " + errDetails);
        }
    } finally {
        btnSave.disabled = false;
        btnSave.innerText = 'بروزرسانی اطلاعات';
    }
}

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

    const currentUser = pb.authStore.model;
    const currentRole = currentUser?.role || '';

    // فیلتر کاربران اختصاصی برای نقش اداره (فقط کاربران زیرمجموعه خود)
    let displayUsers = users;
    if (currentRole === 'department') {
        displayUsers = users.filter(u => u.department_rel === currentUser.id);
    }

    if (!displayUsers || displayUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-slate-400 font-bold">هیچ کاربری یافت نشد.</td></tr>`;
        return;
    }

    let html = '';
    displayUsers.forEach((user, index) => {
        const isEven = index % 2 === 0;
        const bgRow = isEven ? 'bg-white' : 'bg-slate-50/70';

        const deptObj = user.expand?.department_rel;
        const deptName = deptObj
            ? (deptObj.name || deptObj.username || '---')
            : (user.department_rel || '---');

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
            (currentRole === 'department' && user.department_rel === currentUser.id)
        );

        // ۲. بررسی دسترسی حذف (مدیر سایت و مدیر کل)
        const canDelete = (
            currentRole === 'admin_site' ||
            currentRole === 'admin_general'
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

// فیلتر آنی جدول کاربران
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
    const avatarPreview = document.getElementById('modal-avatar-preview');

    const currentUser = pb.authStore.model;
    const currentRole = currentUser?.role || '';

    const roleSelect = document.getElementById('user-role');
    const deptSelect = document.getElementById('user-department');

    form.reset();

    // تنظیم وضعیت کنترل‌های فرم بر اساس نقش
    if (roleSelect) {
        const adminSiteOpt = roleSelect.querySelector('option[value="admin_site"]');
        if (adminSiteOpt) {
            if (currentRole === 'admin_general') {
                adminSiteOpt.disabled = true;
                adminSiteOpt.classList.add('hidden');
            } else {
                adminSiteOpt.disabled = false;
                adminSiteOpt.classList.remove('hidden');
            }
        }

        if (currentRole === 'department') {
            roleSelect.disabled = true; // عدم امکان تغییر نقش دسترسی توسط نقش اداره
        } else {
            roleSelect.disabled = false;
        }
    }

    if (deptSelect) {
        if (currentRole === 'department') {
            deptSelect.value = currentUser.id;
            deptSelect.disabled = true; // عدم امکان تغییر اداره
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
        if (usernameInput) {
            usernameInput.value = user.email || user.username || '';
            // فقط مدیر سایت و مدیر کل مجاز به ویرایش نام کاربری/ایمیل در حالت ویرایش هستند
            if (currentRole === 'admin_site' || currentRole === 'admin_general') {
                usernameInput.disabled = false;
                usernameInput.classList.remove('bg-slate-100', 'text-slate-500', 'cursor-not-allowed');
            } else {
                usernameInput.disabled = true;
                usernameInput.classList.add('bg-slate-100', 'text-slate-500', 'cursor-not-allowed');
            }
        }

        const passwordLabel = document.getElementById('password-label-text');
        if (passwordLabel) passwordLabel.innerText = 'کلمه عبور جدید';

        if (roleSelect) roleSelect.value = user.role || 'expert';
        if (deptSelect) deptSelect.value = user.department_rel || '';

        // بارگذاری تصویر آواتار قبلی در پیش‌نمایش مودال
        const avatarUrl = user.avatar
            ? pb.files.getUrl(user, user.avatar, { thumb: '100x100' })
            : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || 'User') + '&background=random';
        if (avatarPreview) avatarPreview.src = avatarUrl;

        passInput.removeAttribute('required');
        if (passStar) passStar.classList.add('hidden');
        if (passHint) passHint.classList.remove('hidden');
    } else {
        // حالت ایجاد کاربر جدید
        modalTitle.innerText = 'ایجاد کاربر جدید';
        document.getElementById('user-id').value = '';

        const usernameInput = document.getElementById('user-username');
        if (usernameInput) {
            usernameInput.value = '';
            usernameInput.disabled = false;
            usernameInput.classList.remove('bg-slate-100', 'text-slate-500', 'cursor-not-allowed');
        }

        const passwordLabel = document.getElementById('password-label-text');
        if (passwordLabel) passwordLabel.innerText = 'کلمه عبور';

        if (avatarPreview) avatarPreview.src = 'https://ui-avatars.com/api/?name=New+User&background=random';

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

    // تعیین مقدار نقش در حالت ویرایش/ایجاد
    let role = roleSelect ? roleSelect.value : 'expert';
    if (currentRole === 'department') {
        if (userId) {
            const userToEdit = allUsersData.find(u => u.id === userId);
            role = userToEdit ? userToEdit.role : 'expert';
        } else {
            role = 'expert';
        }
    }

    let departmentRel = deptSelect ? deptSelect.value : '';
    if (currentRole === 'department') {
        departmentRel = currentUser.id;
    }

    const formData = new FormData();
    formData.append('name', name);

    // اگر در حالت ایجاد جدید هستیم یا فیلد غیرفعال نیست، مقادیر نام‌کاربری/ایمیل ارسال شوند
    const usernameInput = document.getElementById('user-username');
    if (!userId || (usernameInput && !usernameInput.disabled)) {
        formData.append('username', username);
        if (!username.includes('@')) {
            formData.append('email', `${username}@sahab.local`);
        } else {
            formData.append('email', username);
        }
    }

    formData.append('role', role);
    formData.append('department_rel', departmentRel);
    formData.append('emailVisibility', 'true');

    const avatarInput = document.getElementById('user-avatar');
    if (avatarInput && avatarInput.files && avatarInput.files[0]) {
        formData.append('avatar', avatarInput.files[0]);
    }

    const btnSave = document.getElementById('btn-save-user');
    btnSave.disabled = true;
    btnSave.innerText = 'در حال ذخیره...';

    try {
        if (userId) {
            await pb.collection('users').update(userId, formData);
            // در صورتی که پسورد جدید وارد شده باشد، از طریق مسیر سفارشی به روز می‌شود
            if (password) {
                await pb.send('/api/custom-change-password', {
                    method: 'POST',
                    body: {
                        targetUserId: userId,
                        newPassword: password
                    }
                });

                // اگر کاربر کلمه عبور خودش را تغییر داده باشد، باید خارج شود
                if (userId === currentUser.id) {
                    if (typeof Swal !== 'undefined') {
                        await Swal.fire({
                            title: 'تغییر رمز عبور',
                            text: 'کلمه عبور شما با موفقیت تغییر یافت. لطفاً با کلمه عبور جدید مجدداً وارد شوید.',
                            icon: 'success',
                            confirmButtonText: 'ورود مجدد',
                            confirmButtonColor: '#4f46e5'
                        });
                    } else {
                        alert('کلمه عبور شما با موفقیت تغییر یافت. لطفاً با کلمه عبور جدید مجدداً وارد شوید.');
                    }
                    pb.authStore.clear();
                    window.location.href = 'login.html';
                    return;
                }
            }
        } else {
            if (password) {
                formData.append('password', password);
                formData.append('passwordConfirm', password);
            }
            await pb.collection('users').create(formData);
        }

        closeUserModal();
        await loadUsers();

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'موفقیت‌آمیز',
                text: userId ? 'اطلاعات کاربر با موفقیت بروزرسانی شد.' : 'کاربر جدید با موفقیت ایجاد شد.',
                icon: 'success',
                confirmButtonText: 'تایید',
                confirmButtonColor: '#4f46e5'
            });
        }
    } catch (err) {
        console.error("خطا در ذخیره‌سازی کاربر:", err);
        const errDetails = err.data?.data ? JSON.stringify(err.data.data) : (err.message || 'مشکلی رخ داده است.');
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'خطا در ذخیره‌سازی',
                text: errDetails,
                icon: 'error',
                confirmButtonText: ' متوجه شدم',
                confirmButtonColor: '#ef4444'
            });
        } else {
            alert("خطا در ذخیره‌سازی کاربر: " + errDetails);
        }
    } finally {
        btnSave.disabled = false;
        btnSave.innerText = 'ذخیره کاربر';
    }
}

// حذف کاربر
async function deleteUser(userId, userName) {
    if (typeof Swal !== 'undefined') {
        const confirmResult = await Swal.fire({
            title: 'تایید حذف کاربر',
            text: `آیا از حذف کاربر «${userName}» اطمینان دارید؟`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'بله، حذف شود',
            cancelButtonText: 'انصراف'
        });

        if (!confirmResult.isConfirmed) return;
    } else if (!confirm(`آیا از حذف کاربر «${userName}» اطمینان دارید؟`)) {
        return;
    }

    try {
        await pb.collection('users').delete(userId);
        await loadUsers();

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'حذف شد',
                text: `کاربر «${userName}» با موفقیت حذف گردید.`,
                icon: 'success',
                confirmButtonText: 'تایید',
                confirmButtonColor: '#4f46e5'
            });
        }
    } catch (err) {
        console.error("خطا در حذف کاربر:", err);
        const errorMsg = err.message || 'امکان حذف وجود ندارد.';
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'خطا در حذف کاربر',
                text: errorMsg,
                icon: 'error',
                confirmButtonText: 'متوجه شدم',
                confirmButtonColor: '#ef4444'
            });
        } else {
            alert("خطا در حذف کاربر: " + errorMsg);
        }
    }
}