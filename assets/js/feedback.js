// This file manages the feedback mechanism, including displaying questionnaires and collecting user input.

document.addEventListener('DOMContentLoaded', function() {
    const suggestButton = document.getElementById('suggest-improvements');
    const feedbackForm = document.getElementById('feedback-form-container');
    const feedbackSubject = document.getElementById('feedback-subject');
    const feedbackBody = document.getElementById('feedback-body');
    const sendButton = document.getElementById('send-feedback');
    const cancelButton = document.getElementById('cancel-feedback');
    const feedbackMessage = document.getElementById('feedback-message');
    
    // Toggle feedback form visibility
    if (suggestButton) {
        suggestButton.addEventListener('click', function(e) {
            e.preventDefault();
            feedbackForm.classList.toggle('visible');
            
            // Focus on subject field when form opens
            if (feedbackForm.classList.contains('visible')) {
                feedbackSubject.focus();
            }
        });
    }
    
    // Hide form on cancel
    if (cancelButton) {
        cancelButton.addEventListener('click', function(e) {
            e.preventDefault();
            feedbackForm.classList.remove('visible');
            feedbackForm.reset();
            feedbackMessage.className = 'feedback-message';
            feedbackMessage.textContent = '';
        });
    }
    
    // Handle form submission with mailto
    if (sendButton) {
        sendButton.addEventListener('click', function(e) {
            e.preventDefault();
            
            const subject = feedbackSubject.value.trim();
            const body = feedbackBody.value.trim();
            
            if (!subject || !body) {
                feedbackMessage.className = 'feedback-message error';
                feedbackMessage.textContent = 'Please fill out both subject and feedback fields.';
                return;
            }
            
            // Show success message
            feedbackMessage.className = 'feedback-message success';
            feedbackMessage.textContent = 'Thanks for your feedback!';
            
            // Reset form after submission
            setTimeout(() => {
                document.getElementById('feedback-form').reset();
            }, 500);
        });
    }
});