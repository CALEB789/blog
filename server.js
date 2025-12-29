const express = require('express');
const path = require('path');
const fileupload = require('express-fileupload');
const fs = require('fs');
const xml2js = require('xml2js');
const sharp = require('sharp');
//const {google} = require('googleapis');
//const analyticsdata = google.analyticsdata('v1beta');
let initial_path = __dirname + '/public';
var admin = require("firebase-admin");
const { Filter } = require('firebase-admin/firestore');

// Image processing configuration
const IMAGE_QUALITY = 70;
const IMAGE_MAX_WIDTH = 1200;

// Function to ensure upload directory exists
function ensureUploadDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
// Ensure specific directories exist at startup
ensureUploadDir(path.join(initial_path, 'uploads'));
ensureUploadDir(path.join(initial_path, 'uploads', 'ads'));


// Function to process image with Sharp
async function processImage(inputBuffer, options = {}) {    const {
        width = IMAGE_MAX_WIDTH,
        quality = IMAGE_QUALITY,
        format = 'webp',
        fit = 'cover',
        autoCrop = true
    } = options;

    try {
        const image = sharp(inputBuffer);
        const metadata = await image.metadata(); 
        let processed = image;

        // Resize to max width 1200px and height 658px
        const targetWidth = Math.min(width, IMAGE_MAX_WIDTH);
        processed = processed.resize(targetWidth, 658,{
            fit: autoCrop ? 'inside' : fit,
            position: autoCrop ? sharp.strategy.entropy : 'center', // Use entropy for smart cropping when autoCrop is enabled
            withoutEnlargement: true,
            
        })

        // Format conversion and compression
        if (format === 'webp') {
            processed = processed.webp({ 
                quality,
                effort: 6, // Higher compression effort
                smartSubsample: true // Better quality for images with text
            });
        } else if (format === 'jpeg') {
            processed = processed.jpeg({ 
                quality,
                mozjpeg: true // Better compression
            });
        } else if (format === 'avif') {
            processed = processed.avif({ 
                quality,
                effort: 6 // Higher compression effort
            });
        }

        return processed.toBuffer();
    } catch (error) {
        console.error('Error processing image:', error);
        throw error;
    }
}
var serviceAccount = {

}



admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: ""
});
const db = admin.firestore();
const app = express();
app.use(express.static(initial_path));
app.use(fileupload());
app.use(express.json()); // This middleware is needed to parse JSON bodies
app.use(express.urlencoded({ extended: true })); // This middleware is needed to parse URL-encoded bodies
const addToSitemap = (url) => {
  const sitemapFilePath = './public/sitemap.xml';
  let sitemap = [];
  let sitemapXML;
  let homepageUpdated = false;

  // Check if sitemap file exists
  if (fs.existsSync(sitemapFilePath)) {
    sitemapXML = fs.readFileSync(sitemapFilePath);
    xml2js.parseString(sitemapXML, (err, result) => {
      if (err) throw err;
      sitemap = result.urlset.url;
      // Update homepage <lastmod> to today
      const today = new Date().toISOString().split('T')[0];
      for (let urlObj of sitemap) {
        if (urlObj.loc && urlObj.loc[0] && (urlObj.loc[0] === 'https://famewatch.ug' || urlObj.loc[0] === 'https://famewatch.ug/')) {
          urlObj.lastmod[0] = today;
          homepageUpdated = true;
        }
      }
    });
  }

  // Add the new URL to the sitemap
  sitemap.push({ loc: [url], lastmod: [new Date().toISOString()] });

  // Build new XML
  const builder = new xml2js.Builder();
  const xml = builder.buildObject({ urlset: { $: { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9' }, url: sitemap } });

  // Save to file
  fs.writeFileSync(sitemapFilePath, xml);
};
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.sendFile(path.join(initial_path, 'robots.txt'));
}); 
function buildCategorySections(posts) {
  const categories = ['News', 'Music', 'Movies', 'Lifestyle', 'Interviews', 'Events'];

  // Initialize an object to store generated HTML for each category
  const categorySectionsHTML = {};

  categories.forEach(category => {
    const postsForCategory = posts.filter(post => post.category === category).slice(0,14);

    if (postsForCategory.length === 0) {
      // If no posts, render empty string (or a hidden section if your template has it)
      categorySectionsHTML[category] = '';
    } else {
      // Otherwise, render the posts as HTML
      categorySectionsHTML[category] = postsForCategory.map(post => `
        <div class="col-md-12 col-sm-6">
          <div class="post post-list clearfix" data-post-id="${post.id}">
            <div class="thumb rounded">
              <a href="/${post.id}">
                <div class="inner">
                    <div class="image-wrapper">
                        <img src="${post.bannerImage || ''}" alt="" fetchpriority="high">
                    </div>
                </div>
              </a>
            </div>
            <div class="details">
              <ul class="meta list-inline mb-3"style='display: flex;'>
                <li class="list-inline-item">
                  <a href="#" style="color: #000; display: flex; align-items: center;">
                    
                    <span>${post.authorName ||  'Muki Ivan'}</span>
                  </a>
                </li>
                <li class="list-inline-item">
                  <a href="/category/${post.category}" class="category-badge" data-category="${post.category}">
                    ${post.category}                  </a>
                </li>
                <li class="list-inline-item">${formatDate(post.timestamp)}</li>
              </ul>
              <h5 class="post-tile" style="text-overflow: ellipsis;">
                <a href="/${post.id}">${post.title}</a>
              </h5>
              <p class="excerpt mb-0">${post.article ? stripImagesAndSummarize(post.article, 100) : ''}</p>
            </div>
          </div>
        </div>
      `).join('\n');
    }
  });

  return categorySectionsHTML;
}

function stripImagesAndSummarize(text, length = 100) {
  if (!text) return '';
  // Remove Markdown image links: ![alt](url)
  let clean = text.replace(/!\[.*?\]\(.*?\)/g, '');
  // Remove HTML <img ...> tags
  clean = clean.replace(/<img[^>]*>/gi, '').replace(/<\/?[^>]+(>|$)/g, '');
  // Remove any leftover whitespace
  clean = clean.trim();
  // Return the first `length` characters
  return clean.length > length ? clean.substring(0, length) + '...' : clean;
}
// Endpoint to receive new blog post URLs
app.post('/add-url', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).send('URL is required');
  }

  addToSitemap(url);
  res.send('Sitemap updated');
});

