document.addEventListener('DOMContentLoaded', () => {

    /*CONFIGURATION & DATA */
    const CONFIG = {
        bgColors: ['#000000'],
        storyTexts: [
            "The book is Infinite. None of its pages is the first; none the last.",
            "If space is infinite, we are at any point in space. If time is infinite, we are at any point in time.",
            "I looked at the number of pages. It was exactly 40,514.",
            "He told me his book was called the Book of Sand, because neither the book nor the sand has any beginning or end.",
            "The stranger asked me to find the first page. I put my left hand on the cover and opened the book with my thumb and forefinger. It was impossible.",
            "Lines consist of points; planes of lines; volumes of planes; hypervolumes of volumes...",
            "To tell the truth is nowadays the convention of every made-up story.",
            "I bought the book. I paid a sum I shall not mention.",
            "I hid the Book of Sand behind some imperfect volumes of the Thousand and One Nights.",
            "The sand is infinite. The book is infinite.",
            "I saw at once that he was a foreigner. At first, he struck me as old; only later did I realize that I had been misled by his thin blond hair.",
            "I sell Bibles, he said. Somewhat pedantically, I replied, 'In this house are several English Bibles'.",
            "It was an octavo volume, bound in cloth. There was no doubt that it had passed through many hands.",
            "I opened the book at random. The script was strange to me.",
            "Look at the illustration closely. You'll never see it again."
        ],
        faceRotations: {
            'front': { x: 0, y: 0 },
            'back': { x: 0, y: 180 },
            'right': { x: 0, y: -90 },
            'left': { x: 0, y: 90 },
            'top': { x: -90, y: 0 },
            'bottom': { x: 90, y: 0 }
        }
    };

    /*DOM ELEMENTS */
    const elements = {
        entryPage: document.getElementById('entry-page'),
        cubePage: document.getElementById('cube-page'),
        loginForm: document.getElementById('login-form'),
        urlInput: document.getElementById('url-code'),
        errorMessage: document.getElementById('error-message'),
        textScene: document.getElementById('text-scene'),
        textCube: document.getElementById('text-cube'),
        formatBtn: document.getElementById('format-btn'),
        cubesContainer: document.querySelector('.cubes-container'),
        videoElement: document.getElementsByClassName('input_video')[0],
        canvasElement: document.getElementsByClassName('output_canvas')[0]
    };

    /*STATE MANAGEMENT */
    const state = {
        mode: {
            current: 'default',
            list: ['default', 'flow'],
            index: 0
        },
        cubes: {
            text: {
                element: elements.textCube,
                rotX: -20,
                rotY: -30,
                isDragging: false,
                startX: 0,
                startY: 0,
                lastFace: 'front'
            }
        },
        flow: {
            active: false,
            paused: false,
            manualFocus: false,
            elements: [],
            requestId: null
        },
        hand: {
            isPinching: false,
            pinchStartX: 0,
            pinchStartY: 0
        },
        camera: null
    };

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isTouchDevice) {
        const vc = document.querySelector('.video-container');
        if (vc) vc.style.display = 'none';
    }

    /*TITLE PARTICLE EFFECT */
    function initTitleParticleEffect() {
        const title = document.querySelector('.title');
        if (!title) return;

        // No mouse on touch devices — skip the RAF loop, title renders as plain CSS text
        if (isTouchDevice) return function start() {};

        let particles = [];
        let overlayCanvas = null;
        let ctx = null;
        let mouseX = -9999, mouseY = -9999;
        let rafId = null;

        const REPEL_RADIUS = 160;
        const REPEL_FORCE = 22;
        const SPRING = 0.022;
        const FRICTION = 0.91;
        const SAMPLE_STEP = 2;
        const PARTICLE_COLOR = '#FFFFFF';

        function setup() {
            const rect = title.getBoundingClientRect();
            if (rect.width === 0) return;

            const fontSize = parseFloat(getComputedStyle(title).fontSize);
            const PAD = 12;

            const ofc = document.createElement('canvas');
            ofc.width = Math.ceil(rect.width) + PAD * 2;
            ofc.height = Math.ceil(rect.height) + PAD * 2;
            const oc = ofc.getContext('2d');

            oc.fillStyle = '#fff';
            oc.font = `900 ${fontSize}px Respira, serif`;
            oc.textAlign = 'left';
            oc.textBaseline = 'alphabetic';

            const m = oc.measureText('The Book');
            const ascent = m.actualBoundingBoxAscent;
            const line1Y = PAD + ascent;
            const line2Y = line1Y + fontSize * 1.0524;

            const spaceW = oc.measureText(' ').width;
            const theW   = oc.measureText('The').width;
            const ofW    = oc.measureText('of').width;

            oc.fillText('The', PAD, line1Y);
            oc.fillText('Book', PAD + theW + spaceW - fontSize * 0.11, line1Y);
            oc.fillText('of', PAD, line2Y);
            oc.fillText('Sand', PAD + ofW + spaceW - fontSize * 0.05, line2Y);

            const imgData = oc.getImageData(0, 0, ofc.width, ofc.height);
            const d = imgData.data;
            particles = [];

            for (let py = 0; py < ofc.height; py += SAMPLE_STEP) {
                for (let px = 0; px < ofc.width; px += SAMPLE_STEP) {
                    if (d[(py * ofc.width + px) * 4 + 3] > 100) {
                        const hx = rect.left + px - PAD;
                        const hy = rect.top + py - PAD;
                        particles.push({ homeX: hx, homeY: hy, x: hx, y: hy, vx: 0, vy: 0 });
                    }
                }
            }

            if (!overlayCanvas) {
                overlayCanvas = document.createElement('canvas');
                overlayCanvas.id = 'title-particle-canvas';
                overlayCanvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:11;transition:opacity 0.6s ease;';
                document.body.appendChild(overlayCanvas);
            }
            overlayCanvas.width = window.innerWidth;
            overlayCanvas.height = window.innerHeight;
            ctx = overlayCanvas.getContext('2d');

            title.classList.add('particles-active');
            if (!rafId) rafId = requestAnimationFrame(animate);
        }

        function animate() {
            ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            ctx.fillStyle = PARTICLE_COLOR;

            for (const p of particles) {
                const dx = mouseX - p.x;
                const dy = mouseY - p.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < REPEL_RADIUS * REPEL_RADIUS && distSq > 0.01) {
                    const dist = Math.sqrt(distSq);
                    const f = (1 - dist / REPEL_RADIUS) * REPEL_FORCE;
                    p.vx -= (dx / dist) * f + (Math.random() - 0.5) * f * 0.6;
                    p.vy -= (dy / dist) * f + (Math.random() - 0.5) * f * 0.6;
                }

                p.vx += (p.homeX - p.x) * SPRING;
                p.vy += (p.homeY - p.y) * SPRING;
                p.vx *= FRICTION;
                p.vy *= FRICTION;
                p.x += p.vx;
                p.y += p.vy;

                ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
            }

            rafId = requestAnimationFrame(animate);
        }

        return function start() {
            document.fonts.ready.then(setup);
            document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
            let resizeTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    title.classList.remove('particles-active');
                    cancelAnimationFrame(rafId);
                    rafId = null;
                    setup();
                }, 150);
            });
        };
    }

    /*INTRO ANIMATION*/
    function initIntroAnimation(onComplete) {
        const screen = document.getElementById('intro-screen');
        if (!screen) { onComplete(); return; }

        const canvas = document.getElementById('intro-bg-canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const SIZE = Math.min(canvas.width, canvas.height) * 0.18;
        const letters = ['A', 'C', 'G', 'M', 'R'];

        const balls = letters.map(ch => ({
            ch,
            x: SIZE + Math.random() * (canvas.width - SIZE * 2),
            y: SIZE + Math.random() * (canvas.height - SIZE * 2),
            vx: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 3),
            vy: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 3),
        }));

        let rafId;
        let alpha = 0;
        let fading = false;
        let fadeTs = 0;

        function draw(ts) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (!fading) alpha = Math.min(1, alpha + 0.03);
            else alpha = Math.max(0, 1 - (ts - fadeTs) / 800);

            ctx.font = `900 ${SIZE}px 'Yarndings 12', serif`;
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = alpha;

            for (const b of balls) {
                b.x += b.vx;
                b.y += b.vy;
                if (b.x < 0)                    { b.x = 0;                    b.vx *= -1; }
                if (b.x > canvas.width - SIZE)  { b.x = canvas.width - SIZE;  b.vx *= -1; }
                if (b.y < SIZE)                 { b.y = SIZE;                 b.vy *= -1; }
                if (b.y > canvas.height)        { b.y = canvas.height;        b.vy *= -1; }
                ctx.fillText(b.ch, b.x, b.y);
            }

            ctx.globalAlpha = 1;
            if (!fading || alpha > 0) rafId = requestAnimationFrame(draw);
        }
        rafId = requestAnimationFrame(draw);

        let done = false;
        function finish() {
            if (done) return;
            done = true;
            screen.style.background = 'transparent';
            onComplete();
            setTimeout(() => {
                screen.style.opacity = '0';
                setTimeout(() => { screen.style.display = 'none'; cancelAnimationFrame(rafId); }, 800);
            }, 1500);
        }

        screen.style.pointerEvents = 'auto';
        screen.addEventListener('click', finish);
        setTimeout(finish, 9200);
    }

    /*NAVIGATION */
    function initNavigation() {
        elements.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const url = elements.urlInput.value.trim();

            if (isValidUrl(url)) {
                elements.errorMessage.classList.remove('visible');
                transitionToCube();
            } else {
                elements.errorMessage.textContent = "Please enter a valid URL (e.g., https://example.com)";
                elements.errorMessage.classList.add('visible');
            }
        });
    }

    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    function transitionToCube() {
        elements.entryPage.classList.remove('active');
        elements.entryPage.classList.add('hidden');

        const particleCanvas = document.getElementById('title-particle-canvas');
        if (particleCanvas) particleCanvas.style.opacity = '0';

        setTimeout(() => {
            elements.entryPage.style.display = 'none';
            if (particleCanvas) particleCanvas.style.display = 'none';
            elements.cubePage.classList.remove('hidden');
            elements.cubePage.classList.add('active');
        }, 600);
    }

    /*CUBE INTERACTION */
    function getRandomItem(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function getDominantFace(rotX, rotY) {
        const rx = rotX * Math.PI / 180;
        const ry = rotY * Math.PI / 180;
        const cx = Math.cos(rx), sx = Math.sin(rx);
        const cy = Math.cos(ry), sy = Math.sin(ry);

        const zComponents = {
            front: cx * cy,
            back: -(cx * cy),
            right: -(cx * sy),
            left: cx * sy,
            top: -sx,
            bottom: sx
        };

        let maxZ = -Infinity;
        let dominantFace = 'front';

        for (const [face, z] of Object.entries(zComponents)) {
            if (z > maxZ) {
                maxZ = z;
                dominantFace = face;
            }
        }
        return dominantFace;
    }

    function handleFaceChange(face) {
        for (let i = 1; i <= 6; i++) {
            document.documentElement.style.setProperty(`--color-${i}`, getRandomItem(CONFIG.bgColors));
        }

        const textFaceEl = state.cubes.text.element.querySelector(`.cube-face.${face}`);
        if (textFaceEl) {
            const p = textFaceEl.querySelector('p');
            if (p) p.textContent = getRandomItem(CONFIG.storyTexts);
        }
    }

    function updateCubeTransform(type) {
        const cube = state.cubes[type];
        cube.element.style.transform = `rotateX(${cube.rotX}deg) rotateY(${cube.rotY}deg)`;
    }

    function snapToNearestFace(type) {
        const cube = state.cubes[type];
        const currentDominant = getDominantFace(cube.rotX, cube.rotY);
        const target = CONFIG.faceRotations[currentDominant];

        const normalize = (val, targetVal) => {
            const k = Math.round((val - targetVal) / 360);
            return targetVal + k * 360;
        };

        cube.rotX = normalize(cube.rotX, target.x);
        cube.rotY = normalize(cube.rotY, target.y);

        updateCubeTransform(type);

        if (currentDominant !== cube.lastFace) {
            cube.lastFace = currentDominant;
            handleFaceChange(currentDominant);
        }
    }

    function setupDrag(scene, type) {
        const cube = state.cubes[type];

        const onStart = (x, y) => {
            cube.isDragging = true;
            cube.startX = x;
            cube.startY = y;
            scene.style.cursor = 'grabbing';
        };

        const onEnd = () => {
            cube.isDragging = false;
            scene.style.cursor = 'grab';
        };

        const onMove = (x, y) => {
            if (!cube.isDragging) return;
            const deltaX = x - cube.startX;
            const deltaY = y - cube.startY;

            cube.rotY += deltaX * 0.5;
            cube.rotX -= deltaY * 0.5;

            updateCubeTransform(type);

            const currentDominant = getDominantFace(cube.rotX, cube.rotY);
            if (currentDominant !== cube.lastFace) {
                cube.lastFace = currentDominant;
                handleFaceChange(currentDominant);
            }

            cube.startX = x;
            cube.startY = y;
        };

        scene.addEventListener('mousedown', (e) => {
            onStart(e.clientX, e.clientY);
            e.stopPropagation();
        });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));

        scene.addEventListener('touchstart', (e) => {
            onStart(e.touches[0].clientX, e.touches[0].clientY);
            e.stopPropagation();
        });
        document.addEventListener('touchend', onEnd);
        document.addEventListener('touchmove', (e) => {
            if (!cube.isDragging) return;
            e.preventDefault();
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
    }

    function initCubeInteraction() {
        setupDrag(elements.textScene, 'text');

        document.querySelectorAll('.cube-face').forEach(face => {
            face.addEventListener('click', () => {
                const faceType = Array.from(face.classList).find(c => CONFIG.faceRotations[c]);
                if (!faceType) return;

                const target = CONFIG.faceRotations[faceType];
                const cube = state.cubes.text;

                cube.rotX = target.x;
                cube.rotY = target.y;

                if (faceType !== cube.lastFace) {
                    cube.lastFace = faceType;
                    handleFaceChange(faceType);
                }
                updateCubeTransform('text');
            });
        });
    }

    /*FLOW MODE */
    function initFlowMode() {
        state.flow.active = true;
        state.flow.paused = false;
        state.flow.manualFocus = false;
        state.flow.elements = [];

        const containerW = window.innerWidth;
        const containerH = window.innerHeight;

        for (let i = 0; i < 30; i++) {
            const el = document.createElement('div');
            el.classList.add('flow-item');

            const text = getRandomItem(CONFIG.storyTexts);
            el.textContent = text;
            elements.cubesContainer.appendChild(el);

            const isMobile = window.innerWidth < 768;
            const w = isMobile ? 150 : 200;
            const h = isMobile ? 80 : 100;
            const x = Math.random() * (containerW - w);
            const y = Math.random() * (containerH - h);

            state.flow.elements.push({
                el,
                x, y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                w, h,
                fullText: text
            });

            el.style.transform = `translate(${x}px, ${y}px)`;
        }

        cancelAnimationFrame(state.flow.requestId);
        animateFlow();
    }

    function cleanupFlowMode() {
        state.flow.active = false;
        cancelAnimationFrame(state.flow.requestId);
        document.querySelectorAll('.flow-item').forEach(item => item.remove());
        state.flow.elements = [];
    }

    function animateFlow() {
        if (!state.flow.active) return;

        if (!state.flow.paused) {
            const containerW = window.innerWidth;
            const containerH = window.innerHeight;

            state.flow.elements.forEach(obj => {
                obj.x += obj.vx;
                obj.y += obj.vy;

                if (obj.x <= 0 || obj.x + obj.w >= containerW) {
                    obj.vx *= -1;
                    obj.x = Math.max(0, Math.min(obj.x, containerW - obj.w));
                }
                if (obj.y <= 0 || obj.y + obj.h >= containerH) {
                    obj.vy *= -1;
                    obj.y = Math.max(0, Math.min(obj.y, containerH - obj.h));
                }

                obj.el.style.transform = `translate(${obj.x}px, ${obj.y}px)`;
            });
        }
        state.flow.requestId = requestAnimationFrame(animateFlow);
    }

    function focusClosestElement() {
        if (state.flow.paused) return;
        state.flow.paused = true;

        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        let closestDist = Infinity;
        let closestObj = null;

        state.flow.elements.forEach(obj => {
            const centerX = obj.x + obj.w / 2;
            const centerY = obj.y + obj.h / 2;
            const dist = Math.hypot(centerX - cx, centerY - cy);

            if (dist < closestDist) {
                closestDist = dist;
                closestObj = obj;
            }
        });

        if (closestObj) {
            state.flow.elements.forEach(obj => {
                if (obj === closestObj) {
                    obj.el.classList.add('focused');
                    obj.el.classList.remove('hidden');
                    const match = obj.fullText.match(/[^.?!]+[.?!]/);
                    obj.el.textContent = match ? match[0] : obj.fullText;

                    const targetX = cx - obj.el.offsetWidth / 2;
                    const targetY = cy - obj.el.offsetHeight / 2;
                    obj.el.style.transform = `translate(${targetX}px, ${targetY}px) scale(1.2)`;
                } else {
                    obj.el.classList.remove('focused');
                    obj.el.classList.add('hidden');
                }
            });
        }
    }

    function floatAllElements() {
        if (!state.flow.paused) return;
        state.flow.paused = false;

        state.flow.elements.forEach(obj => {
            obj.el.classList.remove('focused', 'hidden');
            obj.el.textContent = obj.fullText;
        });
    }

    /*MODE SWITCHING */
    function setupModeSwitch() {
        if (!elements.formatBtn) return;

        elements.formatBtn.addEventListener('click', () => {
            const currentMode = state.mode.list[state.mode.index];
            if (currentMode !== 'default') {
                elements.cubesContainer.classList.remove(`${currentMode}-mode`);
            }
            if (currentMode === 'flow') {
                cleanupFlowMode();
            }

            state.mode.index = (state.mode.index + 1) % state.mode.list.length;
            const newMode = state.mode.list[state.mode.index];
            state.mode.current = newMode;

            if (newMode !== 'default') {
                elements.cubesContainer.classList.add(`${newMode}-mode`);
            }

            if (newMode === 'flow') {
                elements.cubesContainer.scrollTop = 0;
                initFlowMode();
            }

        });
    }

    /*HAND TRACKING (MEDIAPIPE) */
    function initHandTracking() {
        if (isTouchDevice) return;

        // Scripts are injected dynamically in <head> and load async — wait for them
        if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
            setTimeout(initHandTracking, 100);
            return;
        }

        const canvasCtx = elements.canvasElement.getContext('2d');
        const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        hands.onResults(onResultsDelegator);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.id === 'cube-page' &&
                    mutation.target.classList.contains('active') &&
                    !state.camera) {

                    state.camera = new Camera(elements.videoElement, {
                        onFrame: async () => {
                            await hands.send({ image: elements.videoElement });
                        },
                        width: 640,
                        height: 480
                    });
                    state.camera.start();
                }
            });
        });
        observer.observe(elements.cubePage, { attributes: true, attributeFilter: ['class'] });

        function isHandOpen(landmarks) {
            const wrist = landmarks[0];
            const tips = [8, 12, 16, 20];
            const pips = [6, 10, 14, 18];
            let extendedCount = 0;

            for (let i = 0; i < tips.length; i++) {
                const dTip = Math.hypot(landmarks[tips[i]].x - wrist.x, landmarks[tips[i]].y - wrist.y);
                const dPip = Math.hypot(landmarks[pips[i]].x - wrist.x, landmarks[pips[i]].y - wrist.y);
                if (dTip > dPip) extendedCount++;
            }
            return extendedCount >= 3;
        }

        function onResultsDelegator(results) {
            const currentMode = state.mode.current;

            canvasCtx.save();
            canvasCtx.clearRect(0, 0, elements.canvasElement.width, elements.canvasElement.height);
            canvasCtx.drawImage(results.image, 0, 0, elements.canvasElement.width, elements.canvasElement.height);

            if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
                if (currentMode === 'flow' && !state.flow.manualFocus) {
                    floatAllElements();
                }
                state.hand.isPinching = false;
                canvasCtx.restore();
                return;
            }

            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#000000', lineWidth: 1 });
                drawLandmarks(canvasCtx, landmarks, { color: '#000000', lineWidth: 1, radius: 2 });
            }

            if (currentMode === 'flow') {
                handleFlowGesture(results.multiHandLandmarks[0], isHandOpen);
            } else {
                handleCubeGesture(results.multiHandLandmarks);
            }

            canvasCtx.restore();
        }

        function handleFlowGesture(landmarks, isHandOpenFn) {
            if (state.flow.manualFocus) return;

            if (isHandOpenFn(landmarks)) {
                focusClosestElement();
            } else {
                floatAllElements();
            }
        }

        function handleCubeGesture(allLandmarks) {
            const PINCH_THRESHOLD = 0.05;

            const hand0 = allLandmarks[0];
            const thumb0 = hand0[4];
            const index0 = hand0[8];
            const dist0 = Math.hypot(index0.x - thumb0.x, index0.y - thumb0.y);

            if (dist0 < PINCH_THRESHOLD) {
                const cx = index0.x;
                const cy = index0.y;

                if (!state.hand.isPinching) {
                    state.hand.isPinching = true;
                    state.hand.pinchStartX = cx;
                    state.hand.pinchStartY = cy;
                    document.body.style.cursor = 'grabbing';
                } else {
                    const sensitivity = 800;
                    const deltaX = (cx - state.hand.pinchStartX) * sensitivity;
                    const deltaY = (cy - state.hand.pinchStartY) * sensitivity;

                    ['text'].forEach(type => {
                        const cube = state.cubes[type];
                        cube.rotY += deltaX * 0.5;
                        cube.rotX -= deltaY * 0.5;

                        updateCubeTransform(type);

                        const currentDominant = getDominantFace(cube.rotX, cube.rotY);
                        if (currentDominant !== cube.lastFace) {
                            cube.lastFace = currentDominant;
                            handleFaceChange(currentDominant);
                        }
                    });
                    state.hand.pinchStartX = cx;
                    state.hand.pinchStartY = cy;
                }
            } else {
                if (state.hand.isPinching) {
                    state.hand.isPinching = false;
                    document.body.style.cursor = 'default';
                }
            }

            if (allLandmarks.length > 1) {
                const hand1 = allLandmarks[1];
                const thumb1 = hand1[4];
                const index1 = hand1[8];
                const dist1 = Math.hypot(index1.x - thumb1.x, index1.y - thumb1.y);

                if (dist1 < PINCH_THRESHOLD) {
                    snapToNearestFace('text');
                }
            }
        }
    }

    /*GLOBAL LISTENERS */
    const modeToggleBtn = document.getElementById('mode-toggle');
    window.addEventListener('click', (e) => {
        if (state.mode.current === 'flow' && e.target !== elements.formatBtn && e.target !== modeToggleBtn) {
            state.flow.manualFocus = !state.flow.manualFocus;
            if (state.flow.manualFocus) {
                focusClosestElement();
            } else {
                floatAllElements();
            }
        }
    });

    /*FAVICON*/
    document.fonts.ready.then(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#fff';
        ctx.font = '900 26px "Yarndings 12", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('R', 16, 16);
        const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
        link.rel = 'icon';
        link.href = canvas.toDataURL();
        document.head.appendChild(link);
    });

    /*MODE TOGGLE*/
    document.getElementById('mode-toggle').addEventListener('click', () => {
        document.documentElement.classList.toggle('light-mode');
    });

    /*INIT */
    const startParticles = initTitleParticleEffect();
    initIntroAnimation(() => startParticles());
    initNavigation();
    initCubeInteraction();
    setupModeSwitch();
    initHandTracking();

});

