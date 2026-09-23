const nav = document.getElementById("nav");
const toast = document.getElementById("toast");
const searchOverlay = document.getElementById("searchOverlay");
const searchInput = document.getElementById("searchInput");
let cart = 0;

window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 45);
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${Math.min(i * 45, 250)}ms`;
  observer.observe(el);
});

document.getElementById("searchBtn").addEventListener("click", () => {
  searchOverlay.classList.add("open");
  setTimeout(() => searchInput.focus(), 250);
});

document.getElementById("closeSearch").addEventListener("click", () => {
  searchOverlay.classList.remove("open");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") searchOverlay.classList.remove("open");
});

document.querySelectorAll(".add").forEach((button) => {
  button.addEventListener("click", () => {
    cart++;
    document.getElementById("cartCount").textContent = cart;
    showToast(`${button.dataset.product} added to your bag`);
  });
});

document.getElementById("newsletter").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = e.currentTarget.querySelector("input").value;
  if (email) {
    showToast("Welcome to the Veloura Circle.");
    e.currentTarget.reset();
  }
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
