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
    const form = document.querySelector('.contact-form-fields');
    if (!form) return; // Guard clause if form doesn't exist
    
    // Form submission handler for validation and effects
    form.addEventListener('submit', handleFormValidation);
    
    // Real-time validation
    setupFormValidation(form);
    
    // Enhanced input interactions
    setupInputEffects(form);
    
    // Setup Web3Forms success/error handling
    setupWeb3FormsHandling(form);
}

function handleFormValidation(e) {
    e.preventDefault(); // Always prevent default form submission
    
    const form = e.target;
    const requiredFields = form.querySelectorAll('input[required], textarea[required]');
    let hasErrors = false;
    
    // Clear previous error states
    requiredFields.forEach(field => {
        field.classList.remove('error');
    });
    
    // Validate required fields
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('error');
            hasErrors = true;
        }
    });
    
    // If there are errors, show message and focus first error
    if (hasErrors) {
        showFormStatus('error', 'Please fill in all required fields (marked with *).');
        
        // Focus on first error field
        const firstError = form.querySelector('.error');
        if (firstError) {
            firstError.focus();
        }
        return false;
    }
    
    // Submit form asynchronously
    submitFormAsync(form);
    
    return false;
}

async function submitFormAsync(form) {
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.querySelector('span').textContent;
    
    // Show loading state
    submitButton.querySelector('span').textContent = 'Sending...';
    submitButton.disabled = true;
    
    try {
        // Prepare form data
        const formData = new FormData(form);
        
        // Submit to Web3Forms
        const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showFormStatus('success', 'Message sent successfully! I\'ll get back to you soon.');
            form.reset();
            // Clear any character counters
            const counters = form.querySelectorAll('.character-count');
            counters.forEach(counter => {
                const textarea = counter.previousElementSibling;
                if (textarea && textarea.tagName === 'TEXTAREA') {
                    counter.textContent = `0/1000`;
                    counter.style.color = 'hsla(0, 0%, 60%, 1)';
                }
            });
        } else {
            throw new Error(result.message || 'Submission failed');
        }
        
    } catch (error) {
        console.error('Form submission error:', error);
        showFormStatus('error', 'There was an issue sending your message. Please try again or contact me directly via email.');
    } finally {
        // Reset button state
        submitButton.querySelector('span').textContent = originalButtonText;
        submitButton.disabled = false;
    }
}

function setupWeb3FormsHandling(form) {
    // This function is now simplified since we handle everything asynchronously
    // Remove any URL parameter checks since we no longer redirect
    
    // Clean up any existing URL parameters from previous sessions
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('success')) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }
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
    field.classList.remove('error');
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
    
    const form = document.querySelector('.contact-form-fields');
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
