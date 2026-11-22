import { describe, it, expect } from 'bun:test';
import { runSteps, type DiagnosticCheck } from './index';

const check = (name: string, status: DiagnosticCheck['status']): DiagnosticCheck => ({ name, status, detail: name });

describe('runSteps', () => {
    it('runs every step when nothing fails, skipped checks included', async () => {
        const result = await runSteps([
            async () => [check('a', 'pass')],
            async () => [check('b', 'skip')],
            async () => [],
            async () => [check('c', 'pass')],
        ]);
        expect(result).toEqual({ ok: true, checks: [check('a', 'pass'), check('b', 'skip'), check('c', 'pass')] });
    });

    it('stops at the first failure, within a step and across steps', async () => {
        let laterRan = false;
        const result = await runSteps([
            async () => [check('a', 'pass'), check('b', 'fail'), check('c', 'pass')],
            async () => { laterRan = true; return [check('d', 'pass')]; },
        ]);
        expect(result).toEqual({ ok: false, checks: [check('a', 'pass'), check('b', 'fail')] });
        expect(laterRan).toBe(false);
    });

    it('reports a step that throws as a failure', async () => {
        const result = await runSteps([async () => { throw new Error('boom'); }, async () => [check('x', 'pass')]]);
        expect(result.ok).toBe(false);
        expect(result.checks).toEqual([{ name: 'unexpected error', status: 'fail', detail: 'boom' }]);
    });
});
