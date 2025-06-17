// API configuration
const API_BASE_URL = (() => {
    const hostname = window.location.hostname;
    console.log('Current hostname:', hostname);
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    
    // For GitHub Pages
    if (hostname.includes('github.io')) {
        return 'https://pollit-backend-6b36ba4351c1.herokuapp.com/api';
    }
    
    // For Heroku
    if (hostname.includes('herokuapp.com')) {
        return '/api';
    }
    
    // Default to production URL
    return 'https://pollit-backend-6b36ba4351c1.herokuapp.com/api';
})();

// Common fetch options for CORS
const fetchOptions = {
    mode: 'cors',
    credentials: 'omit',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': window.location.origin
    }
};

// Log the current API configuration
console.log('Current origin:', window.location.origin);
console.log('Using API URL:', API_BASE_URL);

// News categories and their corresponding API queries
const newsCategories = {
    politics: {
        name: 'Politics',
        query: 'politics OR government OR election OR congress OR senate OR white house OR president',
        description: 'Latest political news and government updates'
    },
    technology: {
        name: 'Technology',
        query: 'technology OR tech OR innovation OR AI OR artificial intelligence OR software OR hardware OR digital',
        description: 'Tech news, innovations, and digital trends'
    },
    business: {
        name: 'Business',
        query: 'business OR economy OR market OR finance OR stock market OR economy OR trade OR commerce',
        description: 'Business news, market updates, and economic trends'
    },
    science: {
        name: 'Science',
        query: 'science OR research OR discovery OR scientific OR study OR experiment OR laboratory',
        description: 'Scientific discoveries and research updates'
    },
    health: {
        name: 'Health',
        query: 'health OR medical OR healthcare OR medicine OR disease OR treatment OR wellness',
        description: 'Health news and medical updates'
    },
    entertainment: {
        name: 'Entertainment',
        query: 'entertainment OR movies OR music OR film OR television OR celebrity OR show business',
        description: 'Entertainment news and cultural updates'
    },
    sports: {
        name: 'Sports',
        query: '(sports OR athletics OR competition OR game OR tournament OR championship OR player) AND (NBA OR NFL OR MLB OR NHL OR soccer OR football OR basketball OR baseball OR hockey OR tennis OR golf OR Olympics) NOT (video game OR gaming OR esports)',
        description: 'Sports news and athletic updates'
    },
    environment: {
        name: 'Environment',
        query: 'environment OR climate OR sustainability OR nature OR conservation OR pollution OR global warming',
        description: 'Environmental news and climate updates'
    }
};

