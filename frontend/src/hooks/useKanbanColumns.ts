/**
 * useKanbanColumns Hook
 * Manages dynamic Kanban column configuration with localStorage persistence
 * FEATURE III: Dynamic Kanban Configuration
 */

import { useState, useEffect, useCallback } from 'react';
import {
    KanbanColumnConfig,
    DEFAULT_COLUMNS,
    KANBAN_CONFIG_STORAGE_KEY,
    isValidColumnLabel,
    SYSTEM_ONLY_LABELS,
} from '../utils/kanbanConstants';
import toast from 'react-hot-toast';

interface UseKanbanColumnsReturn {
    columns: KanbanColumnConfig[];
    addColumn: (column: Omit<KanbanColumnConfig, 'id'>) => boolean;
    updateColumn: (id: string, updates: Partial<KanbanColumnConfig>) => boolean;
    deleteColumn: (id: string) => boolean;
    reorderColumns: (fromIndex: number, toIndex: number) => void;
    resetToDefaults: () => void;
    isLoading: boolean;
}

/**
 * Generate unique column ID
 */
const generateColumnId = (): string => {
    return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Load column configuration from localStorage
 */
const loadConfig = (): KanbanColumnConfig[] | null => {
    try {
        const stored = localStorage.getItem(KANBAN_CONFIG_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Validate the parsed config
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (error) {
        console.error('[useKanbanColumns] Error loading config:', error);
    }
    return null;
};

/**
 * Save column configuration to localStorage
 */
const saveConfig = (columns: KanbanColumnConfig[]): void => {
    try {
        localStorage.setItem(KANBAN_CONFIG_STORAGE_KEY, JSON.stringify(columns));
        console.log('[useKanbanColumns] Config saved:', columns);
    } catch (error) {
        console.error('[useKanbanColumns] Error saving config:', error);
    }
};

export const useKanbanColumns = (): UseKanbanColumnsReturn => {
    const [columns, setColumns] = useState<KanbanColumnConfig[]>(DEFAULT_COLUMNS);
    const [isLoading, setIsLoading] = useState(true);

    // Load config on mount
    useEffect(() => {
        const savedConfig = loadConfig();
        if (savedConfig) {
            console.log('[useKanbanColumns] Loaded saved config:', savedConfig);
            setColumns(savedConfig);
        } else {
            console.log('[useKanbanColumns] Using default columns');
        }
        setIsLoading(false);
    }, []);

    // Save config whenever columns change (after initial load)
    useEffect(() => {
        if (!isLoading) {
            saveConfig(columns);
        }
    }, [columns, isLoading]);

    /**
     * Add a new column
     * @returns true if successful, false if validation failed
     */
    const addColumn = useCallback((column: Omit<KanbanColumnConfig, 'id'>): boolean => {
        // Validate label
        if (!isValidColumnLabel(column.gmailLabel)) {
            const systemLabels = SYSTEM_ONLY_LABELS.join(', ');
            toast.error(`Cannot use "${column.gmailLabel}" - it's a system-managed label. System labels: ${systemLabels}`, {
                duration: 4000,
            });
            return false;
        }

        // Validate title
        if (!column.title.trim()) {
            toast.error('Column title cannot be empty');
            return false;
        }

        // Check for duplicate title
        const duplicateTitle = columns.some(
            c => c.title.toLowerCase() === column.title.toLowerCase()
        );
        if (duplicateTitle) {
            toast.error(`Column "${column.title}" already exists`);
            return false;
        }

        const newColumn: KanbanColumnConfig = {
            ...column,
            id: generateColumnId(),
            isSystemColumn: false,
        };

        setColumns(prev => [...prev, newColumn]);
        toast.success(`Column "${column.title}" created`);
        return true;
    }, [columns]);

    /**
     * Update an existing column
     */
    const updateColumn = useCallback((id: string, updates: Partial<KanbanColumnConfig>): boolean => {
        const columnIndex = columns.findIndex(c => c.id === id);
        if (columnIndex === -1) {
            toast.error('Column not found');
            return false;
        }

        // Validate label if being updated
        if (updates.gmailLabel && !isValidColumnLabel(updates.gmailLabel)) {
            toast.error(`Cannot use "${updates.gmailLabel}" - it's a system-managed label`);
            return false;
        }

        // Validate title if being updated
        if (updates.title !== undefined && !updates.title.trim()) {
            toast.error('Column title cannot be empty');
            return false;
        }

        // Check for duplicate title
        if (updates.title) {
            const duplicateTitle = columns.some(
                c => c.id !== id && c.title.toLowerCase() === updates.title!.toLowerCase()
            );
            if (duplicateTitle) {
                toast.error(`Column "${updates.title}" already exists`);
                return false;
            }
        }

        setColumns(prev => prev.map(col =>
            col.id === id ? { ...col, ...updates } : col
        ));
        toast.success('Column updated');
        return true;
    }, [columns]);

    /**
     * Delete a column
     */
    const deleteColumn = useCallback((id: string): boolean => {
        const column = columns.find(c => c.id === id);

        if (!column) {
            toast.error('Column not found');
            return false;
        }

        if (column.isSystemColumn) {
            toast.error(`Cannot delete system column "${column.title}"`);
            return false;
        }

        if (columns.length <= 1) {
            toast.error('Cannot delete the last column');
            return false;
        }

        setColumns(prev => prev.filter(c => c.id !== id));
        toast.success(`Column "${column.title}" deleted`);
        return true;
    }, [columns]);

    /**
     * Reorder columns
     */
    const reorderColumns = useCallback((fromIndex: number, toIndex: number): void => {
        setColumns(prev => {
            const newColumns = [...prev];
            const [removed] = newColumns.splice(fromIndex, 1);
            newColumns.splice(toIndex, 0, removed);
            return newColumns;
        });
    }, []);

    /**
     * Reset to default columns
     */
    const resetToDefaults = useCallback((): void => {
        setColumns([...DEFAULT_COLUMNS]);
        toast.success('Columns reset to defaults');
    }, []);

    return {
        columns,
        addColumn,
        updateColumn,
        deleteColumn,
        reorderColumns,
        resetToDefaults,
        isLoading,
    };
};

export default useKanbanColumns;
