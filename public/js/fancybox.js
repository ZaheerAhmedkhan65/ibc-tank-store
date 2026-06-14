function ibcInitProductPage() {
    const dataEl = document.getElementById("product-images-data");
    if (!dataEl) return;

    let images;
    try {
        images = JSON.parse(dataEl.textContent);
    } catch(e) {
        images = [];
    }

    if (!images || !images.length) return;

    const mainImg = document.getElementById("mainProductImage");
    if (!mainImg) return;

    const thumbs = document.querySelectorAll(".ibc-thumb-item");
    const nextBtn = document.querySelector(".ibc-gallery-next");
    const prevBtn = document.querySelector(".ibc-gallery-prev");

    let currentIndex = 0;

    function updateMainImage(index) {
        currentIndex = index;
        mainImg.src = images[index];
        mainImg.dataset.index = index;

        thumbs.forEach(t => t.classList.remove("active"));
        if (thumbs[index]) thumbs[index].classList.add("active");
    }

    // Thumbnail click
    thumbs.forEach((thumb, index) => {
        thumb.addEventListener("click", () => updateMainImage(index));
    });

    // Prev / Next buttons
    if (prevBtn) {
        prevBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            updateMainImage((currentIndex - 1 + images.length) % images.length);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            updateMainImage((currentIndex + 1) % images.length);
        });
    }

    // Open Fancybox on main image click
    mainImg.addEventListener("click", () => {
        if (typeof Fancybox !== "undefined") {
            Fancybox.show(
                images.map(src => ({ src, type: "image" })),
                {
                    startIndex: currentIndex,
                    Thumbs: { autoStart: true }
                }
            );
        }
    });
}

function ibcInitTabs() {
    document.querySelectorAll('.ibc-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            document.querySelectorAll('.ibc-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.ibc-tab-content').forEach(c => c.style.display = 'none');
            
            const target = document.getElementById(tabId);
            if (target) target.style.display = 'block';
        });
    });
}

function ibcInitRatingForm() {
    const ratingForm = document.getElementById('ratingForm');
    if (ratingForm) {
        ratingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rating = document.querySelector('input[name="rating"]:checked');
            if (!rating) {
                alert('Please select a rating');
                return;
            }

            const productId = window.location.pathname.split('/').pop();

            try {
                const response = await fetch(`/ratings/${productId}/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ rating: parseInt(rating.value) })
                });

                if (response.ok) {
                    window.location.reload();
                } else if (response.status === 401) {
                    const modalElement = document.getElementById('authModal');
                    if (modalElement) {
                        const modal = new bootstrap.Modal(modalElement);
                        modal.show();
                    } else {
                        window.location.href = '/auth/signin';
                    }
                } else {
                    const data = await response.json();
                    alert(data.message || 'Failed to submit rating');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred while submitting your rating');
            }
        });
    }

    // Rating stars highlight
    document.querySelectorAll('.ibc-rating-input input').forEach(input => {
        input.addEventListener('change', () => {
            document.querySelectorAll('.ibc-rating-input label')
                .forEach(l => l.classList.remove('active'));
            input.nextElementSibling.classList.add('active');

            const submitBtn = document.getElementById('submitRatingBtn');
            if (submitBtn) {
                submitBtn.style.display = 'inline-flex';
            }
        });
    });
}

// Initialize immediately (script is at bottom of page, DOM is ready)
ibcInitProductPage();
ibcInitTabs();
ibcInitRatingForm();