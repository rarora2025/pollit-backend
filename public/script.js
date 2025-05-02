import { newsCategories, getNewsByCategory } from './categories.js';

// API configuration
const API_BASE_URL = '/api';

// DOM Elements
const articlesContainer = document.getElementById('articles-container');
const prevButton = document.getElementById('prev-button');
const nextButton = document.getElementById('next-button');
const articleModal = document.getElementById('article-modal');
const modalContent = document.getElementById('modal-content');
const closeModal = document.querySelector('.close-modal');

let currentIndex = 0;
let articles = [];
let isTransitioning = false;
let hasFetchedToday = false;

// Check if we need to refresh based on API reset time
function shouldRefreshArticles() {
    const lastFetch = localStorage.getItem('lastFetchTime');
    if (!lastFetch) return true;

    const lastFetchTime = new Date(parseInt(lastFetch));
    const now = new Date();
    
    // Check if it's a new day (UTC) since last fetch
    const lastFetchDay = new Date(lastFetchTime).setHours(0, 0, 0, 0);
    const todayDay = new Date(now).setHours(0, 0, 0, 0);
    
    // If it's a new day and past midnight UTC (when NewsAPI resets)
    return lastFetchDay < todayDay && now.getUTCHours() >= 0;
}

// Check if we've already fetched articles today
function checkLastFetch() {
    if (shouldRefreshArticles()) {
        return false;
    }
    
    const cachedArticles = localStorage.getItem('cachedArticles');
    if (cachedArticles) {
        articles = JSON.parse(cachedArticles);
        displayArticles();
        return true;
    }
    return false;
}

// Save articles to cache
function cacheArticles() {
    localStorage.setItem('cachedArticles', JSON.stringify(articles));
    localStorage.setItem('lastFetchTime', new Date().getTime().toString());
}

// Check for API reset once per day
function setupDailyCheck() {
    // Calculate time until next check (next day at 00:05 UTC)
    const now = new Date();
    const nextCheck = new Date();
    nextCheck.setUTCHours(0, 5, 0, 0); // Check at 00:05 UTC
    if (nextCheck <= now) {
        nextCheck.setUTCDate(nextCheck.getUTCDate() + 1);
    }
    
    const timeUntilNextCheck = nextCheck - now;
    
    // Set timeout for next check
    setTimeout(() => {
        if (shouldRefreshArticles()) {
            console.log('API has reset, fetching new articles...');
            fetchNews();
        }
        setupDailyCheck(); // Schedule next check
    }, timeUntilNextCheck);
}

// Initialize the app
async function initializeApp() {
    if (!checkLastFetch()) {
        await fetchNews();
    }
    setupDailyCheck();
}

// Start the app
document.addEventListener('DOMContentLoaded', initializeApp);

// Show loading animation
function showLoading() {
    articlesContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-animation">
                <div class="loading-bar">
                    <div class="loading-progress"></div>
                </div>
                <div class="loading-text">Loading News</div>
            </div>
        </div>
    `;
}

// Hide loading animation
function hideLoading() {
    const loadingContainer = document.querySelector('.loading-container');
    if (loadingContainer) {
        loadingContainer.classList.add('hidden');
        setTimeout(() => {
            loadingContainer.remove();
        }, 300);
    }
}

// Generate AI content
async function generateAIContent(article) {
    try {
        const response = await fetch(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${API_KEY}`);
        const data = await response.json();
        const content = data.articles[currentIndex].content;
        
        // Parse the response using the exact format
        const questionMatch = content.match(/Question: (.*?)(?:\n\n|$)/);
        const optionsMatch = content.match(/Options:\n(.*?)(?:\n\n|$)/s);
        const summaryMatch = content.match(/Summary: (.*?)(?:\n\n|$)/);
        
        const question = questionMatch ? questionMatch[1].trim() : "What's your take on this issue?";
        const options = optionsMatch ? 
            optionsMatch[1].split('\n')
                .map(opt => opt.replace(/^-\s*/, '').trim())
                .filter(opt => opt.length > 0) :
            ["Strongly Agree", "Somewhat Agree", "Disagree"];
        const summary = summaryMatch ? summaryMatch[1].trim() : article.description || "No summary available";
        
        return {
            pollQuestion: question,
            options: options,
            summary: summary
        };
    } catch (error) {
        console.error('Error generating AI content:', error);
        return {
            pollQuestion: "What's your take on this issue?",
            options: ["Strongly Agree", "Somewhat Agree", "Disagree"],
            summary: article.description || "No summary available"
        };
    }
}