app.get('/', async (req, res) => {
    let template = fs.readFileSync(path.join(initial_path, 'home.html'), 'utf-8');
    const posts = await getPosts();
    let sidebarAdsHtml = '';
    try {
        const adsSnapshot = await db.collection('advertisements')
                                    .where('status', '==', 'active') // Assuming 'active' status for displayable ads
                                    .orderBy('uploadedAt', 'desc') // Or some other logic like random, or priority field
                                    .limit(2) // Fetch up to 2 ads for the sidebar
                                    .get();
        
        if (!adsSnapshot.empty) {
            adsSnapshot.forEach(adDoc => {
                const adData = adDoc.data();
                const adId = adDoc.id;
                
                let creativeUrl = adData.creativeUrl;
                
                if (creativeUrl && creativeUrl.startsWith('../')) {
                    creativeUrl = creativeUrl.substring(3); // Converts '../uploads/ads/...' to 'uploads/ads/...'
                }


                sidebarAdsHtml += `
                    <div class="widget rounded mb-4 sidebar-ad-widget">
                        <div class="widget-content p-0"> 
                            <a href="${adData.targetUrl}" target="_blank" rel="noopener sponsored" data-ad-id="${adId}" class="sidebar-ad-link d-block">
                                <div class="image-wrapper">
                                    <img src="/${creativeUrl}" alt="${adData.adName || 'Advertisement'}" class="sidebar-ad-image img-fluid" style="width:100%; height:auto;" fetchpriority="high">
                                </div>
                            </a>
                        </div>
                    </div>
                `;
            });
        } else {
            sidebarAdsHtml = '<!-- No active ads to display -->';
        }
    } catch (error) {
        console.error("Error fetching ads for sidebar:", error);
        sidebarAdsHtml = '<!-- Ads could not be loaded due to an error -->';
    }
    // Ensure the placeholder {{SIDEBAR_ADS_CONTENT}} exists in home.html for this replacement
    template = template.replace('{{SIDEBAR_ADS_CONTENT}}', sidebarAdsHtml);

        const headline = posts[0]
            template = template.replace('{{headimages}}', headline.bannerImage)
        template = template.replace('{{headlink}}', headline.id).replace('{{headtitles}}', headline.title).replace('{{headcategory}}', headline.category).replace('{{headauthorName}}', headline.authorName|| 'Muki Ivan')
        .replace('{{headdate}}', headline.publishedAt)
        const trendingPosts = [...posts]
      .filter(post => {
        const postDate = new Date(formatDate(post.timestamp))
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        return postDate >= twentyFourHoursAgo;
      })
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 4)
      .map((post,idx) => `
        <div class="col-sm-6">
            <div class="post trending-large" data-post-id="${post.id}">
              <div class="thumb rounded">
                <a href="/${post.id}" class="category-badge position-absolute" data-category="${post.category}">${post.category || ''}</a>
                <a href="/${post.id}">
                  <div class="inner">
                    <div class="image-wrapper">
                        <img src="${post.bannerImage || ''}" alt="${post.bannerAltText||post.title}" fetchpriority="high">
                    </div>
                  </div>
                </a>
              </div>
              <ul class="meta list-inline mt-4 mb-0">
                <li class="list-inline-item">
                  <a href="#" style="color: #000;">
                    
                    <span>${post.authorName || 'Muki Ivan'}</span>
                  </a>
                </li>
                <li class="list-inline-item">${formatDate(post.timestamp) || ''}</li>
              </ul>
              <h5 class="post-title mb-3 mt-3" style="text-overflow: ellipsis;">
                <a href="/${post.id}">${post.title}</a>
              </h5>
              <p class="excerpt mb-0">${post.article ? stripImagesAndSummarize(post.article, 50) : ''}</p>
            </div>
          </div>
        `).join('\n');
      
      const foundHeadlines = [];
      for (let i = 0; i < posts.length && foundHeadlines.length <4 ; i++) {
        if (posts[i].isHeadline) {
            foundHeadlines.push(posts[i]);
        }
    }
   
                
      const latestPosts = posts
      .filter(post => typeof post.timestamp._seconds === 'number')
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 4)
      .map(post => 
        `
      <div class="carousel-item">
            <a href="/${post.id}">
            <div class="image-wrapper">
                <img src="${post.bannerImage}" alt="${post.bannerAltText|| post.title}" fetchpriority="high">
            </div>
            <div class="carousel-item-content"> 
                <h2>${post.title}</h2>
                <div class="author-info-carousel" style="display: flex; align-items: center; margin-bottom: 5px;">
                    
                    <span class="author">${post.authorName || 'Muki Ivan'}</span>
                </div>
                <span class="date">${formatDate(post.timestamp)}</span>
            </div>
             </a>
        </div>

      `).join('\n');
      const categorySectionsHTML = buildCategorySections(posts);
      Object.entries(categorySectionsHTML).forEach(([category, htmlContent]) => {
      const placeholder = `{{${category.toLowerCase()}Section}}`;
     template = template.replace(placeholder, htmlContent)
    });
  template = template.replace('{{LATEST_CONTENT}}', latestPosts).replace('{{TRENDING_CONTENT}}', trendingPosts);
  if ( foundHeadlines.length === 0) {
        template = template.replace('{{HEADLINES_CONTENT}}', 'No Articles found currently.')
    }else if(trendingPosts.length === 0){
      template = template.replace('{{TRENDING_CONTENT}}', 'No Articles found currently.');
    }
     else if (foundHeadlines.length > 0) {
    template = template.replace('{{HEADLINES_CONTENT}}',  foundHeadlines.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).map(post => `
      <div class="post post-list-sm circle">
        <div class="thumb circle">
          <a href="/${post.id}">
          </a>
        </div>
        <div class="details clearfix">
          <h6 class="post-title my-0" style="text-overflow: ellipsis;">
            <a href="/${post.id}">${post.title}</a>
          </h6>
          <ul class="meta list-inline mt-1 mb-0">            <li class="list-inline-item">${formatDate(post.timestamp) || ''}</li>
          </ul>
        </div>
      </div>
      `).join('\n'));
}
        res.send(template);

})
app.get('/biography', (req, res) => {
    res.sendFile(path.join(initial_path, "biography.html"));
})
app.get('/editor', (req, res) => {
    res.sendFile(path.join(initial_path, "editor.html"));
})

app.get('/login', (req, res) => {
    res.sendFile(path.join(initial_path, "login.html"));
})

app.get('/stats', (req, res) => {
    res.sendFile(path.join(initial_path, "stats.html"));
})

// Cache object (can be defined at a higher scope if not already)
let cache = {
  posts: null,
  fetchedAt: 0,
  isFetching: false, // Lock to prevent concurrent fetches
};

