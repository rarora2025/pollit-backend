import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors({
    origin: ['http://localhost:3000', 'https://rarora2025.github.io'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: false
}));

// Handle preflight requests
app.options('*', cors());

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
            return res.sendFile(path.join(__dirname, 'public', 'fallback.svg'));
        }

        // Try to fetch the original image first
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.error(`Failed to fetch image from ${imageUrl}: ${response.status} ${response.statusText}`);
            // Use picsum.photos as a fallback
            const fallbackUrl = `https://picsum.photos/800/400?random=${Math.random()}`;
            const fallbackResponse = await fetch(fallbackUrl);
            res.set('Content-Type', fallbackResponse.headers.get('content-type'));
            fallbackResponse.body.pipe(res);
            return;
        }

        // Forward the content type
        res.set('Content-Type', response.headers.get('content-type'));
        
        // Stream the image data
        response.body.pipe(res);
    } catch (error) {
        console.error('Error proxying image:', error);
        // Use picsum.photos as a fallback
        const fallbackUrl = `https://picsum.photos/800/400?random=${Math.random()}`;
        const fallbackResponse = await fetch(fallbackUrl);
        res.set('Content-Type', fallbackResponse.headers.get('content-type'));
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
            // For top news, use the headlines endpoint
            url = `${NEWS_API_BASE_URL}/top-headlines?country=us&apiKey=${NEWS_API_KEY}&pageSize=100`;
        } else {
            // For categories and search, use the everything endpoint
            // Let the News API handle the filtering and sorting
            url = `${NEWS_API_BASE_URL}/everything?q=${encodeURIComponent(query)}&apiKey=${NEWS_API_KEY}&language=en&sortBy=relevancy&pageSize=100`;
        }
        
        console.log('Making request to News API:', url);
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'ok') {
            // Only filter out articles without images
            const filteredArticles = data.articles.filter(article => 
                article.urlToImage && 
                article.title && 
                article.description
            );

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

// Generate poll content endpoint
app.post('/api/generate-content', async (req, res) => {
    try {
        const { article } = req.body;
        
        const prompt = `Given this news article:
Title: ${article.title}
Description: ${article.description}

Create a simple, direct poll question and 3 answer options about this article. Keep everything concise and clear.

Rules:
1. Start the question directly - no prefixes like "Poll Question:" or "Question:"
2. Make answer options simple and direct - no numbering, prefixes, or dashes
3. Keep questions and answers short and to the point
4. Make everything specific to this article's content
5. Provide exactly 3 answer options`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo", // Changed to a more reliable model
                messages: [
                    {
                        role: "system",
                        content: "You are a news analyst who creates simple, direct poll questions. Create clear questions and exactly 3 answer options without any prefixes, numbering, or dashes."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 200
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API error:', errorData);
            throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // Parse the response - looking for question and options
        const lines = content.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            // Remove any common prefixes from questions
            .map(line => line.replace(/^(poll question|question|q|option|answer|choice|a|o)[:.]?\s*/i, ''))
            // Remove any numbering from answers
            .map(line => line.replace(/^\d+[.)]\s*/, ''))
            // Remove any dashes from answers
            .map(line => line.replace(/^-\s*/, ''));

        const question = lines[0];
        const options = lines.slice(1, 4); // Get first 3 options

        res.json({
            choices: [{
                message: {
                    content: `${question}\n${options.join('\n')}`
                }
            }]
        });
    } catch (error) {
        console.error('Error generating poll content:', error);
        res.status(500).json({
            error: 'Error generating poll content',
            message: error.message
        });
    }
});

// Serve the main HTML file for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 