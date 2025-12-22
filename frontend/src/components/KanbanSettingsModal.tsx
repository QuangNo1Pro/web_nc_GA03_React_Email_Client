/**
 * KanbanSettingsModal Component
 * Modal for managing Kanban board columns
 * FEATURE III: Dynamic Kanban Configuration
 * 
 * Features:
 * - View all current columns
 * - Create new columns with label/color selection
 * - Rename existing columns
 * - Delete non-system columns
 * - Reset to default configuration
 */

import React, { useState } from 'react';
import {
    KanbanColumnConfig,
    VALID_COLUMN_LABELS,
    COLUMN_COLORS,
    SYSTEM_ONLY_LABELS,
} from '../utils/kanbanConstants';

interface KanbanSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    columns: KanbanColumnConfig[];
    onAddColumn: (column: Omit<KanbanColumnConfig, 'id'>) => boolean;
    onUpdateColumn: (id: string, updates: Partial<KanbanColumnConfig>) => boolean;
    onDeleteColumn: (id: string) => boolean;
    onReorderColumns: (fromIndex: number, toIndex: number) => void;
    onResetToDefaults: () => void;
}

const KanbanSettingsModal: React.FC<KanbanSettingsModalProps> = ({
    isOpen,
    onClose,
    columns,
    onAddColumn,
    onUpdateColumn,
    onDeleteColumn,
    onReorderColumns,
    onResetToDefaults,
}) => {
    // State for adding new column
    const [isAddingColumn, setIsAddingColumn] = useState(false);
    const [newColumnTitle, setNewColumnTitle] = useState('');
    const [newColumnLabel, setNewColumnLabel] = useState('STARRED');
    const [newColumnColor, setNewColumnColor] = useState('border-l-purple-500');

    // State for editing column
    const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');

    // State for delete confirmation
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleAddColumn = () => {
        const success = onAddColumn({
            title: newColumnTitle.trim(),
            color: newColumnColor,
            gmailLabel: newColumnLabel,
        });

        if (success) {
            setNewColumnTitle('');
            setNewColumnLabel('STARRED');
            setNewColumnColor('border-l-purple-500');
            setIsAddingColumn(false);
        }
    };

    const handleStartEdit = (column: KanbanColumnConfig) => {
        setEditingColumnId(column.id);
        setEditingTitle(column.title);
    };

    const handleSaveEdit = () => {
        if (editingColumnId) {
            const success = onUpdateColumn(editingColumnId, { title: editingTitle.trim() });
            if (success) {
                setEditingColumnId(null);
                setEditingTitle('');
            }
        }
    };

    const handleCancelEdit = () => {
        setEditingColumnId(null);
        setEditingTitle('');
    };

    const handleDeleteColumn = (id: string) => {
        onDeleteColumn(id);
        setDeleteConfirmId(null);
    };

    const handleMoveUp = (index: number) => {
        if (index > 0) {
            onReorderColumns(index, index - 1);
        }
    };

    const handleMoveDown = (index: number) => {
        if (index < columns.length - 1) {
            onReorderColumns(index, index + 1);
        }
    };

    const handleResetToDefaults = () => {
        onResetToDefaults();
    };

    const getLabelDisplayName = (labelId: string) => {
        const label = VALID_COLUMN_LABELS.find(l => l.id === labelId);
        return label?.name || labelId;
    };

    const getColorPreview = (colorClass: string) => {
        const color = COLUMN_COLORS.find(c => c.class === colorClass);
        return color?.preview || '#6b7280';
    };

    // Get used labels and colors to disable them in add form
    const usedLabels = columns.map(col => col.gmailLabel);
    const usedColors = columns.map(col => col.color);

    // Find first available label and color for new columns
    const availableLabels = VALID_COLUMN_LABELS.filter(l => !usedLabels.includes(l.id));
    const availableColors = COLUMN_COLORS.filter(c => !usedColors.includes(c.class));

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl shadow-2xl flex flex-col"
                    style={{
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                    }}
                >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between px-6 py-4 border-b"
                        style={{ borderColor: 'var(--border-primary)' }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--accent-primary)' }}>
                                settings
                            </span>
                            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                Kanban Settings
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        {/* Info Banner */}
                        <div
                            className="mb-4 p-3 rounded-lg flex items-start gap-2"
                            style={{ backgroundColor: 'var(--bg-secondary)' }}
                        >
                            <span className="material-symbols-outlined text-blue-500 flex-shrink-0">info</span>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Configure your Kanban columns and their Gmail label mappings.
                                System labels (<strong>{SYSTEM_ONLY_LABELS.join(', ')}</strong>) cannot be used as they are managed by Gmail.
                            </p>
                        </div>

                        {/* Column List */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                                Columns ({columns.length})
                            </h3>

                            {columns.map((column, index) => (
                                <div
                                    key={column.id}
                                    className="flex items-center gap-3 p-3 rounded-lg border"
                                    style={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        borderColor: 'var(--border-primary)',
                                    }}
                                >
                                    {/* Color indicator */}
                                    <div
                                        className="w-4 h-8 rounded-sm flex-shrink-0"
                                        style={{ backgroundColor: getColorPreview(column.color) }}
                                    />

                                    {/* Reorder buttons */}
                                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                                        <button
                                            onClick={() => handleMoveUp(index)}
                                            disabled={index === 0}
                                            className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                            style={{ color: 'var(--text-secondary)' }}
                                            title="Move up"
                                        >
                                            <span className="material-symbols-outlined text-sm">expand_less</span>
                                        </button>
                                        <button
                                            onClick={() => handleMoveDown(index)}
                                            disabled={index === columns.length - 1}
                                            className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                            style={{ color: 'var(--text-secondary)' }}
                                            title="Move down"
                                        >
                                            <span className="material-symbols-outlined text-sm">expand_more</span>
                                        </button>
                                    </div>

                                    {/* Column info */}
                                    <div className="flex-1 min-w-0">
                                        {editingColumnId === column.id ? (
                                            <input
                                                type="text"
                                                value={editingTitle}
                                                onChange={(e) => setEditingTitle(e.target.value)}
                                                className="w-full px-2 py-1 rounded border outline-none focus:ring-2 focus:ring-blue-400"
                                                style={{
                                                    backgroundColor: 'var(--bg-primary)',
                                                    borderColor: 'var(--border-primary)',
                                                    color: 'var(--text-primary)',
                                                }}
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEdit();
                                                    if (e.key === 'Escape') handleCancelEdit();
                                                }}
                                            />
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                                        {column.title}
                                                    </span>
                                                    {column.isSystemColumn && (
                                                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                                            System
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                                    Label: {getLabelDisplayName(column.gmailLabel)}
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {editingColumnId === column.id ? (
                                            <>
                                                <button
                                                    onClick={handleSaveEdit}
                                                    className="p-1.5 rounded text-green-600 hover:bg-green-100 dark:hover:bg-green-900 transition"
                                                    title="Save"
                                                >
                                                    <span className="material-symbols-outlined text-lg">check</span>
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                                    title="Cancel"
                                                >
                                                    <span className="material-symbols-outlined text-lg">close</span>
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleStartEdit(column)}
                                                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                                    style={{ color: 'var(--text-secondary)' }}
                                                    title="Rename"
                                                >
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </button>
                                                {!column.isSystemColumn && (
                                                    deleteConfirmId === column.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleDeleteColumn(column.id)}
                                                                className="p-1.5 rounded text-red-600 hover:bg-red-100 dark:hover:bg-red-900 transition"
                                                                title="Confirm Delete"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">check</span>
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteConfirmId(null)}
                                                                className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                                                title="Cancel"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">close</span>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setDeleteConfirmId(column.id)}
                                                            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900 transition"
                                                            style={{ color: 'var(--error)' }}
                                                            title="Delete"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">delete</span>
                                                        </button>
                                                    )
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add Column Section */}
                        {isAddingColumn ? (
                            <div
                                className="mt-4 p-4 rounded-lg border-2 border-dashed"
                                style={{ borderColor: 'var(--accent-primary)' }}
                            >
                                <h4 className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                                    Add New Column
                                </h4>

                                <div className="space-y-3">
                                    {/* Title input */}
                                    <div>
                                        <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                                            Column Name
                                        </label>
                                        <input
                                            type="text"
                                            value={newColumnTitle}
                                            onChange={(e) => setNewColumnTitle(e.target.value)}
                                            placeholder="e.g., Review, Blocked, Testing..."
                                            className="w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-400"
                                            style={{
                                                backgroundColor: 'var(--bg-primary)',
                                                borderColor: 'var(--border-primary)',
                                                color: 'var(--text-primary)',
                                            }}
                                        />
                                    </div>

                                    {/* Label selection */}
                                    <div>
                                        <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                                            Gmail Label Mapping
                                        </label>
                                        <select
                                            value={newColumnLabel}
                                            onChange={(e) => setNewColumnLabel(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-400"
                                            style={{
                                                backgroundColor: 'var(--bg-primary)',
                                                borderColor: 'var(--border-primary)',
                                                color: 'var(--text-primary)',
                                            }}
                                        >
                                            {VALID_COLUMN_LABELS.map((label) => {
                                                const isUsed = usedLabels.includes(label.id);
                                                return (
                                                    <option
                                                        key={label.id}
                                                        value={label.id}
                                                        disabled={isUsed}
                                                        style={{ color: isUsed ? '#999' : 'inherit' }}
                                                    >
                                                        {label.name} - {label.description}{isUsed ? ' (Used)' : ''}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>

                                    {/* Color selection */}
                                    <div>
                                        <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                                            Column Color
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {COLUMN_COLORS.map((color) => {
                                                const isUsed = usedColors.includes(color.class);
                                                return (
                                                    <button
                                                        key={color.id}
                                                        onClick={() => !isUsed && setNewColumnColor(color.class)}
                                                        disabled={isUsed}
                                                        className={`w-8 h-8 rounded-full border-2 transition-transform relative ${newColumnColor === color.class
                                                            ? 'scale-110 border-gray-800 dark:border-white'
                                                            : isUsed
                                                                ? 'opacity-40 cursor-not-allowed border-transparent'
                                                                : 'border-transparent hover:scale-105'
                                                            }`}
                                                        style={{ backgroundColor: color.preview }}
                                                        title={isUsed ? `${color.id} (used)` : color.id}
                                                    >
                                                        {isUsed && (
                                                            <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">✓</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={handleAddColumn}
                                            disabled={!newColumnTitle.trim()}
                                            className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={{ backgroundColor: 'var(--accent-primary)' }}
                                        >
                                            Add Column
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsAddingColumn(false);
                                                setNewColumnTitle('');
                                            }}
                                            className="px-4 py-2 rounded-lg font-medium transition"
                                            style={{
                                                backgroundColor: 'var(--bg-secondary)',
                                                color: 'var(--text-primary)',
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    // Auto-select first available label and color
                                    const firstAvailableLabel = VALID_COLUMN_LABELS.find(l => !usedLabels.includes(l.id));
                                    const firstAvailableColor = COLUMN_COLORS.find(c => !usedColors.includes(c.class));
                                    if (firstAvailableLabel) setNewColumnLabel(firstAvailableLabel.id);
                                    if (firstAvailableColor) setNewColumnColor(firstAvailableColor.class);
                                    setIsAddingColumn(true);
                                }}
                                disabled={availableLabels.length === 0}
                                className="mt-4 w-full p-3 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    borderColor: 'var(--border-primary)',
                                    color: 'var(--text-secondary)',
                                }}
                            >
                                <span className="material-symbols-outlined">add</span>
                                Add Column
                            </button>
                        )}
                    </div>

                    {/* Footer */}
                    <div
                        className="flex items-center justify-between px-6 py-4 border-t"
                        style={{ borderColor: 'var(--border-primary)' }}
                    >
                        <button
                            onClick={handleResetToDefaults}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition hover:bg-gray-100 dark:hover:bg-gray-700"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            Reset to Defaults
                        </button>

                        <button
                            onClick={onClose}
                            className="px-6 py-2 rounded-lg font-medium text-white transition"
                            style={{ backgroundColor: 'var(--accent-primary)' }}
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default KanbanSettingsModal;