// Reusable function to get posts (either from cache or fetch)
async function getPosts() {
  const now = Date.now();
  if (cache.isFetching) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait a bit and re-check
    return getPosts(); // Re-call to get data once fetch is done or try again
  }

  if (!cache.posts || now - cache.fetchedAt > 60 * 1000) { // Cache for 1 minute
    cache.isFetching = true;
    try {
      const snapshot = await db.collection('blog-posts')
                                  .where('status', '==', 'published')
                                  .orderBy('timestamp', 'desc')
                                  .get();
      cache.posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      cache.fetchedAt = now;
    } catch (error) {
      console.error("Error fetching posts:", error);
      // Potentially return old cache if fetch fails but posts exist
      if (cache.posts) return cache.posts;
      throw error; // Or handle more gracefully
    } finally {
      cache.isFetching = false;
    }
  }
  return cache.posts;
}

// Modify category routes
const categoriesForRoutes = ['news', 'music', 'movies', 'lifestyle', 'interviews','events'];
categoriesForRoutes.forEach(category => {
  const categoryNameProper = category.replace('-', ' & ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  
  app.get(`/category/${category}`, async (req, res) => {
    try {
      let template = fs.readFileSync(path.join(initial_path, `${category}.html`), 'utf-8');
      const allPosts = await getPosts().then(posts => {
        return posts;
      });
      const categoryPosts = allPosts.filter(post => post.category && post.category.toLowerCase() === categoryNameProper.toLowerCase().replace(' & ', ' and '));
      let itemsHtml = '';
      if (categoryPosts.length === 0) {
        itemsHtml = `<div class="col-12"><p>No posts found in ${categoryNameProper} currently.</p></div>`;
      } else {
        itemsHtml = categoryPosts.map(post => `
          <div class="col-lg-4 col-md-6 col-sm-12 mb-4">
            <div class="blog-card h-100 d-flex flex-column">
                <div class="image-wrapper">
                    <img src="${post.bannerImage || 'img/posts/tabs-1.jpg'}" class="blog-image" alt="${post.bannerAltText||post.title}" fetchpriority="high" style="object-fit: cover; height: 200px;">
                </div>
              <div class="p-3 d-flex flex-column flex-grow-1">
                <h5 class="blog-title" style="font-size: 1.1rem; margin-bottom: 0.5rem;">${post.title.substring(0, 60)}${post.title.length > 60 ? '...' : ''}</h5>
                <p class="blog-overview" style="font-size: 0.9rem; margin-bottom: 1rem; flex-grow: 1;">${post.article ? stripImagesAndSummarize(post.article, 70) : 'Click to read more.'}</p>
                <a href="/${post.id}" class="btn btn-default btn-sm align-self-start" style="background-color: red; color: white;">Read More</a>
              </div>
            </div>
          </div>
        `).join('\n');
      }
      template = template.replace('{{categoryItemsList}}', itemsHtml);
      
      res.send(template);
    } catch (error) {
      console.error(`Error serving /${category} page:`, error);
      res.status(500).send("Error loading page. Please try again later.");
    }
  });
});

// New endpoint for uploading ad creatives
app.post('/upload-ad-creative', async (req, res) => {
    try {
        if (!req.files || !req.files.file) {
            return res.status(400).json({ error: 'No ad creative file uploaded' });
        }
        const file = req.files.file;
        const timestamp = Date.now();
        // Sanitize file name and prepend with 'ad-'
        const originalName = path.parse(file.name).name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const adImageName = `ad-${timestamp}-${originalName}`;

        const adUploadsDir = path.join(initial_path, 'uploads', 'ads');
        // ensureUploadDir(adUploadsDir); // This is called at startup now

        // Create URL-friendly path for response (relative to /public path for client)
        const urlPath = `../uploads/ads/${adImageName}.webp`;
        // Create file system path for saving
        const filePath = path.join(adUploadsDir, `${adImageName}.webp`);
        
        const processedImage = await processImage(file.data, {
            // Ads might have different size requirements, adjust if needed.
            // For now, using similar processing to general images.
            // Consider specific dimensions for ads if required by design.
            width: IMAGE_MAX_WIDTH, // Max width for an ad, can be smaller
            // height: SPECIFIC_AD_HEIGHT, // If ads have fixed height
            fit: 'inside', // 'cover' or 'contain' might be better depending on ad design
            format: 'webp',
            quality: IMAGE_QUALITY, 
            autoCrop: false // Usually ads are specific dimensions, so disable autocrop unless flexible
        });
        
        await fs.promises.writeFile(filePath, processedImage);

        res.json({
            location: urlPath 
        });
    } catch (err) {
        console.error('Error handling ad creative upload:', err);
        res.status(500).json({ error: 'Failed to upload ad creative' });
    }
});

// upload link for general images (e.g. blog banners, TinyMCE)
app.post('/upload', async (req, res) => {
    try {
        if (!req.files || !req.files.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const file = req.files.file;
        const timestamp = Date.now();
        // Sanitize file name
        const originalName = path.parse(file.name).name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const imagename = `${timestamp}-${originalName}`;
        
        const generalUploadsDir = path.join(initial_path, 'uploads');
        // ensureUploadDir(generalUploadsDir); // This is called at startup now

        const urlPath = `../uploads/${imagename}.webp`;
        const filePath = path.join(generalUploadsDir, `${imagename}.webp`);
        
        const processedImage = await processImage(file.data, { // Standard processing for blog images
            width: IMAGE_MAX_WIDTH,
            format: 'webp',
            quality: IMAGE_QUALITY,
            autoCrop: true
        });
        
        await fs.promises.writeFile(filePath, processedImage);

        res.json({
            location: urlPath
        });
    } catch (err) {
        console.error('Error handling image upload:', err);
        res.status(500).json({ error: 'Failed to upload image' });
    }
})
function formatDate(timestamp) {
  if (!timestamp) return '';
  const options = {
  weekday: 'short',  // e.g., "Monday"
  year: 'numeric',    // e.g., "2026"
  month: 'short',     // e.g., "September"
  day: 'numeric',     // e.g., "29"
  hour: '2-digit',    // e.g., "12"
  minute: '2-digit',  // e.g., "59"
  hour12: false        // Use AM/PM
};
  let date = new Date(timestamp).toLocaleString('en-US', options)
  
  if (date === 'Invalid Date') {
    date = timestamp.toDate().toLocaleString('en-US', options) + ' UTC'
    
    return date};
  
  return date;
}

function parseArticle(article) {
    if (!article) return '';
    // Replace all non-breaking spaces with regular spaces, then split
    const lines = article.replace(/&nbsp;/g, ' ').split('\n');
    let html = '';

    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.length === 0) {
            return; // Skip empty or whitespace-only lines
        }

        if (trimmedLine.startsWith('#')) {
            const hCount = trimmedLine.match(/^#+/)[0].length;
            html += `<h${hCount}>${trimmedLine.slice(hCount).trim()}</h${hCount}>`;
        } else if (trimmedLine.startsWith('![')) {
            const separator = trimmedLine.indexOf('](');
            const alt = trimmedLine.slice(2, separator);
            const src = trimmedLine.slice(separator + 2, trimmedLine.length - 1);
            html += `<div class="article-image-wrapper"><img src="${src}" alt="${alt}" class="article-image"></div>`;
        } else {
            html += `<p>${trimmedLine}</p>`;
        }
    });
    return html;
}

