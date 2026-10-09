// 系統全域常數與 Firebase 配置
export const SUPER_ADMIN_EMAIL = 'ianw.solar@gmail.com';

// 測試版獨立 Firebase Firestore 命名空間（與正式版 100% 實體隔離）
export const globalAppId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'homework-checker-dev';

export const firebaseConfig = {
    apiKey: "AIzaSyDuBAZ5hEcrhpYt-XjhiXfi-wuow0Cq83A",
    authDomain: "cheker-barcode.firebaseapp.com",
    projectId: "cheker-barcode",
    storageBucket: "cheker-barcode.firebasestorage.app",
    messagingSenderId: "1093592859159",
    appId: "1:1093592859159:web:40c0741defbb074e4ad252"
};

// 預設測試學校資料
export const DEFAULT_SCHOOL = {
    id: 'shs',
    name: '高雄市立七賢國中',
    code: 'SHS_KAOHSIUNG',
    adminUsername: 'antigravity',
    adminPassword: 'password123',
    contactPerson: '王禹硯 資訊組長',
    phone: '07-211-0561',
    address: '高雄市前金區七賢二路397號',
    createdAt: '2026-09-01T08:00:00Z',
    status: 'active'
};

// 處室核章設定
export const DEPARTMENTS = [
    { id: 'academic', name: '教務處', title: '教學組長 / 教務主任', stampText: '教務處 查訖' },
    { id: 'discipline', name: '學務處', title: '生教組長 / 學務主任', stampText: '學務處 查訖' },
    { id: 'counseling', name: '輔導處', title: '輔導組長 / 輔導主任', stampText: '輔導處 查訖' },
    { id: 'principal', name: '校長室', title: '校長室 督導核定', stampText: '校長 閱訖' }
];
