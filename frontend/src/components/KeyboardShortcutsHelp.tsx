import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
    isOpen: boolean;
    onClose: () => void;
}

const shortcuts = [
    {
        category: 'Điều hướng', items: [
            { keys: ['↑', '↓'], description: 'Di chuyển giữa các email' },
            { keys: ['Enter'], description: 'Mở email đang chọn' },
            { keys: ['Escape'], description: 'Đóng modal / Bỏ chọn email' },
        ]
    },
    {
        category: 'Thao tác email', items: [
            { keys: ['Ctrl', 'C'], description: 'Soạn thư mới' },
            { keys: ['Ctrl', 'Enter'], description: 'Gửi thư (trong Compose)' },
            { keys: ['Ctrl', 'R'], description: 'Làm mới danh sách email' },
            { keys: ['Ctrl', 'S'], description: 'Đánh dấu sao email' },
            { keys: ['Ctrl', 'U'], description: 'Đánh dấu đã đọc/chưa đọc' },
        ]
    },
    {
        category: 'Khác', items: [
            { keys: ['Shift', '?'], description: 'Hiện bảng phím tắt này' },
        ]
    },
];

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--bg-primary)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-4 border-b"
                    style={{ borderColor: 'var(--border-primary)' }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                        >
                            <Keyboard size={20} style={{ color: 'var(--accent-primary)' }} />
                        </div>
                        <div>
                            <h2
                                className="font-semibold"
                                style={{ color: 'var(--text-primary)', fontSize: '16px' }}
                            >
                                Phím tắt
                            </h2>
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                                Thao tác nhanh với bàn phím
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-5 py-4 max-h-96 overflow-y-auto space-y-5">
                    {shortcuts.map((group) => (
                        <div key={group.category}>
                            <h3
                                className="text-xs font-semibold uppercase tracking-wider mb-3"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                {group.category}
                            </h3>
                            <div className="space-y-2">
                                {group.items.map((shortcut, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between py-2 px-3 rounded-lg"
                                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                                    >
                                        <span
                                            style={{ color: 'var(--text-secondary)', fontSize: '13px' }}
                                        >
                                            {shortcut.description}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {shortcut.keys.map((key, keyIdx) => (
                                                <React.Fragment key={keyIdx}>
                                                    <kbd
                                                        className="px-2 py-1 rounded text-xs font-medium"
                                                        style={{
                                                            backgroundColor: 'var(--bg-primary)',
                                                            border: '1px solid var(--border-primary)',
                                                            color: 'var(--text-primary)',
                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                        }}
                                                    >
                                                        {key}
                                                    </kbd>
                                                    {keyIdx < shortcut.keys.length - 1 && (
                                                        <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>+</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div
                    className="px-5 py-3 border-t text-center"
                    style={{ borderColor: 'var(--border-primary)' }}
                >
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                        Nhấn <kbd className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>Esc</kbd> để đóng
                    </span>
                </div>
            </div>
        </div>
    );
}

// Floating button to open keyboard shortcuts
export function KeyboardShortcutsButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="fixed bottom-6 right-6 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-40"
            style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'white',
            }}
            title="Phím tắt (Shift + ?)"
        >
            <Keyboard size={22} />
        </button>
    );
}
