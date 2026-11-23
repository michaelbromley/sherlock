import { describe, it, expect } from 'bun:test';
import { compareSemver } from './update';

describe('compareSemver', () => {
    it.each([
        ['1.9.1', '2.0.0', -1],
        ['2.0.0', '1.9.1', 1],
        ['2.0.0', '2.0.0', 0],
        ['v2.0.0', '2.0.0', 0],
        ['1.10.0', '1.9.1', 1],
        // A pre-release comes before its release, so a beta updates to the release
        ['2.0.0-beta.1', '2.0.0', -1],
        ['2.0.0', '2.0.0-beta.1', 1],
        // ...and after the release before it
        ['2.0.0-beta.1', '1.9.1', 1],
        ['2.0.0-beta.1', '2.0.0-beta.2', -1],
        ['2.0.0-beta.2', '2.0.0-beta.10', -1],
        ['2.0.0-alpha.1', '2.0.0-beta.1', -1],
        ['2.0.0-beta', '2.0.0-beta.1', -1],
        ['2.0.0-beta.1', '2.0.0-beta.1', 0],
    ])('%s against %s is %i', (a, b, expected) => {
        expect(compareSemver(a, b)).toBe(expected);
    });
});
