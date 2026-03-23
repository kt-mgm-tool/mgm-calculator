const fs = require('fs');
const path = require('path');

const calcPath = path.join('C:', 'Users', 'user', 'Desktop', '법인 정책', 'calculator_1.html');
const html = fs.readFileSync(calcPath, 'utf-8');

// Extract PLAN_DATA using regex (multiline)
const planMatch = html.match(/const PLAN_DATA = (\{[\s\S]*?\n\};)/);
if (!planMatch) { console.log('PLAN_DATA not found'); process.exit(1); }
let planStr = planMatch[1].replace(/;\s*$/, '');
planStr = planStr.replace(/,\s*}/g, '}');
const planData = eval('(' + planStr + ')');

const outDir = path.join('C:', 'Users', 'user', 'Desktop', 'MGM');
fs.writeFileSync(path.join(outDir, 'plan_data.js'), 'const PLAN_DATA = ' + JSON.stringify(planData) + ';', 'utf-8');
console.log('Plans:', Object.keys(planData).length);

// Read filtered subsidy
const subsidyData = JSON.parse(fs.readFileSync(path.join(outDir, 'filtered_subsidy.json'), 'utf-8'));
fs.writeFileSync(path.join(outDir, 'subsidy_data.js'), 'const SUBSIDY_DATA = ' + JSON.stringify(subsidyData) + ';', 'utf-8');
console.log('Subsidy chars:', JSON.stringify(subsidyData).length);
