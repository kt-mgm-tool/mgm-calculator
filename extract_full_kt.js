const fs = require('fs');
const path = require('path');

const calcPath = path.join('C:', 'Users', 'user', 'Desktop', '법인 정책', 'calculator_1.html');
const html = fs.readFileSync(calcPath, 'utf-8');

// Extract MODEL_MAP (line 803)
const modelMatch = html.match(/const MODEL_MAP = (\{.*?\});/);
console.log('MODEL_MAP found:', !!modelMatch, 'length:', modelMatch ? modelMatch[1].length : 0);

// Extract PRICE_MAP (line 805)
const priceMatch = html.match(/const PRICE_MAP = (\{.*?\});/);
console.log('PRICE_MAP found:', !!priceMatch, 'length:', priceMatch ? priceMatch[1].length : 0);

// Extract PLAN_DATA (multiline, lines 807-810)
const planMatch = html.match(/const PLAN_DATA = (\{[\s\S]*?\n\});/);
let planStr = planMatch[1].replace(/,\s*}/g, '}');
const planData = eval('(' + planStr + ')');
console.log('PLAN_DATA plans:', Object.keys(planData).length);

// Extract SUBSIDY_DATA (line 814)
const subsidyMatch = html.match(/const SUBSIDY_DATA = (\{.*?\});/);
console.log('SUBSIDY_DATA found:', !!subsidyMatch, 'length:', subsidyMatch ? subsidyMatch[1].length : 0);

// Write all to a single JS file
const outDir = path.join('C:', 'Users', 'user', 'Desktop', 'MGM');
let output = '';
output += modelMatch[0] + '\n\n';
output += priceMatch[0] + '\n\n';
output += 'const PLAN_DATA = ' + JSON.stringify(planData) + ';\n\n';
output += subsidyMatch[0] + '\n';

fs.writeFileSync(path.join(outDir, 'kt_full_data.js'), output, 'utf-8');
console.log('Total output size:', output.length);
