// This file manages the feedback mechanism, including displaying questionnaires and collecting user input.

document.addEventListener('DOMContentLoaded', function() {
    const feedbackForm = document.getElementById('feedback-form');
    const feedbackButton = document.getElementById('feedback-button');
    const feedbackResponse = document.getElementById('feedback-response');

    feedbackButton.addEventListener('click', function() {
        feedbackForm.classList.toggle('hidden');
    });

    feedbackForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(feedbackForm);
        const feedbackData = {};

        formData.forEach((value, key) => {
            feedbackData[key] = value;
        });

        sendFeedback(feedbackData);
    });

    function sendFeedback(data) {
        fetch('/api/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })
        .then(response => response.json())
        .then(data => {
            feedbackResponse.textContent = 'Thank you for your feedback!';
            feedbackForm.reset();
            feedbackForm.classList.add('hidden');
        })
        .catch((error) => {
            feedbackResponse.textContent = 'There was an error submitting your feedback. Please try again.';
        });
    }
});