app.get('/:blogId', async (req, res) => {
  const blogId = req.params.blogId;

  try {
    const docRef = db.collection('blog-posts').doc(blogId);
    const blogDoc = await docRef.get();

    if (!blogDoc.exists) {
        return res.status(404).sendFile(path.join(initial_path,'404.html')); // Or a more generic error page
    }
    const blogData = blogDoc.data();

    // Check if the post is published
    if (blogData.status !== 'published') {
        return res.status(404).sendFile(path.join(initial_path, '404.html')); // Or a message like 'Post not available'
    }

    // Increment views via transaction
    await db.runTransaction(async (transaction) => {
      const post = await transaction.get(docRef);
      if (post.exists) {
        let views = post.data().views;
        if (typeof views !== 'number') views = 0;
        transaction.update(docRef, { views: views + 1 });
      }
    });

    // Fetch latest 5 published blogs (excluding current one)
    const blogsQuery = await db.collection('blog-posts')
      .where('status', '==', 'published')
      .orderBy('timestamp', 'desc')
      .limit(6) // Fetch 6 to ensure we have 5 if current is in the list
      .get();

    const otherBlogs = [];
    let count = 0;
    blogsQuery.forEach(doc => {
      if (doc.id !== blogId && count < 5) {
        otherBlogs.push({
          id: doc.id,
          title: doc.data().title,
          bannerImage: doc.data().bannerImage
        });
        count++;
      }
    });

    // Load template
    function fixTimeStringToDate(timeString) {
        try{
            timeString = blogData.timestamp.toDate().toISOString()
        } catch(e){
            timeString=new Date(blogData.timestamp).toISOString()
        }
        return timeString;
    }
    function fixModifedDate(timeString) {
        if (blogData.lastModified) {
            timeString = new Date(blogData.lastModified).toISOString()
        }else{
            timeString=new Date(blogData.timestamp).toISOString()
        }
        return timeString;
    }
    let template = fs.readFileSync(path.join(initial_path, 'blog.html'), 'utf-8');
    const schema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `https://famewatch.ug/${blogId}`
    },
    "headline": blogData.title,
    "description": blogData.description || blogData.article.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').slice(0, 150).trim() + '...',
    "image": `${blogData.bannerImage}`,
    "author": {
        "@type": "Person",
        "name": blogData.authorName || "Muki Ivan"
    },
    "publisher": {
        "@type": "Organization",
        "name": "FameWatch UG",
        "logo": {
            "@type": "ImageObject",
            "url": "https://famewatch.ug/logo.png"
        },
        "sameAs": [
            "https://www.facebook.com/famewatchug",
            "https://x.com/famewatchug",
            "https://www.instagram.com/famewatchug",
            "https://www.tiktok.com/@famewatch.ug"
        ],
    },
    "datePublished": fixTimeStringToDate(blogData.timestamp),
    "dateModified": fixModifedDate(blogData.timestamp),
    "articleSection": blogData.category,
    "inLanguage": "en-US",
    "wordCount": getWordCount(blogData.article)
};

const schemaGraph = `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;

    template = template.replace('{{title}}', blogData.title)
                        .replace('{{schemaGraph}}', schemaGraph)
                        .replace('{{artticlesTitle}}', blogData.title)
                        .replace('{{category}}', blogData.category).replace('{{author}}', blogData.authorName|| 'Muki Ivan')
                        .replace('{{profilePicUrl}}', blogData.authorProfilePicUrl || 'img/other/author-sm.jpg')
                       .replace('{{bannerImage}}', blogData.bannerImage)
                       .replace('{{publishedAt}}', formatDate(blogData.timestamp))
                       .replace('{{articleContent}}', parseArticle(blogData.article))
                       .replace('{{metaOgTitle}}', blogData.title)
                       .replace('{{authorName}}', blogData.authorName || 'Muki Ivan')
                        .replace('{{keywords}}', blogData.keywords || '')
                        .replace('{{bannerAlt}}', blogData.bannerAltText || blogData.title)
                       .replace('{{metaOgDesc}}', blogData.description || blogData.article.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').slice(0, 120).trim()  + '...')
                       .replace('{{metaDescription}}', blogData.description || blogData.article.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').slice(0, 150).trim() + '...')
                       .replace('{{metaOgImage}}', `https://famewatch.ug${blogData.bannerImage.replace(/(\.\.\/)+uploads\//g, '/uploads/')}`)
                       .replace('{{metaOgUrl}}', `https://famewatch.ug/${blogId}`);
    let authorInfoHtml = '';
    if (blogData.authorUid) {
        try {
            const authorProfileDocRef = db.collection('authors').doc(blogData.authorUid);
            const authorProfileDoc = await authorProfileDocRef.get();
            
            let authorDisplayName = blogData.authorName || 'Author'; // Fallback to post's authorName
            let authorProfilePic = blogData.authorProfilePicUrl || '/img/other/author-sm.jpg'; // Fallback
            let authorAbout = 'No additional information available about the author.';
            let authorSocialLinksHtml = '';

            if (authorProfileDoc.exists) {
                const authorProfileData = authorProfileDoc.data();
                authorDisplayName = authorProfileData.displayName || authorDisplayName;
                authorProfilePic = authorProfileData.profilePicUrl || authorProfilePic;
                authorAbout = authorProfileData.aboutMe || authorAbout;
                authorSocialLinksHtml = generateSocialLinksHtml(authorProfileData.socialLinks);
            } else {
                // Minimal info if full profile not in 'authors' collection but authorId exists
                // (Could also check 'userRoles' as another fallback if desired, but keeping it simpler here)
                 authorSocialLinksHtml = ''; // No social links if full profile is missing
            }

            if (authorDisplayName) { // Only show block if we have at least a name
                authorInfoHtml = `
                <a href = https://famewatch.ug/author/${encodeURI(authorDisplayName)} style="text-decoration: none; color: inherit;">
                <div class="author-bio-box" style="display: flex; align-items: flex-start; padding: 20px; background-color: #f9f9f9; border-radius: 8px; margin-top:30px;">
                    <div class="image-wrapper">
                        <img src="${authorProfilePic}" alt="${authorDisplayName}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin-right: 20px;">
                    </div>
                    <div class="author-bio-content">
                        <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 1.5rem;">About ${authorDisplayName}</h3>
                        <p style="font-size: 0.95rem; line-height: 1.6; margin-bottom: 15px;">${authorAbout}</p>
                        ${authorSocialLinksHtml ? `<div class="author-social-links-blog" style="font-size: 1.2rem; display:flex; gap:10px;">${authorSocialLinksHtml}</div>` : ''}
                    </div>
                </div></a>`;
            }
        } catch (profileError) {
            console.error("Error fetching author profile for blog page:", profileError);
            // authorInfoHtml will remain empty, section won't show
        }
    }
    template = template.replace('{{authorInfoBlock}}', authorInfoHtml)

    // Inject related blogs
    let blogsHtml = '';
    otherBlogs.forEach(b => {
      blogsHtml += `
        <div class="blog-card">
            <div class="image-wrapper">
                <img src="${b.bannerImage}" class="blog-image" alt="">
            </div>
          <h1 class="blog-title" style="padding:30px">${b.title}...</h1>
          <a href="/${b.id}" class="btn dark" style='margin-bottom:20px'>read</a>
        </div>
      `;
    });
    template = template.replace('{{relatedBlogs}}', blogsHtml);

    // Serve rendered HTML
    res.send(template);

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Delete post endpoint
app.delete('/api/delete-post/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;
        
        // Delete from Firestore
        await db.collection('blog-posts').doc(postId).delete();

        // Update sitemap (remove the URL)
        const sitemapFilePath = './public/sitemap.xml';
        if (fs.existsSync(sitemapFilePath)) {
            const sitemapXML = fs.readFileSync(sitemapFilePath);
            xml2js.parseString(sitemapXML, (err, result) => {
                if (err) {
                    console.error('Error parsing sitemap:', err);
                    return;
                }
                
                // Filter out the deleted post URL
                const postUrl = `https://famewatch.ug/${postId}`;
                result.urlset.url = result.urlset.url.filter(urlObj => 
                    urlObj.loc[0] !== postUrl
                );

                // Write updated sitemap
                const builder = new xml2js.Builder();
                const xml = builder.buildObject(result);
                fs.writeFileSync(sitemapFilePath, xml);
            });
        }

        res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// OneSignal notification endpoint
app.post('/api/send-notification', async (req, res) => {
    try {
        const { title, message, url, category } = req.body;
        
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': '' // Replace with your OneSignal REST API key
            },
            body: JSON.stringify({
                app_id: '2',
                included_segments: ['All'],
                headings: { 'en': title },
                contents: { 'en': message },
                url: url,
                data: { category: category }
            })
        });

        const responseData = await response.json();
        res.json(responseData);
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});
// Image transformation endpoint
app.get('/image/:transformations/:filename', async (req, res) => {
    try {
        const { transformations, filename } = req.params;
        const imagePath = path.join(initial_path, 'uploads', filename);
        
        if (!fs.existsSync(imagePath)) {
            return res.status(404).send('Image not found');
        }
        
        // Parse transformation parameters
        const params = transformations.split(',').reduce((acc, curr) => {
            const [key, value] = curr.split('_');
            acc[key] = value;
            return acc;
        }, {});
        
        // Process image with requested transformations
        const imageBuffer = await processImage(await fs.promises.readFile(imagePath), {
            width: parseInt(params.w) || IMAGE_MAX_WIDTH,
            quality: parseInt(params.q) || IMAGE_QUALITY,
            format: params.f || 'webp',
            fit: params.fit || 'inside'
        });
        
        // Set appropriate content type
        res.setHeader('Content-Type', `image/${params.f || 'webp'}`);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(imageBuffer);
    } catch (error) {
        console.error('Error transforming image:', error);
        res.status(500).send('Error processing image');
    }
});

