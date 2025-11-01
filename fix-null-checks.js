// Script to automatically add null checks to getElementById calls
const fs = require('fs');

let content = fs.readFileSync('/workspaces/timeclock-website/script.js', 'utf8');

// List of patterns to fix
const fixes = [
    {
        pattern: /document\.getElementById\('([^']+)'\)\.addEventListener\(/g,
        replacement: (match, id) => {
            return `const ${id.replace(/[^a-zA-Z0-9]/g, '')}El = document.getElementById('${id}');\nif (${id.replace(/[^a-zA-Z0-9]/g, '')}El) {\n    ${id.replace(/[^a-zA-Z0-9]/g, '')}El.addEventListener(`;
        }
    }
];

// Apply fixes
for (const fix of fixes) {
    content = content.replace(fix.pattern, fix.replacement);
}

// Fix closing braces
content = content.replace(/}\n}$/g, '}');

fs.writeFileSync('/workspaces/timeclock-website/script-fixed.js', content);
console.log('Fixed script saved to script-fixed.js');