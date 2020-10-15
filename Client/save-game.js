const COPY_CSS_TAGS_ON_SAVE = [':root', '(prefers-color-scheme: dark)', '.art', '#ending-scroll p', 'body', 'h1', 'h2', 'h3', 'h4', 'h5'];

function saveGameFile() {
    // get text
    let data = document.getElementById('ending-scroll').innerHTML;

    // scrub and format
    data = data.replaceAll(' id="story-stage"', '');
    data = data.replaceAll('<span>', '\n\t<span>');
    data = data.replaceAll('<div>', '\n<div>');
    data = data.replaceAll('</div>', '\n</div>');

    // apply style
    let style = '\n';
    let sheet = document.styleSheets[0];
    sheet = sheet.cssRules || sheet.rules;
    
    $.each(sheet, function(idx, rule) {
        let id = rule.selectorText || rule.conditionText;
        if (COPY_CSS_TAGS_ON_SAVE.includes(id)) {
            style += rule.cssText + '\n';
        }
    });

    // encase
    let hat = `<!DOCTYPE html>
<html>

<head>
    <title>depicture - Saved Game</title>
    <style>` + style + `</style>
</head>
<body>
<div id="ending-scroll">`
    let boots = `
</div>
</body>
</html>`;

    data = hat + data + boots;

    // create file
    let filename = 'depicture-save.html';
    let file = new Blob([data], {type: 'text/html'});

    // offer file
    if (window.navigator.msSaveOrOpenBlob) { // for IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    } else { // for everybody else
        let a = document.createElement('a');
        let url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}