// Bulk image optimization endpoint
app.post('/api/optimize-images', async (req, res) => {
    try {
        const { images } = req.body;
        const results = [];
        
        for (const imagePath of images) {
            const fullPath = path.join(initial_path, imagePath);
            if (fs.existsSync(fullPath)) {
                const optimized = await processImage(
                    await fs.promises.readFile(fullPath),
                    { format: 'webp' }
                );
                await fs.promises.writeFile(fullPath + '.webp', optimized);
                results.push({
                    original: imagePath,
                    optimized: imagePath + '.webp'
                });
            }
        }
        
        res.json({ success: true, results });
    } catch (error) {
        console.error('Error optimizing images:', error);
        res.status(500).json({ error: 'Failed to optimize images' });
    }
});
async function verifyFirebaseToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(403).json({ error: 'Unauthorized: No token provided or invalid format.' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        req.user = decodedToken; // Add user info (including UID) to request object

        next();
    } catch (error) {
        console.error('[verifyFirebaseToken] Error verifying Firebase ID token:', error.message);
        return res.status(403).json({ error: 'Unauthorized: Invalid token.', code: error.code });
    }
}

// GET Author Profile Endpoint
app.get('/api/author/profile/:authorId', async (req, res) => {
    try {
        const authorId = req.params.authorId;
        if (!authorId) {
            return res.status(400).json({ error: 'Author ID is required.' });
        }
        const authorDocRef = db.collection('authors').doc(authorId);
        const authorDoc = await authorDocRef.get();

        if (!authorDoc.exists) { 
            const userRoleRef = db.collection('userRoles').doc(authorId);
            const userRoleDoc = await userRoleRef.get();
            if (userRoleDoc.exists) { // Correct: .exists is a property
                const userData = userRoleDoc.data();
                // Return a minimal profile based on userRoles
                return res.json({
                    displayName: userData.name || userData.email.split('@')[0],
                    profilePicUrl: userData.profilePictureUrl || '',
                    aboutMe: '', // No aboutMe in userRoles by default
                    socialLinks: {}, // No social links in userRoles
                    authorId: authorId // Include authorId for reference
                });
            }
            return res.status(404).json({ error: 'Author profile not found.' });
        }
        const authorData = authorDoc.data();
        res.json({
            displayName: authorData.displayName,
            profilePicUrl: authorData.profilePicUrl,
            aboutMe: authorData.aboutMe,
            socialLinks: authorData.socialLinks || {}, // Ensure socialLinks is an object
            authorId:  authorId // Include authorId for reference
        });
    } catch (error) {
        console.error('Error fetching author profile:', error);
        res.status(500).json({ error: 'Failed to fetch author profile.' });
    }
});
app.get('/i/protection', (req, res) => {
    res.sendFile(path.join(initial_path, "protection.html"));
});
// POST Update Author Profile Endpoint
// This endpoint should be protected and only allow users to update their own profile.
app.post('/api/author/profile/update', verifyFirebaseToken, async (req, res) => {
    if (!req.user || !req.user.uid) {
        console.error('[POST /api/author/profile/update] req.user or req.user.uid is undefined. This should not happen if middleware ran correctly.');
        return res.status(500).json({ error: 'Authentication error: User context not properly set.' });
    }

    try {
        const authorId = req.user.uid; // UID from verified token
        const { aboutMe, socialLinks } = req.body;

        if (typeof aboutMe === 'undefined' && typeof socialLinks === 'undefined') {
            return res.status(400).json({ error: 'No data provided for update.' });
        }

        const authorDocRef = db.collection('authors').doc(authorId);
        const userRoleDocRef = db.collection('userRoles').doc(authorId); 

        const dataToUpdate = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        dataToUpdate.authorId = authorId; // Include authorId in the update data
        if (typeof aboutMe === 'string') {
            dataToUpdate.aboutMe = aboutMe;


        }
        if (typeof socialLinks === 'object' && socialLinks !== null) {
            // Basic validation for social links (ensure they are strings/URLs if desired)
            const validatedSocialLinks = {};
            for (const key in socialLinks) {
                if (typeof socialLinks[key] === 'string') {
                     // Basic check if it's a URL (optional, can be more robust)
                    if (socialLinks[key] === '' || socialLinks[key].startsWith('http://') || socialLinks[key].startsWith('https://')) {
                        validatedSocialLinks[key] = socialLinks[key];
                    } else if (socialLinks[key]) { // If not empty and not a valid-looking URL for some platforms
                        // For now, we accept it, client-side validation is also important
                         validatedSocialLinks[key] = socialLinks[key];
                    }
                }
            }
            dataToUpdate.socialLinks = validatedSocialLinks;
        }
         if (req.body.profilePictureUrl) {
            dataToUpdate.profilePicUrl = req.body.profilePictureUrl;
            // Also update the userRoles collection
            await userRoleDocRef.set({ profilePictureUrl: req.body.profilePictureUrl }, { merge: true });
        }
        
        // Check if the author document exists, if not, create it with initial data
        const authorDoc = await authorDocRef.get();
        if (!authorDoc.exists) { // Correct: .exists is a property
            // If creating for the first time, fetch basic info from userRoles
            const userRoleDoc = await userRoleDocRef.get();
            if (userRoleDoc.exists) { // Correct: .exists is a property
                const userRoleData = userRoleDoc.data();
                dataToUpdate.displayName = userRoleData.name || req.user.email.split('@')[0];
                dataToUpdate.email = req.user.email;
                dataToUpdate.profilePicUrl = userRoleData.profilePictureUrl || '';
                dataToUpdate.createdAt = admin.firestore.FieldValue.serverTimestamp();
            } else {
                // Should not happen if user is authenticated and in userRoles
                dataToUpdate.displayName = req.user.email.split('@')[0];
                dataToUpdate.email = req.user.email;
                dataToUpdate.createdAt = admin.firestore.FieldValue.serverTimestamp();
            }
             await authorDocRef.set(dataToUpdate, { merge: true }); // Use set with merge to create if not exists
        } else {
            await authorDocRef.update(dataToUpdate);
        }
    const finalAuthorDoc = await authorDocRef.get();
        if (finalAuthorDoc.exists && finalAuthorDoc.data().displayName) {
            const authorDisplayName = finalAuthorDoc.data().displayName;
            const authorSlug = generateSlug(authorDisplayName);
            if (authorSlug) { // Ensure slug is not empty
                const authorPageUrl = `https://famewatch.ug/author/${authorSlug}`;
                addToSitemap(authorPageUrl);
                console.log(`[POST /api/author/profile/update] Added/Updated ${authorPageUrl} in sitemap.`);
            }
        } else {
            console.warn(`[POST /api/author/profile/update] Could not add author to sitemap, displayName missing for authorId: ${authorId}`);
        }
        res.json({ message: 'Author profile updated successfully.' });
    } catch (error) {
        console.error('Error updating author profile:', error);
        res.status(500).json({ error: 'Failed to update author profile.', details: error.message });
    }
});

