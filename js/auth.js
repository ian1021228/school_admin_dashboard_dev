import { 
    auth, 
    googleProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    getSchoolTenants,
    saveSchoolTenant,
    db,
    doc,
    getDoc
} from './firebase.js';
import { SUPER_ADMIN_EMAIL, DEFAULT_SCHOOL, globalAppId } from './constants.js';
import { showToast, triggerHaptic } from './utils.js';

export const authState = {
    currentUser: null,       // Firebase User 或 學校管理員物件
    role: null,              // 'super_admin' | 'school_admin'
    currentSchool: null,     // 目前管理的學校租戶物件
    isImpersonating: false   // 是否由系統管理員切換管理學校
};

let authCallback = null;

// 監聽 Firebase 驗證狀態
export function initAuthListener(onStateChanged) {
    authCallback = onStateChanged;
    onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            if (firebaseUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
                authState.currentUser = firebaseUser;
                authState.role = 'super_admin';
                // 預設選中第一所學校作為工作區
                const schools = await getSchoolTenants();
                authState.currentSchool = schools[0] || DEFAULT_SCHOOL;
                authState.isImpersonating = false;
                if (authCallback) authCallback(authState);
                return;
            } else {
                // 非系統管理員 Google 帳號，強制拒絕登入
                await signOut(auth);
                showToast(`存取拒絕：僅授權系統管理員 (${SUPER_ADMIN_EMAIL}) 登入！`, 'error', 5000);
                authState.currentUser = null;
                authState.role = null;
                authState.currentSchool = null;
                if (authCallback) authCallback(authState);
                return;
            }
        } else {
            // 檢查本地是否有管理員 session
            const savedSession = localStorage.getItem('school_admin_session');
            if (savedSession) {
                try {
                    const parsed = JSON.parse(savedSession);
                    if (parsed.role === 'super_admin') {
                        authState.currentUser = parsed.user;
                        authState.role = 'super_admin';
                        const schools = await getSchoolTenants();
                        authState.currentSchool = parsed.school || schools[0] || DEFAULT_SCHOOL;
                        authState.isImpersonating = false;
                        if (authCallback) authCallback(authState);
                        return;
                    }
                    // 若舊 session 保留了舊學校名稱或為測試帳號，自動更新為測試國中
                    if (parsed.user?.username === 'antigravity' || parsed.school?.id === 'shs' || parsed.school?.name?.includes('七賢')) {
                        if (parsed.school) parsed.school.name = '測試國中';
                        if (parsed.user) parsed.user.displayName = '測試國中 管理處';
                        localStorage.setItem('school_admin_session', JSON.stringify(parsed));
                    }
                    authState.currentUser = parsed.user;
                    authState.role = 'school_admin';
                    authState.currentSchool = parsed.school;
                    authState.isImpersonating = false;
                    if (authCallback) authCallback(authState);
                    return;
                } catch (e) {
                    localStorage.removeItem('school_admin_session');
                }
            }
            authState.currentUser = null;
            authState.role = null;
            authState.currentSchool = null;
            if (authCallback) authCallback(authState);
        }
    });
}

// 系統管理員：強制 Google 登入 (ianw.solar@gmail.com)
export async function loginWithGoogle() {
    triggerHaptic('medium');
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        if (user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
            await signOut(auth);
            showToast(`存取拒絕：${user.email} 不是系統管理員 (${SUPER_ADMIN_EMAIL})`, 'error', 6000);
            return false;
        }
        showToast(`歡迎系統管理員登入：${user.email}`, 'success');
        return true;
    } catch (error) {
        console.error("Google 登入失敗:", error);
        showToast(`Google 登入失敗：${error.message}`, 'error');
        return false;
    }
}

// 系統管理員：帳號密碼登入 (ianantigravity / ianistall188 或測試用 antigravity / 123456)
export async function loginAsSuperAdminWithCredentials(username, password) {
    triggerHaptic('medium');
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if ((cleanUser === 'ianantigravity' && cleanPass === 'ianistall188') ||
        (cleanUser === 'antigravity' && (cleanPass === '123456' || cleanPass === 'password123'))) {
        const schools = await getSchoolTenants();
        authState.currentUser = {
            username: cleanUser,
            displayName: '系統管理員 (System Admin)',
            isSuperAdmin: true
        };
        authState.role = 'super_admin';
        authState.currentSchool = schools[0] || DEFAULT_SCHOOL;
        authState.isImpersonating = false;

        localStorage.setItem('school_admin_session', JSON.stringify({
            user: authState.currentUser,
            role: 'super_admin',
            school: authState.currentSchool
        }));

        showToast('系統管理員登入成功！', 'success');
        if (authCallback) authCallback(authState);
        return true;
    }

    showToast('系統管理員帳號或密碼錯誤！', 'error');
    return false;
}

