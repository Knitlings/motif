import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../../src/managers/history.js';
import { CONFIG } from '../../src/config.js';

describe('HistoryManager', () => {
  beforeEach(() => {
    // Reset HistoryManager state before each test
    HistoryManager.history = [];
    HistoryManager.index = -1;
  });

  describe('init', () => {
    it('should initialize with a state', () => {
      const initialState = { grid: [[0, 0], [0, 0]], colors: ['#000'] };
      HistoryManager.init(initialState);

      expect(HistoryManager.history).toHaveLength(1);
      expect(HistoryManager.index).toBe(0);
      expect(HistoryManager.current()).toEqual(initialState);
    });

    it('should deep clone the initial state', () => {
      const initialState = { grid: [[0, 0], [0, 0]], colors: ['#000'] };
      HistoryManager.init(initialState);

      expect(HistoryManager.current()).not.toBe(initialState);
      expect(HistoryManager.current().grid).not.toBe(initialState.grid);
    });
  });

  describe('save', () => {
    beforeEach(() => {
      HistoryManager.init({ value: 0 });
    });

    it('should add new state to history', () => {
      HistoryManager.save({ value: 1 });

      expect(HistoryManager.history).toHaveLength(2);
      expect(HistoryManager.index).toBe(1);
      expect(HistoryManager.current()).toEqual({ value: 1 });
    });

    it('should truncate future history when saving after undo', () => {
      HistoryManager.save({ value: 1 });
      HistoryManager.save({ value: 2 });
      HistoryManager.undo();
      HistoryManager.save({ value: 3 });

      expect(HistoryManager.history).toHaveLength(3);
      expect(HistoryManager.current()).toEqual({ value: 3 });
    });

    it('should deep clone saved state', () => {
      const state = { grid: [[1, 1], [1, 1]] };
      HistoryManager.save(state);

      expect(HistoryManager.current()).not.toBe(state);
      expect(HistoryManager.current().grid).not.toBe(state.grid);
    });
  });

  describe('undo', () => {
    beforeEach(() => {
      HistoryManager.init({ value: 0 });
      HistoryManager.save({ value: 1 });
      HistoryManager.save({ value: 2 });
    });

    it('should return previous state', () => {
      const result = HistoryManager.undo();

      expect(result).toEqual({ value: 1 });
      expect(HistoryManager.index).toBe(1);
    });

    it('should return null when cannot undo', () => {
      HistoryManager.undo();
      HistoryManager.undo();
      const result = HistoryManager.undo();

      expect(result).toBeNull();
      expect(HistoryManager.index).toBe(0);
    });

    it('should deep clone returned state', () => {
      const result = HistoryManager.undo();

      expect(result).not.toBe(HistoryManager.history[HistoryManager.index]);
    });
  });

  describe('redo', () => {
    beforeEach(() => {
      HistoryManager.init({ value: 0 });
      HistoryManager.save({ value: 1 });
      HistoryManager.save({ value: 2 });
      HistoryManager.undo();
    });

    it('should return next state', () => {
      const result = HistoryManager.redo();

      expect(result).toEqual({ value: 2 });
      expect(HistoryManager.index).toBe(2);
    });

    it('should return null when cannot redo', () => {
      HistoryManager.redo();
      const result = HistoryManager.redo();

      expect(result).toBeNull();
      expect(HistoryManager.index).toBe(2);
    });

    it('should deep clone returned state', () => {
      const result = HistoryManager.redo();

      expect(result).not.toBe(HistoryManager.history[HistoryManager.index]);
    });
  });

  describe('canUndo', () => {
    it('should return false at initial state', () => {
      HistoryManager.init({ value: 0 });

      expect(HistoryManager.canUndo()).toBe(false);
    });

    it('should return true after saving', () => {
      HistoryManager.init({ value: 0 });
      HistoryManager.save({ value: 1 });

      expect(HistoryManager.canUndo()).toBe(true);
    });

    it('should return false after undoing to beginning', () => {
      HistoryManager.init({ value: 0 });
      HistoryManager.save({ value: 1 });
      HistoryManager.undo();

      expect(HistoryManager.canUndo()).toBe(false);
    });
  });

  describe('canRedo', () => {
    it('should return false initially', () => {
      HistoryManager.init({ value: 0 });

      expect(HistoryManager.canRedo()).toBe(false);
    });

    it('should return false after saving', () => {
      HistoryManager.init({ value: 0 });
      HistoryManager.save({ value: 1 });

      expect(HistoryManager.canRedo()).toBe(false);
    });

    it('should return true after undo', () => {
      HistoryManager.init({ value: 0 });
      HistoryManager.save({ value: 1 });
      HistoryManager.undo();

      expect(HistoryManager.canRedo()).toBe(true);
    });

    it('should return false after save following undo', () => {
      HistoryManager.init({ value: 0 });
      HistoryManager.save({ value: 1 });
      HistoryManager.undo();
      HistoryManager.save({ value: 2 });

      expect(HistoryManager.canRedo()).toBe(false);
    });
  });

  describe('history size limit', () => {
    it('should enforce MAX_HISTORY_STATES limit', () => {
      HistoryManager.init({ value: 0 });

      // Add states beyond the limit
      for (let i = 1; i <= CONFIG.MAX_HISTORY_STATES + 10; i++) {
        HistoryManager.save({ value: i });
      }

      // Should only keep the most recent MAX_HISTORY_STATES
      expect(HistoryManager.history.length).toBe(CONFIG.MAX_HISTORY_STATES);
      expect(HistoryManager.index).toBe(CONFIG.MAX_HISTORY_STATES - 1);
    });

    it('should remove oldest states when exceeding limit', () => {
      HistoryManager.init({ value: 0 });

      // Add 10 states beyond the limit
      const totalStates = CONFIG.MAX_HISTORY_STATES + 10;
      for (let i = 1; i <= totalStates; i++) {
        HistoryManager.save({ value: i });
      }

      // Oldest state should be trimmed (value 0-10 should be gone)
      // First state in history should be value 11
      expect(HistoryManager.history[0].value).toBe(11);

      // Most recent state should still be accessible
      expect(HistoryManager.current().value).toBe(totalStates);
    });

    it('should preserve most recent states when trimming', () => {
      HistoryManager.init({ value: 0 });

      // Add states beyond the limit
      for (let i = 1; i <= CONFIG.MAX_HISTORY_STATES + 5; i++) {
        HistoryManager.save({ value: i });
      }

      // Should still be able to undo within the preserved history
      const currentValue = HistoryManager.current().value;

      for (let i = 0; i < 10; i++) {
        expect(HistoryManager.canUndo()).toBe(true);
        const undoneState = HistoryManager.undo();
        expect(undoneState.value).toBe(currentValue - i - 1);
      }
    });

    it('should not trim when under the limit', () => {
      HistoryManager.init({ value: 0 });

      // Add states under the limit
      const statesCount = Math.floor(CONFIG.MAX_HISTORY_STATES / 2);
      for (let i = 1; i <= statesCount; i++) {
        HistoryManager.save({ value: i });
      }

      // All states should be preserved (init + saves)
      expect(HistoryManager.history.length).toBe(statesCount + 1);

      // Should be able to undo all the way to the initial state
      for (let i = 0; i < statesCount; i++) {
        HistoryManager.undo();
      }
      expect(HistoryManager.current().value).toBe(0);
    });

    it('should handle trimming after undo and new save', () => {
      HistoryManager.init({ value: 0 });

      // Fill history to the limit
      for (let i = 1; i <= CONFIG.MAX_HISTORY_STATES; i++) {
        HistoryManager.save({ value: i });
      }

      // Undo a few times
      HistoryManager.undo();
      HistoryManager.undo();

      // Save new states beyond the limit
      HistoryManager.save({ value: 1000 });
      HistoryManager.save({ value: 1001 });

      // Should still respect the limit
      expect(HistoryManager.history.length).toBeLessThanOrEqual(CONFIG.MAX_HISTORY_STATES);
      expect(HistoryManager.current().value).toBe(1001);
    });

    it('should maintain correct index after trimming', () => {
      HistoryManager.init({ value: 0 });

      // Add states beyond the limit
      for (let i = 1; i <= CONFIG.MAX_HISTORY_STATES + 10; i++) {
        HistoryManager.save({ value: i });
      }

      // Index should point to the last element
      expect(HistoryManager.index).toBe(HistoryManager.history.length - 1);

      // Current should return the last saved state
      expect(HistoryManager.current().value).toBe(CONFIG.MAX_HISTORY_STATES + 10);
    });
  });
});
