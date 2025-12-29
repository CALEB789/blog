import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, query, orderBy, getDocs, setDoc, doc, deleteDoc, getDoc, onSnapshot, where ,Timestamp} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js";
tinymce.init({
  selector: '.article',  // change this value according to your HTML
  toolbar: 'undo redo | styles | bold italic | alignleft aligncenter alignright alignjustify | outdent indent | link image | code | preview | restoredraft | media | numlist  bullist',
  plugins: 'link image lists media autolink preview autosave fullscreen insertdatetime  anchor table  code lists advlist',
  images_upload_url: 'upload',
  extended_valid_elements: 'div[class],p[class],img[src|alt|class|width|height|style],script[src|type|async|defer]',
  automatic_uploads: true,
  xss_sanitization: false,
  license_key: 'gpl',
   menu: {
    file: { title: 'File', items: 'newdocument restoredraft | preview | importword exportpdf exportword | print | deleteallconversations' },
    edit: { title: 'Edit', items: 'undo redo | cut copy paste pastetext | selectall | searchreplace' },
    view: { title: 'View', items: 'code revisionhistory | visualaid visualchars visualblocks | spellchecker | preview fullscreen | showcomments' },
    insert: { title: 'Insert', items: 'image link media addcomment pageembed codesample inserttable | math | charmap emoticons hr | pagebreak nonbreaking anchor tableofcontents | insertdatetime' },
    format: { title: 'Format', items: 'bold italic underline strikethrough superscript subscript codeformat | styles blocks fontfamily fontsize align lineheight | forecolor backcolor | language | removeformat' },
    tools: { title: 'Tools', items: 'spellchecker spellcheckerlanguage | a11ycheck code wordcount' },
    table: { title: 'Table', items: 'inserttable | cell row column | tableprops deletetable' },
    help: { title: 'Help', items: 'help' }
  },
  setup: function(editor) {
    editor.on('BeforeSetContent', function(e) {
      if (e.content.includes('<img')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.content, 'text/html');
        doc.querySelectorAll('img').forEach(function(img) {
          const parent = img.parentElement;
          if (parent.classList.contains('image-container')) {
            const credit = parent.querySelector('.image-credit');
            if(credit) credit.textContent = img.getAttribute('alt');
            return;
          }
          const altText = img.getAttribute('alt');
          if (altText) {
            const wrapper = document.createElement('div');
            wrapper.className = 'image-container';
            
            const credit = document.createElement('p');
            credit.className = 'image-credit';
            credit.textContent = altText;
            
            parent.insertBefore(wrapper, img);
            wrapper.appendChild(img);
            wrapper.appendChild(credit);
          }
        });
        e.content = doc.body.innerHTML;
      }
    });
  },
  content_style: `
    .image-container {
      position: relative;
    }
    .image-container .image-credit {
      display: block;
      text-align: center;
      font-size: 12px;
      color: #888;
    }
    img {
        max-width: 100%;
    }
  `
});
const firebaseConfig = {
   
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); // Initialize Firebase Storage

// Protect the editor route
const blogTitleField = document.querySelector('.title');
const descriptionField = document.querySelector('.description');
const articleFeild = document.querySelector('.article');
const keywordsField = document.querySelector('.keywords');
const banner_alt_text = document.querySelector('.banner-alt-text');
// banner
const bannerImage = document.querySelector('#banner-upload');
const banner = document.querySelector(".banner");
let bannerPath;

const publishBtn = document.getElementById('publish-btn');
const updateBtn = document.querySelector('.update-btn');
const uploadInput = document.querySelector('#image-upload');
// Get category and headline select elements
const categorySelect = document.querySelector('.category-select');
const headlineSelect = document.querySelector('.headline-select');

// Keep track of existing listeners to prevent duplicates
let postsListenerUnsubscribe = null;
let usersListenerUnsubscribe = null;
let pendingPostsListenerUnsubscribe = null;
let currentUserRole = null; // To store the current user's role (admin, author)
let selectedProfilePicFile = null; // Variable to store the selected profile picture file


bannerImage.addEventListener('change', () => {
    uploadImage(bannerImage, 'banner'); // Specify type for general image uploads if needed
})

uploadInput.addEventListener('change', () => { // This is for TinyMCE image uploads
    uploadImage(uploadInput, 'article_image');
})
function validateKeywords(keywords) {
    if (!keywords.trim()) {
        return true; // Empty is fine
    }
    // Check for multiple words not separated by a comma
    if (!keywords.includes(',') && keywords.trim().split(/\s+/).length > 1) {
        return false;
    }
    return true;
}
function removeAllQuotesFromTitle(x) {
    if (typeof x !== 'string') return '';
    // Remove all symbols except letters, numbers, spaces, and hyphens
    const cleaned = x.replace(/[^a-zA-Z0-9 \-]/g, '');
    // Trim whitespace at both ends and convert to lowercase
    const normalized = cleaned.trim().toLowerCase();
    if (normalized !== x) {
        alert('Title normalized: removed disallowed symbols, trimmed whitespace, and converted to lowercase.');
    }
    return normalized;
}
// General image upload function (e.g. for banners, could be adapted for article images if not using TinyMCE's handler)
const uploadImage = (uploadFileElement, uploadType = 'general') => {
    const [file] = uploadFileElement.files;
    if(file && file.type.includes("image")){
        const formdata = new FormData();
        formdata.append('file', file); // Server expects 'file' for existing /upload endpoint

        // Using existing /upload endpoint for banners
        fetch('/upload', { // This is a custom endpoint, not Firebase Storage directly for banners
            method: 'post',
            body: formdata
        }).then(res => res.json())
        .then(data => {
            if (uploadType === 'banner' && banner) {
                bannerPath = data.location; // Assuming 'location' is the URL field from server response
                banner.style.backgroundImage = `url("${data.location}")`;
            } else {
                // Handle other upload types or integrate with TinyMCE if this is its target
                console.log("Uploaded image for article (or other):", data.location);
                // For TinyMCE, it expects a specific JSON response: { location: "image_url" }
                // This part might need to be TinyMCE specific if `uploadInput` is for it.
            }
        }).catch(error => {
            console.error("Error uploading image via /upload:", error);
            alert("Image upload failed.");
        });
    } else{
        alert("Please upload an image file.");
    }
}

function formatDate(date) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

