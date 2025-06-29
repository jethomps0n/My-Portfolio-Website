// Contact Page JavaScript - Following the design philosophy

document.addEventListener('DOMContentLoaded', () => {
    // Initialize contact page elements
    initializeContactPage();
    
    // Setup form functionality
    setupContactForm();
    
    // Setup scroll animations
    setupScrollAnimations();
    
    // Add interactive enhancements
    addInteractiveEffects();
});

function initializeContactPage() {
    // Initialize pop-in animations (matching site pattern)
    const popInElements = document.querySelectorAll('.pop-in');
    
    // Stagger the appearance of pop-in elements
    popInElements.forEach((element, index) => {
        setTimeout(() => {
            element.classList.add('visible');
        }, index * 200);
    });
}

function setupContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return; // Guard clause if form doesn't exist
    
    const submitButton = form.querySelector('button[type="submit"]');
    const resetButton = form.querySelector('button[type="reset"]');
    
    // Form submission handler
    form.addEventListener('submit', handleFormSubmission);
    
    // Form reset handler with confirmation
    if (resetButton) {
        resetButton.addEventListener('click', handleFormReset);
    }
    
    // Real-time validation
    setupFormValidation(form);
    
    // Enhanced input interactions
    setupInputEffects(form);
}

function handleFormSubmission(e) {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    // Show loading state
    submitButton.textContent = 'Sending...';
    submitButton.disabled = true;
    
    // Get form data
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Simulate form submission (replace with actual endpoint)
    setTimeout(() => {
        showFormStatus('success', 'Message sent successfully! I\'ll get back to you soon.');
        e.target.reset();
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        
        // Track form submission (analytics)
        trackFormSubmission(data);
    }, 1500);
}

function handleFormReset(e) {
    const form = e.target.closest('form');
    const hasData = Array.from(form.querySelectorAll('input, textarea')).some(input => input.value.trim());
    
    if (hasData) {
        if (!confirm('Are you sure you want to clear all form data?')) {
            e.preventDefault();
            return;
        }
    }
    
    // Show reset confirmation
    showFormStatus('info', 'Form cleared.');
}

function setupFormValidation(form) {
    const inputs = form.querySelectorAll('input[required], textarea[required]');
    
    inputs.forEach(input => {
        input.addEventListener('blur', validateField);
        input.addEventListener('input', clearFieldError);
    });
    
    // Email format validation
    const emailInput = form.querySelector('input[type="email"]');
    if (emailInput) {
        emailInput.addEventListener('input', validateEmail);
    }
}

function validateField(e) {
    const field = e.target;
    const value = field.value.trim();
    
    if (field.hasAttribute('required') && !value) {
        showFieldError(field, 'This field is required.');
        return false;
    }
    
    clearFieldError(field);
    return true;
}

function validateEmail(e) {
    const email = e.target;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (email.value && !emailRegex.test(email.value)) {
        showFieldError(email, 'Please enter a valid email address.');
        return false;
    }
    
    clearFieldError(email);
    return true;
}

function showFieldError(field, message) {
    clearFieldError(field);
    
    const errorElement = document.createElement('span');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    errorElement.style.cssText = `
        color: hsla(0, 84%, 60%, 1);
        font-size: 0.8rem;
        margin-top: 4px;
        display: block;
    `;
    
    field.parentNode.appendChild(errorElement);
    field.style.borderColor = 'hsla(0, 84%, 60%, 0.7)';
}

function clearFieldError(field) {
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) {
        errorElement.remove();
    }
    field.style.borderColor = '';
}

function showFormStatus(type, message) {
    // Remove existing status
    const existingStatus = document.querySelector('.form-status');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    // Create status element
    const statusElement = document.createElement('div');
    statusElement.className = `form-status ${type}`;
    statusElement.textContent = message;
    
    const colors = {
        success: 'hsla(152, 81%, 60%, 1)',
        error: 'hsla(0, 84%, 60%, 1)',
        info: 'hsla(214, 100%, 60%, 1)'
    };
    
    statusElement.style.cssText = `
        background: ${colors[type]}20;
        border: 1px solid ${colors[type]}60;
        color: ${colors[type]};
        padding: 12px 16px;
        border-radius: 10px;
        margin-top: 15px;
        font-size: 0.9rem;
        animation: popIn 0.3s ease-out;
    `;
    
    const form = document.getElementById('contact-form');
    form.appendChild(statusElement);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (statusElement.parentNode) {
            statusElement.style.opacity = '0';
            statusElement.style.transform = 'translateY(-10px)';
            setTimeout(() => statusElement.remove(), 300);
        }
    }, 5000);
}

