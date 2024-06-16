const contentContainer = document.querySelectorAll('.contentContainer');

const onToggleActive = event => {
    const thumbnail = event.currentTarget.querySelectorAll('.thumbnail');
    setTimeout(() => {
        thumbnail.forEach(element => {
            if (element.classList.contains('active')) {
                element.classList.remove('active');
            } else {
                element.classList.add('active');
                element.currentTime = '0';
            }
        });
    }, 1500);
};

const offToggleActive = event => {
    const thumbnail = event.currentTarget.querySelectorAll('.thumbnail');
    thumbnail.forEach(element => {
        if (element.classList.contains('active')) {
            element.classList.remove('active');
        } else {
            element.classList.add('active');
        }
    });
};

contentContainer.forEach(element => {
    element.addEventListener('mouseenter', onToggleActive);
    element.addEventListener('mouseleave', offToggleActive);
});