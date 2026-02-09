const imageUpload = document.getElementById('image-upload');
const previewImage = document.getElementById('preview-image');
const originalPreview = document.getElementById('original-preview');
const transformButton = document.getElementById('transform-button');
const resultsContainer = document.getElementById('results-container');
const resultsGrid = document.getElementById('results-grid');

let loadedImage = null;

// Smooth cosine interpolation between control points
function smoothScale(controlPoints, t) {
    t = Math.max(0, Math.min(1, t));
    // Find surrounding control points
    var i;
    for (i = 0; i < controlPoints.length - 1; i++) {
        if (t <= controlPoints[i + 1][0]) break;
    }
    if (i >= controlPoints.length - 1) return controlPoints[controlPoints.length - 1][1];

    var p0 = controlPoints[i];
    var p1 = controlPoints[i + 1];
    var local = (t - p0[0]) / (p1[0] - p0[0]);
    // Cosine interpolation for extra smoothness
    var blend = (1 - Math.cos(local * Math.PI)) / 2;
    return p0[1] + (p1[1] - p0[1]) * blend;
}

// Scanline-based warping: draws image row-by-row with smooth width variation
function scanlineWarp(ctx, img, w, h, scalePoints) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (var y = 0; y < h; y++) {
        var t = y / h;
        var scale = smoothScale(scalePoints, t);
        var stripW = Math.round(w * scale);
        var offsetX = Math.round((w - stripW) / 2);

        // Source row in original image
        var srcY = Math.floor(t * img.height);
        var srcH = Math.max(1, Math.ceil(img.height / h));

        ctx.drawImage(img, 0, srcY, img.width, srcH,
            offsetX, y, stripW, 1);
    }
}

// Scanline-based warping with vertical displacement (for height changes)
function scanlineWarpVertical(ctx, img, w, h, scaleX, scaleY) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (var y = 0; y < h; y++) {
        var tDest = y / h;
        // Map destination y to source y using vertical scale curve
        var tSrc = smoothScale(scaleY, tDest);
        var xScale = smoothScale(scaleX, tDest);

        var stripW = Math.round(w * xScale);
        var offsetX = Math.round((w - stripW) / 2);

        var srcY = Math.floor(tSrc * img.height);
        var srcH = Math.max(1, Math.ceil(img.height / h));

        if (srcY >= 0 && srcY < img.height) {
            ctx.drawImage(img, 0, srcY, img.width, srcH,
                offsetX, y, stripW, 1);
        }
    }
}

var transformTypes = [
    {
        name: '근육질 체형',
        emoji: '🏋️',
        description: '넓은 어깨와 좁은 허리의 V자 실루엣',
        transform: function(ctx, img, w, h) {
            // Control points: [normalizedY, horizontalScale]
            // Head normal → shoulders wide → waist narrow → hips normal → feet normal
            scanlineWarp(ctx, img, w, h, [
                [0.00, 1.00],  // top of head
                [0.10, 1.02],  // forehead
                [0.18, 1.12],  // shoulders start
                [0.28, 1.18],  // shoulders peak
                [0.35, 1.10],  // upper chest
                [0.50, 0.88],  // waist (narrowest)
                [0.60, 0.92],  // lower waist
                [0.70, 1.02],  // hips
                [0.80, 1.04],  // upper thighs
                [0.90, 1.00],  // lower legs
                [1.00, 1.00]   // feet
            ]);
        }
    },
    {
        name: '통통한 체형',
        emoji: '🍔',
        description: '전체적으로 볼륨감 있는 풍성한 체형',
        transform: function(ctx, img, w, h) {
            // Everything wider, belly area widest
            scanlineWarp(ctx, img, w, h, [
                [0.00, 1.00],  // top of head
                [0.08, 1.02],  // head
                [0.15, 1.08],  // neck/chin (fuller face)
                [0.22, 1.14],  // shoulders
                [0.30, 1.18],  // upper chest
                [0.42, 1.28],  // belly peak
                [0.55, 1.25],  // lower belly
                [0.65, 1.18],  // hips
                [0.75, 1.14],  // thighs
                [0.85, 1.08],  // calves
                [1.00, 1.02]   // feet
            ]);
        }
    },
    {
        name: '마른 체형',
        emoji: '🦴',
        description: '전체적으로 슬림하고 날씬한 체형',
        transform: function(ctx, img, w, h) {
            // Everything narrower, waist/limbs most narrow
            scanlineWarp(ctx, img, w, h, [
                [0.00, 1.00],  // top of head
                [0.10, 0.98],  // head
                [0.18, 0.92],  // neck (thinner)
                [0.25, 0.88],  // shoulders
                [0.35, 0.84],  // chest
                [0.48, 0.78],  // waist (narrowest)
                [0.58, 0.80],  // lower belly
                [0.68, 0.84],  // hips
                [0.78, 0.82],  // thighs
                [0.88, 0.86],  // calves
                [1.00, 0.92]   // feet
            ]);
        }
    },
    {
        name: '키 큰 체형',
        emoji: '📏',
        description: '수직으로 늘씬하게 늘어난 체형',
        transform: function(ctx, img, w, h) {
            // Vertical stretch: source maps compressed so body looks taller
            // scaleX: slightly narrower, scaleY: maps dest y to source y (compressed source)
            scanlineWarpVertical(ctx, img, w, h,
                // X scale - slightly narrower for elongated look
                [
                    [0.00, 0.98],
                    [0.15, 0.96],
                    [0.50, 0.94],
                    [0.85, 0.96],
                    [1.00, 0.98]
                ],
                // Y mapping: dest t → source t (pull source upward to stretch)
                // Head stays relatively normal, body stretches
                [
                    [0.00, 0.00],
                    [0.12, 0.14],  // head slightly compressed
                    [0.30, 0.36],  // torso starts stretching
                    [0.50, 0.58],  // mid body
                    [0.70, 0.78],  // lower body
                    [0.85, 0.90],  // legs
                    [1.00, 1.00]
                ]
            );
        }
    },
    {
        name: '키 작은 체형',
        emoji: '🔲',
        description: '수직으로 압축된 아담한 체형',
        transform: function(ctx, img, w, h) {
            // Vertical compression: source maps expanded so body looks shorter
            scanlineWarpVertical(ctx, img, w, h,
                // X scale - slightly wider for stocky look
                [
                    [0.00, 1.02],
                    [0.15, 1.04],
                    [0.50, 1.08],
                    [0.85, 1.04],
                    [1.00, 1.02]
                ],
                // Y mapping: dest t → source t (push source down to compress)
                [
                    [0.00, 0.00],
                    [0.15, 0.12],  // head slightly expanded
                    [0.35, 0.28],  // torso compresses
                    [0.55, 0.46],  // mid body
                    [0.75, 0.66],  // lower body
                    [0.90, 0.82],  // legs compressed
                    [1.00, 1.00]
                ]
            );
        }
    }
];

imageUpload.addEventListener('change', function(event) {
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
        previewImage.src = e.target.result;
        previewImage.style.display = 'block';
        originalPreview.querySelector('p').style.display = 'none';

        var img = new Image();
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

    // Use original image dimensions for high quality (capped at 800px width)
    var maxWidth = 800;
    var canvasWidth = Math.min(loadedImage.width, maxWidth);
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
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
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
