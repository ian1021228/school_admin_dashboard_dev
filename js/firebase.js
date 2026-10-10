// Firebase 初始化與資料庫互動模組
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
    collection, 
    query, 
    where, 
    getDocs, 
    onSnapshot, 
    updateDoc, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { firebaseConfig, globalAppId, SUPER_ADMIN_EMAIL, DEFAULT_SCHOOL } from './constants.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
    onAuthStateChanged,
    signInWithPopup,
    signOut,
    signInWithEmailAndPassword
};

// Google 登入 Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ==========================================
// 學校租戶 (School Tenants - 最高管理端管理)
// ==========================================
export async function getSchoolTenants() {
    try {
        const snap = await getDocs(collection(db, 'artifacts', globalAppId, 'public', 'data', 'schoolTenants'));
        const list = [];
        snap.forEach(docSnap => {
            list.push({ id: docSnap.id, ...docSnap.data() });
        });
        if (list.length === 0) {
            // 自動初始化預設學校租戶
            await saveSchoolTenant(DEFAULT_SCHOOL);
            return [DEFAULT_SCHOOL];
        }
        return list;
    } catch (err) {
        console.warn("無法自雲端取得學校清單，回傳本地快取", err);
        return [DEFAULT_SCHOOL];
    }
}

export async function saveSchoolTenant(schoolData) {
    const docId = schoolData.id || `school_${Date.now()}`;
    const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'schoolTenants', docId);
    const payload = {
        ...schoolData,
        id: docId,
        updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, payload, { merge: true });
    return payload;
}

export async function deleteSchoolTenant(schoolId) {
    const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'schoolTenants', schoolId);
    await deleteDoc(docRef);
}

// ==========================================
// 全校班級帳密 (School Classes - 學校管理端派發)
// ==========================================
export async function getSchoolClasses(schoolId) {
    try {
        const classesRef = collection(db, 'artifacts', globalAppId, 'public', 'data', 'schoolClasses');
        const q = query(classesRef, where('schoolId', '==', schoolId));
        const snap = await getDocs(q);
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        return list;
    } catch (err) {
        console.warn("取得學校班級清單失敗", err);
        return [];
    }
}

export async function saveSchoolClass(classData) {
    const docId = `${classData.schoolId}_${classData.classCode}`;
    const payload = {
        ...classData,
        id: docId,
        updatedAt: new Date().toISOString()
    };

    // 1. 同步儲存至本地快取
    try {
        const localKey = `school_classes_${classData.schoolId}`;
        const cached = JSON.parse(localStorage.getItem(localKey) || '[]');
        const idx = cached.findIndex(c => c.classCode === classData.classCode);
        if (idx >= 0) cached[idx] = { ...cached[idx], ...payload };
        else cached.push(payload);
        localStorage.setItem(localKey, JSON.stringify(cached));
    } catch (e) {}

    // 2. 寫入雲端 schoolClasses
    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'schoolClasses', docId);
        await setDoc(docRef, payload, { merge: true });
    } catch (e) {
        console.warn("寫入雲端 schoolClasses 未完成，已維持本地快取:", e);
    }

    // 3. 同步到 boundAccounts 使得教師端能以此帳密登入並自動載入該班級
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
            console.warn("同步至 boundAccounts 警告:", e);
        }
    }

    return payload;
}

export async function deleteSchoolClass(schoolId, classCode) {
    const docId = `${schoolId}_${classCode}`;
    try {
        const localKey = `school_classes_${schoolId}`;
        const cached = JSON.parse(localStorage.getItem(localKey) || '[]');
        const filtered = cached.filter(c => c.classCode !== classCode);
        localStorage.setItem(localKey, JSON.stringify(filtered));
    } catch (e) {}

    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'schoolClasses', docId);
        await deleteDoc(docRef);
    } catch (e) {
        console.warn("雲端刪除未完成，已從本地快取移除:", e);
    }
}

// ==========================================
// 晨間出缺席看板 (Morning Attendance)
// ==========================================
export async function getMorningAttendance(schoolId, dateStr) {
    try {
        const attRef = collection(db, 'artifacts', globalAppId, 'public', 'data', 'morningAttendance');
        const q = query(attRef, where('schoolId', '==', schoolId), where('date', '==', dateStr));
        const snap = await getDocs(q);
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        return list;
    } catch (err) {
        console.warn("無法取得晨間出缺席資料", err);
        return [];
    }
}

