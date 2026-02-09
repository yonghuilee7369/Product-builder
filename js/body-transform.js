// ==========================================
// 1. DOM REFERENCES
// ==========================================
var imageUpload = document.getElementById('image-upload');
var previewImage = document.getElementById('preview-image');
var originalPreview = document.getElementById('original-preview');
var transformButton = document.getElementById('transform-button');
var resultsContainer = document.getElementById('results-container');
var resultsGrid = document.getElementById('results-grid');
var statusEl = document.getElementById('status');

var loadedImage = null;
var bpModel = null;

// ==========================================
// 2. STATUS & MODEL MANAGEMENT
// ==========================================
function showStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.className = 'status-message' + (isError ? ' error' : '');
    statusEl.style.display = 'block';
}

function hideStatus() {
    statusEl.style.display = 'none';
}

function setButtonLoading(loading) {
    if (loading) {
        transformButton.disabled = true;
        transformButton.innerHTML = '<span class="loading-spinner"></span> 분석 중...';
    } else {
        transformButton.disabled = false;
        transformButton.textContent = '체형 변환 시작';
    }
}

(function loadModel() {
    showStatus('AI 인물 인식 모델을 불러오는 중입니다. 잠시만 기다려주세요...');
    bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2
    }).then(function(model) {
        bpModel = model;
        hideStatus();
        transformButton.disabled = false;
        transformButton.textContent = '체형 변환 시작';
    }).catch(function(err) {
        showStatus('모델 로딩에 실패했습니다. 페이지를 새로고침해주세요.', true);
        console.error(err);
    });
})();

// ==========================================
// 3. IMAGE ANALYSIS
// ==========================================
function analyzeImage(canvas) {
    return bpModel.segmentPerson(canvas, {
        flipHorizontal: false,
        internalResolution: 'medium',
        segmentationThreshold: 0.6,
        scoreThreshold: 0.3
    }).then(function(seg) {
        if (!seg.allPoses || seg.allPoses.length === 0) return null;
        return {
            mask: seg.data,
            width: seg.width,
            height: seg.height,
            pose: seg.allPoses[0]
        };
    });
}

function getKeypoint(pose, name) {
    for (var i = 0; i < pose.keypoints.length; i++) {
        if (pose.keypoints[i].part === name && pose.keypoints[i].score > 0.2) {
            return pose.keypoints[i].position;
        }
    }
    return null;
}

// ==========================================
// 4. MASK UTILITIES
// ==========================================
function featherMask(mask, w, h, radius) {
    // 3-pass box blur for gaussian approximation
    var src = new Float32Array(w * h);
    for (var i = 0; i < mask.length; i++) src[i] = mask[i] === 1 ? 1.0 : 0.0;

    var passes = 3;
    var r = Math.max(1, Math.round(radius / passes));
    for (var p = 0; p < passes; p++) {
        var temp = new Float32Array(w * h);
        // Horizontal pass
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var sum = 0, count = 0;
                for (var dx = -r; dx <= r; dx++) {
                    var nx = x + dx;
                    if (nx >= 0 && nx < w) { sum += src[y * w + nx]; count++; }
                }
                temp[y * w + x] = sum / count;
            }
        }
        // Vertical pass
        var out = new Float32Array(w * h);
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var sum = 0, count = 0;
                for (var dy = -r; dy <= r; dy++) {
                    var ny = y + dy;
                    if (ny >= 0 && ny < h) { sum += temp[ny * w + x]; count++; }
                }
                out[y * w + x] = sum / count;
            }
        }
        src = out;
    }
    return src;
}