publishBtn.addEventListener('click', async () => {
    if (publishBtn.disabled) return; // Prevent multiple clicks if already processing

    // const editingPostId = banner.dataset.editingPostId || null; 
    if (tinymce.activeEditor.getContent().length && blogTitleField.value.length && 
        categorySelect.value !== 'none' && headlineSelect.value !== 'none' && keywordsField.value.length!=0 && banner_alt_text.value.length!=0) {
        
        publishBtn.disabled = true;
        if (!validateKeywords(keywordsField.value)) {
            alert("Keywords must be separated by commas.");
            
        } 

        const originalButtonText = publishBtn.textContent;
        const isAdminUser = currentUserRole === 'admin' || (auth.currentUser && auth.currentUser.email === 'mukiivan@lbtvnow.com');
        publishBtn.textContent = isAdminUser ? 'Publishing...' : 'Submitting...';

        try {
            
            let blogTitle = blogTitleField.value.split(" ").join("-");
            let docId = `${blogTitle}`;
            const date = new Date();
            const isAdminUser = currentUserRole === 'admin' || (auth.currentUser && auth.currentUser.email === 'mukiivan@lbtvnow.com');
            docId = removeAllQuotesFromTitle(docId)
            // Fetch current author's details to embed in the post
            let authorName = 'Muki Ivan' // Default
            let authorProfilePicUrl = "";
            const userRoleRef = doc(db, "userRoles", auth.currentUser.uid);
            const userRoleSnap = await getDoc(userRoleRef);
            if (userRoleSnap.exists()) {
                const userData = userRoleSnap.data();
                authorName = userData.name || authorName;
                authorProfilePicUrl = userData.profilePictureUrl || "";
            }

       await setDoc(doc(db, "blog-posts", docId), {
                title: blogTitleField.value,
                bannerAltText: banner_alt_text.value,
                description: descriptionField.value,
                keywords: keywordsField.value,
                article: tinymce.activeEditor.getContent(),
                bannerImage: bannerPath || "", 
                category: categorySelect.value,
                isHeadline: headlineSelect.value === 'yes',
                publishedAt: isAdminUser ? formatDate(date) : null,
                timestamp: Timestamp.now(),
                authorUid: auth.currentUser.uid,
                authorEmail: auth.currentUser.email,
                authorName: authorName, // Embed author's name
                authorProfilePicUrl: authorProfilePicUrl, // Embed author's profile pic URL
                status: isAdminUser ? 'published' : 'pendingApproval',
                lastModified: formatDate(date)
            });
            const postUrl = `${location.origin}/${docId}`;
            if (isAdminUser) {
                await fetch('/add-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: postUrl })
                });
                try {
                    await fetch('/api/send-notification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: 'New Post on Fame Watch',
                            message: blogTitleField.value,
                            url: postUrl,
                            category: categorySelect.value
                        })
                    });
                } catch (notificationError) {
                    console.error('Error sending notification:', notificationError);
                }
                location.href = `/${docId}`;
            } else {
                alert("Post submitted for approval!");
                clearEditor(); 
                switchTab('management'); 
            }
        
        } catch (err) {
            console.error("Error publishing/submitting post:", err);
            alert('Failed to publish/submit post. Please try again.');
        } finally {
            publishBtn.disabled = false;
            publishBtn.textContent = originalButtonText;
        }
    } else {
        alert("Please fill all fields");
        // Ensure button is re-enabled if validation fails before try block
        if (publishBtn.disabled) { // This check implies it was disabled just before
            publishBtn.disabled = false;
            // Re-determine button text based on current role, as originalButtonText might not have been set
            const currentIsAdmin = currentUserRole === 'admin' || (auth.currentUser && auth.currentUser.email === 'mukiivan@lbtvnow.com');
            publishBtn.textContent = currentIsAdmin ? 'Publish New Post' : 'Submit for Approval';
        }
    }
});
const cropperModal = document.getElementById('cropper-modal');
const cropperImage = document.getElementById('cropper-image');
const cropBtn = document.getElementById('crop-btn');
const cancelCropBtn = document.getElementById('cancel-crop-btn');
let cropper;

updateBtn.addEventListener('click', async () => {
    if (updateBtn.disabled) return; // Prevent multiple clicks

    const editingPostId = banner.dataset.editingPostId;
    if (!editingPostId) {
        alert('Error: No post selected for update.');
        return;
    }
    if(!validateKeywords(keywordsField.value)) {
            alert("Keywords must be separated by commas.");
            return;
        }
    if (tinymce.activeEditor.getContent().length && blogTitleField.value.length &&
        categorySelect.value !== 'none' && headlineSelect.value !== 'none') {
        
        updateBtn.disabled = true;
        const originalButtonText = updateBtn.textContent;
        updateBtn.textContent = 'Updating...';

        try {
            const postRef = doc(db, "blog-posts", editingPostId);
            const postSnap = await getDoc(postRef);
            if (!postSnap.exists()) {
                alert("Error: Post not found for updating.");
                return;
            }
            const postData = postSnap.data();
            const isAdminUser = currentUserRole === 'admin' || (auth.currentUser && auth.currentUser.email === 'mukiivan@lbtvnow.com');
            const isAuthor = postData.authorUid === auth.currentUser.uid;
            const isEditableStatus = postData.status === 'draft' || postData.status === 'pendingApproval';

            if (!isAdminUser && !(isAuthor && isEditableStatus)) {
                alert("You do not have permission to edit this post or it cannot be edited in its current state.");
                return;
            }

            const date = new Date();
            let newStatus = postData.status;
            let publishedAtUpdate = postData.publishedAt;
            let authorNameToEmbed = postData.authorName; // Preserve original author's name by default
            let authorProfilePicUrlToEmbed = postData.authorProfilePicUrl; // Preserve original pic by default
            let authorUidForDetails = postData.authorUid; // Use post's authorUid for fetching details

            // If current user is the author of the post, update with their current profile details
            if (auth.currentUser.uid === postData.authorUid) {
                const userRoleRef = doc(db, "userRoles", auth.currentUser.uid);
                const userRoleSnap = await getDoc(userRoleRef);
                if (userRoleSnap.exists()) {
                    const currentUserData = userRoleSnap.data();
                    authorNameToEmbed = currentUserData.name || auth.currentUser.email.split('@')[0];
                    authorProfilePicUrlToEmbed = currentUserData.profilePictureUrl || "";
                }
            } 
            // If an admin is editing, and we want to ensure the embedded author details are up-to-date
            // with the original author's profile (not the admin's profile).
            // This logic is implicitly covered if postData.authorUid is used and that author's details are fetched.
            // However, if the post is new-ish and might not have these fields, or if admin is publishing for first time:
            else if (isAdminUser && (!postData.authorName || !postData.authorProfilePicUrl)) {
                 const originalAuthorRoleRef = doc(db, "userRoles", postData.authorUid);
                 const originalAuthorSnap = await getDoc(originalAuthorRoleRef);
                 if (originalAuthorSnap.exists()) {
                     const originalAuthorData = originalAuthorSnap.data();
                     authorNameToEmbed = originalAuthorData.name || postData.authorEmail.split('@')[0];
                     authorProfilePicUrlToEmbed = originalAuthorData.profilePictureUrl || "";
                 }
            }


            if (isAdminUser) {
                newStatus = 'published';
                if (!postData.publishedAt) { 
                    publishedAtUpdate = formatDate(date);
                }
            }
            const symbolRegex = /["]/;
            
            const updateData = {
                title: blogTitleField.value,
                bannerAltText: banner_alt_text.value,
                description: descriptionField.value,
                article: tinymce.activeEditor.getContent(),
                bannerImage: bannerPath || postData.bannerImage || "", 
                category: categorySelect.value,
                keywords: keywordsField.value,
                isHeadline: headlineSelect.value === 'yes',
                lastModified: formatDate(date),
                status: newStatus,
                publishedAt: publishedAtUpdate,
                authorName: authorNameToEmbed,
                authorProfilePicUrl: authorProfilePicUrlToEmbed
                // authorUid and authorEmail remain unchanged from original postData
            };      
            await setDoc(postRef, updateData, { merge: true });
            alert('Post updated successfully!');
           
            
            
            
            if (newStatus === 'published') {
                if(isAdminUser && !postData.publishedAt){ 
                    const postUrl = `${location.origin}/${editingPostId}`;
                     await fetch('/add-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: postUrl })
                    });
                }
                location.href = `/${editingPostId}`;
            } else {
                clearEditor();
                switchTab('management');
            }
        } catch (err) {
            console.error("Error updating post:", err);
            alert('Failed to update post. Please try again.');
        } finally {
            updateBtn.disabled = false;
            updateBtn.textContent = originalButtonText;
        }
    } else {
        alert("Please fill all fields, select a category, and specify if this is a headline");
        // If validation fails, the button was not disabled by this flow, so no need to reset it here.
    }
});

