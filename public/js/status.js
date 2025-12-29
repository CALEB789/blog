import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js';

const firebaseConfig = {
    
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
    if (user) {
        user.getIdToken().then((token) => {
            fetch('/api/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(res => res.json())
            .then(data => {
                const dailyVisitorsCtx = document.getElementById('daily-visitors-chart').getContext('2d');
                new Chart(dailyVisitorsCtx, {
                    type: 'line',
                    data: {
                        labels: data.dailyVisitors.labels,
                        datasets: [{
                            label: 'Daily Visitors',
                            data: data.dailyVisitors.data,
                            borderColor: 'rgb(75, 192, 192)',
                            tension: 0.1
                        }]
                    }
                });

                const topPagesCtx = document.getElementById('top-pages-chart').getContext('2d');
                new Chart(topPagesCtx, {
                    type: 'bar',
                    data: {
                        labels: data.topPages.labels,
                        datasets: [{
                            label: 'Top Pages',
                            data: data.topPages.data,
                            backgroundColor: 'rgba(255, 99, 132, 0.2)',
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 1
                        }]
                    }
                });
            });
        });
    } else {
        window.location.href = '/login';
    }
});