// ==========================================
// 5. BACKGROUND PLATE
// ==========================================
function createBackgroundPlate(srcPixels, mask, w, h, expandRadius) {
    var bg = new Uint8ClampedArray(srcPixels.length);
    bg.set(srcPixels);
    var sampleRange = 30;

    // Pass 1: Horizontal inpainting per row
    for (var y = 0; y < h; y++) {
        var left = -1, right = -1;
        for (var x = 0; x < w; x++) {
            if (mask[y * w + x] === 1) {
                if (left === -1) left = x;
                right = x;
            }
        }
        if (left === -1) continue;

        var fillLeft = Math.max(0, left - expandRadius);
        var fillRight = Math.min(w - 1, right + expandRadius);

        // Sample left edge background
        var lR = 0, lG = 0, lB = 0, lCount = 0;
        for (var i = Math.max(0, fillLeft - sampleRange); i < fillLeft; i++) {
            if (mask[y * w + i] === 0) {
                var idx = (y * w + i) * 4;
                lR += srcPixels[idx]; lG += srcPixels[idx + 1]; lB += srcPixels[idx + 2];
                lCount++;
            }
        }
        if (lCount > 0) { lR /= lCount; lG /= lCount; lB /= lCount; }
        else { var idx = (y * w + Math.max(0, fillLeft - 1)) * 4; lR = srcPixels[idx]; lG = srcPixels[idx + 1]; lB = srcPixels[idx + 2]; }

        // Sample right edge background
        var rR = 0, rG = 0, rB = 0, rCount = 0;
        for (var i = fillRight + 1; i <= Math.min(w - 1, fillRight + sampleRange); i++) {
            if (mask[y * w + i] === 0) {
                var idx = (y * w + i) * 4;
                rR += srcPixels[idx]; rG += srcPixels[idx + 1]; rB += srcPixels[idx + 2];
                rCount++;
            }
        }
        if (rCount > 0) { rR /= rCount; rG /= rCount; rB /= rCount; }
        else { var idx = (y * w + Math.min(w - 1, fillRight + 1)) * 4; rR = srcPixels[idx]; rG = srcPixels[idx + 1]; rB = srcPixels[idx + 2]; }

        var fillW = fillRight - fillLeft;
        if (fillW <= 0) continue;
        for (var x = fillLeft; x <= fillRight; x++) {
            var t = (x - fillLeft) / fillW;
            var idx = (y * w + x) * 4;
            bg[idx] = Math.round(lR * (1 - t) + rR * t);
            bg[idx + 1] = Math.round(lG * (1 - t) + rG * t);
            bg[idx + 2] = Math.round(lB * (1 - t) + rB * t);
            bg[idx + 3] = 255;
        }
    }

    // Pass 2: Vertical blending - blend each filled pixel with above/below background
    var blended = new Uint8ClampedArray(bg.length);
    blended.set(bg);
    var vRange = 20;
    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            if (mask[y * w + x] !== 1) continue;
            var tR = 0, tG = 0, tB = 0, tCount = 0;
            // Sample above
            for (var dy = -vRange; dy < 0; dy++) {
                var ny = y + dy;
                if (ny >= 0 && mask[ny * w + x] === 0) {
                    var idx = (ny * w + x) * 4;
                    var weight = 1.0 - Math.abs(dy) / vRange;
                    tR += srcPixels[idx] * weight; tG += srcPixels[idx + 1] * weight; tB += srcPixels[idx + 2] * weight;
                    tCount += weight;
                }
            }
            // Sample below
            for (var dy = 1; dy <= vRange; dy++) {
                var ny = y + dy;
                if (ny < h && mask[ny * w + x] === 0) {
                    var idx = (ny * w + x) * 4;
                    var weight = 1.0 - dy / vRange;
                    tR += srcPixels[idx] * weight; tG += srcPixels[idx + 1] * weight; tB += srcPixels[idx + 2] * weight;
                    tCount += weight;
                }
            }
            if (tCount > 0) {
                var idx = (y * w + x) * 4;
                var hR = bg[idx], hG = bg[idx + 1], hB = bg[idx + 2];
                var vR = tR / tCount, vG = tG / tCount, vB = tB / tCount;
                // Blend horizontal and vertical 50/50
                blended[idx] = Math.round(hR * 0.5 + vR * 0.5);
                blended[idx + 1] = Math.round(hG * 0.5 + vG * 0.5);
                blended[idx + 2] = Math.round(hB * 0.5 + vB * 0.5);
            }
        }
    }

    // Pass 3: Light smoothing on filled area to reduce banding
    var smoothed = new Uint8ClampedArray(blended.length);
    smoothed.set(blended);
    for (var y = 1; y < h - 1; y++) {
        for (var x = 1; x < w - 1; x++) {
            if (mask[y * w + x] !== 1) continue;
            var idx = (y * w + x) * 4;
            for (var c = 0; c < 3; c++) {
                smoothed[idx + c] = Math.round(
                    blended[idx + c] * 0.4 +
                    blended[((y - 1) * w + x) * 4 + c] * 0.15 +
                    blended[((y + 1) * w + x) * 4 + c] * 0.15 +
                    blended[(y * w + x - 1) * 4 + c] * 0.15 +
                    blended[(y * w + x + 1) * 4 + c] * 0.15
                );
            }
        }
    }
    return smoothed;
}