function loadUsersForManagement() {
    const usersListDiv = document.querySelector('.users-list');
    const selectUserForRoleChange = document.getElementById('select-user-for-role-change');
    if (!usersListDiv || !selectUserForRoleChange) return;

    if (usersListenerUnsubscribe) {
        usersListenerUnsubscribe();
        usersListenerUnsubscribe = null;
    }

    usersListDiv.innerHTML = '<div class="loading">Loading users...</div>';
    selectUserForRoleChange.innerHTML = '<option value="">Select User</option>'; 

    const q = query(collection(db, "userRoles"), orderBy("email"));
    usersListenerUnsubscribe = onSnapshot(q, (querySnapshot) => {
        usersListDiv.innerHTML = ''; 
        selectUserForRoleChange.innerHTML = '<option value="">Select User</option>'; 

        if (querySnapshot.empty) {
            usersListDiv.innerHTML = '<div class="no-users">No users found.</div>';
            return;
        }

        querySnapshot.forEach(docSnap => {
            const userData = docSnap.data();
            const userUid = docSnap.id;
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            let isCurrentUser = auth.currentUser && auth.currentUser.uid === userUid;
            
            let profilePicHtml = userData.profilePictureUrl 
                ? `<img src="${userData.profilePictureUrl}" alt="${userData.name || 'Author'}" class="user-list-profile-pic">`
                : '<div class="user-list-profile-pic default-avatar"></div>'; // Placeholder for default avatar

            userDiv.innerHTML = `
                ${profilePicHtml}
                <div class="user-details">
                    <span class="user-name">${userData.name || 'N/A'}</span>
                    <span class="user-email">${userData.email}</span>
                    <span class="user-role">Role: ${userData.role}</span>
                    ${isCurrentUser ? '<span class="current-user-indicator">(You)</span>' : ''}
                </div>
            `;
            usersListDiv.appendChild(userDiv);

            if (currentUserRole === 'admin' || (auth.currentUser && auth.currentUser.email === 'mukiivan@lbtvnow.com')) {
                if (auth.currentUser.uid !== userUid) { 
                    const option = document.createElement('option');
                    option.value = userUid;
                    option.textContent = `${userData.name || userData.email}`;
                    selectUserForRoleChange.appendChild(option);
                }
            }
        });
    }, (error) => {
        console.error("Error loading users with onSnapshot:", error);
        usersListDiv.innerHTML = '<div class="error">Error loading users. Please try again.</div>';
    });
}

function initializeAdminControls() {
    const registerAuthorBtn = document.getElementById('register-author-btn');
    const changeRoleBtn = document.getElementById('change-role-btn');
    const profilePicInput = document.getElementById('new-author-profile-pic');
    const profilePicPreview = document.getElementById('profile-pic-preview');
    const adsupload = document.getElementById('upload-ad-btn');
    if (profilePicInput && profilePicPreview) {
        profilePicInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                selectedProfilePicFile = file; 
                const reader = new FileReader();
                reader.onload = (e) => {
                    profilePicPreview.src = e.target.result;
                    profilePicPreview.style.display = 'block';
                }
                reader.readAsDataURL(file);
            } else {
                selectedProfilePicFile = null;
                profilePicPreview.src = '#';
                profilePicPreview.style.display = 'none';
            }
        });
    }

    if (registerAuthorBtn) {
        registerAuthorBtn.addEventListener('click', async () => {
            if (registerAuthorBtn.disabled) return;

            const name = document.getElementById('new-author-name').value;
            const email = document.getElementById('new-author-email').value;
            const password = document.getElementById('new-author-password').value;

            if (!name || !email || !password) {
                alert("Please provide name, email, and password for the new author.");
                return;
            }
            if (currentUserRole !== 'admin' && auth.currentUser.email !== 'mukiivan@lbtvnow.com') {
                alert("You are not authorized to register new users.");
                return;
            }

            registerAuthorBtn.disabled = true;
            const originalButtonText = registerAuthorBtn.textContent;
            registerAuthorBtn.textContent = 'Registering...';

            try {
                const adminUser = auth.currentUser; 
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const newUser = userCredential.user;
                
                let profilePictureUrl = null;
                if (selectedProfilePicFile) {
                    profilePictureUrl = await uploadProfilePicture(selectedProfilePicFile, newUser.uid);
                }

                await setDoc(doc(db, "userRoles", newUser.uid), {
                    email: newUser.email,
                    role: "author",
                    name: name,
                    profilePictureUrl: profilePictureUrl || "" 
                });
                alert(`Author ${email} (Name: ${name}) registered successfully!`);
                document.getElementById('new-author-name').value = '';
                document.getElementById('new-author-email').value = '';
                document.getElementById('new-author-password').value = '';
                if(profilePicInput) profilePicInput.value = null; 
                if(profilePicPreview) {
                    profilePicPreview.src = '#';
                    profilePicPreview.style.display = 'none';
                }
                selectedProfilePicFile = null;
                
                if (auth.currentUser.uid !== adminUser.uid) {
                     console.warn("New user signed in. Admin session may need refresh.");
                     alert("Author registered. Admin session might require refresh for full functionality due to auth changes for new user creation.");
                }
            } catch (error) {
                console.error("Error registering author:", error);
                if (error.code === 'auth/email-already-in-use') {
                    alert('Failed to register author: The email address is already in use by another account.');
                } else if (error.code === 'auth/weak-password') {
                    alert('Failed to register author: Password should be at least 6 characters.');
                } else {
                    alert(`Failed to register author: ${error.message}`);
                }
            } finally {
                registerAuthorBtn.disabled = false;
                registerAuthorBtn.textContent = originalButtonText;
            }
        });
    }

    if (changeRoleBtn) {
        changeRoleBtn.addEventListener('click', async () => {
            if (changeRoleBtn.disabled) return;

            const userUidToChange = document.getElementById('select-user-for-role-change').value;
            const newRole = document.getElementById('select-new-role').value;
            if (!userUidToChange || !newRole) {
                alert("Please select a user and a new role.");
                return;
            }
            if (currentUserRole !== 'admin' && auth.currentUser.email !== 'mukiivan@lbtvnow.com') {
                alert("You are not authorized to change user roles.");
                return;
            }
            if (auth.currentUser.uid === userUidToChange) { 
                alert("Admins cannot change their own role through this interface.");
                return;
            }

            changeRoleBtn.disabled = true;
            const originalButtonText = changeRoleBtn.textContent;
            changeRoleBtn.textContent = 'Changing Role...';

            try {
                const userRoleRef = doc(db, "userRoles", userUidToChange);
                await setDoc(userRoleRef, { role: newRole }, { merge: true });
                alert("User role updated successfully!");
            } catch (error) {
                console.error("Error changing user role:", error);
                alert(`Failed to change user role: ${error.message}`);
            } finally {
                changeRoleBtn.disabled = false;
                changeRoleBtn.textContent = originalButtonText;
            }
        });
    }
}
if (currentUserRole === 'admin' || (auth.currentUser && auth.currentUser.email === 'mukiivan@lbtvnow.com')) {
    const adsman = document.getElementById('adsman');
    if (adsman) {
         adsman.style.display = 'block';
    }else{
        adsman.style.display = 'none';
       }                
                    
    }
function switchTab(tabId) {
    const tabBtns = document.querySelectorAll('.nav-tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        const parentLi = btn.closest('li'); // Get parent li for nav item styling
        if (btn.getAttribute('data-tab') === tabId) {
            if(parentLi) parentLi.classList.add('active'); else btn.classList.add('active');
        } else {
            if(parentLi) parentLi.classList.remove('active'); else btn.classList.remove('active');
        }
    });
    
    tabContents.forEach(content => {
        if (content.id === `${tabId}-tab`) {
            content.style.display = 'block';
            if (tabId === 'management') {
                loadPosts(); 
            } else if (tabId === 'user-management') {
                loadUsersForManagement(); 
                const adminControls = document.getElementById('admin-user-controls');
        
                if (adminControls){ 
                    if (currentUserRole === 'admin' || (auth.currentUser && auth.currentUser.email === 'mukiivan@lbtvnow.com')) {
                        adminControls.style.display = 'block';
                    } else {
                        adminControls.style.display = 'none';
                    }
                }
            } 
        } else {
            content.style.display = 'none';
        }
    });
}

