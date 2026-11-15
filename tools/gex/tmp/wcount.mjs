// Proper opcode walk: count real instructions, not raw bytes. (A byte
// histogram counts immediates that happen to equal an opcode byte.)
import fs from "node:fs";
import zlib from "node:zlib";
let b; try { b = zlib.gunzipSync(fs.readFileSync("gex/game.wasm.gz")); } catch { b = fs.readFileSync("gex/game.wasm"); }
const uleb = (p) => { let r = 0, s = 0, x; do { x = b[p++]; r |= (x & 0x7f) << s; s += 7; } while (x & 0x80); return [r >>> 0, p]; };
const sleb = (p) => { let r = 0, s = 0, x; do { x = b[p++]; r |= (x & 0x7f) << s; s += 7; } while (x & 0x80); if (x & 0x40) r -= 1 << s; return [r, p]; };
let p = 8; const secs = {};
while (p < b.length) { const id = b[p++]; let size; [size, p] = uleb(p); secs[id] = p; p += size; }
let q = secs[2]; let n; [n, q] = uleb(q); let nImport = 0;
for (let i = 0; i < n; i++) { let l; [l, q] = uleb(q); q += l; [l, q] = uleb(q); q += l; const k = b[q++];
  if (k === 0) { let t; [t, q] = uleb(q); nImport++; } else if (k === 2) { let t; [t, q] = uleb(q); } else if (k === 1) q++; else if (k === 3) q += 2; }
const exps = [];
q = secs[7]; [n, q] = uleb(q);
for (let i = 0; i < n; i++) { let l; [l, q] = uleb(q); const nm = b.slice(q, q + l).toString("utf8"); q += l; const k = b[q++]; let ix; [ix, q] = uleb(q); exps.push([nm, k, ix]); }
const want = "g_" + (process.argv[2] ?? "gml_Object_oMeatBlob_Create_0").replace(/[^A-Za-z0-9_@]/g, "_");
const hit = exps.find((e) => e[0] === want);
const fidx = hit[2] - nImport;
q = secs[10]; [n, q] = uleb(q);
let body = null;
for (let i = 0; i < n; i++) { let sz; [sz, q] = uleb(q); if (i === fidx) body = [q, q + sz]; q += sz; }
let i2 = body[0]; let nl; [nl, i2] = uleb(i2);
for (let i = 0; i < nl; i++) { let c, t; [c, i2] = uleb(i2); [t, i2] = uleb(i2); }
const end = body[1] - 1;
const NAME = { 0x02: "block", 0x03: "loop", 0x04: "if", 0x05: "else", 0x0b: "end", 0x0c: "br", 0x0d: "br_if", 0x0e: "br_table", 0x10: "call", 0x11: "call_indirect" };
const count = {}; let steps = 0;
const memarg = (p) => { let a, o; [a, p] = uleb(p); [o, p] = uleb(p); return p; };
while (i2 < end) {
  const op = b[i2++]; steps++;
  count[op] = (count[op] ?? 0) + 1;
  switch (op) {
    case 0x02: case 0x03: case 0x04: {
      const t = b[i2++];
      if (t === 0x40 || t === 0x7f || t === 0x7e || t === 0x7d || t === 0x7c || t === 0x7b) break;
      i2--; { let x; [x, i2] = sleb(i2); }
      break;
    }
    case 0x0c: case 0x0d: case 0x20: case 0x21: case 0x22: case 0x23: case 0x24: { let x; [x, i2] = uleb(i2); break; }
    case 0x10: { let x; [x, i2] = uleb(i2); break; }
    case 0x11: { let x, y; [x, i2] = uleb(i2); [y, i2] = uleb(i2); break; }
    case 0x0e: { let c; [c, i2] = uleb(i2); for (let k = 0; k <= c; k++) { let x; [x, i2] = uleb(i2); } break; }
    case 0x41: { let x; [x, i2] = sleb(i2); break; }
    case 0x42: { let x; [x, i2] = sleb(i2); break; }
    case 0x43: i2 += 4; break;
    case 0x44: i2 += 8; break;
    case 0x05: case 0x0b: case 0x0f: case 0x1a: case 0x1b: break;
    // loads/stores: 0x28..0x3e
    default:
      if (op >= 0x28 && op <= 0x3e) { i2 = memarg(i2); break; }
      if (op >= 0x45 && op <= 0xc4) break; // numeric ops, no immediates
      throw new Error("unhandled opcode 0x" + op.toString(16) + " at +" + (i2 - 1 - body[0]));
  }
}
console.log(`${want}: ${end - body[0]} bytes, ${steps} instructions decoded`);
console.log("control-flow opcodes (real counts):");
for (const k of [0x02, 0x03, 0x04, 0x05, 0x0b, 0x0c, 0x0d, 0x0e, 0x10, 0x11]) {
  console.log("   0x" + k.toString(16).padStart(2, "0") + " " + (NAME[k] ?? "?").padEnd(12) + (count[k] ?? 0));
}
