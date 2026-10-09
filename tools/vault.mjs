// 현황판 자료를 잠그는 도구. 비밀값은 쓰지 않습니다(등록된 기기의 공개 열쇠만 사용).
//   node tools/vault.mjs add "hk1:...." [이름]      기기 등록 (recipients.json에 추가)
//   node tools/vault.mjs seal <in.json> <out.enc.json>   자료 잠그기
import { webcrypto as c } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RCP = join(ROOT, "recipients.json");
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const kidOf = async (n) => Buffer.from(await c.subtle.digest("SHA-256", new TextEncoder().encode(n))).toString("hex").slice(0, 16);
const load = () => (existsSync(RCP) ? JSON.parse(readFileSync(RCP, "utf8")) : []);
const [cmd, a, b] = process.argv.slice(2);
if (cmd === "add") {
  const m = /hk1:([A-Za-z0-9_-]{300,})/.exec((a || "").replace(/\s+/g, ""));
  if (!m) { console.error("열쇠 형식이 아닙니다. 'hk1:'로 시작하는 글자를 통째로 넣어야 합니다."); process.exit(1); }
  const n = m[1];
  await c.subtle.importKey("jwk", { kty: "RSA", n, e: "AQAB", alg: "RSA-OAEP-256", ext: true }, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const kid = await kidOf(n), list = load();
  if (list.some((r) => r.kid === kid)) { console.log("이미 등록된 기기입니다:", kid); process.exit(0); }
  list.push({ kid, name: b || "기기", n, added: new Date().toISOString().slice(0, 10) });
  writeFileSync(RCP, JSON.stringify(list, null, 1) + "\n");
  console.log("등록했습니다:", kid, "(모두", list.length, "대)");
} else if (cmd === "seal") {
  const list = load();
  if (!list.length) { console.error("등록된 기기가 없습니다. 먼저 add로 기기를 등록해야 합니다."); process.exit(1); }
  const text = readFileSync(a, "utf8"); JSON.parse(text);
  const key = await c.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = c.getRandomValues(new Uint8Array(12));
  const ct = await c.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  const raw = await c.subtle.exportKey("raw", key);
  const keys = [];
  for (const r of list) {
    const pk = await c.subtle.importKey("jwk", { kty: "RSA", n: r.n, e: "AQAB", alg: "RSA-OAEP-256", ext: true }, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
    keys.push({ kid: r.kid, wk: b64u(await c.subtle.encrypt({ name: "RSA-OAEP" }, pk, raw)) });
  }
  writeFileSync(b, JSON.stringify({ v: 1, alg: "RSA-OAEP-256+A256GCM", iv: b64u(iv), ct: b64u(ct), keys }));
  console.log("잠갔습니다:", b, "(기기", keys.length, "대)");
} else { console.error("사용법: add <열쇠> [이름] | seal <in.json> <out.enc.json>"); process.exit(1); }
