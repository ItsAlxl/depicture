const COPY_CSS_TAGS_ON_SAVE = [':root', '(prefers-color-scheme: dark)', '.art', '#ending-scroll p', 'body', 'h1', 'h2', 'h3', 'h4', 'h5', '.like-button', '.like-counter', '.like-counter-on', '.accordion-hidden'];

let saveText = '';
let saveImgCount = 0;
let srcToDataUrl = {};

function saveGameFile() {
    // get text
    saveText = getAccordionBtnHtml('likes', 'Toggle Like Visibility');
    saveText += '<br><br>' + document.getElementById('ending-scroll').innerHTML;

    // scrub and format
    saveText = saveText.split(' class="story-stage"').join('');
    saveText = saveText.split('<span>').join('\n\t<span>');
    saveText = saveText.split('<div>').join('\n\t<div>');
    saveText = saveText.split('</div>').join('\n\t</div>');

    // begin replacing image srcs with DataURL
    let imgTags = saveText.match(/<img.+?src=".+?">/g);
    saveImgCount = imgTags.length;
    for (let i = 0; i < imgTags.length; i++) {
        let imgSrc = imgTags[i].match(/src="(.+?)"/)[1];
        if (!imgSrc.startsWith('data:') && !(imgSrc in srcToDataUrl)) {
            srcToDataUrl[imgSrc] = '';
            let img = new Image();
            img.src = imgSrc;
            img.onload = function () {
                srcToDataUrl[imgSrc] = imgToDataUrl(img);
                saveImgCount--;
                attemptSavegameImgReplace();
            }
        } else {
            saveImgCount--;
        }
    }

    // grab style
    let style = '\n';
    let sheet = document.styleSheets[0];
    sheet = sheet.cssRules || sheet.rules;

    $.each(sheet, function (idx, rule) {
        let id = rule.selectorText || rule.conditionText;
        if (COPY_CSS_TAGS_ON_SAVE.includes(id)) {
            style += rule.cssText + '\n';
        }
    });

    // grab accordion script
    let accordionScript = document.scripts.namedItem('accordion-script').text;

    // encase
    let hat = `<!DOCTYPE html>
<html>

<head>
    <title>depicture - Saved Game</title>
    <style>` + style + `</style>
    <script>` + accordionScript + `</script>
</head>
<body>
<div id="ending-scroll">`
    let boots = `
</div>
</body>
</html>`;

    saveText = hat + saveText + boots;
    attemptSavegameImgReplace();
}

function attemptSavegameImgReplace() {
    if (saveImgCount == 0) {
        for (let src in srcToDataUrl) {
            saveText = saveText.split('src="' + src + '"').join('src="' + srcToDataUrl[src] + '"');
        }
        serveSaveFile();
    }
}

function serveSaveFile() {
    // create file
    let filename = 'depicture-save.html';
    let file = new Blob([saveText], { type: 'text/html' });

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
        setTimeout(function () {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}

function imgToDataUrl(img) {
    let cvs = document.createElement('canvas');
    cvs.width = img.naturalWidth;
    cvs.height = img.naturalHeight;
    cvs.getContext('2d').drawImage(img, 0, 0);
    return cvs.toDataURL();
}