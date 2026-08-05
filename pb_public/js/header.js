// header.js - مدیریت یکپارچه هدر در تمام صفحات
async function renderGlobalHeader() {
    const headerContainer = document.getElementById('app-header');
    if (!headerContainer) return;

    // اطمینان از وجود متغیر pb
    if (typeof pb === 'undefined') {
        window.pb = (window.state && window.state.pb) || new PocketBase(window.location.origin);
    }

    // دریافت اطلاعات کاربر جاری از PocketBase
    const user = (pb && pb.authStore) ? pb.authStore.model : null;

    // نقشه‌برداری نقش‌های PocketBase به عناوین فارسی
    const roleTitles = {
        'expert': 'کارشناس',
        'department': 'اداره',
        'admin_site': 'ادمین',
        'admin_general': 'مدیر کل'
    };

    // دریافت اطلاعات کاربر جاری
    const rawRole = user ? (user.role_name || user.role) : null;
    const userName = user ? (user.name || user.username || 'کاربر سیستم') : 'کاربر مهمان';
    const userRole = rawRole ? (roleTitles[rawRole] || rawRole) : 'کاربر سیستم';
    
    let avatarUrl = 'images/default-avatar.png';
    if (user && user.avatar && pb && pb.files) {
        try {
            avatarUrl = pb.files.getUrl(user, user.avatar);
        } catch (e) {
            console.warn('خطا در دریافت تصویر آواتار:', e);
        }
    }

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
                <a href="users.html" class="nav-item ${isCurrentPage('users.html') ? 'active' : ''}">مدیریت کاربران</a>
            </nav>

            <div class="navbar-user-profile">
                <div class="user-info">
                    <span class="user-name">${userName}</span>
                    <span class="user-role">${userRole}</span>
                </div>
                <div class="user-avatar-wrapper">
                    <a href="profile.html" title="مشاهده پروفایل">
                        <img src="${avatarUrl}" alt="${userName}" class="user-avatar" onerror="this.src='images/default-avatar.png'">
                    </a>
                </div>
                <button id="logout-btn" class="logout-btn" title="خروج از سامانه">
                    <i class="icon-logout"></i> خروج
                </button>
            </div>
        </header>
    `;

    // اضافه کردن اکشن خروج
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        if (confirm('آیا می‌خواهید از سامانه خارج شوید؟')) {
            if (pb && pb.authStore) {
                pb.authStore.clear();
            }
            window.location.href = 'login.html';
        }
    });
}

// تابع کمکی برای تشخیص صفحه فعلی و فعال کردن منو
function isCurrentPage(pageName) {
    return window.location.pathname.endsWith(pageName) ||
        (pageName === 'index.html' && (window.location.pathname === '/' || window.location.pathname.endsWith('/')));
}

// اجرای خودکار
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderGlobalHeader);
} else {
    renderGlobalHeader();
}