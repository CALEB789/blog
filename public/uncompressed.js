
    // Register GSAP ScrollTrigger plugin
    gsap.registerPlugin(ScrollTrigger);
    // Select carousel and items
    const carousel = document.querySelector(".carousel");
    const items = document.querySelectorAll(".carousel-item");
    
    // Calculate total width (100% per item)
    const totalWidth = (items.length - 1) * 100;
    // GSAP animation for horizontal scrolling
    
    gsap.to(carousel, {
        x: () => `-${totalWidth}%`,
        ease: 'power1.inOut',
        duration: 1,
        scrollTrigger: {
            trigger: ".latest",
            start: "center center",
            end: () => `+=${totalWidth * 1.5}%`, // Multiplier for smooth end
            pin: true,
            anticipatePin: 1,
            scrub: 1,
            snap: {
                snapTo: 1 / (items.length - 1),
                duration: { min: 0.2, max: 0.5 },
                delay: 0.1,
                ease: "power1.inOut"
            },
            onUpdate: (self) => {
                // Prevent overshooting at the end
                if (self.progress >= 1) {
                    self.animation.progress(1);
                }
            }
        }
    });
  
gsap.set(".nav",{display:"none"})

  
function initMenu(){
  let navWrap = document.querySelector(".nav")
  let state = navWrap.getAttribute("data-nav")
  let overlay = navWrap.querySelector(".overlay")
  let menu = navWrap.querySelector(".menu")
  let bgPanels = navWrap.querySelectorAll(".bg-panel")
  let menuToggles = document.querySelectorAll("[data-menu-toggle]")
  let menuLinks = navWrap.querySelectorAll(".menu-link")
  let fadeTargets = navWrap.querySelectorAll("[data-menu-fade]")
  let tl = gsap.timeline()
  
  const openNav = () =>{
    navWrap.setAttribute("data-nav", "open")
    
    tl.clear()
    .set(navWrap,{display:"block"})
    .set(menu,{xPercent:0},"<")
    .fromTo(menuButtonTexts,{yPercent:0},{yPercent:-100,stagger:0.2})
    .fromTo(menuButtonIcon,{rotate:0},{rotate:315},"<")
    .fromTo(overlay,{autoAlpha:0},{autoAlpha:1},"<")
    .fromTo(bgPanels,{xPercent:101},{xPercent:0,stagger:0.12,duration: 0.575},"<")
    .fromTo(menuLinks,{yPercent:140,rotate:10},{yPercent:0, rotate:0,stagger:0.05},"<+=0.35")
    .fromTo(fadeTargets,{autoAlpha:0,yPercent:50},{autoAlpha:1, yPercent:0,stagger:0.04},"<+=0.2")
  }
  
  const closeNav = () =>{
    navWrap.setAttribute("data-nav", "closed")
    
    tl.clear()
    .to(overlay,{autoAlpha:0})
    .to(menu,{xPercent:120},"<")
    .to(menuButtonTexts,{yPercent:0},"<")
    .to(menuButtonIcon,{rotate:0},"<")
    .set(navWrap,{display:"none"})
  }  
  
  // Toggle menu open / close depending on its current state
  menuToggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      state = navWrap.getAttribute("data-nav");
      if (state === "open") {
        closeNav();
      } else {
        openNav();
      }
    });    
  });
  
  // If menu is open, you can close it using the "escape" key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navWrap.getAttribute("data-nav") === "open") {
      closeNav();
    }
  });
}

document.addEventListener("DOMContentLoaded",()=>{
  initMenu()
})
    document.addEventListener('DOMContentLoaded', function() {
            const adLinks = document.querySelectorAll('.sidebar-ad-link[data-ad-id]');
            adLinks.forEach(adLink => {
                const adId = adLink.dataset.adId;
                const adImage = adLink.querySelector('img.sidebar-ad-image');
                const adName = adImage ? adImage.alt : 'Unknown Ad';
                const creativeUrl = adImage ? adImage.src : 'Unknown Creative';

                if (typeof gtag === 'function') {
                    gtag('event', 'ad_view', {
                        'ad_id': adId,
                        'ad_name': adName,
                        'creative_url': creativeUrl,
                        'page_location': window.location.pathname, // Optional: track on which page type ad was viewed
                        'event_category': 'Advertisement', // Optional
                        'event_label': `Ad ID: ${adId} - ${adName}` // Optional
                    });
                    console.log(`GA Event: ad_view - ID: ${adId}, Name: ${adName}`);
                } else {
                    console.warn('gtag function not found. Ad view not tracked for ad ID:', adId);
                }
            });
        });
    