function switchToEditor(postId = null) {
    const tabBtns = document.querySelectorAll('.nav-tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
         const parentLi = btn.closest('li');
         if(parentLi) parentLi.classList.remove('active'); else btn.classList.remove('active');
    });
    const editorBtn = document.querySelector('button[data-tab="editor"]');
    if(editorBtn) {
        const parentLi = editorBtn.closest('li');
        if(parentLi) parentLi.classList.add('active'); else editorBtn.classList.add('active');
    }
    
    tabContents.forEach(content => {
        content.style.display = content.id === 'editor-tab' ? 'block' : 'none';
    });

    if (postId) {
        loadPostForEdit(postId);
    } else {
        clearEditor();
    }
}

function clearEditor() {
    if(blogTitleField) blogTitleField.value = '';
    if(descriptionField) descriptionField.value = '';
    if(keywordsField) keywordsField.value = '';
    if (tinymce.activeEditor) { 
        tinymce.activeEditor.setContent('');
    }
    if(categorySelect) categorySelect.value = 'none';
    if(headlineSelect) headlineSelect.value = 'none';
    if (banner) { 
        banner.style.backgroundImage = '';
        delete banner.dataset.editingPostId;
    }
    bannerPath = '';
    
    const url = new URL(window.location);
    url.searchParams.delete('edit');
    window.history.pushState({}, '', url);

    if(publishBtn) publishBtn.style.display = 'inline-block';
    if(updateBtn) updateBtn.style.display = 'none';

    const isAdminUser = currentUserRole === 'admin' || (auth.currentUser && auth.currentUser.email === 'mukiivan@lbtvnow.com');
    if(publishBtn) publishBtn.textContent = isAdminUser ? 'Publish New Post' : 'Submit for Approval';
    if(updateBtn) updateBtn.textContent = 'Update Post';
}

function initializePendingPostsNotifier() {
    const isAdminUser = currentUserRole === 'admin' || (auth.currentUser && auth.currentUser.email === 'mukiivan@lbtvnow.com');
    if (!isAdminUser) {
        updatePendingPostsBadge(0); 
        if(pendingPostsListenerUnsubscribe) {
            pendingPostsListenerUnsubscribe();
            pendingPostsListenerUnsubscribe = null;
        }
        return;
    }

    if (pendingPostsListenerUnsubscribe) { 
        return;
    }

    const q = query(collection(db, "blog-posts"), where("status", "==", "pendingApproval"));
    pendingPostsListenerUnsubscribe = onSnapshot(q, (querySnapshot) => {
        updatePendingPostsBadge(querySnapshot.size);
    }, (error) => {
        console.error("Error listening to pending posts:", error);
        updatePendingPostsBadge(0);
    });
}

function updatePendingPostsBadge(count) {
    let badge = document.getElementById('pending-posts-badge');
    const managePostsTabButton = document.querySelector('button[data-tab="management"]');
    if (!managePostsTabButton) return;

    if (!badge) {
        badge = document.createElement('span');
        badge.id = 'pending-posts-badge';
        badge.className = 'notification-badge'; 
        badge.style.backgroundColor = 'red';
        badge.style.color = 'white';
        badge.style.padding = '2px 6px';
        badge.style.borderRadius = '10px';
        badge.style.fontSize = '0.8em';
        badge.style.marginLeft = '8px';
        badge.style.display = 'none'; 
        managePostsTabButton.appendChild(badge);
    }

    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function initializeUI() {
    const tabBtns = document.querySelectorAll('.nav-tab-btn');
    const navbarToggle = document.querySelector('.navbar-toggle');
    const navbarMenu = document.querySelector('.navbar-menu');
    const overlay = document.querySelector('.overlay'); 
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
            if (navbarMenu && (navbarMenu.classList.contains('active') || navbarMenu.classList.contains('show'))) {
                if (navbarMenu.contains(document.activeElement) && navbarToggle) {
                    navbarToggle.focus();
                }
                if (navbarMenu) navbarMenu.classList.remove('active', 'show');
                if (navbarToggle) navbarToggle.classList.remove('active');
                document.body.style.overflow = '';
                if (overlay) overlay.classList.remove('show');
            }
        });
    });
    
    function toggleMobileMenu(e) { 
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (e && e.type === 'touchstart' && navbarToggle) {
            navbarToggle.style.transform = 'scale(0.95)';
            setTimeout(() => {
                if(navbarToggle) navbarToggle.style.transform = '';
            }, 150);
        }
        if (navbarToggle) navbarToggle.classList.toggle('active');
        if (navbarMenu) navbarMenu.classList.toggle('show'); 
        if (overlay) overlay.classList.toggle('show');
        
        const isExpanded = navbarToggle ? navbarToggle.classList.contains('active') : false;
        if (navbarToggle) navbarToggle.setAttribute('aria-expanded', isExpanded.toString());
        if (navbarMenu) navbarMenu.setAttribute('aria-hidden', (!isExpanded).toString());
        document.body.style.overflow = isExpanded ? 'hidden' : '';
    }

    if (navbarToggle && navbarMenu && overlay) {
        navbarToggle.addEventListener('touchstart', toggleMobileMenu, { passive: false });
        navbarToggle.addEventListener('click', toggleMobileMenu);
        overlay.addEventListener('touchstart', toggleMobileMenu, { passive: false });
        overlay.addEventListener('click', toggleMobileMenu);
    }

    if (navbarMenu) {
        navbarMenu.querySelectorAll('button, a').forEach(item => {
            item.addEventListener('click', () => {
                if (navbarMenu.contains(document.activeElement) && navbarToggle) {
                    navbarToggle.focus();
                }
                if (navbarToggle) navbarToggle.classList.remove('active');
                navbarMenu.classList.remove('active', 'show');
                document.body.style.overflow = '';
                if (overlay) overlay.classList.remove('show');
            });
        });
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && navbarMenu && navbarMenu.classList.contains('show')) {
            toggleMobileMenu(); 
        }
    });

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = '/login';
            } catch (error) {
                console.error('Error signing out:', error);
            }
        });
    }
    switchTab('editor'); // Default to editor tab
    // checkEditMode(); // Called from onAuthStateChanged after role is known
}

function loadPosts() { 
    const postsList = document.querySelector('.posts-list');
    if (!postsList) return;
    
    if (postsListenerUnsubscribe) {
        postsListenerUnsubscribe();
        postsListenerUnsubscribe = null;
    }

    postsList.innerHTML = '<div class="loading">Loading posts...</div>';
    const isAdminUser = currentUserRole === 'admin' || (auth.currentUser && auth.currentUser.email === 'mukiivan@lbtvnow.com');
    let q;
    if (isAdminUser) {
        q = query(collection(db, 'blog-posts'), orderBy('timestamp', 'desc'));
    } else {
        q = query(collection(db, 'blog-posts'), where('authorUid', '==', auth.currentUser.uid), orderBy('timestamp', 'desc'));
    }

    postsListenerUnsubscribe = onSnapshot(q, (querySnapshot) => {
        postsList.innerHTML = ''; 
        if (querySnapshot.empty) {
            postsList.innerHTML = '<div class="no-posts">No posts found.</div>';
            return;
        }
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const postId = docSnap.id;

            const postDiv = document.createElement('div');
            postDiv.className = 'post-item';
            postDiv.dataset.postId = postId;
            postDiv.dataset.authorUid = data.authorUid;
            postDiv.dataset.status = data.status;

            let actionsHtml = '';
            const isAuthor = auth.currentUser && data.authorUid === auth.currentUser.uid;
            const canEditDeleteAuthor = isAuthor && (data.status === 'draft' || data.status === 'pendingApproval');

            if (isAdminUser || canEditDeleteAuthor) {
                actionsHtml += `<button class="edit-btn btn dark" data-id="${postId}">Edit</button>`; // Added btn dark
                actionsHtml += `<button class="delete-btn btn dark" data-id="${postId}">Delete</button>`; // Added btn dark
            }
            if (isAdminUser && data.status === 'pendingApproval') {
                actionsHtml += `<button class="approve-btn btn dark" data-id="${postId}">Approve & Publish</button>`; // Added btn dark
                actionsHtml += `<button class="reject-btn btn dark" data-id="${postId}">Reject</button>`; // Added btn dark
            }
            postDiv.innerHTML = `
                <div class="post-details">
                    <div class="post-item-title">${data.title}</div>
                    <div class="post-item-meta">
                        <span>By: ${data.authorEmail || 'Unknown'}</span> | 
                        <span>Status: ${data.status || 'N/A'}</span> | 
                        <span>${data.category}</span> | 
                        <span>${data.publishedAt || data.lastModified || 'N/A'}</span> | 
                        <span>Headline: ${data.isHeadline ? 'Yes' : 'No'}</span>
                    </div>
                </div>
                <div class="post-item-actions">
                    ${actionsHtml}
                </div>
            `;
            postsList.appendChild(postDiv);
        });
        addPostActionListeners(postsList, isAdminUser);
    }, (error) => {
        postsList.innerHTML = '<div class="error">Error loading posts. Please try again.</div>';
        console.error("Error in loadPosts onSnapshot:", error);
    });
}

