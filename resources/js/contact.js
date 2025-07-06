// Contact Page JavaScript - Following the design philosophy with INP optimizations

document.addEventListener('DOMContentLoaded', () => {
    // Initialize contact page elements with proper prioritization
    scheduler.postTask(() => {
        initializeContactPage();
    }, { priority: 'user-blocking' });
    
    // Setup form functionality with high priority (user interaction)
    scheduler.postTask(() => {
        setupContactForm();
    }, { priority: 'user-blocking' });
    
    // Setup scroll animations with lower priority
    scheduler.postTask(() => {
        setupScrollAnimations();
    }, { priority: 'user-visible' });
    
    // Add interactive enhancements with background priority
    scheduler.postTask(() => {
        addInteractiveEffects();
    }, { priority: 'background' });
});

async function initializeContactPage() {
    // Initialize pop-in animations (matching site pattern) with batching
    const popInElements = Array.from(document.querySelectorAll('.pop-in'));
    
    // Stagger the appearance of pop-in elements with yielding for better INP
    const BATCH_SIZE = 3;
    for (let i = 0; i < popInElements.length; i += BATCH_SIZE) {
        const batch = popInElements.slice(i, i + BATCH_SIZE);
        
        await scheduler.postTask(() => {
            batch.forEach((element, batchIndex) => {
                const index = i + batchIndex;
                setTimeout(() => {
                    requestAnimationFrame(() => {
                        element.classList.add('visible');
                    });
                }, index * 200);
            });
        }, { priority: 'user-visible' });
    }
}

function setupContactForm() {
    const form = document.querySelector('.contact-form-fields');
    if (!form) return; // Guard clause if form doesn't exist
    
    // Form submission handler for validation and effects
    form.addEventListener('submit', handleFormValidation, { passive: false }); // Must not be passive for preventDefault
    
    // Real-time validation with debouncing for better INP
    setupFormValidation(form);
    
    // Enhanced input interactions
    setupInputEffects(form);
    
    // Setup Web3Forms success/error handling
    setupWeb3FormsHandling(form);
    
    // Setup dynamic subject line based on connection type
    setupDynamicSubject(form);
}

async function handleFormValidation(e) {
    e.preventDefault(); // Always prevent default form submission
    
    const form = e.target;
    const requiredFields = form.querySelectorAll('input[required], textarea[required], select[required]');
    let hasErrors = false;
    
    // Use scheduler for validation to avoid blocking
    await scheduler.postTask(() => {
        // Clear previous error states in batch
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
    }, { priority: 'user-blocking' });
    
    // If there are errors, show message and focus first error
    if (hasErrors) {
        await scheduler.postTask(() => {
            const result = document.getElementById('result');
            result.innerHTML = "❌ Please fill in all required fields (marked with *).";
            result.className = "form-result error";
            result.style.display = "block";
            
            // Focus on first error field
            const firstError = form.querySelector('.error');
            if (firstError) {
                firstError.focus();
            }
        }, { priority: 'user-blocking' });
        return false;
    }
    
    // Submit form asynchronously with proper prioritization
    scheduler.postTask(() => {
        submitFormAsync(form);
    }, { priority: 'user-blocking' });
    
    return false;
}

function submitFormAsync(form) {
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.querySelector('span').textContent;
    const result = document.getElementById('result');
    
    // Show loading state
    submitButton.querySelector('span').textContent = 'Sending...';
    submitButton.disabled = true;
    result.innerHTML = "Sending your message...";
    result.style.display = "block";
    result.className = "form-result loading";
    
    // Prepare form data following Web3Forms documentation
    const formData = new FormData(form);
    const object = Object.fromEntries(formData);
    const json = JSON.stringify(object);
    
    fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: json
    })
    .then(async (response) => {
        let responseJson = await response.json();
        if (response.status == 200) {
            // Success
            result.innerHTML = "Message sent successfully! I'll get back to you soon.";
            result.className = "form-result success";
            
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
            // Error from Web3Forms
            console.log(response);
            result.innerHTML = `${responseJson.message || 'There was an issue sending your message. Please try again.'}`;
            result.className = "form-result error";
        }
    })
    .catch(error => {
        console.log(error);
        result.innerHTML = "Network error. Please check your connection and try again.";
        result.className = "form-result error";
    })
    .then(function() {
        // Reset button state
        submitButton.querySelector('span').textContent = originalButtonText;
        submitButton.disabled = false;
        
        // Reset form only on success
        if (result.className.includes('success')) {
            form.reset();
        }
        
        // Auto-hide result after 5 seconds
        setTimeout(() => {
            result.style.opacity = "0";
            setTimeout(() => {
                result.style.display = "none";
                result.style.opacity = "1";
            }, 300);
        }, 5000);
    });
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
    const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
    
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

// Setup dynamic subject line based on connection type selection
function setupDynamicSubject(form) {
    const connectionTypeSelect = form.querySelector('#connection-type');
    const subjectField = form.querySelector('#dynamic-subject');
    
    if (!connectionTypeSelect || !subjectField) return;
    
    // Subject line mapping based on connection type
    const subjectMap = {
        'work-opportunity': 'Work Opportunity Inquiry',
        'collaboration': 'Collaboration Request',
        'question': 'General Inquiry',
        'feedback': 'Feedback/Comments'
    };
    
    // Update subject when connection type changes
    connectionTypeSelect.addEventListener('change', function() {
        const selectedValue = this.value;
        const newSubject = subjectMap[selectedValue] || 'Contact Form Submission';
        subjectField.value = newSubject;
    });
}
