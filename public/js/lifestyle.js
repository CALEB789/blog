import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

const firebaseConfig = {
    
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const blogSection = document.querySelector('.blogs-section');

const fetchBlogs = async () => {
    // Fetch posts from 'blog-posts' collection, filter by category 'Lifestyle' and status 'published'
    const lifestyleQuery = query(
        collection(db, "blog-posts"),
        where("category", "==", "Lifestyle"),
        where("status", "==", "published"),
        orderBy("timestamp", "desc") // Optional: order by timestamp or other field
    );
    const blogsSnapshot = await getDocs(lifestyleQuery);

    if (blogsSnapshot.empty) {
        if(blogSection) blogSection.innerHTML = '<p class="no-posts">No lifestyle articles found.</p>';
        return;
    }

    blogsSnapshot.forEach(blog => {
        createBlog(blog);
    });
};

const createBlog = (blog) => { // blog is a Firestore DocumentSnapshot
    let data = blog.data();
    let authorPicHtml = data.authorProfilePicUrl 
        ? `<img src="${data.authorProfilePicUrl}" alt="${data.authorName || 'Author'}" class="author-avatar-card">`
        : `<div class="author-avatar-card default-avatar-card">👤</div>`;

    blogSection.innerHTML += `
    <div class="blog-card">
        <img src="${data.bannerImage}" class="blog-image" alt="${data.title || 'Blog image'}">
        <div class="card-content">
            <h1 class="blog-title">${data.title ? data.title.substring(0, 80) + '...' : 'Untitled Post'}</h1>
            <div class="author-info-card">
                ${authorPicHtml}
                <span class="author-name-card">${data.authorName || data.authorEmail || 'Anonymous'}</span>
            </div>
            <p class="blog-overview">${data.article ? data.article.substring(0, 120).replace(/<[^>]*>/g, '') + '...' : ''}</p>
            <a href="/${blog.id}" class="btn dark">Read More</a>
        </div>
    </div>
    `;
};

fetchBlogs();