export async function saveMorningAttendance(record) {
    const docId = `${record.schoolId}_${record.classCode}_${record.date}`;
    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'morningAttendance', docId);
        await setDoc(docRef, {
            ...record,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.warn("寫入晨間出缺席資料未完成:", e);
    }
}

// ==========================================
// 線上行政抽查與電子核章 (Inspections & Stamps)
// ==========================================
export async function getAdminInspections(schoolId) {
    try {
        const snap = await getDocs(query(
            collection(db, 'artifacts', globalAppId, 'public', 'data', 'adminInspections'),
            where('schoolId', '==', schoolId)
        ));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        return list.sort((a, b) => new Date(b.stampedAt || 0) - new Date(a.stampedAt || 0));
    } catch (e) {
        console.warn("取得行政抽查資料失敗", e);
        return [];
    }
}

export async function saveAdminInspection(inspectionData) {
    const docId = inspectionData.id || `insp_${Date.now()}`;
    const payload = {
        ...inspectionData,
        id: docId,
        stampedAt: new Date().toISOString()
    };
    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'adminInspections', docId);
        await setDoc(docRef, payload, { merge: true });
    } catch (e) {
        console.warn("寫入行政抽查資料未完成:", e);
    }
    return payload;
}

// ==========================================
// 全校全校廣播 (Campus Safety Announcements)
// ==========================================
export async function getCampusAnnouncements(schoolId) {
    const localKey = `campus_announcements_${schoolId}`;
    let cached = [];
    try {
        cached = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}

    try {
        const snap = await getDocs(query(
            collection(db, 'artifacts', globalAppId, 'public', 'data', 'campusAnnouncements'),
            where('schoolId', '==', schoolId)
        ));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        if (list.length > 0) {
            localStorage.setItem(localKey, JSON.stringify(list));
            return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }
    } catch (e) {
        console.warn("取得全校廣播失敗，使用本地快取", e);
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

    // 1. 本地快取
    try {
        const localKey = `campus_announcements_${announcementData.schoolId}`;
        const cached = JSON.parse(localStorage.getItem(localKey) || '[]');
        const idx = cached.findIndex(b => b.id === docId);
        if (idx >= 0) cached[idx] = { ...cached[idx], ...payload };
        else cached.unshift(payload);
        localStorage.setItem(localKey, JSON.stringify(cached));
    } catch (e) {}

    // 2. 雲端同步
    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'campusAnnouncements', docId);
        await setDoc(docRef, payload, { merge: true });
    } catch (e) {
        console.warn("寫入雲端全校廣播警告:", e);
    }
    return payload;
}

export async function toggleCampusAnnouncement(annId, active, fallbackData = null) {
    const payload = {
        active,
        ...(fallbackData || {}),
        updatedAt: new Date().toISOString()
    };

    // 1. 本地快取更新
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('campus_announcements_')) {
                const cached = JSON.parse(localStorage.getItem(key) || '[]');
                const idx = cached.findIndex(b => b.id === annId);
                if (idx >= 0) {
                    cached[idx] = { ...cached[idx], ...payload };
                    localStorage.setItem(key, JSON.stringify(cached));
                }
            }
        }
        if (fallbackData && fallbackData.schoolId) {
            const localKey = `campus_announcements_${fallbackData.schoolId}`;
            const cached = JSON.parse(localStorage.getItem(localKey) || '[]');
            const idx = cached.findIndex(b => b.id === annId);
            if (idx >= 0) {
                cached[idx] = { ...cached[idx], ...payload };
            } else {
                cached.unshift({ ...fallbackData, ...payload, id: annId });
            }
            localStorage.setItem(localKey, JSON.stringify(cached));
        }
    } catch (e) {}

    // 2. 雲端同步
    try {
        const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'campusAnnouncements', annId);
        await setDoc(docRef, payload, { merge: true });
    } catch (e) {
        console.warn("更新雲端全校廣播警告:", e);
    }
}