// ==========================================
// 6. INTERPOLATION & WARPING
// ==========================================
function smoothScale(points, t) {
    t = Math.max(0, Math.min(1, t));
    var i;
    for (i = 0; i < points.length - 1; i++) {
        if (t <= points[i + 1][0]) break;
    }
    if (i >= points.length - 1) return points[points.length - 1][1];
    var p0 = points[i], p1 = points[i + 1];
    var local = (t - p0[0]) / (p1[0] - p0[0]);
    var blend = (1 - Math.cos(local * Math.PI)) / 2;
    return p0[1] + (p1[1] - p0[1]) * blend;
}

function buildScalePoints(pose, h, zones) {
    var noseP = getKeypoint(pose, 'nose');
    var lShoulder = getKeypoint(pose, 'leftShoulder');
    var rShoulder = getKeypoint(pose, 'rightShoulder');
    var lHip = getKeypoint(pose, 'leftHip');
    var rHip = getKeypoint(pose, 'rightHip');
    var lKnee = getKeypoint(pose, 'leftKnee');
    var rKnee = getKeypoint(pose, 'rightKnee');
    var lAnkle = getKeypoint(pose, 'leftAnkle');
    var rAnkle = getKeypoint(pose, 'rightAnkle');

    var headY = noseP ? noseP.y / h : 0.12;
    var shoulderY = (lShoulder && rShoulder) ? ((lShoulder.y + rShoulder.y) / 2) / h : 0.25;
    var hipY = (lHip && rHip) ? ((lHip.y + rHip.y) / 2) / h : 0.55;
    var waistY = (shoulderY + hipY) / 2;
    var chestY = shoulderY + (hipY - shoulderY) * 0.25;
    var kneeY = (lKnee && rKnee) ? ((lKnee.y + rKnee.y) / 2) / h : 0.78;
    var ankleY = (lAnkle && rAnkle) ? ((lAnkle.y + rAnkle.y) / 2) / h : 0.95;

    var pts = [];
    pts.push([0, 1.0]);
    pts.push([Math.max(0.01, headY - 0.06), 1.0]);
    pts.push([headY, zones.head || 1.0]);
    pts.push([shoulderY, zones.shoulders || 1.0]);
    pts.push([chestY, zones.chest !== undefined ? zones.chest : (zones.shoulders || 1.0)]);
    pts.push([waistY, zones.waist || 1.0]);
    pts.push([hipY, zones.hips || 1.0]);
    pts.push([kneeY, zones.knees || 1.0]);
    pts.push([ankleY, zones.ankles || 1.0]);
    pts.push([1.0, 1.0]);
    return pts;
}

function bilinearSample(pixels, x, y, w, h) {
    var x0 = Math.floor(x), y0 = Math.floor(y);
    var x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
    x0 = Math.max(0, Math.min(x0, w - 1));
    y0 = Math.max(0, Math.min(y0, h - 1));
    var fx = x - Math.floor(x), fy = y - Math.floor(y);
    var w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy);
    var w01 = (1 - fx) * fy, w11 = fx * fy;
    var i00 = (y0 * w + x0) * 4, i10 = (y0 * w + x1) * 4;
    var i01 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4;
    return [
        pixels[i00] * w00 + pixels[i10] * w10 + pixels[i01] * w01 + pixels[i11] * w11,
        pixels[i00 + 1] * w00 + pixels[i10 + 1] * w10 + pixels[i01 + 1] * w01 + pixels[i11 + 1] * w11,
        pixels[i00 + 2] * w00 + pixels[i10 + 2] * w10 + pixels[i01 + 2] * w01 + pixels[i11 + 2] * w11
    ];
}

