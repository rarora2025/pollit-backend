import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
    origin: '*',  // Allow all origins in production
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: false
}));

// Log all incoming requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('Origin:', req.headers.origin);
    next();
});

// Parse JSON bodies
app.use(express.json());

// Serve static files from the public directory
app.use(express.static('public'));

// API Keys
const NEWS_API_KEY = process.env.NEWS_API_KEY;
if (!NEWS_API_KEY) {
    console.error('NEWS_API_KEY environment variable is not set');
    process.exit(1);
}

const UNSPLASH_API_KEY = 'YOUR_UNSPLASH_API_KEY'; // You'll need to get this from Unsplash
const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

// Cache for Unsplash images
const unsplashCache = new Map();

// Get a random image from Unsplash
async function getUnsplashImage(query) {
    try {
        if (unsplashCache.has(query)) {
            return unsplashCache.get(query);
        }

        const response = await fetch(
            `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape`,
            {
                headers: {
                    'Authorization': `Client-ID ${UNSPLASH_API_KEY}`
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch from Unsplash');
        }

        const data = await response.json();
        const imageUrl = data.urls.regular;
        unsplashCache.set(query, imageUrl);
        return imageUrl;
    } catch (error) {
        console.error('Error fetching from Unsplash:', error);
        return null;
    }
}

// Image proxy endpoint
app.get('/api/proxy-image', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            console.log('No image URL provided, using fallback');
            return res.sendFile(path.join(__dirname, 'public', 'fallback.svg'));
        }

        console.log('Proxying image from:', imageUrl);
        
        // Validate image URL
        if (!imageUrl.startsWith('http')) {
            console.log('Invalid image URL format, using fallback');
            return res.sendFile(path.join(__dirname, 'public', 'fallback.svg'));
        }

        // Try to fetch the original image first
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/*',
                'Referer': 'https://newsapi.org/'
            }
        });

        if (!response.ok) {
            console.error(`Failed to fetch image from ${imageUrl}: ${response.status} ${response.statusText}`);
            // Use picsum.photos as a fallback
            const fallbackUrl = `https://picsum.photos/800/400?random=${Math.random()}`;
            console.log('Using fallback image:', fallbackUrl);
            const fallbackResponse = await fetch(fallbackUrl);
            res.set('Content-Type', fallbackResponse.headers.get('content-type'));
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
            fallbackResponse.body.pipe(res);
            return;
        }

        // Forward the content type and set CORS headers
        res.set('Content-Type', response.headers.get('content-type'));
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
        
        // Stream the image data
        response.body.pipe(res);
    } catch (error) {
        console.error('Error proxying image:', error);
        // Use picsum.photos as a fallback
        const fallbackUrl = `https://picsum.photos/800/400?random=${Math.random()}`;
        console.log('Using fallback image due to error:', fallbackUrl);
        const fallbackResponse = await fetch(fallbackUrl);
        res.set('Content-Type', fallbackResponse.headers.get('content-type'));
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
        fallbackResponse.body.pipe(res);
    }
});

// Proxy endpoint for news
app.get('/api/news', async (req, res) => {
    try {
        const query = req.query.q || 'top';
        let url;
        
        // Handle different types of queries
        if (query === 'top') {
            url = `${NEWS_API_BASE_URL}/top-headlines?country=us&apiKey=${NEWS_API_KEY}&pageSize=100`;
        } else {
            // For categories and search, use the everything endpoint with proper query formatting
            const formattedQuery = query.includes('OR') ? `(${query})` : query;
            url = `${NEWS_API_BASE_URL}/everything?q=${encodeURIComponent(formattedQuery)}&apiKey=${NEWS_API_KEY}&language=en&sortBy=relevancy&pageSize=100`;
        }
        
        console.log('Making request to News API:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error('News API error response:', response.status, response.statusText);
            throw new Error(`News API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('News API response status:', data.status);
        
        if (data.status === 'ok') {
            // Simple filtering to ensure we have valid articles
            const filteredArticles = data.articles.filter(article => {
                const hasImage = article.urlToImage && article.urlToImage.startsWith('http');
                const hasTitle = article.title && article.title.length > 0;
                const hasDescription = article.description && article.description.length > 30;
                
                if (!hasImage) {
                    console.log('Article filtered out - no valid image:', article.title);
                }
                if (!hasTitle) {
                    console.log('Article filtered out - no valid title');
                }
                if (!hasDescription) {
                    console.log('Article filtered out - no valid description:', article.title);
                }
                
                return hasImage && hasTitle && hasDescription;
            });

            console.log(`Found ${filteredArticles.length} articles after filtering for query: ${query}`);
            
            // Set CORS headers
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
            
            // Return the filtered articles
            res.json({
                status: 'ok',
                articles: filteredArticles
            });
        } else {
            console.error('News API error:', data);
            res.status(500).json({ 
                error: 'Error fetching news',
                message: data.message || 'Unknown error occurred'
            });
        }
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Generate content using OpenAI
app.post('/api/generate-content', async (req, res) => {
    try {
        const { article } = req.body;
        if (!article) {
            return res.status(400).json({ error: 'Article is required' });
        }

        const prompt = `Create a thought-provoking, opinion-based poll question specifically about this news article. The question should be directly related to the article's content and ask for people's views on the specific implications, outcomes, or ethical considerations raised in the article.

Article Title: ${article.title}
Article Description: ${article.description}

Format your response exactly like this:
poll question: [Your specific, opinion-based question about this article]
option: [First opinion option that directly relates to the article]
option: [Second opinion option that directly relates to the article]
option: [Third opinion option that directly relates to the article]

Example format (based on a tech article):
poll question: Should companies be required to disclose their AI training data sources?
option: Yes, transparency is crucial for ethical AI development
option: No, it could expose trade secrets and competitive advantages
option: Only for high-risk applications, with exceptions for proprietary data

Remember:
- Make the question SPECIFIC to this article's content
- Focus on the article's unique aspects or implications
- Create options that reflect different viewpoints on the article's specific topic
- Avoid generic questions like "What's your take" or "Do you agree"
- Make it controversial enough to spark debate
- Each option should be a complete thought that relates to the article
- Do not use any numbering or prefixes in the options`;

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a news analyst who creates engaging, opinion-based poll questions. Your questions should be specific to each article and spark meaningful debate about the article's unique aspects. Never use numbers or prefixes in the options."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.8,
            max_tokens: 200
        });

        res.json(response);
    } catch (error) {
        console.error('Error generating content:', error);
        res.status(500).json({ error: 'Error generating content' });
    }
});

// Serve the main HTML file for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 