const fs = require('fs');
let c = fs.readFileSync('components/ApplyWizard.tsx', 'utf8');
const origLen = c.length;
// Match basic text inputs, selects, and textareas
c = c.replace(/className="(w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none)"/g, 'className="$1 text-black"');
c = c.replace(/className="(flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none)"/g, 'className="$1 text-black"');
c = c.replace(/className="(w-full px-4 py-3 border border-slate-300 rounded-lg h-24 resize-none focus:ring-2 focus:ring-cyan-400 focus:outline-none)"/g, 'className="$1 text-black"');
c = c.replace(/className="(w-20 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none text-center)"/g, 'className="$1 text-black text-center"');

fs.writeFileSync('components/ApplyWizard.tsx', c);
console.log('Done. Size: ' + origLen + ' -> ' + c.length);