async function deletePost(postId) {
    try {
        const postRef = doc(db, 'blog-posts', postId);
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) {
            alert("Post not found, cannot delete.");
            return;
        }
        const postData = postSnap.data();
        const isAdminUser = currentUserRole === 'admin' || (auth.currentUser && auth.currentUser.email === 'mukiivan@lbtvnow.com');
        const isAuthor = auth.currentUser && postData.authorUid === auth.currentUser.uid;
        const canDeleteAuthor = isAuthor && (postData.status === 'draft' || postData.status === 'pendingApproval');

        if (!isAdminUser && !canDeleteAuthor) {
            alert("You do not have permission to delete this post.");
            return;
        }
        if (confirm('Are you sure you want to delete this post?')) {
            await deleteDoc(postRef); 
            if (postData.status === 'published') {
                 await fetch(`/api/delete-post/${postId}`, { method: 'DELETE' }); 
            }
            console.log(`Post ${postId} deleted.`);
        }
    } catch (err) {
        alert('Failed to delete post.');
        console.error("Error in deletePost:",err);
    }
}

function addPostActionListeners(postsListContainer, isAdmin) {
    postsListContainer.addEventListener('click', async (event) => {
        const target = event.target;
        const postId = target.dataset.id;
        if (!postId) return;

        if (target.classList.contains('edit-btn')) {
            // Edit button typically navigates or changes view, less critical for disable/enable here
            // unless the switchToEditor or loadPostForEdit is very slow. For now, skipping.
            const url = new URL(window.location);
            url.searchParams.set('edit', postId);
            window.history.pushState({}, '', url);
            switchToEditor(postId);
        } else if (target.classList.contains('delete-btn')) {
            if (target.disabled) return;
            target.disabled = true;
            const originalText = target.textContent;
            target.textContent = 'Deleting...';
            try {
                await deletePost(postId); 
            } catch (error) {
                console.error("Error during deletePost from listener:", error);
                alert("Failed to delete post.");
                target.disabled = false; // Re-enable on error
                target.textContent = originalText;
            } finally {
                
                if (target && target.parentNode) { // Check if button still in DOM
                    target.disabled = false;
                    target.textContent = originalText;
                }
            }
        } else if (target.classList.contains('approve-btn') && isAdmin) {
            if (target.disabled) return;
            if (confirm("Are you sure you want to approve and publish this post?")) {
                target.disabled = true;
                const originalText = target.textContent;
                target.textContent = 'Approving...';
                try {
                    const postRef = doc(db, "blog-posts", postId);
                    const currentDate = formatDate(new Date());
                    await setDoc(postRef, { status: "published", publishedAt: currentDate, lastModified: currentDate }, { merge: true });
                    
                    const postSnap = await getDoc(postRef); 
                    if(postSnap.exists()){
                        const postData = postSnap.data();
                        const postUrl = `${location.origin}/${postId}`;
                        await fetch('/add-url', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: postUrl })
                        });
                        await fetch('/api/send-notification', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({
                                 title: 'New Post on Fame Watch', 
                                 message: postData.title,
                                 url: postUrl,
                                 category: postData.category
                             })
                         });
                    }
                    alert("Post approved and published!");
                } catch (error) {
                    console.error("Error approving post:", error);
                    alert("Failed to approve post.");
                    if (target) { // Re-enable on error
                        target.disabled = false;
                        target.textContent = originalText;
                    }
                } finally {
                    // Re-enable if button still exists (e.g. error, or action didn't remove/refresh)
                    if (target && target.parentNode) {
                        target.disabled = false;
                        target.textContent = originalText;
                    }
                }
            } else {
                // User cancelled the confirm dialog
                if (target.disabled) { // It was disabled before confirm
                     target.disabled = false;
                     target.textContent = originalText; // Restore text if it was changed
                }
            }
        } else if (target.classList.contains('reject-btn') && isAdmin) {
            if (target.disabled) return;
            if (confirm("Are you sure you want to reject this post?")) {
                target.disabled = true;
                const originalText = target.textContent;
                target.textContent = 'Rejecting...';
                try {
                    const postRef = doc(db, "blog-posts", postId);
                    await setDoc(postRef, { status: "rejected", lastModified: formatDate(new Date()) }, { merge: true });
                    alert("Post rejected!");
                } catch (error) {
                    console.error("Error rejecting post:", error);
                    alert("Failed to reject post.");
                    if (target) { // Re-enable on error
                        target.disabled = false;
                        target.textContent = originalText;
                    }
                } finally {
                    // Re-enable if button still exists
                    if (target && target.parentNode) {
                        target.disabled = false;
                        target.textContent = originalText;
                    }
                }
            } else {
                // User cancelled the confirm dialog
                if (target.disabled) { // It was disabled before confirm
                    target.disabled = false;
                    target.textContent = originalText; // Restore text
                }
            }
        }
    });
}

async function loadPostForEdit(postId) {
    try {
        const docRef = doc(db, 'blog-posts', postId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if(keywordsField) keywordsField.value = data.keywords || '';
            if(banner_alt_text) banner_alt_text.value = data.bannerAltText || '';
            if(blogTitleField) blogTitleField.value = data.title || '';
            if(descriptionField) descriptionField.value = data.description || '';
            if (tinymce.activeEditor) tinymce.activeEditor.setContent(data.article || '');
            if(categorySelect) categorySelect.value = data.category || 'none';
            if(headlineSelect) headlineSelect.value = data.isHeadline ? 'yes' : 'no';
            if (data.bannerImage) {
                bannerPath = data.bannerImage;
               if(banner) banner.style.backgroundImage = `url('${data.bannerImage}')`;
            }
            if(banner) banner.dataset.editingPostId = postId;

            const isAdminUser = currentUserRole === 'admin' || (auth.currentUser && auth.currentUser.email === 'mukiivan@lbtvnow.com');
            const isAuthor = auth.currentUser && data.authorUid === auth.currentUser.uid;
            const canEditAuthor = isAuthor && (data.status === 'draft' || data.status === 'pendingApproval');

            if (isAdminUser || canEditAuthor) {
                if(publishBtn) publishBtn.style.display = 'none';
                if(updateBtn) updateBtn.style.display = 'inline-block';
                if(updateBtn) {
                    if (isAdminUser && (data.status === 'pendingApproval' || data.status === 'draft')) {
                        updateBtn.textContent = 'Edit & Publish Post';
                    } else if (isAdminUser) {
                         updateBtn.textContent = 'Update Published Post';
                    } else { 
                        updateBtn.textContent = 'Update Post';
                    }
                }
            } else {
                alert("You do not have permission to edit this post in its current state.");
                if(publishBtn) publishBtn.style.display = 'inline-block'; 
                if(updateBtn) updateBtn.style.display = 'none';
                clearEditor(); 
                return;
            }
        } else {
            alert('Post not found');
            clearEditor();
        }
    } catch (err) {
        console.error('Error loading post:', err);
        alert('Failed to load post for editing');
        clearEditor();
    }
}

function checkEditMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    if (editId) {
        if (currentUserRole !== undefined) { 
             loadPostForEdit(editId);
        } else {
            console.log("Deferring checkEditMode until user role is confirmed.");
        }
    } else { // Not in edit mode
        if(publishBtn) publishBtn.style.display = 'inline-block';
        if(updateBtn) updateBtn.style.display = 'none';
        const isAdminUser = currentUserRole === 'admin' || (auth.currentUser && auth.currentUser.email === 'mukiivan@lbtvnow.com');
        if(publishBtn) publishBtn.textContent = isAdminUser ? 'Publish New Post' : 'Submit for Approval';
        if(updateBtn) updateBtn.textContent = 'Update Post'; 
    }
}

async function checkUserRole(user) {
    if (!user) {
        currentUserRole = null; 
        initializePendingPostsNotifier(); 
        return;
    }
    const userRoleRef = doc(db, "userRoles", user.uid);
    const docSnap = await getDoc(userRoleRef);
    if (docSnap.exists()) {
        currentUserRole = docSnap.data().role;
    } else {
        if (user.email === 'mukiivan@lbtvnow.com') {
            await setDoc(userRoleRef, { role: "admin", email: user.email, name: "Muki Ivan" }); // Added default name
            currentUserRole = "admin";
            console.log(`Admin role created for ${user.email}`);
        } else {
             // For new users not registered by admin yet, or if doc is missing
             // This case should ideally be handled by how users are added (e.g. only by admin)
             // For now, if a user exists in Auth but not userRoles, and isn't the main admin,
             // they won't have a role here until admin assigns one or they are registered via admin panel.
             // Let's log this situation.
             console.log(`User ${user.email} authenticated but has no role document in userRoles. Assigning 'author' by default for editor access.`);
             await setDoc(userRoleRef, { role: "author", email: user.email, name: user.email.split('@')[0] }); // Default name from email
             currentUserRole = "author";
        }
    }
    console.log("Current user role:", currentUserRole);
    initializePendingPostsNotifier(); 
}

onAuthStateChanged(auth, async (user) => { 
    if (user) {
        console.log("User is signed in:", user);
        await checkUserRole(user); 
        initializeUI(); 
        
        const isAdminUserGlobal = currentUserRole === 'admin' || (user && user.email === 'mukiivan@lbtvnow.com');

        const adminControlsDiv = document.getElementById('admin-user-controls');
        if (adminControlsDiv) { 
            adminControlsDiv.style.display = isAdminUserGlobal ? 'block' : 'none';
            if(isAdminUserGlobal) initializeAdminControls(); 
        }

        const userManagementNavItem = document.getElementById('user-management-nav-item');
        const adsman = document.getElementById('adsman');
        if (userManagementNavItem) {
            userManagementNavItem.style.display = isAdminUserGlobal ? 'list-item' : 'none';
            adsman.style.display = isAdminUserGlobal ? 'list-item' : 'none';
        }
        
        loadPosts(); 
        if(isAdminUserGlobal) loadUsersForManagement(); // Only load users if admin to populate role change dropdown etc.
        
        checkEditMode(); 
        
        if(publishBtn) publishBtn.textContent = isAdminUserGlobal ? 'Publish New Post' : 'Submit for Approval';

    } else { // User is logged out
        window.location.href = '/login'; // Ensure it's login.html or your correct login page
        currentUserRole = null; 
        if (postsListenerUnsubscribe) postsListenerUnsubscribe();
        if (usersListenerUnsubscribe) usersListenerUnsubscribe();
        if (pendingPostsListenerUnsubscribe) pendingPostsListenerUnsubscribe();
        updatePendingPostsBadge(0); 
        const userManagementNavItem = document.getElementById('user-management-nav-item');
        if (userManagementNavItem) {
            userManagementNavItem.style.display = 'none'; 
        }
    }
});
// --- Author Profile Management ---
const authorAboutTextarea = document.getElementById('author-about');
const authorProfilePicInput = document.getElementById('author-profile-pic');
const authorProfilePicPreview = document.getElementById('author-profile-pic-preview');
let selectedAuthorProfilePicFile = null;

if (authorProfilePicInput) {
    authorProfilePicInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            
            const reader = new FileReader();
            reader.onload = (e) => {
                cropperImage.src = e.target.result;
                cropperModal.style.display = 'block';
                cropper = new Cropper(cropperImage, {
                    aspectRatio: 1,
                    viewMode: 1,
                });
            }
            reader.readAsDataURL(file);
        } 
    });
}

const socialTwitterInput = document.getElementById('social-twitter');
const socialInstagramInput = document.getElementById('social-instagram');
const socialFacebookInput = document.getElementById('social-facebook');
const socialLinkedinInput = document.getElementById('social-linkedin');
const socialWebsiteInput = document.getElementById('social-website');
const saveProfileBtn = document.getElementById('save-profile-btn');
const profileStatusMsg = document.getElementById('profile-status-msg');

