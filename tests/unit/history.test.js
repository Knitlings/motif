import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../../src/managers/history.js';

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
});
