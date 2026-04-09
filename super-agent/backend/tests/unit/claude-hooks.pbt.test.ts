/**
 * Property-based tests for Claude Security Hooks
 *
 * Feature: claude-agent-sdk-chat
 * Property 10: Dangerous command detection
 * Property 11: Skill access control enforcement
 * Validates: Requirements 6.2, 6.3
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  DANGEROUS_PATTERNS,
  dangerousCommandBlocker,
  createSkillAccessChecker,
  type HookInput,
} from '../../src/services/claude-hooks.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal HookInput wrapping tool_input. */
function makeInput(toolInput: Record<string, unknown>): HookInput {
  return {
    session_id: 'test-session',
    transcript_path: '/tmp/transcript',
    cwd: '/tmp',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: toolInput,
  };
}

const abortOpts = { signal: new AbortController().signal };

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const dangerousCommandArb = fc.oneof(
  fc.record({
    prefix: fc.constantFrom('', 'sudo ', 'echo hello && '),
    flags: fc.constantFrom('-rf', '-Rf', '-f', '-rRf'),
    path: fc.constantFrom('/', '/etc', '/var', '/usr'),
  }).map(({ prefix, flags, path }) => `${prefix}rm ${flags} ${path}`),

  fc.record({
    device: fc.constantFrom('zero', 'random', 'urandom'),
    target: fc.constantFrom('/dev/sda', '/dev/sdb', '/tmp/disk.img'),
  }).map(({ device, target }) => `dd if=/dev/${device} of=${target} bs=1M`),

  fc.constant(':() { : | : & } ;:'),
  fc.constant(':()  {  :  |  :  &  } ; :'),

  fc.record({
    url: fc.webUrl(),
    shell: fc.constantFrom('bash', 'sh'),
  }).map(({ url, shell }) => `curl ${url} | ${shell}`),

  fc.record({
    url: fc.webUrl(),
    shell: fc.constantFrom('bash', 'sh'),
  }).map(({ url, shell }) => `wget ${url} | ${shell}`),
);

const safeCommandArb = fc.oneof(
  fc.constantFrom(
    'ls -la', 'echo hello world', 'cat /etc/hostname', 'pwd', 'whoami',
    'date', 'uname -a', 'ps aux', 'df -h', 'free -m', 'top -bn1',
    'grep -r "pattern" ./src', 'find . -name "*.ts"', 'npm install',
    'npm run build', 'node index.js', 'python3 script.py', 'git status',
    'git log --oneline', 'mkdir -p ./output', 'cp file1.txt file2.txt',
    'mv old.txt new.txt', 'touch newfile.txt', 'head -n 10 file.txt',
    'tail -f /var/log/app.log', 'wc -l file.txt', 'sort data.csv',
    'uniq -c sorted.txt', 'tar -czf archive.tar.gz ./dist', 'chmod 755 script.sh',
  ),
  fc.record({
    flags: fc.constantFrom('-rf', '-r', '-f', ''),
    path: fc.constantFrom('./build', './dist', './node_modules', './tmp', '../old'),
  }).map(({ flags, path }) => `rm ${flags} ${path}`.replace(/\s+/g, ' ').trim()),
  fc.webUrl().map((url) => `curl ${url}`),
  fc.webUrl().map((url) => `curl -o output.html ${url}`),
  fc.webUrl().map((url) => `wget ${url}`),
  fc.webUrl().map((url) => `wget -O output.html ${url}`),
  fc.constantFrom(
    'dd if=input.img of=output.img bs=4M',
    'dd if=/dev/sda of=backup.img bs=1M count=100',
    'dd if=file.bin of=copy.bin',
  ),
);

const skillNameArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/);

const skillListArb = fc
  .uniqueArray(skillNameArb, { minLength: 1, maxLength: 20 })
  .filter((arr) => arr.length > 0);

// ---------------------------------------------------------------------------
// Property 10: Dangerous command detection
// ---------------------------------------------------------------------------

