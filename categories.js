// News categories and their corresponding API queries
const newsCategories = {
    politics: {
        name: 'Politics',
        query: 'politics OR government OR election',
        description: 'Latest political news and government updates'
    },
    technology: {
        name: 'Technology',
        query: 'technology OR tech OR innovation',
        description: 'Tech news, innovations, and digital trends'
    },
    business: {
        name: 'Business',
        query: 'business OR economy OR market',
        description: 'Business news, market updates, and economic trends'
    },
    science: {
        name: 'Science',
        query: 'science OR research OR discovery',
        description: 'Scientific discoveries and research updates'
    },
    health: {
        name: 'Health',
        query: 'health OR medical OR healthcare',
        description: 'Health news and medical updates'
    },
    entertainment: {
        name: 'Entertainment',
        query: 'entertainment OR movies OR music',
        description: 'Entertainment news and cultural updates'
    },
    sports: {
        name: 'Sports',
        query: 'sports OR athletics OR competition',
        description: 'Sports news and athletic updates'
    },
    environment: {
        name: 'Environment',
        query: 'environment OR climate OR sustainability',
        description: 'Environmental news and climate updates'
    }
};

// Function to get news for a specific category
async function getNewsByCategory(category, apiKey) {
    const categoryInfo = newsCategories[category];
    if (!categoryInfo) {
        throw new Error('Invalid category');
    }

    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(categoryInfo.query)}&apiKey=${apiKey}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching news:', error);
        throw error;
    }
}

// Export the categories and function
export { newsCategories, getNewsByCategory }; 