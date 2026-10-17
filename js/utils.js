// 通用工具函數庫

export function triggerHaptic(type = 'light') {
    if ('vibrate' in navigator && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) {
        try {
            if (type === 'light') navigator.vibrate(10);
            else if (type === 'medium') navigator.vibrate(25);
            else if (type === 'heavy') navigator.vibrate([30, 20, 30]);
        } catch (e) {
            // ignore
        }
    }
}

export function showToast(message, type = 'info', duration = 3000) {
    triggerHaptic('light');
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgMap = {
        success: 'bg-emerald-600 text-white shadow-emerald-500/30',
        error: 'bg-rose-600 text-white shadow-rose-500/30',
        warning: 'bg-amber-500 text-stone-900 shadow-amber-500/30',
        info: 'bg-indigo-600 text-white shadow-indigo-500/30'
    };
    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-triangle-exclamation',
        warning: 'fa-circle-exclamation',
        info: 'fa-circle-info'
    };

    toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl font-bold text-xs sm:text-sm transform transition-all duration-300 translate-y-2 opacity-0 ${bgMap[type] || bgMap.info}`;
    toast.innerHTML = `
        <i class="fa-solid ${iconMap[type] || 'fa-circle-info'} text-base shrink-0"></i>
        <span class="flex-1 leading-snug">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function getTodayDateString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function safeCopyToClipboard(text) {
    triggerHaptic('medium');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
    } catch (e) {
        console.error("Copy failed", e);
    }
    document.body.removeChild(textArea);
    return Promise.resolve();
}

export function generateSecurePassword(length = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let res = '';
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
        res += chars[array[i] % chars.length];
    }
    return res;
}

export function exportToCSV(filename, rows) {
    triggerHaptic('light');
    const processRow = function (row) {
        let finalVal = '';
        for (let j = 0; j < row.length; j++) {
            let innerValue = row[j] === null || row[j] === undefined ? '' : row[j].toString();
            if (row[j] instanceof Date) {
                innerValue = row[j].toLocaleString();
            }
            let result = innerValue.replace(/"/g, '""');
            if (result.search(/("|,|\n)/g) >= 0)
                result = '"' + result + '"';
            if (j > 0)
                finalVal += ',';
            finalVal += result;
        }
        return finalVal + '\n';
    };

    let csvFile = '\uFEFF'; // BOM for UTF-8 in Excel
    for (let i = 0; i < rows.length; i++) {
        csvFile += processRow(rows[i]);
    }

    const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