describe('Property 10: Dangerous command detection', () => {
  it('should block any command matching a dangerous pattern with a non-empty reason', async () => {
    await fc.assert(
      fc.asyncProperty(dangerousCommandArb, async (command) => {
        const result = await dangerousCommandBlocker(makeInput({ command }), undefined, abortOpts);
        expect(result.decision).toBe('block');
        expect(typeof result.reason).toBe('string');
        expect(result.reason!.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });

  it('should allow any command that does not match a dangerous pattern', async () => {
    await fc.assert(
      fc.asyncProperty(safeCommandArb, async (command) => {
        const result = await dangerousCommandBlocker(makeInput({ command }), undefined, abortOpts);
        expect(result).toEqual({});
      }),
      { numRuns: 200 },
    );
  });

  it('should return an empty object when tool_input has no command field', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(
          fc.string().filter((k) => k !== 'command'),
          fc.string(),
        ),
        async (toolInput) => {
          const result = await dangerousCommandBlocker(
            makeInput(toolInput as Record<string, unknown>),
            undefined,
            abortOpts,
          );
          expect(result).toEqual({});
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return an empty object when command is not a string', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined), fc.array(fc.integer())),
        async (commandValue) => {
          const result = await dangerousCommandBlocker(
            makeInput({ command: commandValue }),
            undefined,
            abortOpts,
          );
          expect(result).toEqual({});
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should produce a block decision consistent with at least one DANGEROUS_PATTERNS entry', async () => {
    await fc.assert(
      fc.asyncProperty(dangerousCommandArb, async (command) => {
        const result = await dangerousCommandBlocker(makeInput({ command }), undefined, abortOpts);
        const knownReasons = DANGEROUS_PATTERNS.map((p) => p.reason);
        expect(knownReasons).toContain(result.reason);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Skill access control enforcement
// ---------------------------------------------------------------------------

describe('Property 11: Skill access control enforcement', () => {
  it('should allow access when the skill name IS in the allowed list', async () => {
    await fc.assert(
      fc.asyncProperty(
        skillListArb.chain((list) =>
          fc.record({
            allowedSkills: fc.constant(list),
            requestedSkill: fc.constantFrom(...list),
          }),
        ),
        async ({ allowedSkills, requestedSkill }) => {
          const checker = createSkillAccessChecker(allowedSkills);
          const result = await checker(makeInput({ skill_name: requestedSkill }), undefined, abortOpts);
          expect(result).toEqual({});
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should block access when the skill name is NOT in the allowed list', async () => {
    await fc.assert(
      fc.asyncProperty(
        skillListArb.chain((list) => {
          const notInList = skillNameArb.filter((s) => !list.includes(s));
          return fc.record({
            allowedSkills: fc.constant(list),
            requestedSkill: notInList,
          });
        }),
        async ({ allowedSkills, requestedSkill }) => {
          const checker = createSkillAccessChecker(allowedSkills);
          const result = await checker(makeInput({ skill_name: requestedSkill }), undefined, abortOpts);
          expect(result.decision).toBe('block');
          expect(typeof result.reason).toBe('string');
          expect(result.reason!.length).toBeGreaterThan(0);
          expect(result.reason).toContain(requestedSkill);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should block all skills when the allowed list is empty', async () => {
    await fc.assert(
      fc.asyncProperty(skillNameArb, async (requestedSkill) => {
        const checker = createSkillAccessChecker([]);
        const result = await checker(makeInput({ skill_name: requestedSkill }), undefined, abortOpts);
        expect(result.decision).toBe('block');
        expect(typeof result.reason).toBe('string');
        expect(result.reason!.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('should return an empty object when tool_input has no skill_name field', async () => {
    await fc.assert(
      fc.asyncProperty(
        skillListArb,
        fc.dictionary(
          fc.string().filter((k) => k !== 'skill_name'),
          fc.string(),
        ),
        async (allowedSkills, toolInput) => {
          const checker = createSkillAccessChecker(allowedSkills);
          const result = await checker(
            makeInput(toolInput as Record<string, unknown>),
            undefined,
            abortOpts,
          );
          expect(result).toEqual({});
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return an empty object when skill_name is not a string', async () => {
    await fc.assert(
      fc.asyncProperty(
        skillListArb,
        fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined), fc.array(fc.integer())),
        async (allowedSkills, skillNameValue) => {
          const checker = createSkillAccessChecker(allowedSkills);
          const result = await checker(
            makeInput({ skill_name: skillNameValue }),
            undefined,
            abortOpts,
          );
          expect(result).toEqual({});
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should enforce case-sensitive matching for skill names', async () => {
    const skillWithLetterArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,20}$/);

    await fc.assert(
      fc.asyncProperty(
        skillWithLetterArb.filter((s) => {
          const toggled = s.split('').map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('');
          return toggled !== s;
        }),
        async (skillName) => {
          const toggled = skillName.split('').map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('');
          const checker = createSkillAccessChecker([skillName]);

          const allowResult = await checker(makeInput({ skill_name: skillName }), undefined, abortOpts);
          expect(allowResult).toEqual({});

          const denyResult = await checker(makeInput({ skill_name: toggled }), undefined, abortOpts);
          expect(denyResult.decision).toBe('block');
        },
      ),
      { numRuns: 100 },
    );
  });
});