// Endpoint for admin to approve a name change request
app.post('/api/admin/approve-name-change', verifyFirebaseToken, async (req, res) => {
    const adminId = req.user.uid;
    try {
        const adminRoleRef = db.collection('userRoles').doc(adminId);
        const adminRoleDoc = await adminRoleRef.get();
        if (!adminRoleDoc.exists() || adminRoleDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Admin access required.' });
        }

        const { requestId, userId, newName } = req.body;
        if (!requestId || !userId || !newName) {
            return res.status(400).json({ error: 'Request ID, User ID, and new name are required.' });
        }

        const batch = db.batch();

        // Update request document
        const requestRef = db.collection('nameChangeRequests').doc(requestId);
        batch.update(requestRef, { status: 'approved', approvedBy: adminId });

        // Update userRoles and authors collections
        const userRoleRef = db.collection('userRoles').doc(userId);
        batch.update(userRoleRef, { name: newName });
        const authorRef = db.collection('authors').doc(userId);
        batch.set(authorRef, { displayName: newName }, { merge: true });

        // Update all blog posts by the author
        const postsQuery = db.collection('blog-posts').where('authorUid', '==', userId);
        const postsSnapshot = await postsQuery.get();
        postsSnapshot.forEach(doc => {
            batch.update(doc.ref, { authorName: newName });
        });

        await batch.commit();
        res.json({ message: 'Name change approved successfully.' });
    } catch (error) {
        console.error('Error approving name change:', error);
        res.status(500).json({ error: 'Failed to approve name change.', details: error.message });
    }
});

// Endpoint for admin to deny a name change request
app.post('/api/admin/deny-name-change', verifyFirebaseToken, async (req, res) => {
    const adminId = req.user.uid;
    try {
        const adminRoleRef = db.collection('userRoles').doc(adminId);
        const adminRoleDoc = await adminRoleRef.get();
        if (!adminRoleDoc.exists() || adminRoleDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Admin access required.' });
        }

        const { requestId } = req.body;
        if (!requestId) {
            return res.status(400).json({ error: 'Request ID is required.' });
        }

        const requestRef = db.collection('nameChangeRequests').doc(requestId);
        await requestRef.update({ status: 'denied', deniedBy: adminId });
        res.json({ message: 'Name change request denied.' });
    } catch (error) {
        console.error('Error denying name change request:', error);
        res.status(500).json({ error: 'Failed to deny name change request.', details: error.message });
    }
});

