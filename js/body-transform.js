const imageUpload = document.getElementById('image-upload');
const previewImage = document.getElementById('preview-image');
const originalPreview = document.getElementById('original-preview');
const transformButton = document.getElementById('transform-button');
const resultsContainer = document.getElementById('results-container');
const resultsGrid = document.getElementById('results-grid');

let loadedImage = null;

const transformTypes = [
    {
        name: '근육질 체형',
        emoji: '🏋️',
        description: '넓은 어깨와 좁은 허리의 V자 실루엣',
        transform: function(ctx, img, w, h) {
            const topH = Math.floor(h * 0.35);
            const midH = Math.floor(h * 0.35);
            const botH = h - topH - midH;

            // 어깨 부분 넓히기
            const topW = Math.floor(w * 1.2);
            const topX = Math.floor((w - topW) / 2);
            ctx.drawImage(img, 0, 0, img.width, Math.floor(img.height * 0.35),
                topX, 0, topW, topH);

            // 허리 부분 좁히기
            const midW = Math.floor(w * 0.85);
            const midX = Math.floor((w - midW) / 2);
            ctx.drawImage(img, 0, Math.floor(img.height * 0.35), img.width, Math.floor(img.height * 0.35),
                midX, topH, midW, midH);

            // 하체 약간 넓히기
            const botW = Math.floor(w * 1.05);
            const botX = Math.floor((w - botW) / 2);
            ctx.drawImage(img, 0, Math.floor(img.height * 0.7), img.width, img.height - Math.floor(img.height * 0.7),
                botX, topH + midH, botW, botH);
        }
    },
    {
        name: '통통한 체형',
        emoji: '🍔',
        description: '전체적으로 볼륨감 있는 풍성한 체형',
        transform: function(ctx, img, w, h) {
            const topH = Math.floor(h * 0.3);
            const midH = Math.floor(h * 0.4);
            const botH = h - topH - midH;

            // 상체 약간 넓히기
            const topW = Math.floor(w * 1.15);
            const topX = Math.floor((w - topW) / 2);
            ctx.drawImage(img, 0, 0, img.width, Math.floor(img.height * 0.3),
                topX, 0, topW, topH);

            // 복부 중심으로 넓히기
            const midW = Math.floor(w * 1.35);
            const midX = Math.floor((w - midW) / 2);
            ctx.drawImage(img, 0, Math.floor(img.height * 0.3), img.width, Math.floor(img.height * 0.4),
                midX, topH, midW, midH);

            // 하체 넓히기
            const botW = Math.floor(w * 1.2);
            const botX = Math.floor((w - botW) / 2);
            ctx.drawImage(img, 0, Math.floor(img.height * 0.7), img.width, img.height - Math.floor(img.height * 0.7),
                botX, topH + midH, botW, botH);
        }
    },
    {
        name: '마른 체형',
        emoji: '🦴',
        description: '전체적으로 슬림하고 날씬한 체형',
        transform: function(ctx, img, w, h) {
            const topH = Math.floor(h * 0.3);
            const midH = Math.floor(h * 0.4);
            const botH = h - topH - midH;

            // 상체 좁히기
            const topW = Math.floor(w * 0.85);
            const topX = Math.floor((w - topW) / 2);
            ctx.drawImage(img, 0, 0, img.width, Math.floor(img.height * 0.3),
                topX, 0, topW, topH);

            // 복부 좁히기
            const midW = Math.floor(w * 0.75);
            const midX = Math.floor((w - midW) / 2);
            ctx.drawImage(img, 0, Math.floor(img.height * 0.3), img.width, Math.floor(img.height * 0.4),
                midX, topH, midW, midH);

            // 하체 좁히기
            const botW = Math.floor(w * 0.8);
            const botX = Math.floor((w - botW) / 2);
            ctx.drawImage(img, 0, Math.floor(img.height * 0.7), img.width, img.height - Math.floor(img.height * 0.7),
                botX, topH + midH, botW, botH);
        }
    },
    {
        name: '키 큰 체형',
        emoji: '📏',
        description: '수직으로 늘씬하게 늘어난 체형',
        transform: function(ctx, img, w, h) {
            // 수직으로 늘리기 (1.25배)
            const newH = Math.floor(h * 1.25);
            const newW = Math.floor(w * 0.95);
            const offsetX = Math.floor((w - newW) / 2);
            const offsetY = Math.floor((h - newH) / 2);
            ctx.drawImage(img, 0, 0, img.width, img.height,
                offsetX, offsetY, newW, newH);
        }
    },
    {
        name: '키 작은 체형',
        emoji: '🔲',
        description: '수직으로 압축된 아담한 체형',
        transform: function(ctx, img, w, h) {
            // 수직으로 압축 (0.75배), 수평 약간 넓히기
            const newH = Math.floor(h * 0.75);
            const newW = Math.floor(w * 1.1);
            const offsetX = Math.floor((w - newW) / 2);
            const offsetY = Math.floor((h - newH) / 2);
            ctx.drawImage(img, 0, 0, img.width, img.height,
                offsetX, offsetY, newW, newH);
        }
    }
];

imageUpload.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        previewImage.src = e.target.result;
        previewImage.style.display = 'block';
        originalPreview.querySelector('p').style.display = 'none';

        const img = new Image();
        img.onload = function() {
            loadedImage = img;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

transformButton.addEventListener('click', function() {
    if (!loadedImage) {
        alert('먼저 이미지를 업로드해주세요.');
        return;
    }

    resultsGrid.innerHTML = '';
    resultsContainer.style.display = 'block';

    var canvasWidth = 300;
    var ratio = loadedImage.height / loadedImage.width;
    var canvasHeight = Math.floor(canvasWidth * ratio);

    for (var i = 0; i < transformTypes.length; i++) {
        var type = transformTypes[i];
        var card = document.createElement('div');
        card.className = 'result-card';

        var canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        type.transform(ctx, loadedImage, canvasWidth, canvasHeight);

        var label = document.createElement('div');
        label.className = 'result-label';
        label.innerHTML = '<span class="result-emoji">' + type.emoji + '</span> ' +
            '<strong>' + type.name + '</strong><br>' +
            '<small>' + type.description + '</small>';

        card.appendChild(canvas);
        card.appendChild(label);
        resultsGrid.appendChild(card);
    }

    resultsContainer.scrollIntoView({ behavior: 'smooth' });
});
