const fs = require('fs');
const path = require('path');

function processDir(dir) {
    for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
            processDir(full);
        } else if (f.endsWith('.ejs') && !full.includes('partials')) {
            let content = fs.readFileSync(full, 'utf8');
            if (!content.includes('rel="icon"') && !content.includes("rel='icon'")) {
                if (content.includes('</head>')) {
                    content = content.replace('</head>', '    <link rel="icon" type="image/svg+xml" href="/favicon.svg">\n    <link rel="alternate icon" href="/favicon.ico">\n</head>');
                    fs.writeFileSync(full, content, 'utf8');
                    console.log('Added favicon to:', f);
                }
            }
        }
    }
}

processDir('C:/Users/Richard/Downloads/HTML/HTML/Eduplat/views');