// Person-only horizontal warp with background preservation
function warpPersonHorizontal(srcPixels, bgPlate, mask, softMask, w, h, scalePoints) {
    var dst = new Uint8ClampedArray(bgPlate.length);
    dst.set(bgPlate);

    for (var y = 0; y < h; y++) {
        var left = -1, right = -1;
        for (var x = 0; x < w; x++) {
            if (mask[y * w + x] === 1) {
                if (left === -1) left = x;
                right = x;
            }
        }
        if (left === -1 || right - left <= 1) continue;

        var personCenter = (left + right) / 2;
        var personWidth = right - left;
        var scale = smoothScale(scalePoints, y / h);
        var newWidth = personWidth * scale;
        var newLeft = personCenter - newWidth / 2;

        // Also compute source Y with slight vertical offset for smoother result
        var scaleAbove = (y > 0) ? smoothScale(scalePoints, (y - 1) / h) : scale;
        var scaleBelow = (y < h - 1) ? smoothScale(scalePoints, (y + 1) / h) : scale;
        var srcYOffset = (scaleBelow - scaleAbove) * 0.25;

        for (var dx = Math.max(0, Math.floor(newLeft)); dx <= Math.min(w - 1, Math.ceil(newLeft + newWidth)); dx++) {
            var relX = (dx - newLeft) / newWidth;
            var srcX = left + relX * personWidth;
            var srcY = y + srcYOffset;
            if (srcX < 0 || srcX >= w - 1 || srcY < 0 || srcY >= h - 1) continue;

            var rgb = bilinearSample(srcPixels, srcX, srcY, w, h);
            var dstIdx = (y * w + dx) * 4;

            var srcXClamped = Math.min(Math.max(Math.round(srcX), 0), w - 1);
            var srcYClamped = Math.min(Math.max(Math.round(srcY), 0), h - 1);
            var alpha = softMask[srcYClamped * w + srcXClamped];

            dst[dstIdx] = Math.round(rgb[0] * alpha + bgPlate[dstIdx] * (1 - alpha));
            dst[dstIdx + 1] = Math.round(rgb[1] * alpha + bgPlate[dstIdx + 1] * (1 - alpha));
            dst[dstIdx + 2] = Math.round(rgb[2] * alpha + bgPlate[dstIdx + 2] * (1 - alpha));
            dst[dstIdx + 3] = 255;
        }
    }
    return dst;
}

// Full-image scanline warp for vertical transforms, composited with mask
function warpFullWithMask(srcPixels, bgPlate, softMask, w, h, xScalePoints, yMapping) {
    var dst = new Uint8ClampedArray(bgPlate.length);
    dst.set(bgPlate);

    for (var y = 0; y < h; y++) {
        var tDest = y / h;
        var tSrc = smoothScale(yMapping, tDest);
        var xScale = smoothScale(xScalePoints, tDest);

        var stripW = Math.round(w * xScale);
        var offsetX = Math.round((w - stripW) / 2);
        var srcYf = tSrc * h;
        if (srcYf < 0 || srcYf >= h - 1) continue;

        for (var dx = Math.max(0, offsetX); dx < Math.min(w, offsetX + stripW); dx++) {
            var relX = (dx - offsetX) / stripW;
            var srcX = relX * w;
            if (srcX < 0 || srcX >= w - 1) continue;

            var sxClamped = Math.min(Math.max(Math.round(srcX), 0), w - 1);
            var syClamped = Math.min(Math.max(Math.round(srcYf), 0), h - 1);
            var maskAlpha = softMask[syClamped * w + sxClamped];
            if (maskAlpha < 0.05) continue;

            var rgb = bilinearSample(srcPixels, srcX, srcYf, w, h);
            var dstIdx = (y * w + dx) * 4;

            dst[dstIdx] = Math.round(rgb[0] * maskAlpha + bgPlate[dstIdx] * (1 - maskAlpha));
            dst[dstIdx + 1] = Math.round(rgb[1] * maskAlpha + bgPlate[dstIdx + 1] * (1 - maskAlpha));
            dst[dstIdx + 2] = Math.round(rgb[2] * maskAlpha + bgPlate[dstIdx + 2] * (1 - maskAlpha));
            dst[dstIdx + 3] = 255;
        }
    }
    return dst;
}

