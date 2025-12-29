import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

const firebaseConfig = {
    
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const blogSection = document.querySelector('.blogs-section');

const fetchBlogs = async () => {
    // Fetch posts from 'blog-posts' collection, filter for 'Interviews' OR 'Events' and status 'published'
    // Firestore does not support OR queries on different fields directly.
    // We need to fetch for 'Interviews' and then for 'Events', then merge and sort.
    // Or, if the combined volume is low, fetch all published and filter client-side (less ideal).
    // Given the setup, two separate queries are better.

    const interviewsQuery = query(
        collection(db, "blog-posts"),
        where("category", "==", "Interviews"),
        where("status", "==", "published"),
        orderBy("timestamp", "desc")
    );

    const eventsQuery = query(
        collection(db, "blog-posts"),
        where("category", "==", "Events"),
        where("status", "==", "published"),
        orderBy("timestamp", "desc")
    );

    const [interviewsSnapshot, eventsSnapshot] = await Promise.all([
        getDocs(interviewsQuery),
        getDocs(eventsQuery)
    ]);

    let combinedPosts = [];
    interviewsSnapshot.forEach(doc => combinedPosts.push({ id: doc.id, ...doc.data() }));
    eventsSnapshot.forEach(doc => {
        // Avoid duplicates if a post somehow has both categories (though unlikely with current setup)
        if (!combinedPosts.find(p => p.id === doc.id)) {
            combinedPosts.push({ id: doc.id, ...doc.data() });
        }
    });

    // Sort combined results by timestamp
    combinedPosts.sort((a, b) => b.timestamp - a.timestamp);
    
    if (combinedPosts.length === 0) {
        if(blogSection) blogSection.innerHTML = '<p class="no-posts">No interviews or events found.</p>';
        return;
    }

    combinedPosts.forEach(postData => { // postData is now an object, not a doc snapshot
        createBlog(postData); // createBlog needs to handle data object directly
    });
};

const createBlog = (postData) => { 
    // postData is already an object { id: '...', ...data() }
    let authorPicHtml = postData.authorProfilePicUrl 
        ? `<img src="${postData.authorProfilePicUrl}" alt="${postData.authorName || 'Author'}" class="author-avatar-card">`
        : `<div class="author-avatar-card default-avatar-card">👤</div>`;

    blogSection.innerHTML += `
    <div class="blog-card">
        <img src="${postData.bannerImage}" class="blog-image" alt="${postData.title || 'Blog image'}">
        <div class="card-content">
            <h1 class="blog-title">${postData.title ? postData.title.substring(0, 80) + '...' : 'Untitled Post'}</h1>
            <div class="author-info-card">
                ${authorPicHtml}
                <span class="author-name-card">${postData.authorName || postData.authorEmail || 'Anonymous'}</span>
            </div>
            <p class="blog-overview">${postData.article ? postData.article.substring(0, 120).replace(/<[^>]*>/g, '') + '...' : ''}</p>
            <a href="/${postData.id}" class="btn dark">Read More</a>
        </div>
    </div>
    `;
};

fetchBlogs();