// Endpoint for an admin to update their own name directly
app.post('/api/admin/update-own-name', verifyFirebaseToken, async (req, res) => {
    const adminId = req.user.uid;
    try {
        const adminRoleRef = db.collection('userRoles').doc(adminId);
        const adminRoleDoc = await adminRoleRef.get();
        if (!adminRoleDoc.exists() || adminRoleDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: This action is for admins only.' });
        }

        const { newName } = req.body;
        if (!newName) {
            return res.status(400).json({ error: 'New name is required.' });
        }

        const batch = db.batch();

        // Update userRoles and authors collections
        const userRoleRef = db.collection('userRoles').doc(adminId);
        batch.update(userRoleRef, { name: newName });
        const authorRef = db.collection('authors').doc(adminId);
        batch.set(authorRef, { displayName: newName }, { merge: true });

        // Update all blog posts by the admin
        const postsQuery = db.collection('blog-posts').where('authorUid', '==', adminId);
        const postsSnapshot = await postsQuery.get();
        postsSnapshot.forEach(doc => {
            batch.update(doc.ref, { authorName: newName });
        });

        await batch.commit();
        res.json({ message: 'Your name has been updated successfully.' });
    } catch (error) {
        console.error('Error updating admin name:', error);
        res.status(500).json({ error: 'Failed to update name.', details: error.message });
    }
});

// Helper to generate social link HTML
function generateSocialLinksHtml(socialLinks) {
    let html = '';
    if (!socialLinks || typeof socialLinks !== 'object') return html;

    const platformIcons = {
        twitter: '<svg xmlns="http://www.w3.org/2000/svg" fill="#000" class="bi bi-twitter-x" viewBox="0 0 16 16" id="Twitter-X--Streamline-Bootstrap" height="16" width="16"><path d="M12.6 0.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867 -5.07 -4.425 5.07H0.316l5.733 -6.57L0 0.75h5.063l3.495 4.633L12.601 0.75Zm-0.86 13.028h1.36L4.323 2.145H2.865z" stroke-width="1"></path></svg>',
        instagram: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" id="Instagram--Streamline-Core" height="14" width="14"><g id="instagram"><g id="Group 4546"><path id="Vector" stroke="#000" stroke-linecap="round" stroke-linejoin="round" d="M10.3332 3.64404c-0.1381 0 -0.25 -0.11193 -0.25 -0.25s0.1119 -0.25 0.25 -0.25" stroke-width="1"></path><path id="Vector_2" stroke="#000" stroke-linecap="round" stroke-linejoin="round" d="M10.3332 3.64404c0.1381 0 0.25 -0.11193 0.25 -0.25s-0.1119 -0.25 -0.25 -0.25" stroke-width="1"></path></g><path id="Rectangle 2" stroke="#000" stroke-linecap="round" stroke-linejoin="round" d="M0.858276 3.43141c0 -1.42103 1.151974 -2.573012 2.573014 -2.573012h6.86141c1.421 0 2.573 1.151982 2.573 2.573012v6.86139c0 1.421 -1.152 2.573 -2.573 2.573H3.43129c-1.42104 0 -2.573014 -1.152 -2.573014 -2.573V3.43141Z" stroke-width="1"></path><path id="Ellipse 11" stroke="#000" stroke-linecap="round" stroke-linejoin="round" d="M4.312 6.862a2.55 2.55 0 1 0 5.1 0 2.55 2.55 0 1 0 -5.1 0" stroke-width="1"></path></g></svg>',
        facebook: '<svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="100" height="100" viewBox="0,0,256,256"><g fill="#000" fill-rule="nonzero" stroke="none" stroke-width="1" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0" font-family="none" font-weight="none" font-size="none" text-anchor="none" style="mix-blend-mode: normal"><g transform="scale(5.12,5.12)"><path d="M25,3c-12.15,0 -22,9.85 -22,22c0,11.03 8.125,20.137 18.712,21.728v-15.897h-5.443v-5.783h5.443v-3.848c0,-6.371 3.104,-9.168 8.399,-9.168c2.536,0 3.877,0.188 4.512,0.274v5.048h-3.612c-2.248,0 -3.033,2.131 -3.033,4.533v3.161h6.588l-0.894,5.783h-5.694v15.944c10.738,-1.457 19.022,-10.638 19.022,-21.775c0,-12.15 -9.85,-22 -22,-22z"></path></g></g></svg>',
        linkedin: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" id="Linkedin--Streamline-Core" height="14" width="14"><g id="linkedin--network-linkedin-professional"><path id="Vector" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" d="M3.57363 1.76698c0.00269 0.34578 -0.13077 0.67873 -0.37155 0.92692 -0.24077 0.24818 -0.56953 0.39167 -0.91523 0.39946 -0.34498 -0.01266 -0.67191 -0.15736 -0.91324 -0.40422 -0.24132 -0.24685 -0.378592 -0.57697 -0.383437 -0.92216 0.014997 -0.3363 0.157307 -0.65433 0.398097 -0.889597 0.24078 -0.23527 0.56202 -0.37018 0.89858 -0.377383 0.33559 0.007337 0.65569 0.142582 0.89487 0.378085 0.23918 0.235505 0.37938 0.553475 0.39191 0.888895ZM1.12875 5.44916c0 -0.76217 0.48502 -0.64339 1.1581 -0.64339 0.67309 0 1.14821 -0.11878 1.14821 0.64339v7.42374c0 0.7721 -0.48502 0.6137 -1.14821 0.6137 -0.66318 0 -1.1581 0.1584 -1.1581 -0.6137V5.44916Z" stroke-width="1"></path><path id="Vector_2" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" d="M5.43451 5.44927c0 -0.42563 0.15837 -0.584 0.40583 -0.63349 0.24746 -0.0495 1.09871 0 1.39566 0 0.29695 0 0.41573 0.48501 0.40583 0.85125 0.25401 -0.3409 0.59125 -0.61092 0.97946 -0.78423 0.3882 -0.17331 0.81438 -0.2441 1.23777 -0.2056 0.41574 -0.02542 0.83224 0.03692 1.22234 0.18295 0.39 0.14603 0.7451 0.3725 1.0419 0.66469 0.2969 0.29219 0.5289 0.64356 0.6811 1.03129s0.2211 0.80314 0.2023 1.21924v5.06793c0 0.7721 -0.4751 0.6137 -1.1482 0.6137s-1.1482 0.1584 -1.1482 -0.6137V8.88399c0.0174 -0.20378 -0.0092 -0.40891 -0.0781 -0.60147 -0.0689 -0.19256 -0.1785 -0.36804 -0.3212 -0.51452s-0.31529 -0.26053 -0.506 -0.33441c-0.1907 -0.07387 -0.39507 -0.10585 -0.59923 -0.09374 -0.20321 -0.00516 -0.4052 0.0329 -0.5926 0.11167 -0.18739 0.07876 -0.35592 0.19644 -0.49442 0.34523 -0.13849 0.1488 -0.24381 0.32531 -0.30896 0.51786 -0.06515 0.19255 -0.08866 0.39675 -0.06897 0.59907V12.873c0 0.7721 -0.48502 0.6137 -1.15811 0.6137 -0.67308 0 -1.1482 0.1584 -1.1482 -0.6137V5.44927Z" stroke-width="1"></path></g></svg>',
        website: 'fas fa-globe'
        // Add more platforms and their Font Awesome icons here
    };

    for (const [platform, url] of Object.entries(socialLinks)) {
        if (url && typeof url === 'string' && url.trim() !== '') {
            const iconClass = platformIcons[platform.toLowerCase()] || 'fas fa-link'; // Default icon
            html += `<a href="${url}" target="_blank"  aria-label="${platform}">${iconClass}</a>\n`;
        }
    }
    return html;
}