// ==========================================
// 7. TRANSFORM DEFINITIONS
// ==========================================
var transformTypes = [
    {
        name: '근육질 체형',
        emoji: '🏋️',
        description: '넓은 어깨와 좁은 허리의 V자 실루엣',
        apply: function(srcPixels, bgPlate, mask, softMask, w, h, pose) {
            var pts = buildScalePoints(pose, h, {
                head: 1.0, shoulders: 1.15, chest: 1.1,
                waist: 0.88, hips: 1.0, knees: 1.0, ankles: 1.0
            });
            return warpPersonHorizontal(srcPixels, bgPlate, mask, softMask, w, h, pts);
        }
    },
    {
        name: '통통한 체형',
        emoji: '🍔',
        description: '전체적으로 볼륨감 있는 풍성한 체형',
        apply: function(srcPixels, bgPlate, mask, softMask, w, h, pose) {
            var pts = buildScalePoints(pose, h, {
                head: 1.02, shoulders: 1.1, chest: 1.16,
                waist: 1.22, hips: 1.16, knees: 1.08, ankles: 1.02
            });
            return warpPersonHorizontal(srcPixels, bgPlate, mask, softMask, w, h, pts);
        }
    },
    {
        name: '마른 체형',
        emoji: '🦴',
        description: '전체적으로 슬림하고 날씬한 체형',
        apply: function(srcPixels, bgPlate, mask, softMask, w, h, pose) {
            var pts = buildScalePoints(pose, h, {
                head: 0.98, shoulders: 0.9, chest: 0.86,
                waist: 0.82, hips: 0.85, knees: 0.88, ankles: 0.94
            });
            return warpPersonHorizontal(srcPixels, bgPlate, mask, softMask, w, h, pts);
        }
    },
    {
        name: '키 큰 체형',
        emoji: '📏',
        description: '수직으로 늘씬하게 늘어난 체형',
        apply: function(srcPixels, bgPlate, mask, softMask, w, h, pose) {
            return warpFullWithMask(srcPixels, bgPlate, softMask, w, h,
                [[0, 0.98], [0.3, 0.96], [0.5, 0.95], [0.7, 0.96], [1, 0.98]],
                [[0, 0], [0.1, 0.13], [0.25, 0.32], [0.45, 0.55], [0.65, 0.76], [0.85, 0.92], [1, 1]]
            );
        }
    },
    {
        name: '키 작은 체형',
        emoji: '🔲',
        description: '수직으로 압축된 아담한 체형',
        apply: function(srcPixels, bgPlate, mask, softMask, w, h, pose) {
            return warpFullWithMask(srcPixels, bgPlate, softMask, w, h,
                [[0, 1.01], [0.3, 1.04], [0.5, 1.06], [0.7, 1.04], [1, 1.01]],
                [[0, 0], [0.15, 0.12], [0.35, 0.28], [0.55, 0.46], [0.75, 0.66], [0.9, 0.82], [1, 1]]
            );
        }
    }
];

// ==========================================
// 8. UI EVENT HANDLERS
// ==========================================
imageUpload.addEventListener('change', function(event) {
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
        previewImage.src = e.target.result;
        previewImage.style.display = 'block';
        originalPreview.querySelector('p').style.display = 'none';

        var img = new Image();
        img.onload = function() { loadedImage = img; };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

transformButton.addEventListener('click', function() {
    if (!loadedImage || !bpModel) {
        alert('이미지를 업로드하고 모델 로딩이 완료될 때까지 기다려주세요.');
        return;
    }

    setButtonLoading(true);
    showStatus('AI가 사진 속 인물을 분석하고 있습니다...');
    resultsGrid.innerHTML = '';
    resultsContainer.style.display = 'none';

    // Draw image to processing canvas
    var maxW = 800;
    var cw = Math.min(loadedImage.width, maxW);
    var ratio = loadedImage.height / loadedImage.width;
    var ch = Math.floor(cw * ratio);

    var procCanvas = document.createElement('canvas');
    procCanvas.width = cw;
    procCanvas.height = ch;
    var procCtx = procCanvas.getContext('2d');
    procCtx.drawImage(loadedImage, 0, 0, cw, ch);

    var srcImageData = procCtx.getImageData(0, 0, cw, ch);
    var srcPixels = srcImageData.data;

    // Run BodyPix segmentation
    analyzeImage(procCanvas).then(function(analysis) {
        if (!analysis || !analysis.pose) {
            showStatus('사진에서 인물을 찾지 못했습니다. 다른 사진을 시도해주세요.', true);
            setButtonLoading(false);
            return;
        }

        showStatus('체형 변환을 적용하고 있습니다...');

        var mask = analysis.mask;
        var pose = analysis.pose;
        var w = cw, h = ch;
        var FEATHER = 10;

        // Create feathered mask and background plate
        var softMask = featherMask(mask, w, h, FEATHER);
        var bgPlate = createBackgroundPlate(srcPixels, mask, w, h, FEATHER + 2);

        // Apply each transform
        resultsContainer.style.display = 'block';

        for (var i = 0; i < transformTypes.length; i++) {
            var type = transformTypes[i];

            var resultPixels = type.apply(srcPixels, bgPlate, mask, softMask, w, h, pose);
            var resultData = new ImageData(new Uint8ClampedArray(resultPixels), w, h);

            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.putImageData(resultData, 0, 0);

            var card = document.createElement('div');
            card.className = 'result-card';

            var label = document.createElement('div');
            label.className = 'result-label';
            label.innerHTML = '<span class="result-emoji">' + type.emoji + '</span> ' +
                '<strong>' + type.name + '</strong><br>' +
                '<small>' + type.description + '</small>';

            card.appendChild(canvas);
            card.appendChild(label);
            resultsGrid.appendChild(card);
        }

        hideStatus();
        setButtonLoading(false);
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }).catch(function(err) {
        showStatus('오류가 발생했습니다: ' + err.message, true);
        setButtonLoading(false);
        console.error(err);
    });
});
