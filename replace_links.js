const fs = require('fs');
const path = require('path');

const pagesDir = 'e:/Agriplanner/pages';
fs.readdirSync(pagesDir).forEach(file => {
    if (file.endsWith('.html')) {
        const filePath = path.join(pagesDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/"\.\.\/index\.html"/g, '"../dashboard.html"');
        content = content.replace(/'\.\.\/index\.html'/g, "'../dashboard.html'");
        fs.writeFileSync(filePath, content, 'utf8');
    }
});
let dashPath = 'e:/Agriplanner/dashboard.html';
let content = fs.readFileSync(dashPath, 'utf8');
content = content.replace(/"index\.html"/g, '"dashboard.html"');
content = content.replace(/'index\.html'/g, "'dashboard.html'");
fs.writeFileSync(dashPath, content, 'utf8');
console.log("Replaced links successfully!");
