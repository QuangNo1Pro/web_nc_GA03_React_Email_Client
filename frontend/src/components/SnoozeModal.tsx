/**
 * FEATURE III: Snooze Modal Component
 * 
 * Allows users to snooze emails with quick options or custom datetime
 * Integrates with existing Kanban workflow
 */

import React, { useState } from 'react';
import { Email } from '../types/email';

interface SnoozeModalProps {
  email: Email;
  isOpen: boolean;
  onClose: () => void;
  onSnooze: (snoozedUntil: string, simulate: boolean) => void;
}

const SnoozeModal: React.FC<SnoozeModalProps> = ({ email, isOpen, onClose, onSnooze }) => {
  const [customTime, setCustomTime] = useState('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  if (!isOpen) return null;

  // Quick snooze options
  const quickOptions = [
    {
      label: '30 seconds',
      getValue: () => {
        const date = new Date();
        date.setSeconds(date.getSeconds() + 30);
        return { time: date.toISOString(), simulate: true };
      },
    },
    {
      label: '1 hour',
      getValue: () => {
        const date = new Date();
        date.setHours(date.getHours() + 1);
        return { time: date.toISOString(), simulate: false };
      },
    },
    {
      label: 'Tomorrow 9 AM',
      getValue: () => {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(9, 0, 0, 0);
        return { time: date.toISOString(), simulate: false };
      },
    },
    {
      label: 'Next Monday 9 AM',
      getValue: () => {
        const date = new Date();
        const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
        date.setDate(date.getDate() + daysUntilMonday);
        date.setHours(9, 0, 0, 0);
        return { time: date.toISOString(), simulate: false };
      },
    },
  ];

  const handleQuickSnooze = (option: typeof quickOptions[0]) => {
    const { time, simulate } = option.getValue();
    onSnooze(time, simulate);
    onClose();
  };

  const handleCustomSnooze = () => {
    if (!customTime) {
      alert('Please select a date and time');
      return;
    }

    const selectedDate = new Date(customTime);
    if (selectedDate <= new Date()) {
      alert('Snooze time must be in the future');
      return;
    }

    onSnooze(selectedDate.toISOString(), false);
    onClose();
  };

  // Get minimum datetime (now + 1 minute)
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    return now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-labelledby="snooze-modal-title"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-2xl">
              schedule
            </span>
            <h2 id="snooze-modal-title" className="text-lg font-bold text-gray-900">
              Snooze Email
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Email Info */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-900 truncate">{email.subject}</p>
          <p className="text-xs text-gray-600 truncate">
            From: {email.sender.split('<')[0].trim()}
          </p>
        </div>

        {/* Quick Options */}
        {!showCustomPicker && (
          <div className="space-y-2 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Quick Snooze:</p>
            {quickOptions.map((option) => (
              <button
                key={option.label}
                onClick={() => handleQuickSnooze(option)}
                className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors border border-gray-200 hover:border-blue-300"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {/* Custom Picker */}
        {showCustomPicker && (
          <div className="mb-4">
            <label htmlFor="custom-snooze-time" className="block text-sm font-medium text-gray-700 mb-2">
              Pick custom date & time:
            </label>
            <input
              id="custom-snooze-time"
              type="datetime-local"
              min={getMinDateTime()}
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleCustomSnooze}
              className="w-full mt-3 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Confirm Snooze
            </button>
          </div>
        )}

        {/* Toggle Custom Picker */}
        <button
          onClick={() => setShowCustomPicker(!showCustomPicker)}
          className="w-full px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
        >
          {showCustomPicker ? '← Back to Quick Options' : 'Pick Custom Date & Time →'}
        </button>

        {/* Cancel */}
        <button
          onClick={onClose}
          className="w-full mt-3 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default SnoozeModal;
