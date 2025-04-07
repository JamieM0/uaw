document.addEventListener('DOMContentLoaded', function() {
    // Tab switching functionality
    const tabs = document.querySelectorAll('.method-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Hide all tab contents
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Show the selected tab content
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Vote button functionality
    const voteButtons = document.querySelectorAll('.vote-button');
    
    voteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const voteCount = this.closest('.approach-card').querySelector('.vote-count');
            const currentVotes = parseInt(voteCount.textContent);
            voteCount.textContent = currentVotes + 1;
            
            // Disable the button after voting
            this.disabled = true;
            this.innerHTML = 'Voted';
            this.classList.add('voted');
            
            // You would typically send this vote to a server
            console.log('Vote recorded');
        });
    });
});
