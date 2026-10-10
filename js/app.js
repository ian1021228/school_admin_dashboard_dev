// 學校與最高行政管理端主程式 (School Admin App Entry)
import { 
    authState, 
    initAuthListener, 
    loginWithGoogle, 
    loginWithSchoolCredentials, 
    logout, 
    impersonateSchool, 
    exitImpersonation 
} from './auth.js';
import { getSchoolTenants, saveSchoolTenant, deleteSchoolTenant } from './firebase.js';
import { renderAttendanceDashboard } from './attendance.js';
import { renderInspectionDashboard } from './inspection.js';
import { renderBroadcastDashboard } from './broadcast.js';
import { renderAccountsDashboard } from './accounts.js';
import { renderContactBookDashboard } from './contactBook.js';
import { showToast, triggerHaptic, generateSecurePassword, escapeHtml } from './utils.js';

let currentTab = 'attendance';

// DOM 元素參照
const loginView = document.getElementById('login-view');
const authenticatedView = document.getElementById('authenticated-view');
const superAdminView = document.getElementById('super-admin-view');
const moduleContainer = document.getElementById('module-container');

const headerSchoolName = document.getElementById('header-school-name');
const headerRoleBadge = document.getElementById('header-role-badge');
const headerNavTabs = document.getElementById('header-nav-tabs');
const mobileNavTabs = document.getElementById('mobile-nav-tabs');
const headerLogoutBtn = document.getElementById('header-logout-btn');
const navSuperAdminBtn = document.getElementById('nav-super-admin-btn');
const mobileSuperTabBtn = document.getElementById('mobile-super-tab-btn');
const impersonationBar = document.getElementById('impersonation-bar');
const exitImpersonationBtn = document.getElementById('exit-impersonation-btn');

const btnGoogleLogin = document.getElementById('btn-google-login');
const schoolLoginForm = document.getElementById('school-login-form');

// 初始化認證狀態監聽
initAuthListener((state) => {
    updateUIForAuthState(state);
});

function updateUIForAuthState(state) {
    if (!state.currentUser) {
        // 未登入狀態
        loginView.classList.remove('hidden');
        authenticatedView.classList.add('hidden');
        superAdminView.classList.add('hidden');
        headerNavTabs.classList.add('hidden');
        mobileNavTabs.classList.add('hidden');
        headerLogoutBtn.classList.add('hidden');
        headerRoleBadge.classList.add('hidden');
        impersonationBar.classList.add('hidden');
        headerSchoolName.textContent = '學校行政管理中心';
        return;
    }

    // 已登入狀態
    loginView.classList.add('hidden');
    headerLogoutBtn.classList.remove('hidden');
    headerRoleBadge.classList.remove('hidden');

    if (state.role === 'super_admin' && !state.isImpersonating) {
        // 最高管理端檢視
        headerSchoolName.textContent = '最高管理中樞 (ianw.solar@gmail.com)';
        headerRoleBadge.innerHTML = '<i class="fa-solid fa-crown mr-1"></i>最高管理員';
        headerRoleBadge.className = 'text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200';
        navSuperAdminBtn.classList.remove('hidden');
        mobileSuperTabBtn.classList.remove('hidden');
        impersonationBar.classList.add('hidden');
    } else {
        // 學校管理端檢視 (或最高管理員穿透檢視)
        headerSchoolName.textContent = state.currentSchool?.name || '學校管理端';
        headerRoleBadge.innerHTML = state.isImpersonating 
            ? '<i class="fa-solid fa-crown mr-1"></i>穿透檢視' 
            : '<i class="fa-solid fa-school mr-1"></i>學校端';
        headerRoleBadge.className = state.isImpersonating 
            ? 'text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200'
            : 'text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200';

        if (state.isImpersonating) {
            impersonationBar.classList.remove('hidden');
            impersonationBar.classList.add('flex');
            navSuperAdminBtn.classList.remove('hidden');
            mobileSuperTabBtn.classList.remove('hidden');
        } else {
            impersonationBar.classList.add('hidden');
            navSuperAdminBtn.classList.add('hidden');
            mobileSuperTabBtn.classList.add('hidden');
        }
    }

    headerNavTabs.classList.remove('hidden');
    mobileNavTabs.classList.remove('hidden');

    // 切換預設分頁
    switchTab(currentTab);
}

// 切換分頁模組
export async function switchTab(tabKey) {
    currentTab = tabKey;
    triggerHaptic('light');

    const isSuper = authState.role === 'super_admin' || authState.isImpersonating;

    // 更新 Desktop 導航按鈕樣式
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabKey) {
            btn.className = `nav-tab-btn px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-white text-indigo-700 shadow-xs border border-indigo-100 ${btn.id === 'nav-super-admin-btn' && !isSuper ? 'hidden' : ''}`;
        } else if (btn.id === 'nav-super-admin-btn') {
            btn.className = `nav-tab-btn px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-purple-700 hover:bg-purple-100/80 bg-purple-50 border border-purple-200 ${!isSuper ? 'hidden' : ''}`;
        } else {
            btn.className = 'nav-tab-btn px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-white/60';
        }
    });

    // 更新 Mobile 導航樣式
    document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
        const isSuperBtn = btn.id === 'mobile-super-tab-btn';
        if (btn.dataset.tab === tabKey) {
            btn.className = `mobile-tab-btn flex-1 py-1.5 text-center text-indigo-600 font-black border-b-2 border-indigo-600 ${isSuperBtn && !isSuper ? 'hidden' : ''}`;
        } else {
            btn.className = `mobile-tab-btn flex-1 py-1.5 text-center text-slate-500 font-medium ${isSuperBtn && !isSuper ? 'hidden' : ''}`;
        }
    });

    if (tabKey === 'super_admin') {
        authenticatedView.classList.add('hidden');
        superAdminView.classList.remove('hidden');
        await renderSuperAdminSchoolList();
        return;
    }

    authenticatedView.classList.remove('hidden');
    superAdminView.classList.add('hidden');

    if (tabKey === 'attendance') {
        await renderAttendanceDashboard(moduleContainer, authState.currentSchool);
    } else if (tabKey === 'inspection') {
        await renderInspectionDashboard(moduleContainer, authState.currentSchool);
    } else if (tabKey === 'broadcast') {
        await renderBroadcastDashboard(moduleContainer, authState.currentSchool);
    } else if (tabKey === 'accounts') {
        await renderAccountsDashboard(moduleContainer, authState.currentSchool);
    } else if (tabKey === 'contact_book') {
        await renderContactBookDashboard(moduleContainer, authState.currentSchool);
    }
}

