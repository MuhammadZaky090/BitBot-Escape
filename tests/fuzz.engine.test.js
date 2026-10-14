'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const EN = require('../engine.js');

// Seeded PRNG (Mulberry32)
function createRng(seed) {
  let s = seed >>> 0;
  return function() {
    let t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COMMANDS = [
  'robot.forward()',
  'robot.turn_left()',
  'robot.turn_right()',
  'robot.take()'
];

const CONDITIONS = [
  'robot.wall_ahead()',
  'robot.wall_left()',
  'robot.wall_right()',
  'robot.item_ahead()',
  'robot.at_goal()',
  'not robot.wall_ahead()',
  'not robot.item_ahead()',
  'not robot.at_goal()'
];

const UNKNOWN_CMDS = [
  'robot.jump()', 'robot.fly()', 'robot.destroy()', 'robot.backward()',
  'print("test")', 'import os', 'eval("1+1")', 'exec("code")',
  'a = 123', 'return true', 'break', 'continue', 'pass', 'exit()', 'sys.exit()'
];

const PROSE_SNIPPETS = [
  'Halo Kak, ini kodenya jalan tapi robotnya kok tabrak tembok ya?',
  'Bagaimana cara memakai loop ulangi untuk level 2?',
  'SELECT * FROM users WHERE admin = 1;',
  '<script>alert("XSS")</script>',
  '# Panduan Level\n1. Maju 3 langkah\n2. Belok kanan',
  'Dekomposisi algoritma adalah memecah masalah besar menjadi submasalah.',
  'while(true) { window.location.reload(); }'
];

const UNICODE_SNIPPETS = [
  '🤖 🚀 🔥 ⚠️ ❌ 🏆',
  'روبوت.إلى_الأمام()',
  '机器人.前进()',
  'робот.вперед()',
  '\u200B\u200C\u200D\uFEFF', // Zero-width spaces
  'robot.forward()\u0000',    // Null byte
  'robot.for\u00A0ward()'    // Non-breaking space
];

function generateValidSnippet(rng, depth, maxDepth) {
  if (depth >= maxDepth) {
    return [COMMANDS[Math.floor(rng() * COMMANDS.length)]];
  }
  const choice = rng();
  const indent = '    '.repeat(depth);
  if (choice < 0.5) {
    return [COMMANDS[Math.floor(rng() * COMMANDS.length)]];
  } else if (choice < 0.75) {
    const times = Math.floor(rng() * 6) + 1;
    const body = generateValidSnippet(rng, depth + 1, maxDepth);
    return [`for i in range(${times}):`, ...body.map(l => '    ' + l)];
  } else if (choice < 0.9) {
    const cond = CONDITIONS[Math.floor(rng() * CONDITIONS.length)];
    const body = generateValidSnippet(rng, depth + 1, maxDepth);
    const lines = [`if ${cond}:`, ...body.map(l => '    ' + l)];
    if (rng() < 0.4) {
      const elseBody = generateValidSnippet(rng, depth + 1, maxDepth);
      lines.push('else:', ...elseBody.map(l => '    ' + l));
    }
    return lines;
  } else {
    const cond = CONDITIONS[Math.floor(rng() * CONDITIONS.length)];
    const body = generateValidSnippet(rng, depth + 1, maxDepth);
    return [`while ${cond}:`, ...body.map(l => '    ' + l)];
  }
}

function generateRandomProgram(rng) {
  const cat = Math.floor(rng() * 11);
  switch (cat) {
    case 0: { // 1. Valid program
      const lineCount = Math.floor(rng() * 8) + 1;
      const lines = [];
      for (let i = 0; i < lineCount; i++) {
        lines.push(...generateValidSnippet(rng, 0, 3));
      }
      return lines.join('\n');
    }
    case 1: { // 2. Mutated valid program
      const base = generateRandomProgram(rng);
      if (base.length === 0) return 'robot.forward()';
      const pos = Math.floor(rng() * base.length);
      const mutChoice = rng();
      if (mutChoice < 0.3) { // Deletion
        return base.slice(0, pos) + base.slice(pos + 1);
      } else if (mutChoice < 0.6) { // Insertion
        const chars = ' :()_#\n\t123abcdef';
        return base.slice(0, pos) + chars[Math.floor(rng() * chars.length)] + base.slice(pos);
      } else { // Replacement
        return base.slice(0, pos) + 'X' + base.slice(pos + 1);
      }
    }
    case 2: { // 3. Garbled indentation
      const base = generateValidSnippet(rng, 0, 3).join('\n');
      const lines = base.split('\n');
      const spaces = ['  ', '   ', '     ', '\t', '  \t', ' '];
      return lines.map(line => {
        const leading = line.match(/^ */)[0].length;
        if (leading > 0) {
          const rep = spaces[Math.floor(rng() * spaces.length)].repeat(Math.ceil(leading / 4));
          return rep + line.trim();
        }
        return line;
      }).join(rng() < 0.5 ? '\r\n' : '\n');
    }
    case 3: { // 4. Empty bodies
      const emptyHeaders = [
        'for i in range(3):',
        'if robot.wall_ahead():',
        'if not robot.item_ahead():',
        'while robot.wall_ahead():',
        'def test():',
        'else:'
      ];
      const h = emptyHeaders[Math.floor(rng() * emptyHeaders.length)];
      return rng() < 0.5 ? h : `${h}\nrobot.forward()`;
    }
    case 4: { // 5. Edge ranges
      const ranges = [
        'for i in range(0):\n    robot.forward()',
        'for i in range(1):\n    robot.forward()',
        'for i in range(99999999):\n    robot.forward()',
        'for i in range(-5):\n    robot.forward()',
        'for i in range():\n    robot.forward()',
        'for i in range(1, 10):\n    robot.forward()'
      ];
      return ranges[Math.floor(rng() * ranges.length)];
    }
    case 5: { // 6. Deep nesting
      const depth = Math.floor(rng() * 25) + 10;
      const lines = [];
      for (let d = 0; d < depth; d++) {
        lines.push('    '.repeat(d) + 'for i in range(2):');
      }
      lines.push('    '.repeat(depth) + 'robot.forward()');
      return lines.join('\n');
    }
    case 6: { // 7. Huge input
      const count = Math.floor(rng() * 500) + 200;
      const cmds = [];
      for (let i = 0; i < count; i++) {
        cmds.push(COMMANDS[Math.floor(rng() * COMMANDS.length)]);
      }
      return cmds.join('\n');
    }
    case 7: { // 8. Unknown commands
      const cmds = [];
      for (let i = 0; i < 4; i++) {
        cmds.push(UNKNOWN_CMDS[Math.floor(rng() * UNKNOWN_CMDS.length)]);
      }
      return cmds.join('\n');
    }
    case 8: { // 9. Pasted prose
      return PROSE_SNIPPETS[Math.floor(rng() * PROSE_SNIPPETS.length)];
    }
    case 9: { // 10. Unicode
      const uni = UNICODE_SNIPPETS[Math.floor(rng() * UNICODE_SNIPPETS.length)];
      return `robot.forward()\n# ${uni}\n${uni}`;
    }
    default: { // 11. Functions with calls
      return [
        'def maju_dua():',
        '    robot.forward()',
        '    robot.forward()',
        'maju_dua()',
        'robot.turn_left()'
      ].join('\n');
    }
  }
}

// 10,000 programs per level
const TOTAL_PER_LEVEL = 10000;

EN.LEVELS.forEach((level, lvlIdx) => {
  test(`Fuzz engine: 10,000 program acak pada Level ${level.no} (${level.nama})`, () => {
    const seed = 1337000 + (lvlIdx * 997);
    const rng = createRng(seed);

    let okCount = 0;
    let errCount = 0;

    for (let i = 0; i < TOTAL_PER_LEVEL; i++) {
      const code = generateRandomProgram(rng);
      const t0 = performance.now();
      let r1;
      try {
        r1 = EN.evaluateProgram(code, level);
      } catch (err) {
        // Laporkan seed dan detail program jika ada uncaught exception
        const msg = `CRASH pada Level ${level.no}, iterasi ${i}, SEED=${seed}:\n` +
                    `Input:\n${code}\n` +
                    `Error: ${err.stack || err}`;
        assert.fail(msg);
      }
      const elapsed = performance.now() - t0;
      assert.ok(elapsed <= 200, `Waktu eksekusi melebihi 200ms (${elapsed.toFixed(1)}ms) pada iterasi ${i}, SEED=${seed}`);

      // Hasil evaluasi harus valid dan terstruktur
      assert.strictEqual(typeof r1.ok, 'boolean', `Nilai r.ok tidak valid pada iterasi ${i}, SEED=${seed}`);
      if (!r1.ok) {
        errCount++;
        assert.ok(typeof r1.pesan === 'string' && r1.pesan.trim().length > 0,
          `Pesan error kosong pada iterasi ${i}, SEED=${seed}`);
      } else {
        okCount++;
        // Uji determinisme: eksekusi kedua harus menghasilkan output identik
        const r2 = EN.evaluateProgram(code, level);
        assert.strictEqual(r2.ok, r1.ok, `Non-deterministik ok pada iterasi ${i}, SEED=${seed}`);
        assert.strictEqual(r2.cost, r1.cost, `Non-deterministik cost pada iterasi ${i}, SEED=${seed}`);
        assert.strictEqual(r2.steps, r1.steps, `Non-deterministik steps pada iterasi ${i}, SEED=${seed}`);
        assert.strictEqual(r2.stars, r1.stars, `Non-deterministik stars pada iterasi ${i}, SEED=${seed}`);
      }
    }

    assert.ok(okCount + errCount === TOTAL_PER_LEVEL);
  });
});