function generateSlug(name) {
    if (!name) return '';
    return name
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars but hyphens
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

function displayNameFromSlug(slug) {
    if (!slug) return '';
    return slug
        .toString()
        .replace(/-/g, ' ')
        .replace(/\w\S*/g, (txt) => { // Capitalize first letter of each word
            return txt
        });
}


// Route for displaying author page by slugified name
app.get('/author/:authorNameSlug', async (req, res) => {
    try {
        const authorNameSlug = req.params.authorNameSlug;
        if (!authorNameSlug) {
            return res.status(400).send('Author name required');
        }

        const targetDisplayName = displayNameFromSlug(authorNameSlug);
        let authorProfileData = null; // Will store data from 'authors' or 'userRoles'
        let actualAuthorUid = null; // The crucial Firebase UID

        // 1. Try to fetch from 'authors' collection by displayName
        const authorsQuery = db.collection('authors').where('displayName', '==', targetDisplayName).limit(1);
        const authorsSnapshot = await authorsQuery.get();
        if (!authorsSnapshot.empty) {
            const authorDoc = authorsSnapshot.docs[0];
            authorProfileData = authorDoc.data();
            actualAuthorUid = authorDoc.id; // UID is the document ID
        } else {
            // 2. If not in 'authors', try 'userRoles' collection by 'name' field
            const userRolesQuery = db.collection('userRoles').where('name', '==', targetDisplayName).limit(1);
            const userRolesSnapshot = await userRolesQuery.get();
            if (!userRolesSnapshot.empty) {
                const userRoleDoc = userRolesSnapshot.docs[0];
                authorProfileData = userRoleDoc.data(); // Contains name, profilePictureUrl, email, role
                actualAuthorUid = userRoleDoc.id; // UID is the document ID
                // Adapt userRolesData to match expected structure for authorData if necessary
                authorProfileData.displayName = userRoleDoc.data().name; // Ensure displayName field
                authorProfileData.profilePicUrl = userRoleDoc.data().profilePictureUrl;
                // aboutMe and socialLinks will be undefined, handled by defaults later
            } else {
                return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
            }
        }
        
        // Prepare author details for template, using fallbacks
        const authorName = authorProfileData.displayName || targetDisplayName; // Fallback to slug-derived name
        const authorProfilePicUrl = authorProfileData.profilePicUrl || '/img/other/author-sm.jpg';
        const authorAboutMe = authorProfileData.aboutMe || 'No biography available.';
        const socialLinks = authorProfileData.socialLinks || {};


        // 3. Fetch Author's Articles using the actualAuthorUid (Firebase UID)
        if (!actualAuthorUid) {
             // This case should ideally be caught by the 404 above if no author found
            console.error("Could not determine actualAuthorUid for slug:", authorNameSlug);
            return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
        }
        
        const articlesSnapshot = await db.collection('blog-posts')
            .where('authorUid', '==', actualAuthorUid)
            .where('status', '==', 'published')
            .orderBy('timestamp', 'desc')
            .get();
        let articlesHtml = '';
         
        if (articlesSnapshot.empty) {
            articlesHtml = `<div class="col-12"><p>${authorName} has not published any articles yet.</p></div>`;
        } else {
            articlesHtml = articlesSnapshot.docs.map(doc => {
                const post = { id: doc.id, ...doc.data() };
                return `
                    <div class="col-lg-4 col-md-6 col-sm-12 mb-4">
                        <div class="blog-card h-100 d-flex flex-column">
                            <div class="image-wrapper">
                                <img src="${post.bannerImage || '/img/posts/tabs-1.jpg'}" class="blog-image" alt="${post.bannerAltText||post.title}" fetchpriority="high" style="object-fit: cover; height: 200px;">
                            </div>
                            <div class="p-3 d-flex flex-column flex-grow-1">
                                <h5 class="blog-title" style="font-size: 1.1rem; margin-bottom: 0.5rem;">${post.title.substring(0, 60)}</h5>
                                <p class="blog-overview" style="font-size: 0.9rem; margin-bottom: 1rem; flex-grow: 1;">${post.article ? stripImagesAndSummarize(post.article, 70) : 'Click to read more.'}</p>
                                <a href="/${post.id}" class="btn btn-default btn-sm align-self-start" style="background-color: red; color: white;">Read More</a>
                            </div>
                        </div>
                    </div>
                `;
            }).join('\n');
        }

        // 4. Generate Social Links HTML
        const socialLinksHtml = generateSocialLinksHtml(socialLinks);

        // 5. Read and Populate Template
        let template = fs.readFileSync(path.join(initial_path, 'author.html'), 'utf-8');
        template = template.replace(new RegExp('{{authorName}}', 'g'), authorName);
        template = template.replace('{{authorProfilePicUrl}}', authorProfilePicUrl);
        template = template.replace('{{authorAboutMe}}', authorAboutMe);
        template = template.replace('{{authorSocialLinks}}', socialLinksHtml);
        template = template.replace('{{authorArticlesList}}', articlesHtml);
        template = template.replace('<title>Author Profile - Fame Watch</title>', `<title>${authorName} - Author Profile - Fame Watch</title>`);


        res.send(template);

    } catch (error) {
        console.error(`Error serving /author/${req.params.authorId} page:`, error);
        res.status(500).send("Error loading author page. Please try again later.");
    }
});

function getWordCount(html) {
    if (!html) return 0;
    // Select the content within <p>, <blockquote>, and <h*> tags
        let relevantContentArr = html.match(/<(p|blockquote|h[1-6])[^>]*>.*?<\/\1>/g);
    if (!relevantContentArr) {
        relevantContentArr = html.match(/<p[^>]*>.*?<\/p>/g);
       
    }
    if (!relevantContentArr) {
        relevantContentArr = [];
    }
    const relevantContent = relevantContentArr.join(' ');
    // Strip HTML tags from the selected content
    const text = relevantContent.replace(/<[^>]*>/g, ' ');
    // Split by whitespace and filter out empty strings
    const words = text.split(/\s+/).filter(word => word.length > 0);
    return words.length;
}

app.use((req, res) => {
    res.json("404");
})
app.listen(process.env.PORT || 3000, async () => {
    console.log('Server listening on port', process.env.PORT || 3000);
})