// 綁定導航點擊事件
document.querySelectorAll('.nav-tab-btn, .mobile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
    });
});

// Google 登入按鈕
btnGoogleLogin.addEventListener('click', async () => {
    await loginWithGoogle();
});

// 學校管理員登入表單
schoolLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('school-login-user').value;
    const pass = document.getElementById('school-login-pass').value;
    await loginWithSchoolCredentials(user, pass);
});


// 登出按鈕
headerLogoutBtn.addEventListener('click', async () => {
    await logout();
});

// 退出穿透巡查按鈕
exitImpersonationBtn.addEventListener('click', () => {
    exitImpersonation();
    updateUIForAuthState(authState);
    switchTab('super_admin');
});

// ==============================================================
// 最高管理端學校租戶管理邏輯
// ==============================================================
const superSchoolTableBody = document.getElementById('super-school-table-body');
const superSchoolCount = document.getElementById('super-school-count');
const superNewSchoolBtn = document.getElementById('super-new-school-btn');
const superSchoolModal = document.getElementById('super-school-modal');
const superModalClose = document.getElementById('super-modal-close');
const superModalCancel = document.getElementById('super-modal-cancel');
const superSchoolForm = document.getElementById('super-school-form');

const closeSuperModal = () => superSchoolModal.classList.add('hidden');
superModalClose.addEventListener('click', closeSuperModal);
superModalCancel.addEventListener('click', closeSuperModal);

superNewSchoolBtn.addEventListener('click', () => {
    triggerHaptic('light');
    superSchoolForm.reset();
    document.getElementById('sch-id').readOnly = false;
    document.getElementById('sch-admin-pass').value = generateSecurePassword(10);
    superSchoolModal.classList.remove('hidden');
});

superSchoolForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic('medium');
    const id = document.getElementById('sch-id').value.trim().toLowerCase();
    const name = document.getElementById('sch-name').value.trim();
    const adminUsername = document.getElementById('sch-admin-user').value.trim();
    const adminPassword = document.getElementById('sch-admin-pass').value.trim();

    try {
        await saveSchoolTenant({
            id,
            name,
            code: id.toUpperCase(),
            adminUsername,
            adminPassword,
            status: 'active'
        });
        showToast(`已成功核發並建立學校【${name}】！`, 'success');
        closeSuperModal();
        await renderSuperAdminSchoolList();
    } catch (err) {
        showToast('建立失敗：' + err.message, 'error');
    }
});

async function renderSuperAdminSchoolList() {
    const schools = await getSchoolTenants();
    superSchoolCount.textContent = `${schools.length} 所學校`;
    superSchoolTableBody.innerHTML = '';

    schools.forEach(sch => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';
        tr.innerHTML = `
            <td class="py-3.5 px-4 font-mono font-bold text-slate-800">${escapeHtml(sch.id)}</td>
            <td class="py-3.5 px-4 font-black text-slate-900">${escapeHtml(sch.name)}</td>
            <td class="py-3.5 px-4 font-mono font-bold text-indigo-700">${escapeHtml(sch.adminUsername || '-')}</td>
            <td class="py-3.5 px-4 font-mono text-slate-600">${escapeHtml(sch.adminPassword || '-')}</td>
            <td class="py-3.5 px-4">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-black ${sch.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                    ${sch.status === 'active' ? '正常營運' : '已停用'}
                </span>
            </td>
            <td class="py-3.5 px-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button class="impersonate-btn px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer" title="穿透巡查此校管理端">
                        <i class="fa-solid fa-arrow-right-to-bracket text-[10px]"></i>
                        <span>穿透巡查</span>
                    </button>
                    <button class="delete-sch-btn p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors" title="刪除學校">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            </td>
        `;

        // 穿透巡查
        tr.querySelector('.impersonate-btn').addEventListener('click', () => {
            impersonateSchool(sch);
            updateUIForAuthState(authState);
            switchTab('attendance');
        });

        // 刪除學校
        tr.querySelector('.delete-sch-btn').addEventListener('click', async () => {
            if (confirm(`確定要刪除【${sch.name}】嗎？`)) {
                triggerHaptic('medium');
                await deleteSchoolTenant(sch.id);
                showToast(`已刪除學校【${sch.name}】`, 'info');
                renderSuperAdminSchoolList();
            }
        });

        superSchoolTableBody.appendChild(tr);
    });
}
