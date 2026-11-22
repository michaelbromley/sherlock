import { Database } from 'bun:sqlite';
const db = new Database(`./events.db`, { readonly: true });
const s: any = db.prepare('select 1 as a, 2 as "2024", 3 as a, id, amount*2 as x from events where id < 3');
console.log('names', s.columnNames);
let p = s; const names = new Set<string>(); while (p && p !== Object.prototype) { Object.getOwnPropertyNames(p).forEach(n => names.add(n)); p = Object.getPrototypeOf(p); }
console.log('methods', [...names].join(' '));
const it = s.iterate(); it.next();
try { console.log('declared after 1st step', s.declaredTypes, s.columnTypes); } catch (e: any) { console.log('declared after step:', e.message); }
// arrays one at a time? try values() on a LIMIT-less statement with a manual step via .as? 
const z: any = db.prepare('select id, body from events where 0'); z.all();
try { console.log('zero-row declared', z.declaredTypes); } catch (e: any) { console.log('zero-row declared:', e.message); }
