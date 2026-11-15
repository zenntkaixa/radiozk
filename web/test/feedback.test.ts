import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { FEEDBACK_URL, shouldAskFeedback } from '../src/feedback.ts';

beforeEach(() => localStorage.clear());

describe('feedback ask', () => {
  it('waits for three liked songs and asks only once per browser', () => {
    expect(shouldAskFeedback(1)).toBe(false);
    expect(shouldAskFeedback(2)).toBe(false);
    expect(shouldAskFeedback(3)).toBe(true);
    expect(shouldAskFeedback(4)).toBe(false);
  });

  it('never asks when it cannot remember having asked', () => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
    try {
      expect(shouldAskFeedback(5)).toBe(false);
    } finally {
      Storage.prototype.setItem = real;
    }
  });
});

describe('feedback link', () => {
  it('opens the issue chooser of this repo, which has both issue forms', () => {
    expect(FEEDBACK_URL).toBe('https://github.com/zenntkaixa/radiozk/issues/new/choose');
    const dir = resolve(import.meta.dirname, '..', '..', '.github', 'ISSUE_TEMPLATE');
    const forms = readdirSync(dir).filter((f) => f.endsWith('.yml'));
    expect(forms.sort()).toEqual(['feedback.yml', 'problem.yml']);
    for (const f of forms) expect(readFileSync(resolve(dir, f), 'utf8')).toMatch(/^name: .+\n.*description:/s);
  });
});
