// اطمینان از مقداردهی pb در صورت عدم وجود
if (typeof pb === 'undefined') {
    window.pb = (window.state && window.state.pb) || new PocketBase('http://127.0.0.1:8090');
}// header.js - مدیریت یکپارچه هدر در تمام صفحات
async function renderGlobalHeader() {
    const headerContainer = document.getElementById('app-header');
    if (!headerContainer) return;

    // دریافت اطلاعات کاربر جاری از PocketBase
    // (با فرض اینکه pb در پروژه شما به صورت سراسری تعریف شده است)
    const user = pb.authStore.model;

    // اطلاعات پیش‌فرض در صورت عدم وجود
    const userName = user?.name || user?.username || 'کاربر مهمان';
    const userRole = user?.role_name || user?.role || 'کاربر سیستم';
    const avatarUrl = user?.avatar
        ? pb.files.getUrl(user, user.avatar)
        : 'assets/images/default-avatar.png'; // مسیر آواتار پیش‌فرض شما

    // ساختار HTML هدر
    headerContainer.innerHTML = `
        <header class="main-navbar">
            <div class="navbar-brand">
                <a href="index.html" class="logo-link">
<img src="images/logo.png" alt="لوگو سحاب" class="app-logo" height="40" style="height: 40px; width: auto;">                    <span class="app-title">بانک اطلاعات آفلاین «سحاب»</span>
                </a>
            </div>

            <nav class="navbar-menu">
                <a href="index.html" class="nav-item ${isCurrentPage('index.html') ? 'active' : ''}">پیشخوان</a>
                <a href="create-report.html" class="nav-item ${isCurrentPage('create-report.html') ? 'active' : ''}">افزودن | ویرایش خبر</a>
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

    // اضافه کردن اکشن خروج
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        if (confirm('آیا می‌خواهید از سامانه خارج شوید؟')) {
            pb.authStore.clear();
            window.location.href = 'login.html';
        }
    });
}

// تابع کمکی برای تشخیص صفحه فعلی و فعال کردن منو
function isCurrentPage(pageName) {
    return window.location.pathname.endsWith(pageName) ||
        (pageName === 'index.html' && (window.location.pathname === '/' || window.location.pathname.endsWith('/')));
}

// اجرای خودکار پس از بارگذاری DOM
document.addEventListener('DOMContentLoaded', renderGlobalHeader);