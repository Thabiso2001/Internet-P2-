// ============================================
// MUT ICT WEBSITE - COMPLETE WORKING SCRIPT
// All features: Search, Chatbot, Recommendations, Dashboard, Newsletter, Feedback
// ============================================

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Website loaded - all systems ready');
    
    // ========== 1. SMART SEARCH - WORKING ==========
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    
    if (searchInput) {
        searchInput.addEventListener('input', async function() {
            const query = this.value.trim();
            
            if (query.length === 0) {
                searchResults.innerHTML = '';
                return;
            }
            
            if (query.length < 2) {
                searchResults.innerHTML = '<li style="color:#D4A017;">🔍 Type at least 2 characters...</li>';
                return;
            }
            
            searchResults.innerHTML = '<li style="color:#D4A017;">⏳ Searching programmes...</li>';
            
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                const programmes = await response.json();
                
                if (programmes.length === 0) {
                    searchResults.innerHTML = '<li>❌ No programmes found. Try "IT" or "Networking"</li>';
                } else {
                    searchResults.innerHTML = programmes.map(p => `
                        <li>
                            <strong>📘 ${p.name || p}</strong>
                            <span class="search-result-meta">${p.duration || 'Click Apply to apply'}</span>
                        </li>
                    `).join('');
                }
            } catch (error) {
                console.error('Search error:', error);
                searchResults.innerHTML = '<li>❌ Error searching. Please try again.</li>';
            }
        });
    }
    
    // ========== 2. CHATBOT - WORKING ==========
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const messagesDiv = document.getElementById('messages');
    
    async function sendMessage() {
        if (!chatInput) return;
        
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Display user message
        messagesDiv.innerHTML += `<div style="margin-top: 8px;"><strong>You:</strong> ${message}</div>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        chatInput.value = '';
        
        // Show typing indicator
        messagesDiv.innerHTML += `<div id="typing" style="color: #D4A017;"><em>Bot is typing...</em></div>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        try {
            const response = await fetch(`/api/chat?message=${encodeURIComponent(message)}`);
            const data = await response.json();
            
            // Remove typing indicator
            document.getElementById('typing')?.remove();
            
            // Display bot response
            messagesDiv.innerHTML += `<div style="margin-top: 8px;"><strong>🤖 Bot:</strong> ${data.answer}</div>`;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        } catch (error) {
            document.getElementById('typing')?.remove();
            messagesDiv.innerHTML += `<div style="margin-top: 8px;"><strong>🤖 Bot:</strong> Sorry, I'm having trouble. Please try again.</div>`;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') sendMessage();
        });
    }
    
    // ========== 3. RECOMMENDATIONS - WORKING ==========
    const recBtn = document.getElementById('recBtn');
    const interestSelect = document.getElementById('interestSelect');
    const recResults = document.getElementById('recResults');
    
    async function loadRecommendations() {
        if (!recBtn) return;
        
        const interest = interestSelect.value;
        recResults.innerHTML = '<li style="color:#D4A017;">⏳ Loading recommendations...</li>';
        
        try {
            const response = await fetch(`/api/recommend?interest=${interest}`);
            const recommendations = await response.json();
            
            recResults.innerHTML = recommendations.map(rec => `<li>🎯 ${rec}</li>`).join('');
        } catch (error) {
            console.error('Recommendation error:', error);
            recResults.innerHTML = '<li>❌ Error loading recommendations. Please refresh.</li>';
        }
    }
    
    if (recBtn) {
        recBtn.addEventListener('click', loadRecommendations);
        // Load default recommendations on page load
        loadRecommendations();
    }
    
    // ========== 4. ROLE-BASED DASHBOARD ==========
    async function loadDashboard(role) {
        try {
            const response = await fetch(`/api/user?role=${role}`);
            const data = await response.json();
            
            const titleElement = document.getElementById('dashboardTitle');
            const greetingElement = document.getElementById('dashboardGreeting');
            const listElement = document.getElementById('dashboardItems');
            const applyBtn = document.getElementById('applyBtn');
            
            if (titleElement) titleElement.innerText = data.title;
            if (greetingElement) greetingElement.innerText = data.greeting;
            if (listElement) {
                listElement.innerHTML = data.quickLinks.map(item => `<li>${item}</li>`).join('');
            }
            if (applyBtn) {
                applyBtn.style.display = data.showApply !== false ? 'block' : 'none';
            }
        } catch (error) {
            console.error('Dashboard error:', error);
        }
    }
    
    // Role button listeners
    const visitorBtn = document.getElementById('visitorBtn');
    const studentBtn = document.getElementById('studentBtn');
    const lecturerBtn = document.getElementById('lecturerBtn');
    
    if (visitorBtn) visitorBtn.addEventListener('click', () => loadDashboard('visitor'));
    if (studentBtn) studentBtn.addEventListener('click', () => loadDashboard('student'));
    if (lecturerBtn) lecturerBtn.addEventListener('click', () => loadDashboard('lecturer'));
    
    // Load visitor dashboard by default
    loadDashboard('visitor');
    
    // ========== 5. LATEST NEWS ==========
    async function loadNews() {
        const newsContainer = document.getElementById('newsListContainer');
        if (!newsContainer) return;
        
        newsContainer.innerHTML = '<div class="loading-spinner">📰 Loading latest news...</div>';
        
        try {
            const response = await fetch('/api/news');
            const articles = await response.json();
            
            if (articles && articles.length > 0) {
                newsContainer.innerHTML = `
                    <ul class="news-list">
                        ${articles.map(article => `
                            <li class="news-item">
                                <span class="news-icon">📰</span>
                                <div class="news-content">
                                    <a href="${article.url}" target="_blank" class="news-title">${article.title}</a>
                                    <p class="news-description">${article.description?.substring(0, 120)}...</p>
                                    <span class="news-date">📅 ${new Date(article.publishedAt).toLocaleDateString()}</span>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                `;
            } else {
                newsContainer.innerHTML = '<div class="no-results">No news available. Check back later.</div>';
            }
        } catch (error) {
            console.error('News error:', error);
            newsContainer.innerHTML = '<div class="error">❌ Unable to load news. Please refresh.</div>';
        }
    }
    
    loadNews();
    // Refresh news every 5 minutes
    setInterval(loadNews, 300000);
    
    // ========== 6. NEWSLETTER SUBSCRIPTION ==========
    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const name = document.getElementById('newsletterName')?.value || '';
            const email = document.getElementById('newsletterEmail').value;
            const messageDiv = document.getElementById('newsletterMessage');
            
            messageDiv.innerHTML = '⏳ Subscribing...';
            messageDiv.style.color = '#D4A017';
            
            try {
                const response = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, name })
                });
                const data = await response.json();
                
                if (data.success) {
                    messageDiv.innerHTML = '✅ ' + data.message;
                    messageDiv.style.color = '#4CAF50';
                    newsletterForm.reset();
                    setTimeout(() => { messageDiv.innerHTML = ''; }, 5000);
                } else {
                    messageDiv.innerHTML = '❌ ' + data.message;
                    messageDiv.style.color = '#8B2C2C';
                }
            } catch (error) {
                messageDiv.innerHTML = '❌ Error. Please try again.';
                messageDiv.style.color = '#8B2C2C';
            }
        });
    }
    
    // ========== 7. FEEDBACK SYSTEM ==========
    let selectedRating = 0;
    const stars = document.querySelectorAll('.star');
    const ratingValueDiv = document.getElementById('ratingValue');
    const submitFeedbackBtn = document.getElementById('submitFeedbackBtn');
    const feedbackText = document.getElementById('feedbackText');
    const feedbackMessage = document.getElementById('feedbackMessage');
    const userRoleSelect = document.getElementById('userRoleSelect');
    
    stars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.rating);
            
            stars.forEach(s => {
                const rating = parseInt(s.dataset.rating);
                if (rating <= selectedRating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
            
            const ratingTexts = {
                1: '⭐ Poor - Needs improvement',
                2: '⭐⭐ Fair - Could be better',
                3: '⭐⭐⭐ Good - Satisfactory',
                4: '⭐⭐⭐⭐ Very Good - Impressive',
                5: '⭐⭐⭐⭐⭐ Excellent - Love it!'
            };
            if (ratingValueDiv) {
                ratingValueDiv.textContent = ratingTexts[selectedRating];
                ratingValueDiv.style.color = '#D4A017';
            }
        });
    });
    
    if (submitFeedbackBtn) {
        submitFeedbackBtn.addEventListener('click', async () => {
            if (selectedRating === 0) {
                feedbackMessage.innerHTML = '❌ Please select a rating first!';
                feedbackMessage.style.color = '#8B2C2C';
                setTimeout(() => { feedbackMessage.innerHTML = ''; }, 3000);
                return;
            }
            
            const feedback = feedbackText?.value || 'No comment provided';
            const userRole = userRoleSelect?.value || 'visitor';
            
            feedbackMessage.innerHTML = '⏳ Submitting feedback...';
            feedbackMessage.style.color = '#D4A017';
            
            try {
                const response = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userRole, rating: selectedRating, feedback })
                });
                const data = await response.json();
                
                if (data.success) {
                    feedbackMessage.innerHTML = '✅ Thank you for your feedback!';
                    feedbackMessage.style.color = '#4CAF50';
                    selectedRating = 0;
                    stars.forEach(s => s.classList.remove('active'));
                    if (ratingValueDiv) ratingValueDiv.textContent = 'Select a rating';
                    if (feedbackText) feedbackText.value = '';
                    setTimeout(() => { feedbackMessage.innerHTML = ''; }, 3000);
                } else {
                    feedbackMessage.innerHTML = '❌ ' + data.message;
                    feedbackMessage.style.color = '#8B2C2C';
                }
            } catch (error) {
                feedbackMessage.innerHTML = '❌ Error submitting feedback. Please try again.';
                feedbackMessage.style.color = '#8B2C2C';
            }
        });
    }
    
    // ========== 8. MODAL / APPLY BUTTONS ==========
    const modal = document.getElementById('applyModal');
    const closeModal = document.querySelector('.close-modal');
    
    function openApplyModal() {
        if (modal) {
            modal.style.display = 'flex';
            console.log('Modal opened');
        } else {
            console.log('Modal not found');
        }
    }
    
    // Fix all apply buttons
    const heroApplyBtn = document.getElementById('heroApplyBtn');
    const dashboardApplyBtn = document.getElementById('applyBtn');
    const programmeApplyBtns = document.querySelectorAll('.apply-now-btn');
    
    if (heroApplyBtn) {
        const newBtn = heroApplyBtn.cloneNode(true);
        heroApplyBtn.parentNode.replaceChild(newBtn, heroApplyBtn);
        newBtn.addEventListener('click', openApplyModal);
    }
    
    if (dashboardApplyBtn) {
        const newBtn = dashboardApplyBtn.cloneNode(true);
        dashboardApplyBtn.parentNode.replaceChild(newBtn, dashboardApplyBtn);
        newBtn.addEventListener('click', openApplyModal);
    }
    
    programmeApplyBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const programme = this.getAttribute('data-programme');
            const programmeSelect = document.getElementById('programmeSelect');
            if (programmeSelect && programme) {
                for (let i = 0; i < programmeSelect.options.length; i++) {
                    if (programmeSelect.options[i].text.includes(programme)) {
                        programmeSelect.value = programmeSelect.options[i].value;
                        break;
                    }
                }
            }
            openApplyModal();
        });
    });
    
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // ========== 9. APPLICATION FORM SUBMISSION ==========
    const applicationForm = document.getElementById('applicationForm');
    if (applicationForm) {
        applicationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                fullName: document.getElementById('fullName')?.value || '',
                email: document.getElementById('appEmail')?.value || '',
                phone: document.getElementById('phone')?.value || '',
                programmeName: document.getElementById('programmeSelect')?.options[document.getElementById('programmeSelect')?.selectedIndex]?.text || '',
                studentNumber: document.getElementById('studentNumber')?.value || ''
            };
            
            const msgDiv = document.getElementById('appMessage');
            msgDiv.innerHTML = '⏳ Submitting application...';
            msgDiv.style.color = '#D4A017';
            
            try {
                const response = await fetch('/api/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                const data = await response.json();
                
                if (data.success) {
                    msgDiv.innerHTML = '✅ ' + data.message;
                    msgDiv.style.color = '#4CAF50';
                    applicationForm.reset();
                    setTimeout(() => {
                        if (modal) modal.style.display = 'none';
                        msgDiv.innerHTML = '';
                    }, 2000);
                } else {
                    msgDiv.innerHTML = '❌ ' + data.message;
                    msgDiv.style.color = '#8B2C2C';
                }
            } catch (error) {
                msgDiv.innerHTML = '❌ Error submitting application. Please try again.';
                msgDiv.style.color = '#8B2C2C';
            }
        });
    }
    
    console.log('✅ All features initialized successfully');
});

