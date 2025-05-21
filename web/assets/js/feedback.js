// This file manages the feedback mechanism, including displaying questionnaires and collecting user input.

document.addEventListener('DOMContentLoaded', function() {
    const suggestButton = document.getElementById('suggest-improvements');
    const feedbackFormContainer = document.getElementById('feedback-form-container');
    const feedbackForm = document.getElementById('feedback-form');
    const feedbackSubject = document.getElementById('feedback-subject');
    const feedbackBody = document.getElementById('feedback-body');
    const cancelButton = document.getElementById('cancel-feedback');
    const feedbackMessage = document.getElementById('feedback-message');
    
    // Toggle feedback form visibility
    if (suggestButton) {
        suggestButton.addEventListener('click', function(e) {
            e.preventDefault();
            feedbackFormContainer.classList.toggle('visible');
            
            // Focus on subject field when form opens
            if (feedbackFormContainer.classList.contains('visible')) {
                feedbackSubject.focus();
            }
        });
    }
    
    // Hide form on cancel
    if (cancelButton) {
        cancelButton.addEventListener('click', function(e) {
            e.preventDefault();
            feedbackFormContainer.classList.remove('visible');
            feedbackForm.reset();
            feedbackMessage.className = 'feedback-message';
            feedbackMessage.textContent = '';
        });
    }
    
    // Handle form submission with AWS Lambda
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            feedbackMessage.className = 'feedback-message';
            feedbackMessage.textContent = 'Submitting...';
            
            const subject = feedbackSubject.value.trim();
            const body = feedbackBody.value.trim();
            
            if (!subject || !body) {
                feedbackMessage.className = 'feedback-message error';
                feedbackMessage.textContent = 'Please fill out both subject and feedback fields.';
                return;
            }
            
            // Prepare data for Lambda function
            const formData = {
                name: document.getElementById('feedback-name').value || 'Anonymous',
                email: document.getElementById('feedback-email').value || '',
                message: `${subject}\n\n${body}`,
                pageUrl: window.location.href
            };
            
            try {
                // AWS Lambda endpoint
                const apiUrl = 'https://4hmwnax7r1.execute-api.us-east-1.amazonaws.com/default/uaw-feedback-handler';
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData),
                    mode: 'cors'
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    feedbackForm.reset();
                    feedbackMessage.className = 'feedback-message success';
                    feedbackMessage.textContent = 'Thank you for your feedback!';
                    
                    // Hide form after successful submission
                    setTimeout(() => {
                        feedbackFormContainer.classList.remove('visible');
                        feedbackMessage.className = 'feedback-message';
                        feedbackMessage.textContent = '';
                    }, 3000);
                } else {
                    feedbackMessage.className = 'feedback-message error';
                    feedbackMessage.textContent = 'Error: ' + (result.message || 'Could not submit feedback');
                }
            } catch (error) {
                feedbackMessage.className = 'feedback-message error';
                feedbackMessage.textContent = 'Error submitting feedback. Please try again.';
                console.error('Feedback submission error:', error);
            }
        });
    }
});