(() => {
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a2, b) => (typeof require !== "undefined" ? require : a2)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });

  // main.js
  var import_firebase_app = __require("https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js");
  var import_firebase_firestore = __require("https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js");
  $(function() {
    "use strict";
    $(".sidebar").stickySidebar({ topSpacing: 60, bottomSpacing: 30, containerSelector: ".main-content" }), $(".submenu").before('<i class="icon-arrow-down switch"></i>'), $(".vertical-menu li i.switch").on("click", function() {
      var e3 = $(this).next(".submenu");
      e3.slideToggle(300), e3.parent().toggleClass("openmenu");
    }), $("button.burger-menu").on("click", function() {
      $(".canvas-menu").toggleClass("open"), $(".main-overlay").toggleClass("active");
    }), $(".canvas-menu .btn-close, .main-overlay").on("click", function() {
      $(".canvas-menu").removeClass("open"), $(".main-overlay").removeClass("active");
    }), $("button.search").on("click", function() {
      $(".search-popup").addClass("visible");
    }), $(".search-popup .btn-close").on("click", function() {
      $(".search-popup").removeClass("visible");
    }), $(document).keyup(function(e3) {
      "Escape" === e3.key && $(".search-popup").removeClass("visible");
    });
    for (var e2 = document.getElementsByClassName("spacer"), t2 = 0; t2 < e2.length; t2++) {
      var a2 = e2[t2].getAttribute("data-height");
      e2[t2].style.height = "" + a2 + "px";
    }
    for (var e2 = document.getElementsByClassName("data-bg-image"), t2 = 0; t2 < e2.length; t2++) {
      var o2 = e2[t2].getAttribute("data-bg-image");
      e2[t2].style.backgroundImage = "url('" + o2 + "')";
    }
  });
  var firebaseConfig = {  };
  var app = (0, import_firebase_app.initializeApp)(firebaseConfig);
  var db = (0, import_firebase_firestore.getFirestore)(app);
  async function loadPosts() {
    try {
      let e2 = (0, import_firebase_firestore.collection)(db, "blog-posts"), t2 = (0, import_firebase_firestore.query)(e2, (0, import_firebase_firestore.orderBy)("timestamp", "desc")), i = await (0, import_firebase_firestore.getDocs)(t2), r = [];
      if (i.forEach((e3) => {
        let t3 = e3.data();
        t3.id = e3.id, r.push(t3);
      }), 0 === r.length) return;
      let l = r[0];
      updateHeadline(l), updateHeadlineWithImage(l.bannerImage), updateCategoryPostSections(r), updateLatestPosts(r), updateHeadlines(r);
    } catch (c) {
      console.error("Error loading posts:", c);
    }
  }
  function updateHeadline(e2) {
    let t2 = document.getElementById("x"), a2 = t2.parentElement.querySelector(".category-badge");
    a2 && (a2.textContent = e2.category || "", a2.setAttribute("data-category", e2.category || ""));
    let o2 = document.getElementById("headdate");
    o2 && (o2.textContent = e2.publishedAt || ""), t2.innerHTML = `<a href="/${e2.id}" class='featured-title'>${e2.title}</a>`;
  }
  function updateHeadlineWithImage(e2) {
    let t2 = document.getElementById("headimage");
    t2.style.backgroundImage = `url('${e2}')`;
  }
  function updateCategoryPostSections(e2) {
    try {
      let t2 = { News: [], Music: [], Movies: [], Lifestyle: [], Interviews: [], Events: [] };
      e2.forEach((e3) => {
        e3.category && t2[e3.category] && t2[e3.category].push(e3);
      }), Object.entries(t2).forEach(([e3, t3]) => {
        let a2 = `${e3.toLowerCase()}-section`, o2 = document.querySelector(`.${a2}`);
        if (o2) {
          let s2 = o2.closest(`.${e3.toLowerCase()}`);
          0 === t3.length ? s2 && (s2.style.display = "none") : s2 && (s2.style.display = "block");
        }
      });
    } catch (a2) {
      console.error("Error updating category sections:", a2);
    }
  }
  function updateHeadlines(e2) {
    try {
      let t2 = document.getElementById("headlines-content");
      if (!t2) return;
      let a2 = /* @__PURE__ */ new Date(), o2 = new Date(a2.getTime() - 864e5), s2 = e2.filter((e3) => {
        if (!e3.isHeadline || !e3.publishedAt) return false;
        let t3 = new Date(e3.publishedAt);
        return t3 >= o2 && t3 <= a2;
      }), n2 = s2.sort((e3, t3) => (t3.publishedAt || "").localeCompare(e3.publishedAt || "")).slice(0, 4), i = document.querySelector(".headlines");
      i && (i.style.display = 0 === n2.length ? "none" : "block");
    } catch (r) {
      console.error("Error updating headlines:", r);
    }
  }
  window.addEventListener("load", loadPosts);
})();
