// اطمینان از مقداردهی اولیه pb بر اساس origin جاری مرورگر
if (typeof window.pb === 'undefined' || !window.pb) {
    if (typeof PocketBase !== 'undefined') {
        window.pb = new PocketBase(window.location.origin);
    }
}

// header.js - مدیریت یکپارچه هدر در تمام صفحات
window.renderGlobalHeader = async function renderGlobalHeader() {
    const headerContainer = document.getElementById('app-header');
    if (!headerContainer) return;

    // اگر window.pb مقداردهی نشده بود، مجددا تلاش برای ایجاد آن
    if (!window.pb && typeof PocketBase !== 'undefined') {
        window.pb = new PocketBase(window.location.origin);
    }

    const activePb = window.pb || (typeof pb !== 'undefined' ? pb : null);
    
    // بازخوانی مدل کاربر از authStore
    const user = activePb?.authStore?.isValid ? activePb.authStore.model : null;

    // نقشه‌برداری نقش‌های PocketBase به عناوین فارسی
    const roleTitles = {
        'expert': 'کارشناس',
        'department': 'اداره',
        'admin_site': 'ادمین',
        'admin_general': 'مدیر کل'
    };

    // استخراج مشخصات کاربر
    const rawRole = user?.role_name || user?.role;
    const userName = user?.name || user?.username || 'کاربر مهمان';
    const userRole = roleTitles[rawRole] || rawRole || 'کاربر سیستم';
    const avatarUrl = (user?.avatar && activePb?.files)
        ? activePb.files.getUrl(user, user.avatar)
        : 'images/default-avatar.png';

    // ساختار HTML هدر
    headerContainer.innerHTML = `
        <header class="main-navbar">
            <div class="navbar-brand">
                <a href="index.html" class="logo-link">
                    <img src="images/logo.png" alt="لوگو سحاب" class="app-logo" height="40" style="height: 40px; width: auto;">
                    <span class="app-title">بانک اطلاعات آفلاین «سحاب»</span>
                </a>
            </div>

            <nav class="navbar-menu">
                <a href="index.html" class="nav-item ${isCurrentPage('index.html') ? 'active' : ''}">پیشخوان</a>
                <a href="create-report.html" class="nav-item ${isCurrentPage('create-report.html') ? 'active' : ''}">افزودن | ویرایش خبر</a>
                <a href="analytics.html" class="nav-item ${isCurrentPage('analytics.html') ? 'active' : ''}">گزارش و تحلیل</a>
                <a href="users.html" class="nav-item ${isCurrentPage('users.html') ? 'active' : ''}">مدیریت کاربران</a>
            </nav>

            <div class="navbar-user-profile">
                <div class="user-info">
                    <span class="user-name">${userName}</span>
                    <span class="user-role">${userRole}</span>
                </div>
                <div class="user-avatar-wrapper">
                    <a href="profile.html" title="مشاهده پروفایل">
                        <img src="${avatarUrl}" alt="${userName}" class="user-avatar">
                    </a>
                </div>
                <button id="logout-btn" class="logout-btn" title="خروج از سامانه">
                    <i class="icon-logout"></i> خروج
                </button>
            </div>
        </header>
    `;

    // اضافه کردن اکشن خروج با پشتیبانی از SweetAlert2
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        if (typeof Swal !== 'undefined') {
            const confirmResult = await Swal.fire({
                title: 'خروج از سامانه',
                text: 'آیا می‌خواهید از حساب کاربری خود خارج شوید؟',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'بله، خروج',
                cancelButtonText: 'انصراف'
            });

            if (!confirmResult.isConfirmed) return;
        } else if (!confirm('آیا می‌خواهید از سامانه خارج شوید؟')) {
            return;
        }

        if (activePb?.authStore) {
            activePb.authStore.clear();
        }
        window.location.href = 'login.html';
    });
};

// تابع کمکی برای تشخیص صفحه فعلی و فعال کردن منو
function isCurrentPage(pageName) {
    return window.location.pathname.endsWith(pageName) ||
        (pageName === 'index.html' && (window.location.pathname === '/' || window.location.pathname.endsWith('/')));
}

// اجرای خودکار پس از بارگذاری کامل DOM یا بلافاصله در صورت آماده بودن
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderGlobalHeader);
} else {
    renderGlobalHeader();
}