// Firebase 初始化與資料庫互動模組 (相容線上 Firestore 權限規則與全域快取)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signOut, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { firebaseConfig, globalAppId, DEFAULT_SCHOOL } from './constants.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
    onAuthStateChanged,
    signInWithPopup,
    signOut,
    signInWithEmailAndPassword,
    doc,
    getDoc,
    setDoc
};

// Google 登入 Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ==========================================
// 學校租戶 (School Tenants - 系統管理員管理)
// 存儲路徑：userProfiles/sys_school_tenants
// ==========================================
export async function getSchoolTenants() {
    const localKey = 'school_tenants_cache';
    let cached = [];
    try {
        cached = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}

    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', 'sys_school_tenants');
        const snap = await getDoc(docRef);
        if (snap.exists() && Array.isArray(snap.data()?.list) && snap.data().list.length > 0) {
            const list = snap.data().list;
            localStorage.setItem(localKey, JSON.stringify(list));
            return list;
        }
    } catch (err) {
        console.warn("自雲端取得學校清單提示:", err);
    }

    if (cached.length > 0) return cached;

    // 預設示範學校
    const initial = [DEFAULT_SCHOOL];
    localStorage.setItem(localKey, JSON.stringify(initial));
    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', 'sys_school_tenants');
        await setDoc(docRef, { list: initial, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {}
    return initial;
}

export async function saveSchoolTenant(schoolData) {
    const docId = schoolData.id || `school_${Date.now()}`;
    const payload = {
        ...schoolData,
        id: docId,
        updatedAt: new Date().toISOString()
    };
    const localKey = 'school_tenants_cache';
    let list = [];
    try { list = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch (e) {}
    const idx = list.findIndex(s => s.id === docId);
    if (idx >= 0) list[idx] = payload;
    else list.push(payload);
    localStorage.setItem(localKey, JSON.stringify(list));

    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', 'sys_school_tenants');
        await setDoc(docRef, { list, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
        console.warn("同步至雲端學校租戶提示:", e);
    }
    return payload;
}

export async function deleteSchoolTenant(schoolId) {
    const localKey = 'school_tenants_cache';
    let list = [];
    try { list = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch (e) {}
    list = list.filter(s => s.id !== schoolId);
    localStorage.setItem(localKey, JSON.stringify(list));

    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', 'sys_school_tenants');
        await setDoc(docRef, { list, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
        console.warn("刪除雲端學校租戶提示:", e);
    }
}

// ==========================================
// 全校班級帳密 (School Classes - 學校管理端派發)
// 存儲路徑：userProfiles/sch_classes_{schoolId}
// ==========================================
export async function getSchoolClasses(schoolId) {
    const localKey = `school_classes_${schoolId}`;
    let cached = [];
    try {
        cached = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}

    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', `sch_classes_${schoolId}`);
        const snap = await getDoc(docRef);
        if (snap.exists() && Array.isArray(snap.data()?.list)) {
            const list = snap.data().list;
            localStorage.setItem(localKey, JSON.stringify(list));
            return list;
        }
    } catch (err) {
        console.warn("自雲端取得班級清單提示:", err);
    }

    return cached;
}

export async function saveSchoolClass(classData) {
    const docId = `${classData.schoolId}_${classData.classCode}`;
    const payload = {
        ...classData,
        id: docId,
        updatedAt: new Date().toISOString()
    };

    const localKey = `school_classes_${classData.schoolId}`;
    let list = [];
    try {
        list = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}
    const idx = list.findIndex(c => c.classCode === classData.classCode);
    if (idx >= 0) list[idx] = { ...list[idx], ...payload };
    else list.push(payload);
    localStorage.setItem(localKey, JSON.stringify(list));

    // 寫入雲端 sch_classes_{schoolId} 與 schoolClasses
    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', `sch_classes_${classData.schoolId}`);
        await setDoc(docRef, { list, updatedAt: new Date().toISOString() }, { merge: true });

        const scRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'schoolClasses', docId);
        await setDoc(scRef, payload, { merge: true });
    } catch (e) {
        console.warn("寫入雲端學校班級提示:", e);
    }

    // 同步到 boundAccounts 使得教師端能以此帳密登入並自動載入該班級
    if (classData.teacherUsername && classData.teacherPassword) {
        try {
            const boundRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'boundAccounts', classData.teacherUsername.toLowerCase().trim());
            await setDoc(boundRef, {
                username: classData.teacherUsername.trim(),
                password: classData.teacherPassword,
                role: 'teacher',
                schoolId: classData.schoolId,
                classCode: classData.classCode,
                className: classData.className,
                studentCount: classData.studentCount || 30,
                missingSeats: classData.missingSeats || [],
                parentAccessCode: classData.parentAccessCode || '',
                parentPassword: classData.parentPassword || '',
                isReadOnly: Boolean(classData.isReadOnly),
                studentPins: classData.studentPins || {},
                studentAccounts: classData.studentAccounts || [],
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            console.warn("同步至 boundAccounts 提示:", e);
        }
    }

    return payload;
}

export async function deleteSchoolClass(schoolId, classCode) {
    const localKey = `school_classes_${schoolId}`;
    let list = [];
    try {
        list = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}
    list = list.filter(c => c.classCode !== classCode);
    localStorage.setItem(localKey, JSON.stringify(list));

    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', `sch_classes_${schoolId}`);
        await setDoc(docRef, { list, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
        console.warn("刪除雲端班級提示:", e);
    }
}

// ==========================================
// 晨間出缺席看板 (Morning Attendance)
// 存儲路徑：userProfiles/sch_att_{schoolId}_{date}
// ==========================================
export async function getMorningAttendance(schoolId, dateStr) {
    const localKey = `morning_attendance_${schoolId}_${dateStr}`;
    let cached = [];
    try {
        cached = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}

    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', `sch_att_${schoolId}_${dateStr}`);
        const snap = await getDoc(docRef);
        if (snap.exists() && Array.isArray(snap.data()?.list)) {
            const list = snap.data().list;
            localStorage.setItem(localKey, JSON.stringify(list));
            return list;
        }
    } catch (err) {
        console.warn("自雲端取得晨間出缺席提示:", err);
    }

    return cached;
}

export async function saveMorningAttendance(record) {
    const localKey = `morning_attendance_${record.schoolId}_${record.date}`;
    let list = [];
    try {
        list = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}
    const idx = list.findIndex(r => r.classCode === record.classCode);
    const payload = {
        ...record,
        updatedAt: new Date().toISOString()
    };
    if (idx >= 0) list[idx] = payload;
    else list.push(payload);
    localStorage.setItem(localKey, JSON.stringify(list));

    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', `sch_att_${record.schoolId}_${record.date}`);
        await setDoc(docRef, { list, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
        console.warn("寫入晨間出缺席資料提示:", e);
    }
    return payload;
}

// ==========================================
// 線上行政抽查與電子核章 (Inspections & Stamps)
// 存儲路徑：userProfiles/sch_insp_{schoolId}
// ==========================================
export async function getAdminInspections(schoolId) {
    const localKey = `admin_inspections_${schoolId}`;
    let cached = [];
    try {
        cached = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}

    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', `sch_insp_${schoolId}`);
        const snap = await getDoc(docRef);
        if (snap.exists() && Array.isArray(snap.data()?.list)) {
            const list = snap.data().list;
            localStorage.setItem(localKey, JSON.stringify(list));
            return list.sort((a, b) => new Date(b.stampedAt || 0) - new Date(a.stampedAt || 0));
        }
    } catch (e) {
        console.warn("自雲端取得行政抽查資料提示:", e);
    }

    return cached.sort((a, b) => new Date(b.stampedAt || 0) - new Date(a.stampedAt || 0));
}

export async function saveAdminInspection(inspectionData) {
    const docId = inspectionData.id || `insp_${Date.now()}`;
    const payload = {
        ...inspectionData,
        id: docId,
        stampedAt: new Date().toISOString()
    };

    const localKey = `admin_inspections_${inspectionData.schoolId}`;
    let list = [];
    try {
        list = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}
    list.unshift(payload);
    localStorage.setItem(localKey, JSON.stringify(list));

    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', `sch_insp_${inspectionData.schoolId}`);
        await setDoc(docRef, { list, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
        console.warn("寫入行政抽查資料提示:", e);
    }

    // 跨端即時連動：寫入 parentClasses/{classCode} 讓該班導師端與家長端聯絡簿立即呈現查訖印戳
    if (inspectionData.classCode) {
        try {
            const pRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'parentClasses', String(inspectionData.classCode).trim());
            const pSnap = await getDoc(pRef);
            let stamps = [];
            if (pSnap.exists()) {
                const pData = pSnap.data() || {};
                stamps = Array.isArray(pData.inspectionStamps) ? pData.inspectionStamps : [];
            }
            stamps.unshift(payload);
            await setDoc(pRef, {
                inspectionStamps: stamps.slice(0, 20),
                latestInspection: payload,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            console.warn("同步行政核章至 parentClasses 提示:", e);
        }
    }

    return payload;
}

// ==========================================
// 全校廣播 (Campus Safety Announcements)
// 存儲路徑：userProfiles/sch_bc_{schoolId}
// ==========================================
export async function getCampusAnnouncements(schoolId) {
    const localKey = `campus_announcements_${schoolId}`;
    let cached = [];
    try {
        cached = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}

    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', `sch_bc_${schoolId}`);
        const snap = await getDoc(docRef);
        if (snap.exists() && Array.isArray(snap.data()?.list)) {
            const list = snap.data().list;
            localStorage.setItem(localKey, JSON.stringify(list));
            return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }
    } catch (e) {
        console.warn("取得全校廣播提示:", e);
    }

    return cached.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function saveCampusAnnouncement(announcementData) {
    const docId = announcementData.id || `ann_${Date.now()}`;
    const payload = {
        ...announcementData,
        id: docId,
        createdAt: announcementData.createdAt || new Date().toISOString()
    };

    const localKey = `campus_announcements_${announcementData.schoolId}`;
    let list = [];
    try {
        list = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}
    const idx = list.findIndex(b => b.id === docId);
    if (idx >= 0) list[idx] = payload;
    else list.unshift(payload);
    localStorage.setItem(localKey, JSON.stringify(list));

    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', `sch_bc_${announcementData.schoolId}`);
        await setDoc(docRef, { list, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
        console.warn("寫入雲端全校廣播提示:", e);
    }

    // 跨端即時連動：同步寫入 systemBroadcasts/main 讓全校教師端與家長端跑馬燈與小鈴鐺立即收到
    try {
        const bcRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'systemBroadcasts', 'main');
        const snap = await getDoc(bcRef);
        let broadcasts = [];
        let history = [];
        if (snap.exists()) {
            const data = snap.data() || {};
            broadcasts = Array.isArray(data.broadcasts) ? data.broadcasts : [];
            history = Array.isArray(data.history) ? data.history : [];
        }
        const bcItem = {
            id: payload.id,
            title: payload.title,
            content: payload.content,
            message: `【${payload.title}】${payload.content}`,
            level: payload.level || 'notice',
            target: payload.target || 'all',
            schoolId: payload.schoolId,
            sender: '學校行政處室',
            author: '學校行政處室',
            authorName: '學校行政處室',
            active: payload.active !== false,
            createdAt: payload.createdAt
        };
        broadcasts = [bcItem, ...broadcasts.filter(b => b.id !== bcItem.id)].slice(0, 50);
        history = [bcItem, ...history.filter(h => h.id !== bcItem.id)].slice(0, 50);
        await setDoc(bcRef, {
            active: payload.active !== false,
            current: bcItem,
            latest: bcItem,
            broadcasts,
            history,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.warn("同步至 systemBroadcasts/main 提示:", e);
    }

    return payload;
}

export async function toggleCampusAnnouncement(annId, active, fallbackData = null) {
    const schoolId = fallbackData?.schoolId || 'shs';
    const localKey = `campus_announcements_${schoolId}`;
    let list = [];
    try {
        list = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}

    let found = list.find(b => b.id === annId);
    if (found) {
        found.active = active;
        found.updatedAt = new Date().toISOString();
    } else if (fallbackData) {
        found = { ...fallbackData, id: annId, active, updatedAt: new Date().toISOString() };
        list.unshift(found);
    }
    localStorage.setItem(localKey, JSON.stringify(list));

    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'userProfiles', `sch_bc_${schoolId}`);
        await setDoc(docRef, { list, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
        console.warn("更新雲端全校廣播提示:", e);
    }

    try {
        const bcRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'systemBroadcasts', 'main');
        const snap = await getDoc(bcRef);
        if (snap.exists()) {
            const data = snap.data() || {};
            let broadcasts = Array.isArray(data.broadcasts) ? data.broadcasts : [];
            broadcasts = broadcasts.map(b => b.id === annId ? { ...b, active } : b);
            let current = data.current;
            if (current && current.id === annId) {
                current = { ...current, active };
            }
            await setDoc(bcRef, {
                broadcasts,
                current,
                active: current ? current.active : true,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        }
    } catch (e) {
        console.warn("更新 systemBroadcasts 狀態提示:", e);
    }
}

// ==========================================
// 各班聯絡簿與作業點收 (Parent Classes Data)
// 存儲路徑：parentClasses/{classCode} (線上開放公開讀取)
// ==========================================
export async function getClassParentData(accessCode) {
    if (!accessCode) return null;
    const cleanCode = String(accessCode).trim();
    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'parentClasses', cleanCode);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data();
        }
    } catch (e) {
        console.warn(`自 parentClasses 取得【${cleanCode}】聯絡簿資料失敗:`, e);
    }
    return null;
}