// Function to get news for a specific category
async function getNewsByCategory(category) {
    const categoryInfo = newsCategories[category];
    if (!categoryInfo) {
        throw new Error('Invalid category');
    }

    try {
        showLoading();
        // Use the category's specific query
        const url = `${API_BASE_URL}/news?q=${encodeURIComponent(categoryInfo.query)}`;
        console.log('Fetching category news from:', url);
        
        const response = await fetch(url, fetchOptions);
        console.log('Category response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Category data received:', data);
        
        if (data.status === 'ok' && data.articles) {
            articles = data.articles;
            currentIndex = 0;
            if (articles.length === 0) {
                articlesContainer.innerHTML = `
                    <div class="error-message">
                        <h2>No articles found</h2>
                        <p>No articles found in the ${categoryInfo.name} category. Try another category or check back later.</p>
                        <button onclick="fetchNews()" class="retry-button">Show All News</button>
                    </div>
                `;
            } else {
                await displayArticles();
            }
        } else {
            throw new Error('Invalid response from API');
        }
    } catch (error) {
        console.error('Error fetching category news:', error);
        articlesContainer.innerHTML = `
            <div class="error-message">
                <h2>Error loading articles</h2>
                <p>${error.message}</p>
                <button onclick="fetchNews()" class="retry-button">Show All News</button>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// DOM Elements
const articlesContainer = document.getElementById('articles-container');
const prevButton = document.getElementById('prev-button');
const nextButton = document.getElementById('next-button');
const articleModal = document.getElementById('article-modal');
const modalContent = document.getElementById('modal-content');

let currentIndex = 0;
let articles = [];
let isTransitioning = false;

// Show loading animation
function showLoading() {
    const loadingHTML = `
        <div class="loading-container">
            <div class="loading-animation">
                <div class="loading-bar">
                    <div class="loading-progress"></div>
                </div>
                <div class="loading-text">Loading News</div>
            </div>
        </div>
    `;
    articlesContainer.innerHTML = loadingHTML;
}

// Hide loading animation
function hideLoading() {
    const loadingContainer = document.querySelector('.loading-container');
    if (loadingContainer) {
        loadingContainer.remove();
    }
}

// Fetch news articles
async function fetchNews() {
    console.log('Starting to fetch news...');
    showLoading();
    
    try {
        console.log('Making API request to backend...');
        const url = `${API_BASE_URL}/news?q=top`;
        console.log('Fetching from:', url);
        
        const response = await fetch(url, {
            ...fetchOptions,
            headers: {
                ...fetchOptions.headers,
                'Origin': window.location.origin
            }
        });
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received data:', data);
        
        if (data.status === 'ok' && data.articles && data.articles.length > 0) {
            console.log('Total articles received:', data.articles.length);
            articles = data.articles.filter(article => article.urlToImage);
            console.log('Articles with images:', articles.length);
            
            if (articles.length === 0) {
                throw new Error('No articles with images found');
            }
            
            currentIndex = 0;
            await displayArticles();
        } else {
            console.error('Invalid API response:', data);
            throw new Error('Invalid response from API');
        }
    } catch (error) {
        console.error('Error fetching news:', error);
        articlesContainer.innerHTML = `
            <div class="error-message">
                <h2>Error loading articles</h2>
                <p>${error.message}</p>
                <button onclick="fetchNews()" class="retry-button">Retry</button>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// Generate poll content using OpenAI
async function generatePollContent(article) {
    try {
        console.log('Generating poll content for:', article.title);
        const response = await fetch(`${API_BASE_URL}/generate-content`, {
            ...fetchOptions,
            method: 'POST',
            body: JSON.stringify({ article })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error response from server:', errorData);
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received poll content:', data);
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Invalid response format:', data);
            throw new Error('Invalid response format from server');
        }

        const content = data.choices[0].message.content;
        console.log('Parsing content:', content);
        
        // Parse the response to extract question and answers
        const lines = content.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            // Remove any remaining prefixes
            .map(line => line.replace(/^(poll question|question|q|option|answer|choice|a|o)[:.]?\s*/i, ''))
            // Remove any numbering
            .map(line => line.replace(/^\d+[.)]\s*/, ''))
            // Remove any dashes
            .map(line => line.replace(/^-\s*/, ''));

        console.log('Parsed lines:', lines);

        const question = lines[0];
        const answers = lines.slice(1);

        if (!question || answers.length !== 3) {
            console.error('Invalid poll format:', { question, answers });
            return {
                question: "What's your take on this news?",
                answers: [
                    "Agree",
                    "Neutral",
                    "Disagree"
                ]
            };
        }

        return { question, answers };
    } catch (error) {
        console.error('Error generating poll content:', error);
        // Return default poll content on error
        return {
            question: "What's your take on this news?",
            answers: [
                "Agree",
                "Neutral",
                "Disagree"
            ]
        };
    }
}

// Display articles with loading animation
async function displayArticles() {
    console.log('Displaying articles...');
    if (!articles.length) {
        console.log('No articles to display');
        articlesContainer.innerHTML = `
            <div class="error-message">
                <h2>No articles found</h2>
                <p>Please try a different category.</p>
            </div>
        `;
        return;
    }

    // Display the current article
    await displayCurrentArticle();
    updateNavigation();
}

// Display the current article
async function displayCurrentArticle() {
    if (currentIndex < 0 || currentIndex >= articles.length) return;
    
    const article = articles[currentIndex];
    console.log(`Displaying article ${currentIndex + 1} of ${articles.length}`);
    
    // Create the article element
    const articleElement = document.createElement('div');
    articleElement.className = 'article-card visible';

    // Create the card structure
    articleElement.innerHTML = `
        <div class="article-image-container">
            <img src="${article.urlToImage ? `${API_BASE_URL}/proxy-image?url=${encodeURIComponent(article.urlToImage)}` : 'fallback.svg'}" 
                 alt="${article.title}" 
                 class="article-image" 
                 onerror="this.onerror=null; this.src='fallback.svg'; this.classList.add('fallback-image');"
                 loading="lazy">
        </div>
        <div class="article-content">
            <h2 class="article-title">${article.title}</h2>
            <p class="article-summary">${article.description || 'No description available'}</p>
            <div class="poll-section">
                <div class="loading-container">
                    <div class="loading-animation">
                        <div class="loading-bar">
                            <div class="loading-progress"></div>
                        </div>
                        <div class="loading-text">Loading Poll</div>
                    </div>
                </div>
            </div>
            <div class="article-meta">
                <span class="source">${article.source.name}</span>
                <span class="date">${new Date(article.publishedAt).toLocaleDateString()}</span>
                <a href="${article.url}" target="_blank" class="read-more">
                    Read Full Article
                    <span class="read-more-icon">→</span>
                </a>
            </div>
        </div>
    `;

    // Clear the container and add the new card
    articlesContainer.innerHTML = '';
    articlesContainer.appendChild(articleElement);

    // Generate poll content using OpenAI
    const pollContent = await generatePollContent(article);
    
    // Update the poll section with the generated content
    const pollSection = articleElement.querySelector('.poll-section');
    if (pollSection) {
        pollSection.innerHTML = `
            <h3>${pollContent.question}</h3>
            <div class="poll-options">
                ${pollContent.answers.map(option => `
                    <button class="poll-option" onclick="handleVote('${option}')">
                        ${option}
                    </button>
                `).join('')}
            </div>
        `;
    }
}

// Update navigation buttons
function updateNavigation() {
    prevButton.disabled = currentIndex <= 0;
    nextButton.disabled = currentIndex >= articles.length - 1;
    
    prevButton.style.opacity = prevButton.disabled ? '0.5' : '1';
    nextButton.style.opacity = nextButton.disabled ? '0.5' : '1';
}

// Navigate to next article
async function nextArticle() {
    if (isTransitioning || currentIndex >= articles.length - 1) return;
    
    isTransitioning = true;
    currentIndex++;
    await displayCurrentArticle();
    updateNavigation();
    
    // Add a small delay before allowing next transition
    setTimeout(() => {
        isTransitioning = false;
    }, 300);
}

// Navigate to previous article
async function prevArticle() {
    if (isTransitioning || currentIndex <= 0) return;
    
    isTransitioning = true;
    currentIndex--;
    await displayCurrentArticle();
    updateNavigation();
    
    // Add a small delay before allowing next transition
    setTimeout(() => {
        isTransitioning = false;
    }, 300);
}

// Handle poll votes
function handleVote(option) {
    if (isTransitioning) return;
    nextArticle();
}

// Open full article in modal
function openArticle(index) {
    const article = articles[index];
    const aiContent = generateAIContent(article);
    
    modalContent.innerHTML = `
        <div class="modal-article">
            <div class="modal-header">
                <h2>${article.title}</h2>
            </div>
            <div class="modal-body">
                <div class="modal-summary">
                    ${aiContent.detailedSummary}
                </div>
                <a href="${article.url}" target="_blank" class="read-more">
                    <span class="read-more-text">Read Original Article</span>
                    <span class="read-more-icon">→</span>
                </a>
            </div>
        </div>
    `;
    articleModal.style.display = 'block';
}

// Initialize the app
async function initializeApp() {
    console.log('Initializing app...');
    await fetchNews();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    initializeApp();
    
    const newsContainer = document.getElementById('news-container');
    const categoryButtons = document.querySelectorAll('.category-btn');
    const searchBar = document.querySelector('.search-bar');
    const searchButton = document.querySelector('.search-button');
    let currentCategory = 'all';

    // Add event listeners for search
    searchButton.addEventListener('click', handleSearch);
    searchBar.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    async function handleSearch() {
        const searchTerm = searchBar.value.trim();
        if (searchTerm) {
            try {
                showLoading();
                const url = `${API_BASE_URL}/news?q=${encodeURIComponent(searchTerm)}`;
                console.log('Searching news from:', url);
                
                const response = await fetch(url, {
                    ...fetchOptions,
                    headers: {
                        ...fetchOptions.headers,
                        'Origin': window.location.origin
                    }
                });
                console.log('Search response status:', response.status);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Search error response:', errorText);
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('Search data received:', data);
                
                if (data.status === 'ok' && data.articles) {
                    articles = data.articles.filter(article => article.urlToImage);
                    currentIndex = 0;
                    if (articles.length === 0) {
                        articlesContainer.innerHTML = `
                            <div class="error-message">
                                <h2>No articles found</h2>
                                <p>No articles found for "${searchTerm}". Try a different search term.</p>
                                <button onclick="fetchNews()" class="retry-button">Show All News</button>
                            </div>
                        `;
                    } else {
                        await displayArticles();
                    }
                } else {
                    throw new Error('No articles found');
                }
            } catch (error) {
                console.error('Error searching news:', error);
                articlesContainer.innerHTML = `
                    <div class="error-message">
                        <h2>Error searching articles</h2>
                        <p>${error.message}</p>
                        <button onclick="fetchNews()" class="retry-button">Show All News</button>
                    </div>
                `;
            } finally {
                hideLoading();
            }
        }
    }

    function setActiveCategory(category) {
        categoryButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            }
        });
        currentCategory = category;
    }

    // Category buttons
    categoryButtons.forEach(button => {
        button.addEventListener('click', async () => {
            console.log('Category button clicked:', button.dataset.category);
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const category = button.dataset.category;
            currentIndex = 0;
            
            try {
                if (category === 'all') {
                    await fetchNews();
                } else {
                    await getNewsByCategory(category);
                }
            } catch (error) {
                console.error('Error fetching category news:', error);
                articlesContainer.innerHTML = `
                    <div class="error-message">
                        <h2>Error loading articles</h2>
                        <p>${error.message}</p>
                        <button onclick="fetchNews()" class="retry-button">Show All News</button>
                    </div>
                `;
            }
        });
    });
    
    // Navigation buttons
    prevButton.addEventListener('click', prevArticle);
    nextButton.addEventListener('click', nextArticle);
}); 