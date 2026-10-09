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
    const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'schoolClasses', docId);
    const payload = {
        ...classData,
        id: docId,
        updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, payload, { merge: true });

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
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            console.error("同步至 boundAccounts 失敗:", e);
        }
    }

    return payload;
}

export async function deleteSchoolClass(schoolId, classCode) {
    const docId = `${schoolId}_${classCode}`;
    const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'schoolClasses', docId);
    await deleteDoc(docRef);
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
    const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'morningAttendance', docId);
    await setDoc(docRef, {
        ...record,
        updatedAt: new Date().toISOString()
    }, { merge: true });
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
    const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'adminInspections', docId);
    const payload = {
        ...inspectionData,
        id: docId,
        stampedAt: new Date().toISOString()
    };
    await setDoc(docRef, payload, { merge: true });
    return payload;
}

// ==========================================
// 全校校安廣播 (Campus Safety Announcements)
// ==========================================
export async function getCampusAnnouncements(schoolId) {
    try {
        const snap = await getDocs(query(
            collection(db, 'artifacts', globalAppId, 'public', 'data', 'campusAnnouncements'),
            where('schoolId', '==', schoolId)
        ));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } catch (e) {
        console.warn("取得校安廣播失敗", e);
        return [];
    }
}

export async function saveCampusAnnouncement(announcementData) {
    const docId = announcementData.id || `ann_${Date.now()}`;
    const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'campusAnnouncements', docId);
    const payload = {
        ...announcementData,
        id: docId,
        createdAt: new Date().toISOString()
    };
    await setDoc(docRef, payload, { merge: true });
    return payload;
}

export async function toggleCampusAnnouncement(annId, active) {
    const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'campusAnnouncements', annId);
    await updateDoc(docRef, { active });
}