// Fetch news articles
async function fetchNews() {
    console.log('Fetching news...');
    showLoading();
    
    try {
        const response = await fetch(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${API_KEY}`);
        const data = await response.json();
        console.log('Received data:', data);
        
        if (data.status === 'ok' && data.articles) {
            articles = data.articles.filter(article => article.urlToImage);
            console.log('Articles loaded:', articles.length);
            await displayArticles();
        } else {
            throw new Error('Invalid response from API');
        }
    } catch (error) {
        console.error('Error fetching news:', error);
        articlesContainer.innerHTML = `
            <div class="error-message">
                <h2>Error loading articles</h2>
                <p>Please try again later.</p>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// Display articles in the feed
async function displayArticles() {
    console.log('Displaying articles...');
    if (!articlesContainer) {
        console.error('Articles container not found!');
        return;
    }
    
    // Clear container and show loading state
    articlesContainer.innerHTML = '';
    showLoading();
    
    if (!articles || articles.length === 0) {
        console.error('No articles to display!');
        hideLoading();
        return;
    }
    
    // Create all cards first
    const cards = [];
    for (const [index, article] of articles.entries()) {
        const card = document.createElement('div');
        card.className = 'article-card';
        card.style.display = index === currentIndex ? 'block' : 'none';
        cards.push(card);
        articlesContainer.appendChild(card);
    }
    
    try {
        // Generate AI content for all articles first
        const aiContents = await Promise.all(articles.map(article => generateAIContent(article)));
        
        // Update cards with content
        cards.forEach((card, index) => {
            const article = articles[index];
            const aiContent = aiContents[index];
            
            card.innerHTML = `
                <div class="article-content">
                    <div>
                        <h3 class="article-title">${article.title}</h3>
                        <div class="article-summary">
                            ${aiContent.summary}
                        </div>
                        <div class="debate-section">
                            <h4 class="debate-title">${aiContent.pollQuestion}</h4>
                            <div class="debate-options">
                                ${aiContent.options.map(option => `
                                    <div class="debate-option">${option}</div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="article-meta">
                        <span class="source">${article.source.name}</span>
                        <span class="date">${new Date(article.publishedAt).toLocaleDateString()}</span>
                        <button class="read-more" onclick="openArticle(${index})">
                            <span class="read-more-text">Read Full Article</span>
                            <span class="read-more-icon">→</span>
                        </button>
                    </div>
                </div>
            `;
            
            // Add click handlers for debate options
            const options = card.querySelectorAll('.debate-option');
            options.forEach(option => {
                option.addEventListener('click', () => {
                    options.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    
                    setTimeout(() => {
                        nextArticle();
                    }, 500);
                });
            });
        });
        
        // Hide loading animation after all cards are created
        setTimeout(() => {
            hideLoading();
        }, cards.length * 100 + 300);
        
        updateNavigation();
    } catch (error) {
        console.error('Error displaying articles:', error);
        hideLoading();
        articlesContainer.innerHTML = `
            <div class="error-message">
                <h2>Error loading articles</h2>
                <p>Please try again later.</p>
            </div>
        `;
    }
}

// Update navigation buttons
function updateNavigation() {
    console.log('Updating navigation, current index:', currentIndex);
    if (!prevButton || !nextButton) {
        console.error('Navigation buttons not found!');
        return;
    }
    
    prevButton.style.opacity = currentIndex > 0 ? '1' : '0.5';
    nextButton.style.opacity = currentIndex < articles.length - 1 ? '1' : '0.5';
}

// Navigate to next article
function nextArticle() {
    console.log('Next article clicked, current index:', currentIndex);
    if (isTransitioning || currentIndex >= articles.length - 1) {
        console.log('Cannot navigate: isTransitioning:', isTransitioning, 'currentIndex:', currentIndex);
        return;
    }
    
    isTransitioning = true;
    currentIndex++;
    
    const cards = document.querySelectorAll('.article-card');
    cards.forEach((card, index) => {
        card.style.display = index === currentIndex ? 'block' : 'none';
    });
    
    setTimeout(() => {
        isTransitioning = false;
        updateNavigation();
        console.log('Transition complete');
    }, 500);
}

// Navigate to previous article
function prevArticle() {
    console.log('Previous article clicked, current index:', currentIndex);
    if (isTransitioning || currentIndex <= 0) {
        console.log('Cannot navigate: isTransitioning:', isTransitioning, 'currentIndex:', currentIndex);
        return;
    }
    
    isTransitioning = true;
    currentIndex--;
    
    const cards = document.querySelectorAll('.article-card');
    cards.forEach((card, index) => {
        card.style.display = index === currentIndex ? 'block' : 'none';
    });
    
    setTimeout(() => {
        isTransitioning = false;
        updateNavigation();
        console.log('Transition complete');
    }, 500);
}

// Open full article in modal
function openArticle(index) {
    const article = articles[index];
    modalContent.innerHTML = `
        <div class="modal-article">
            <div class="modal-header">
                <h2>${article.title}</h2>
            </div>
            <div class="modal-body">
                <div class="modal-summary">
                    <p>${article.description || ''}</p>
                </div>
                <a href="${article.url}" target="_blank" class="read-more">
                    <span class="read-more-text">Read Full Article</span>
                    <span class="read-more-icon">→</span>
                </a>
            </div>
        </div>
    `;
    articleModal.style.display = 'block';
}

// Event listeners
if (prevButton) prevButton.addEventListener('click', prevArticle);
if (nextButton) nextButton.addEventListener('click', nextArticle);
if (closeModal) closeModal.addEventListener('click', () => {
    articleModal.style.display = 'none';
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === articleModal) {
        articleModal.style.display = 'none';
    }
});

// Clear cache
function clearCache() {
    localStorage.removeItem('lastFetchTime');
    localStorage.removeItem('cachedArticles');
    console.log('Cache cleared');
}

// Add category filtering functionality
document.addEventListener('DOMContentLoaded', () => {
    const categoryButtons = document.querySelectorAll('.category-btn');
    let currentCategory = 'all';

    categoryButtons.forEach(button => {
        button.addEventListener('click', async () => {
            // Update active button
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Get selected category
            currentCategory = button.dataset.category;
            
            try {
                // Clear existing articles
                const articlesContainer = document.getElementById('articles-container');
                articlesContainer.innerHTML = '';
                showLoading();

                if (currentCategory === 'all') {
                    // Fetch all news
                    await fetchNews();
                } else {
                    // Fetch category-specific news
                    const news = await getNewsByCategory(currentCategory, API_KEY);
                    if (news.status === 'ok' && news.articles) {
                        articles = news.articles.filter(article => article.urlToImage);
                        await displayArticles();
                    } else {
                        throw new Error('Invalid response from API');
                    }
                }
            } catch (error) {
                console.error('Error fetching category news:', error);
                articlesContainer.innerHTML = `
                    <div class="error-message">
                        <h2>Error loading articles</h2>
                        <p>Please try again later.</p>
                    </div>
                `;
            } finally {
                hideLoading();
            }
        });
    });
}); 