// 學校管理端：帳號密碼登入
export async function loginWithSchoolCredentials(username, password) {
    triggerHaptic('medium');
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    // 若輸入系統管理員帳密，自動以系統管理員身分登入
    if (cleanUser === 'ianantigravity' && cleanPass === 'ianistall188') {
        return await loginAsSuperAdminWithCredentials(cleanUser, cleanPass);
    }

    // 支援測試用標準帳密 antigravity / 123456
    if (cleanUser === 'antigravity' && (cleanPass === '123456' || cleanPass === 'password123')) {
        const schools = await getSchoolTenants();
        let targetSchool = schools.find(s => s.id === 'shs' || s.id === 'test_school' || s.name === '測試國中') || DEFAULT_SCHOOL;
        targetSchool = { ...targetSchool, name: '測試國中' };
        authState.currentUser = { username: 'antigravity', displayName: '測試國中 管理處' };
        authState.role = 'school_admin';
        authState.currentSchool = targetSchool;
        authState.isImpersonating = false;

        localStorage.setItem('school_admin_session', JSON.stringify({
            user: authState.currentUser,
            role: 'school_admin',
            school: authState.currentSchool
        }));

        showToast(`學校管理端登入成功：${targetSchool.name}`, 'success');
        if (authCallback) authCallback(authState);
        return true;
    }

    // 比對各校註冊的租戶帳號（支援 adminAccount 與 adminUsername）
    let schools = await getSchoolTenants();
    let matched = schools.find(s => {
        const acc = String(s.adminAccount || s.adminUsername || '').trim().toLowerCase();
        const pass = String(s.adminPassword || '').trim();
        return acc === cleanUser && pass === cleanPass;
    });

    // 若本地快取未匹配，強制自雲端 Firestore 載入最新租戶清單進行即時比對（防止跨裝置同步延遲）
    if (!matched) {
        try {
            const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', 'sys_school_tenants');
            const snap = await getDoc(docRef);
            if (snap.exists() && Array.isArray(snap.data()?.list)) {
                schools = snap.data().list;
                localStorage.setItem('school_tenants_cache', JSON.stringify(schools));
                matched = schools.find(s => {
                    const acc = String(s.adminAccount || s.adminUsername || '').trim().toLowerCase();
                    const pass = String(s.adminPassword || '').trim();
                    return acc === cleanUser && pass === cleanPass;
                });
            }
        } catch (err) {
            console.warn("即時重新查詢雲端租戶提示:", err);
        }
    }

    // 若仍然未匹配，檢查 boundAccounts 是否有指派
    if (!matched) {
        try {
            const boundRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'boundAccounts', cleanUser);
            const boundSnap = await getDoc(boundRef);
            if (boundSnap.exists()) {
                const bData = boundSnap.data();
                if (bData.password === cleanPass && bData.schoolId) {
                    const targetSchool = schools.find(s => s.id === bData.schoolId) || {
                        id: bData.schoolId,
                        name: bData.schoolName || '校園管理處',
                        code: bData.schoolId.toUpperCase()
                    };
                    matched = {
                        ...targetSchool,
                        adminAccount: cleanUser,
                        adminPassword: cleanPass
                    };
                }
            }
        } catch (err) {
            console.warn("即時查詢 boundAccounts 提示:", err);
        }
    }

    if (matched) {
        if (matched.status === 'suspended') {
            showToast(`該學校系統已被系統管理員停用，請聯繫 ${SUPER_ADMIN_EMAIL}`, 'error');
            return false;
        }

        const validUsername = matched.adminAccount || matched.adminUsername || cleanUser;
        authState.currentUser = { username: validUsername, displayName: `${matched.name} 管理處` };
        authState.role = 'school_admin';
        authState.currentSchool = matched;
        authState.isImpersonating = false;

        localStorage.setItem('school_admin_session', JSON.stringify({
            user: authState.currentUser,
            role: 'school_admin',
            school: authState.currentSchool
        }));

        showToast(`學校管理端登入成功：${matched.name}`, 'success');
        if (authCallback) authCallback(authState);
        return true;
    }

    showToast('帳號或密碼錯誤，請重新確認！', 'error');
    return false;
}

// 系統管理員進入特定學校管理後台
export function impersonateSchool(schoolObj) {
    if (authState.role !== 'super_admin' && !authState.isImpersonating) {
        showToast('僅限系統管理員可切換學校管理！', 'error');
        return;
    }
    authState.currentSchool = schoolObj;
    authState.isImpersonating = true;
    showToast(`已切換至學校管理：${schoolObj.name}`, 'info');
    if (authCallback) authCallback(authState);
}

// 結束學校管理，返回系統管理員總覽
export function exitImpersonation() {
    authState.isImpersonating = false;
    showToast('已返回系統管理員總覽', 'info');
    if (authCallback) authCallback(authState);
}

// 登出
export async function logout() {
    triggerHaptic('light');
    localStorage.removeItem('school_admin_session');
    if (auth.currentUser) {
        await signOut(auth);
    }
    authState.currentUser = null;
    authState.role = null;
    authState.currentSchool = null;
    authState.isImpersonating = false;
    showToast('已安全登出', 'info');
    if (authCallback) authCallback(authState);
}