function setupInputEffects(form) {
    const inputs = form.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
        // Enhanced focus effects
        input.addEventListener('focus', (e) => {
            e.target.style.transform = 'scale(1.02)';
            e.target.style.transition = 'all 200ms ease';
        });
        
        input.addEventListener('blur', (e) => {
            e.target.style.transform = '';
        });
        
        // Character count for textarea
        if (input.tagName === 'TEXTAREA') {
            setupCharacterCount(input);
        }
    });
}

function setupCharacterCount(textarea) {
    const maxLength = 1000; // Reasonable limit
    const counter = document.createElement('div');
    counter.className = 'character-count';
    counter.style.cssText = `
        text-align: right;
        font-size: 0.75rem;
        color: hsla(0, 0%, 60%, 1);
        margin-top: 4px;
    `;
    
    const updateCount = () => {
        const current = textarea.value.length;
        counter.textContent = `${current}/${maxLength}`;
        
        if (current > maxLength * 0.9) {
            counter.style.color = 'hsla(0, 84%, 60%, 1)';
        } else {
            counter.style.color = 'hsla(0, 0%, 60%, 1)';
        }
    };
    
    textarea.addEventListener('input', updateCount);
    textarea.parentNode.appendChild(counter);
    updateCount();
}

function setupScrollAnimations() {
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
    
    // Observe collaboration items
    document.querySelectorAll('.collaboration-item').forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        item.style.transition = 'all 0.4s ease';
        observer.observe(item);
    });
}

function addInteractiveEffects() {
    // Add ripple effect to CTA buttons (matching site pattern)
    const ctaButtons = document.querySelectorAll('.cta-button');
    ctaButtons.forEach(button => {
        button.addEventListener('click', createRippleEffect);
    });
    
    // Enhanced hover effects for contact methods
    setupContactMethodEffects();
    
    // Status indicator pulse enhancement
    enhanceStatusIndicator();
}

function createRippleEffect(e) {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    const ripple = document.createElement('span');
    ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        pointer-events: none;
        animation: contactRipple 0.6s ease-out;
    `;
    
    button.style.position = 'relative';
    button.style.overflow = 'hidden';
    button.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
}

function setupContactMethodEffects() {
    const contactMethods = document.querySelectorAll('.contact-method');
    
    contactMethods.forEach(method => {
        method.addEventListener('mouseenter', () => {
            method.style.transform = 'translateX(5px)';
            method.style.transition = 'transform 200ms ease';
        });
        
        method.addEventListener('mouseleave', () => {
            method.style.transform = '';
        });
    });
}

function enhanceStatusIndicator() {
    const statusDot = document.querySelector('.status-dot');
    if (statusDot) {
        statusDot.addEventListener('mouseenter', () => {
            statusDot.style.transform = 'scale(1.5)';
        });
        
        statusDot.addEventListener('mouseleave', () => {
            statusDot.style.transform = '';
        });
    }
}

function trackFormSubmission(data) {
    // Analytics tracking (placeholder)
    console.log('Form submitted:', data);
    
    // You can integrate with analytics services here
    // gtag('event', 'form_submit', { event_category: 'contact' });
}

// Add custom animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes contactRipple {
        from {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.6;
        }
        to {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Mouse cursor integration (if mouse-follower is available)
if (typeof cursor !== 'undefined') {
    const interactiveElements = document.querySelectorAll('.cta-button, .contact-link, .social-link');
    interactiveElements.forEach(element => {
        element.addEventListener('mouseenter', () => {
            cursor.addState('-pointer');
        });
        
        element.addEventListener('mouseleave', () => {
            cursor.removeState('-pointer');
        });
    });
}