async function loadAuthorProfile() {
    if (!auth.currentUser) {
        if(profileStatusMsg) profileStatusMsg.textContent = 'You must be logged in to view your profile.';
        return;
    }
    if(profileStatusMsg) profileStatusMsg.textContent = 'Loading profile...';
    try {
        const response = await fetch(`/api/author/profile/${auth.currentUser.uid}`);
        if (!response.ok) {
            if (response.status === 404) {
                 if(profileStatusMsg) profileStatusMsg.textContent = 'No profile found. You can create one by saving.';
                 if(authorAboutTextarea) authorAboutTextarea.value = '';
                 if(socialTwitterInput) socialTwitterInput.value = '';
                 if(socialInstagramInput) socialInstagramInput.value = '';
                 if(socialFacebookInput) socialFacebookInput.value = '';
                 if(socialLinkedinInput) socialLinkedinInput.value = '';
                 if(socialWebsiteInput) socialWebsiteInput.value = '';
            } else {
                throw new Error(`Failed to load profile: ${response.statusText}`);
            }
            return;
        }
        const profileData = await response.json();
        if (profileData) {
            if (authorProfilePicPreview && profileData.profilePicUrl) {
                authorProfilePicPreview.src = profileData.profilePicUrl;
                authorProfilePicPreview.style.display = 'block';
            }
            if(authorAboutTextarea) authorAboutTextarea.value = profileData.aboutMe || '';
            if(socialTwitterInput && profileData.socialLinks) socialTwitterInput.value = profileData.socialLinks.twitter || '';
            if(socialInstagramInput && profileData.socialLinks) socialInstagramInput.value = profileData.socialLinks.instagram || '';
            if(socialFacebookInput && profileData.socialLinks) socialFacebookInput.value = profileData.socialLinks.facebook || '';
            if(socialLinkedinInput && profileData.socialLinks) socialLinkedinInput.value = profileData.socialLinks.linkedin || '';
            if(socialWebsiteInput && profileData.socialLinks) socialWebsiteInput.value = profileData.socialLinks.website || '';
            if(profileStatusMsg) profileStatusMsg.textContent = 'Profile loaded.';
            
            const currentDisplayNameSpan = document.getElementById('current-display-name');
            if (currentDisplayNameSpan) {
                currentDisplayNameSpan.textContent = profileData.displayName || 'Not set';
            }

            const requestNameChangeBtn = document.getElementById('request-name-change-btn');
            const nameChangeTitle = document.querySelector('.name-change-request h4');
            const nameChangeContainer = document.querySelector('.name-change-request');
            
            if (currentUserRole === 'admin') {
                if(nameChangeTitle) nameChangeTitle.textContent = 'Update Your Display Name';
                if(requestNameChangeBtn) requestNameChangeBtn.textContent = 'Update Name';
                if(nameChangeContainer) nameChangeContainer.style.display = 'block';
            } else if (currentUserRole === 'author') {
                if(nameChangeTitle) nameChangeTitle.textContent = 'Request a Name Change';
                if(requestNameChangeBtn) requestNameChangeBtn.textContent = 'Request Change';
                if(nameChangeContainer) nameChangeContainer.style.display = 'block';
            } else {
                if(nameChangeContainer) nameChangeContainer.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error loading author profile:', error);
        if(profileStatusMsg) profileStatusMsg.textContent = `Error: ${error.message}`;
    }
}

async function uploadProfilePicture(file, authorUid) {
    if (!file || !authorUid) return null;
    const storagePath = `profile_pictures/${authorUid}/${file.name}`;
    const storageRef = ref(storage, storagePath);
    try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log('Profile picture uploaded:', downloadURL);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading profile picture:", error);
        alert("Error uploading profile picture: " + error.message);
        return null;
    }
}

async function saveProfile(profileDataToSave) {
    if(profileStatusMsg) profileStatusMsg.textContent = 'Saving profile data...';
    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/author/profile/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(profileDataToSave)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to save profile: ${response.statusText}`);
        }
        const result = await response.json();
        if(profileStatusMsg) profileStatusMsg.textContent = result.message || 'Profile saved successfully!';
        alert('Profile saved successfully!');
    } catch (error) {
        console.error('Error saving author profile:', error);
        if(profileStatusMsg) profileStatusMsg.textContent = `Error: ${error.message}`;
        alert(`Error saving profile: ${error.message}`);
    }
}

if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
        if (!auth.currentUser) {
            if(profileStatusMsg) profileStatusMsg.textContent = 'You must be logged in to save your profile.';
            alert('You must be logged in to save your profile.');
            return;
        }
        if(profileStatusMsg) profileStatusMsg.textContent = 'Saving profile...';

        const profileDataToSave = {
            aboutMe: authorAboutTextarea ? authorAboutTextarea.value : '',
            socialLinks: {
                twitter: socialTwitterInput ? socialTwitterInput.value : '',
                instagram: socialInstagramInput ? socialInstagramInput.value : '',
                facebook: socialFacebookInput ? socialFacebookInput.value : '',
                linkedin: socialLinkedinInput ? socialLinkedinInput.value : '',
                website: socialWebsiteInput ? socialWebsiteInput.value : '',
            }
        };

        if (selectedAuthorProfilePicFile) {
            uploadProfilePicture(selectedAuthorProfilePicFile, auth.currentUser.uid).then(profilePictureUrl => {
                if (profilePictureUrl) {
                    profileDataToSave.profilePictureUrl = profilePictureUrl;
                }
                saveProfile(profileDataToSave);
            });
        } else {
            saveProfile(profileDataToSave);
        }
    });
}

const requestNameChangeBtn = document.getElementById('request-name-change-btn');
if (requestNameChangeBtn) {
    requestNameChangeBtn.addEventListener('click', async () => {
        const newDisplayNameInput = document.getElementById('new-display-name');
        const nameChangeStatusMsg = document.getElementById('name-change-status-msg');
        const newName = newDisplayNameInput.value.trim();
        
        if (!newName) {
            alert('Please enter your desired new display name.');
            return;
        }

        if (!auth.currentUser) {
            alert('Authentication error. Please log in again.');
            return;
        }
        
        requestNameChangeBtn.disabled = true;
        nameChangeStatusMsg.textContent = 'Processing...';

        try {
            const user = auth.currentUser;

            if (currentUserRole === 'admin') {
                const token = await user.getIdToken();
                const response = await fetch('/api/admin/update-own-name', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ newName: newName })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Failed to update name.');
                
                nameChangeStatusMsg.textContent = 'Your name has been updated successfully.';
                alert('Your name has been updated successfully.');
                loadAuthorProfile(); // Reload to show the new name
                newDisplayNameInput.value = '';

            } else if (currentUserRole === 'author') {
                nameChangeStatusMsg.textContent = 'Submitting request...';
                const userRoleRef = doc(db, "userRoles", user.uid);
                const userRoleSnap = await getDoc(userRoleRef);
                let currentName = 'N/A';
                if (userRoleSnap.exists()) {
                    currentName = userRoleSnap.data().name || user.email.split('@')[0];
                }

                const requestsQuery = query(collection(db, "nameChangeRequests"), where("uid", "==", user.uid), where("status", "==", "pending"));
                const existingRequests = await getDocs(requestsQuery);

                if (!existingRequests.empty) {
                    nameChangeStatusMsg.textContent = "You already have a pending name change request.";
                    alert("You already have a pending name change request.");
                    requestNameChangeBtn.disabled = false;
                    return;
                }
                
                const requestRef = doc(collection(db, "nameChangeRequests"));
                await setDoc(requestRef, {
                    uid: user.uid,
                    email: user.email,
                    currentName: currentName,
                    requestedName: newName,
                    status: 'pending',
                    requestedAt: Timestamp.now()
                });

                nameChangeStatusMsg.textContent = 'Request submitted successfully. It is pending admin approval.';
                newDisplayNameInput.value = '';
            }
        } catch (error) {
            console.error("Error during name change process:", error);
            nameChangeStatusMsg.textContent = `Error: ${error.message}`;
            alert(`Error: ${error.message}`);
        } finally {
            requestNameChangeBtn.disabled = false;
        }
    });
}

// Modify switchTab to load profile when 'profile' tab is clicked
const originalSwitchTab = switchTab; // Keep a reference to the original
switchTab = (tabId) => { // Override switchTab
    originalSwitchTab(tabId); // Call the original function
    if (tabId === 'profile') {
        loadAuthorProfile();
    } else if (tabId === 'ads-management') {
        loadAds();
    } else if (tabId === 'user-management') {
        if (currentUserRole === 'admin') {
            loadNameChangeRequests();
        }
    }
};

async function loadNameChangeRequests() {
    const requestsListDiv = document.getElementById('name-change-requests-list');
    if (!requestsListDiv) return;

    requestsListDiv.innerHTML = '<div class="loading">Loading name change requests...</div>';

    try {
        const q = query(collection(db, "nameChangeRequests"), where("status", "==", "pending"), orderBy("requestedAt", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            requestsListDiv.innerHTML = '<div class="no-requests">No pending name change requests.</div>';
            return;
        }

        let requestsHtml = '';
        querySnapshot.forEach(docSnap => {
            const req = docSnap.data();
            const reqId = docSnap.id;
            requestsHtml += `
                <div class="list-group-item" id="req-${reqId}">
                    <p><strong>User:</strong> ${req.email}</p>
                    <p><strong>Current Name:</strong> ${req.currentName}</p>
                    <p><strong>Requested Name:</strong> ${req.requestedName}</p>
                    <div class="request-actions">
                        <button class="btn btn-sm btn-success approve-name-change-btn" data-req-id="${reqId}" data-user-id="${req.uid}" data-new-name="${req.requestedName}">Approve</button>
                        <button class="btn btn-sm btn-danger deny-name-change-btn" data-req-id="${reqId}">Deny</button>
                    </div>
                </div>
            `;
        });
        requestsListDiv.innerHTML = requestsHtml;
        
        requestsListDiv.addEventListener('click', handleNameChangeRequestAction);

    } catch (error) {
        console.error("Error loading name change requests:", error);
        requestsListDiv.innerHTML = `<div class="error">Error loading requests: ${error.message}</div>`;
    }
}

async function handleNameChangeRequestAction(event) {
    const target = event.target;
    if(!auth.currentUser) return;
    const token = await auth.currentUser.getIdToken();
    
    if (target.classList.contains('approve-name-change-btn')) {
        target.disabled = true;
        const { reqId, userId, newName } = target.dataset;
        
        try {
            const response = await fetch('/api/admin/approve-name-change', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ requestId: reqId, userId: userId, newName: newName })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            alert('Name change approved.');
            loadNameChangeRequests();
        } catch (error) {
            console.error('Error approving name change:', error);
            alert(`Error: ${error.message}`);
            target.disabled = false;
        }
    } else if (target.classList.contains('deny-name-change-btn')) {
        target.disabled = true;
        const { reqId } = target.dataset;

        try {
            const response = await fetch('/api/admin/deny-name-change', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ requestId: reqId })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            alert('Name change denied.');
            loadNameChangeRequests();
        } catch (error) {
            console.error('Error denying name change:', error);
            alert(`Error: ${error.message}`);
            target.disabled = false;
        }
    }
}

// Function to upload ad creative (similar to uploadImage but potentially for a different path/type)
const uploadAdCreative = async (file) => {
    if (!file || !file.type.includes("image")) {
        alert("Please select an image file for the ad creative.");
        throw new Error("Invalid file type for ad creative.");
    }
    const formdata = new FormData();
    formdata.append('file', file); // Server's endpoint expects 'file'

    try {
        const response = await fetch('/upload-ad-creative', { // Using the new dedicated endpoint for ads
            method: 'post',
            body: formdata
        });
        if (!response.ok) {
            throw new Error(`Ad creative upload failed: ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.location) {
            throw new Error("Ad creative upload failed: No location returned from server.");
        }
        // IMPORTANT: The server.js /upload endpoint might need adjustment if ads
        // should go to a specific subfolder e.g. /uploads/ads/
        // For now, it will go to /uploads/
        console.log("Ad creative uploaded:", data.location);
        return data.location; // This will be like "../uploads/imagename.webp"
    } catch (error) {
        console.error("Error uploading ad creative:", error);
        alert(`Ad creative upload failed: ${error.message}`);
        throw error;
    }
};

