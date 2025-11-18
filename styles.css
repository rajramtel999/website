// Enhanced Navigation
class Navigation {
    constructor() {
        this.navToggle = document.querySelector('.nav-toggle');
        this.navMenu = document.querySelector('.nav-menu');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.sections = document.querySelectorAll('section');
        this.contactBtn = document.querySelector('.btn-contact');
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupScrollSpy();
    }

    setupEventListeners() {
        // Mobile menu toggle
        this.navToggle.addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        // Contact button event listener
        if (this.contactBtn) {
            this.contactBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(this.contactBtn.getAttribute('href'));
                this.fastSmoothScrollTo(target);
                
                // Close mobile menu if open
                this.closeMobileMenu();
            });
        }

        // Navigation links
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(link.getAttribute('href'));
                
                // Close mobile menu
                this.closeMobileMenu();
                
                // Fast smooth scroll to section
                this.fastSmoothScrollTo(target);
                
                // Update active state
                this.updateActiveNavLink(link);
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.navToggle.contains(e.target) && !this.navMenu.contains(e.target)) {
                this.closeMobileMenu();
            }
        });

        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMobileMenu();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 968) {
                this.closeMobileMenu();
            }
        });
    }

    toggleMobileMenu() {
        this.navMenu.classList.toggle('active');
        this.navToggle.classList.toggle('active');
        
        // Prevent body scroll when menu is open
        document.body.style.overflow = this.navMenu.classList.contains('active') ? 'hidden' : '';
    }

    closeMobileMenu() {
        this.navMenu.classList.remove('active');
        this.navToggle.classList.remove('active');
        document.body.style.overflow = '';
    }

    updateActiveNavLink(activeLink) {
        this.navLinks.forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
    }

    fastSmoothScrollTo(target) {
        if (!target) return;
        
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
        const startPosition = window.pageYOffset;
        const distance = targetPosition - startPosition - 70; // Account for fixed header
        const duration = Math.min(800, Math.max(400, Math.abs(distance) * 0.4));
        
        let start = null;

        const animation = (currentTime) => {
            if (start === null) start = currentTime;
            const timeElapsed = currentTime - start;
            const progress = Math.min(timeElapsed / duration, 1);
            
            // Cubic ease-in-out for smooth mobile experience
            const ease = progress < 0.5 
                ? 4 * progress * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            window.scrollTo(0, startPosition + distance * ease);
            
            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        };

        requestAnimationFrame(animation);
    }

    setupScrollSpy() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    this.updateNavLinksForSection(id);
                    this.animateSectionLine();
                }
            });
        }, { 
            threshold: 0.3,
            rootMargin: '-70px 0px -50% 0px' // Account for fixed header
        });

        this.sections.forEach(section => {
            observer.observe(section);
        });
    }

    updateNavLinksForSection(sectionId) {
        this.navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${sectionId}`) {
                link.classList.add('active');
            }
        });
    }

    animateSectionLine() {
        const lineProgress = document.querySelector('.line-progress');
        if (lineProgress) {
            lineProgress.style.width = '100%';
        }
    }
}

// Enhanced Animations
class Animations {
    constructor() {
        this.init();
    }

    init() {
        this.setupScrollAnimations();
        this.setupCounterAnimation();
        this.setupSkillAnimations();
        this.setupTypingAnimation();
        this.optimizePerformance();
    }

    optimizePerformance() {
        // Use transform and opacity for better performance
        const style = document.createElement('style');
        style.textContent = `
            .skill-category,
            .project-card,
            .feature-card,
            .info-card {
                will-change: transform, opacity;
            }
        `;
        document.head.appendChild(style);
    }

    setupTypingAnimation() {
        const codeLines = [
            {text: '<span class="code-variable">Profile</span> <span class="code-operator">=</span> <span class="code-brace">{</span>', delay: 100},
            {text: '<span class="code-property">&nbsp;&nbsp;Name:</span> <span class="code-string">"Khem Raj Ramtel"</span><span class="code-comment">,</span>', delay: 100},
            {text: '<span class="code-property">&nbsp;&nbsp;Role:</span> <span class="code-string">"Cybersecurity Student"</span><span class="code-comment">,</span>', delay: 100},
            {text: '<span class="code-property">&nbsp;&nbsp;Passion:</span> <span class="code-string">"Ethical Hacking"</span><span class="code-comment">,</span>', delay: 100},
            {text: '<span class="code-property">&nbsp;&nbsp;Location:</span> <span class="code-string">"Nepal"</span>', delay: 100},
            {text: '<span class="code-brace">}</span><span class="code-comment">;</span>', delay: 100}
        ];

        const codeContainer = document.getElementById('code-container');
        if (!codeContainer) return;

        let currentLine = 0;
        let hasAnimated = false;
        
        const typeLine = () => {
            if (currentLine < codeLines.length) {
                const line = document.createElement('div');
                line.className = 'code-line';
                line.innerHTML = `<span class="line-number">${currentLine + 1}</span>${codeLines[currentLine].text}`;
                codeContainer.appendChild(line);
                
                // Make line visible immediately
                setTimeout(() => {
                    line.classList.add('visible');
                }, 50);
                
                currentLine++;
                setTimeout(typeLine, codeLines[currentLine - 1].delay);
            }
        };
        
        // Start typing animation when code window is in view
        const codeWindow = document.querySelector('.code-window');
        if (!codeWindow) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !hasAnimated) {
                    hasAnimated = true;
                    setTimeout(typeLine, 300);
                }
            });
        }, { threshold: 0.3 });
        
        observer.observe(codeWindow);
    }

    setupScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // Observe all animate-able elements
        const elements = document.querySelectorAll('.skill-category, .project-card, .feature-card, .info-card');
        elements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            observer.observe(el);
        });
    }

    setupCounterAnimation() {
        const counters = document.querySelectorAll('.stat-value');
        if (counters.length === 0) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateCounter(entry.target);
                    observer.unobserve(entry.target); // Animate only once
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(counter => observer.observe(counter));
    }

    animateCounter(counter) {
        const target = parseInt(counter.getAttribute('data-count'));
        const duration = 1500;
        const step = target / (duration / 16);
        let current = 0;

        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            counter.textContent = Math.round(current);
        }, 16);
    }

    setupSkillAnimations() {
        const skillObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const progressBars = entry.target.querySelectorAll('.skill-progress');
                    progressBars.forEach(bar => {
                        const level = bar.getAttribute('data-level');
                        setTimeout(() => {
                            bar.style.width = `${level}%`;
                        }, 100);
                    });
                    skillObserver.unobserve(entry.target); // Animate only once
                }
            });
        }, { threshold: 0.3 });

        const skillSections = document.querySelectorAll('.skill-category');
        skillSections.forEach(section => skillObserver.observe(section));
    }
}

// Form Handling - Web3Forms with timeout fallback
class FormHandler {
    constructor() {
        this.form = document.getElementById('contactForm');
        this.init();
    }

    init() {
        if (this.form) {
            this.setupFormSubmission();
        }
    }

    setupFormSubmission() {
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = this.form.querySelector('.submit-btn');
            const btnText = submitBtn.querySelector('.btn-text');
            const btnLoader = submitBtn.querySelector('.btn-loader');
            const btnIcon = submitBtn.querySelector('.fa-paper-plane');
            
            // Show loading state
            this.setLoadingState(submitBtn, btnText, btnLoader, btnIcon);
            
            // Add timeout to prevent getting stuck
            const timeout = setTimeout(() => {
                console.log('Form submission timeout');
                this.handleSubmissionResult(false, 'Timeout - Please try again', submitBtn, btnText, btnLoader, btnIcon);
            }, 8000);
            
            try {
                const formData = new FormData(this.form);
                
                console.log('Submitting form to Web3Forms...');
                
                // Use the form action directly
                const response = await fetch(this.form.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                clearTimeout(timeout);
                console.log('Form submission response:', response.status);
                
                if (response.ok) {
                    // Success - Web3Forms will send the email
                    this.handleSubmissionResult(true, 'Message Sent! ✓', submitBtn, btnText, btnLoader, btnIcon);
                    this.form.reset();
                } else {
                    // Error from server
                    throw new Error(`Server responded with ${response.status}`);
                }
                
            } catch (error) {
                clearTimeout(timeout);
                console.error('Error sending email:', error);
                this.handleSubmissionResult(false, 'Failed to Send ✗', submitBtn, btnText, btnLoader, btnIcon);
            }
        });
    }

    setLoadingState(submitBtn, btnText, btnLoader, btnIcon) {
        btnText.textContent = 'Sending...';
        btnIcon.style.display = 'none';
        btnLoader.style.display = 'flex';
        submitBtn.disabled = true;
    }
    
    handleSubmissionResult(success, message, submitBtn, btnText, btnLoader, btnIcon) {
        btnText.textContent = message;
        submitBtn.style.background = success 
            ? 'linear-gradient(135deg, #10b981, #059669)'
            : 'linear-gradient(135deg, #ef4444, #dc2626)';
        
        // Reset after 3 seconds
        setTimeout(() => {
            this.resetButton(submitBtn, btnText, btnLoader, btnIcon);
        }, 3000);
    }
    
    resetButton(submitBtn, btnText, btnLoader, btnIcon) {
        btnText.textContent = 'Send Message';
        btnIcon.style.display = 'block';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.style.background = '';
    }
}

// Fast Smooth Scrolling for all anchor links
class SmoothScroll {
    constructor() {
        this.init();
    }

    init() {
        this.setupSmoothLinks();
    }

    setupSmoothLinks() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            // Skip if it's a nav link (handled by Navigation class)
            if (anchor.classList.contains('nav-link')) return;
            
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    this.smoothScrollTo(target);
                }
            });
        });
    }

    smoothScrollTo(target) {
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
        const startPosition = window.pageYOffset;
        const distance = targetPosition - startPosition - 70; // Account for fixed header
        const duration = Math.min(800, Math.max(400, Math.abs(distance) * 0.4));
        
        let start = null;

        const animation = (currentTime) => {
            if (start === null) start = currentTime;
            const timeElapsed = currentTime - start;
            const progress = Math.min(timeElapsed / duration, 1);
            
            // Cubic ease-in-out for smooth mobile experience
            const ease = progress < 0.5 
                ? 4 * progress * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            window.scrollTo(0, startPosition + distance * ease);
            
            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            }
        };

        requestAnimationFrame(animation);
    }
}

// Utility functions
class Utils {
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static isMobile() {
        return window.innerWidth <= 968;
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if elements exist before initializing
    if (document.querySelector('.navbar')) {
        new Navigation();
    }
    
    new Animations();
    new FormHandler();
    new SmoothScroll();
});

// Performance optimization
window.addEventListener('load', function() {
    // Remove will-change after animations complete
    setTimeout(() => {
        const elements = document.querySelectorAll('.skill-category, .project-card, .feature-card, .info-card');
        elements.forEach(el => {
            el.style.willChange = 'auto';
        });
    }, 2000);

    // Add loaded class for any CSS transitions
    document.body.classList.add('loaded');
});

// Handle page visibility changes for performance
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Page is hidden, reduce animations
        document.body.classList.add('page-hidden');
    } else {
        // Page is visible
        document.body.classList.remove('page-hidden');
    }
});
