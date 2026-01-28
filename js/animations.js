/* =====================================================
   AgriPlanner - GSAP Animation Utilities
   Reusable animation functions
   ===================================================== */

/**
 * Check if GSAP is loaded
 * @returns {boolean}
 */
function isGsapLoaded() {
    return typeof gsap !== 'undefined';
}

/**
 * Fade in elements from bottom with stagger
 * @param {string|Element|NodeList} elements - Target elements
 * @param {Object} options - Animation options
 */
function fadeInUp(elements, options = {}) {
    if (!isGsapLoaded()) return;

    const defaults = {
        duration: 0.6,
        stagger: 0.1,
        distance: 30,
        delay: 0,
        ease: 'power2.out'
    };

    const settings = { ...defaults, ...options };

    gsap.fromTo(elements,
        {
            opacity: 0,
            y: settings.distance
        },
        {
            opacity: 1,
            y: 0,
            duration: settings.duration,
            stagger: settings.stagger,
            delay: settings.delay,
            ease: settings.ease
        }
    );
}

/**
 * Fade in elements from left
 * @param {string|Element|NodeList} elements - Target elements
 * @param {Object} options - Animation options
 */
function fadeInLeft(elements, options = {}) {
    if (!isGsapLoaded()) return;

    const defaults = {
        duration: 0.5,
        stagger: 0.1,
        distance: 30,
        delay: 0,
        ease: 'power2.out'
    };

    const settings = { ...defaults, ...options };

    gsap.fromTo(elements,
        { opacity: 0, x: -settings.distance },
        {
            opacity: 1,
            x: 0,
            duration: settings.duration,
            stagger: settings.stagger,
            delay: settings.delay,
            ease: settings.ease
        }
    );
}

/**
 * Fade in elements from right
 * @param {string|Element|NodeList} elements - Target elements
 * @param {Object} options - Animation options
 */
function fadeInRight(elements, options = {}) {
    if (!isGsapLoaded()) return;

    const defaults = {
        duration: 0.5,
        stagger: 0.1,
        distance: 30,
        delay: 0,
        ease: 'power2.out'
    };

    const settings = { ...defaults, ...options };

    gsap.fromTo(elements,
        { opacity: 0, x: settings.distance },
        {
            opacity: 1,
            x: 0,
            duration: settings.duration,
            stagger: settings.stagger,
            delay: settings.delay,
            ease: settings.ease
        }
    );
}

/**
 * Scale in animation with bounce
 * @param {string|Element|NodeList} elements - Target elements
 * @param {Object} options - Animation options
 */
function scaleIn(elements, options = {}) {
    if (!isGsapLoaded()) return;

    const defaults = {
        duration: 0.5,
        stagger: 0.1,
        delay: 0,
        ease: 'back.out(1.7)'
    };

    const settings = { ...defaults, ...options };

    gsap.fromTo(elements,
        { opacity: 0, scale: 0.8 },
        {
            opacity: 1,
            scale: 1,
            duration: settings.duration,
            stagger: settings.stagger,
            delay: settings.delay,
            ease: settings.ease
        }
    );
}

/**
 * Animate number counting up
 * @param {Element} element - Target element
 * @param {number} target - Target number
 * @param {Object} options - Animation options
 */
function countUp(element, target, options = {}) {
    if (!isGsapLoaded()) return;

    const defaults = {
        duration: 1.5,
        delay: 0,
        ease: 'power2.out',
        prefix: '',
        suffix: '',
        decimals: 0
    };

    const settings = { ...defaults, ...options };
    const obj = { value: 0 };

    gsap.to(obj, {
        value: target,
        duration: settings.duration,
        delay: settings.delay,
        ease: settings.ease,
        onUpdate: () => {
            const formattedValue = settings.decimals > 0
                ? obj.value.toFixed(settings.decimals)
                : Math.round(obj.value);
            element.textContent = settings.prefix + formattedValue + settings.suffix;
        }
    });
}

/**
 * Animate chart bars from bottom
 * @param {string|Element|NodeList} bars - Chart bar elements
 * @param {Object} options - Animation options
 */
function animateBars(bars, options = {}) {
    if (!isGsapLoaded()) return;

    const defaults = {
        duration: 0.8,
        stagger: 0.05,
        delay: 0,
        ease: 'power2.out'
    };

    const settings = { ...defaults, ...options };

    gsap.fromTo(bars,
        { scaleY: 0 },
        {
            scaleY: 1,
            duration: settings.duration,
            stagger: settings.stagger,
            delay: settings.delay,
            ease: settings.ease,
            transformOrigin: 'bottom center'
        }
    );
}

/**
 * Animate line chart drawing
 * @param {Element} path - SVG path element
 * @param {Object} options - Animation options
 */
function drawLine(path, options = {}) {
    if (!isGsapLoaded()) return;

    const defaults = {
        duration: 1.5,
        delay: 0,
        ease: 'power2.inOut'
    };

    const settings = { ...defaults, ...options };
    const length = path.getTotalLength();

    gsap.fromTo(path,
        {
            strokeDasharray: length,
            strokeDashoffset: length
        },
        {
            strokeDashoffset: 0,
            duration: settings.duration,
            delay: settings.delay,
            ease: settings.ease
        }
    );
}

/**
 * Hover scale effect
 * @param {Element} element - Target element
 * @param {number} scale - Scale amount (default 1.05)
 */
function addHoverScale(element, scale = 1.05) {
    if (!isGsapLoaded()) return;

    element.addEventListener('mouseenter', () => {
        gsap.to(element, {
            scale: scale,
            duration: 0.2,
            ease: 'power2.out'
        });
    });

    element.addEventListener('mouseleave', () => {
        gsap.to(element, {
            scale: 1,
            duration: 0.2,
            ease: 'power2.out'
        });
    });
}

/**
 * Slide down animation for dropdowns/accordions
 * @param {Element} element - Target element
 * @param {Object} options - Animation options
 */
function slideDown(element, options = {}) {
    if (!isGsapLoaded()) return;

    const defaults = {
        duration: 0.3,
        ease: 'power2.out'
    };

    const settings = { ...defaults, ...options };

    gsap.fromTo(element,
        { height: 0, opacity: 0 },
        {
            height: 'auto',
            opacity: 1,
            duration: settings.duration,
            ease: settings.ease
        }
    );
}

/**
 * Slide up animation
 * @param {Element} element - Target element
 * @param {Object} options - Animation options
 */
function slideUp(element, options = {}) {
    if (!isGsapLoaded()) return;

    const defaults = {
        duration: 0.3,
        ease: 'power2.in'
    };

    const settings = { ...defaults, ...options };

    gsap.to(element, {
        height: 0,
        opacity: 0,
        duration: settings.duration,
        ease: settings.ease
    });
}

/**
 * Pulse animation for attention
 * @param {Element} element - Target element
 */
function pulse(element) {
    if (!isGsapLoaded()) return;

    gsap.to(element, {
        scale: 1.05,
        duration: 0.3,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut'
    });
}

/**
 * Shake animation for errors
 * @param {Element} element - Target element
 */
function shake(element) {
    if (!isGsapLoaded()) return;

    gsap.to(element, {
        x: [-10, 10, -10, 10, 0],
        duration: 0.4,
        ease: 'power2.inOut'
    });
}

// Export animation utilities
window.Animations = {
    isGsapLoaded,
    fadeInUp,
    fadeInLeft,
    fadeInRight,
    scaleIn,
    countUp,
    animateBars,
    drawLine,
    addHoverScale,
    slideDown,
    slideUp,
    pulse,
    shake
};