// Function to load ads from Firestore and display them
async function loadAds() {
    const adsListDiv = document.getElementById('ads-list');
    if (!adsListDiv) return;

    adsListDiv.innerHTML = '<div class="loading">Loading ads...</div>';

    try {
        const q = query(collection(db, "advertisements"), orderBy("uploadedAt", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            adsListDiv.innerHTML = '<div class="no-ads">No ads found. Upload a new ad to get started.</div>';
            return;
        }

        let adsHtml = '';
        querySnapshot.forEach(docSnap => {
            const ad = docSnap.data();
            const adId = docSnap.id;
            // Creative URL might be relative like ../uploads/xxxx.webp.
            // For display in admin, this should be okay if editor.html is in /public/
            // If editor.html is at root, then creativeUrl might need adjustment.
            // Assuming editor.html is in /public, so creativeUrl like ../uploads/.. is fine.
            let creativePreviewUrl = ad.creativeUrl;
            if (creativePreviewUrl && creativePreviewUrl.startsWith('../')) {
                 // no change needed if editor.html is at /public/editor.html
            }


            adsHtml += `
                <div class="list-group-item" id="ad-${adId}">
                    <div class="row align-items-center">
                        <div class="col-md-2">
                            ${ad.creativeUrl ? `<img src="${creativePreviewUrl}" alt="${ad.adName}" style="width: 100px; height: auto; max-height: 100px; object-fit: contain;">` : 'No creative'}
                        </div>
                        <div class="col-md-4">
                            <strong>Name:</strong> ${ad.adName || 'N/A'} <br>
                            <strong>Target URL:</strong> <a href="${ad.targetUrl}" target="_blank" rel="noopener noreferrer">${ad.targetUrl}</a>
                        </div>
                        <div class="col-md-2">
                            <strong>Views:</strong> ${ad.views !== undefined ? ad.views : 'N/A'}
                        </div>
                        <div class="col-md-2">
                            <small>ID: ${adId}</small><br/>
                            <small>Uploaded: ${ad.uploadedAt ? new Date(ad.uploadedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</small>
                        </div>
                        <div class="col-md-2">
                            <button class="btn btn-sm btn-danger delete-ad-btn" data-ad-id="${adId}">Delete</button>
                        </div>
                    </div>
                </div>
            `;
        });
        adsListDiv.innerHTML = adsHtml;

        // Add event listeners for delete buttons
        document.querySelectorAll('.delete-ad-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const adIdToDelete = event.target.dataset.adId;
                if (confirm(`Are you sure you want to delete ad ${adIdToDelete}?`)) {
                    try {
                        await deleteDoc(doc(db, "advertisements", adIdToDelete));
                        // Optionally, could also try to delete the creative from server storage,
                        // but that requires a backend endpoint and knowing the exact file path.
                        // For now, just delete from Firestore.
                        alert('Ad deleted successfully.');
                        loadAds(); // Refresh the list
                    } catch (error) {
                        console.error("Error deleting ad:", error);
                        alert(`Failed to delete ad: ${error.message}`);
                    }
                }
            });
        });

    } catch (error) {
        console.error("Error loading ads:", error);
        adsListDiv.innerHTML = `<div class="error">Error loading ads: ${error.message}</div>`;
    }
}

// Event listener for the ad upload form
const adUploadForm = document.getElementById('ad-upload-form');
if (adUploadForm) {
    adUploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const adNameInput = document.getElementById('ad-name');
        const adTargetUrlInput = document.getElementById('ad-target-url');
        const adCreativeUploadInput = document.getElementById('ad-creative-upload');
        const uploadAdBtn = document.getElementById('upload-ad-btn');

        const adName = adNameInput.value.trim();
        const targetUrl = adTargetUrlInput.value.trim();
        const creativeFile = adCreativeUploadInput.files[0];

        if (!adName || !targetUrl || !creativeFile) {
            alert("Please fill in all fields and select an ad creative.");
            return;
        }
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            alert("Please enter a valid Target URL starting with http:// or https://");
            return;
        }

        uploadAdBtn.disabled = true;
        uploadAdBtn.textContent = 'Uploading...';

        try {
            const creativeStoragePath = await uploadAdCreative(creativeFile);

            const adData = {
                adName: adName,
                targetUrl: targetUrl,
                creativeUrl: creativeStoragePath, // This is the path returned by /upload
                uploadedAt: new Date().toLocaleString(), // Will be converted to Firestore Timestamp by SDK
                views: 0, // Initial view count
                status: 'active' // Default status
            };

            await setDoc(doc(collection(db, "advertisements")), adData); // Use setDoc with auto-ID

            alert("Ad uploaded successfully!");
            adUploadForm.reset(); // Clear the form
            loadAds(); // Refresh the ads list

        } catch (error) {
            console.error("Ad upload process failed:", error);
            alert(`Ad upload failed: ${error.message}`);
        } finally {
            uploadAdBtn.disabled = false;
            uploadAdBtn.textContent = 'Upload Ad';
        }
    });
}



// Function to alert if max words (12) are reached in the title
function checkTitleWordLimit() {
    const titleField = document.querySelector('.title');
    if (!titleField) return;
    titleField.addEventListener('input', function() {
        const words = this.value.trim().split(/\s+/);
        if (words.length > 12) {
            alert('Maximum of 12 words allowed in the title.');
            // Optionally trim to 12 words automatically:
            this.value = words.slice(0, 12).join(' ');
        }
       
    });
}
cropBtn.addEventListener('click', () => {
    cropper.getCroppedCanvas({
        width: 256,
        height: 256,
    }).toBlob((blob) => {
        selectedAuthorProfilePicFile = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
        authorProfilePicPreview.src = URL.createObjectURL(selectedAuthorProfilePicFile);
        authorProfilePicPreview.style.display = 'block';
        cropperModal.style.display = 'none';
        cropper.destroy();
    });
});

cancelCropBtn.addEventListener('click', () => {
    cropperModal.style.display = 'none';
    cropper.destroy();
});

// Initialize the title word limit checker on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkTitleWordLimit);
} else {
    checkTitleWordLimit();
}
