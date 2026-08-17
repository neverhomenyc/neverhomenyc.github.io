// Fourthwall Storefront API integration for the "MADE TO ORDER" merch grid.
// Products/prices/images are all managed on fourthwall.com — this file just
// fetches them and renders them in the site's own style. Cart handling
// itself (add/checkout/badge) lives in cart_widget.js, loaded on every page.
(function () {
    var STOREFRONT_TOKEN = 'ptkn_9299072d-3cd9-4bf6-9b81-08c3fa1d5ce9';
    var API_BASE = 'https://storefront-api.fourthwall.com/v1';

    function money(value) {
        return '$' + Number(value).toFixed(2);
    }

    function variantLabel(variant, variants) {
        var hasMultipleColors = variants.some(function (v) {
            return v.attributes && v.attributes.color && variant.attributes && variant.attributes.color &&
                v.attributes.color.name !== variant.attributes.color.name;
        });
        var sizeName = variant.attributes && variant.attributes.size ? variant.attributes.size.name : variant.name;
        if (hasMultipleColors && variant.attributes && variant.attributes.color) {
            return variant.attributes.color.name + ' / ' + sizeName;
        }
        return sizeName;
    }

    function collapseAllCards() {
        document.querySelectorAll('.storeitem.enlarged').forEach(function (el) {
            el.classList.remove('enlarged');
        });
        var backdrop = document.getElementById('merchBackdrop');
        if (backdrop) backdrop.classList.remove('active');
    }

    function toggleEnlarge(card) {
        var wasEnlarged = card.classList.contains('enlarged');
        collapseAllCards();
        if (!wasEnlarged) {
            card.classList.add('enlarged');
            var backdrop = document.getElementById('merchBackdrop');
            if (backdrop) backdrop.classList.add('active');
        }
    }

    function renderProducts(products) {
        var grid = document.getElementById('madeToOrderGrid');
        if (!grid) return;
        grid.innerHTML = '';

        if (!products.length) {
            var empty = document.createElement('div');
            empty.className = 'sectionsub';
            empty.textContent = 'No made-to-order items yet — check back soon.';
            grid.appendChild(empty);
            return;
        }

        products.forEach(function (product) {
            var variants = product.variants || [];
            if (!variants.length) return;

            var card = document.createElement('div');
            card.className = 'storeitem';

            var images = (product.images && product.images.length) ? product.images : (variants[0].images || []);
            var imgIndex = 0;

            var imgWrap = document.createElement('div');
            imgWrap.className = 'itemimgwrap';

            // Collapsed (default) view: front + back shown side by side so
            // shirts don't all look identical at a glance. Fourthwall's
            // product images array has no explicit "front"/"back" label —
            // this assumes image 0 = front, image 1 = back (their standard
            // photo ordering). If a product's photos come back in a
            // different order, swap the assumption below.
            var split = document.createElement('div');
            split.className = 'itemimgsplit' + (images.length < 2 ? ' singleimg' : '');

            var frontThumb = document.createElement('img');
            frontThumb.src = images.length ? images[0].url : '';
            frontThumb.alt = product.name + ' — front';
            frontThumb.addEventListener('click', function () {
                imgIndex = 0;
                showFull();
            });
            split.appendChild(frontThumb);

            if (images.length > 1) {
                var backThumb = document.createElement('img');
                backThumb.src = images[1].url;
                backThumb.alt = product.name + ' — back';
                backThumb.addEventListener('click', function () {
                    imgIndex = 1;
                    showFull();
                });
                split.appendChild(backThumb);
            }
            imgWrap.appendChild(split);

            if (images.length > 1) {
                var labels = document.createElement('div');
                labels.className = 'itemimglabels';
                var frontLabel = document.createElement('span');
                frontLabel.className = 'itemimglabel';
                frontLabel.textContent = 'FRONT';
                var backLabel = document.createElement('span');
                backLabel.className = 'itemimglabel';
                backLabel.textContent = 'BACK';
                labels.appendChild(frontLabel);
                labels.appendChild(backLabel);
                imgWrap.appendChild(labels);
            }

            // Enlarged view: single image with full carousel through every
            // photo (front, back, and any other angles Fourthwall has).
            var full = document.createElement('div');
            full.className = 'itemimgfull';

            var img = document.createElement('img');
            img.src = images.length ? images[imgIndex].url : '';
            img.alt = product.name;
            img.addEventListener('click', function () {
                toggleEnlarge(card);
            });
            full.appendChild(img);

            function showFull() {
                img.src = images[imgIndex].url;
                updateDots();
                if (!card.classList.contains('enlarged')) {
                    toggleEnlarge(card);
                }
            }

            if (images.length > 1) {
                var prevBtn = document.createElement('button');
                prevBtn.type = 'button';
                prevBtn.className = 'itemimgnav itemimgprev';
                prevBtn.textContent = '‹';
                prevBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    imgIndex = (imgIndex - 1 + images.length) % images.length;
                    img.src = images[imgIndex].url;
                    updateDots();
                });
                full.appendChild(prevBtn);

                var nextBtn = document.createElement('button');
                nextBtn.type = 'button';
                nextBtn.className = 'itemimgnav itemimgnext';
                nextBtn.textContent = '›';
                nextBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    imgIndex = (imgIndex + 1) % images.length;
                    img.src = images[imgIndex].url;
                    updateDots();
                });
                full.appendChild(nextBtn);

                var dots = document.createElement('div');
                dots.className = 'itemimgdots';
                images.forEach(function (_, i) {
                    var dot = document.createElement('span');
                    dot.className = 'itemimgdot' + (i === imgIndex ? ' active' : '');
                    dots.appendChild(dot);
                });
                full.appendChild(dots);
            }

            function updateDots() {
                var dotEls = full.querySelectorAll('.itemimgdot');
                dotEls.forEach(function (d, i) {
                    d.className = 'itemimgdot' + (i === imgIndex ? ' active' : '');
                });
            }

            imgWrap.appendChild(full);

            card.appendChild(imgWrap);

            var name = document.createElement('div');
            name.className = 'itemname';
            name.textContent = product.name;
            card.appendChild(name);

            var priceEl = document.createElement('div');
            priceEl.className = 'itemprice';
            priceEl.textContent = money(variants[0].unitPrice.value);
            card.appendChild(priceEl);

            var select = null;
            if (variants.length > 1) {
                select = document.createElement('select');
                select.className = 'itemsize';
                variants.forEach(function (v) {
                    var opt = document.createElement('option');
                    opt.value = v.id;
                    opt.textContent = variantLabel(v, variants);
                    select.appendChild(opt);
                });
                card.appendChild(select);
            }

            var btn = document.createElement('button');
            btn.textContent = 'ADD TO CART';

            var errorEl = document.createElement('div');
            errorEl.className = 'itemerror';
            errorEl.style.display = 'none';

            btn.addEventListener('click', function () {
                var variantId = select ? select.value : variants[0].id;
                var originalText = btn.textContent;
                btn.textContent = 'ADDING...';
                btn.disabled = true;
                errorEl.style.display = 'none';

                if (!window.NHCart) {
                    btn.textContent = 'ERROR — TRY AGAIN';
                    btn.disabled = false;
                    errorEl.textContent = 'Cart script did not load (window.NHCart missing).';
                    errorEl.style.display = 'block';
                    return;
                }

                window.NHCart.addItem(
                    variantId,
                    1,
                    function () {
                        btn.textContent = 'ADDED!';
                        setTimeout(function () {
                            btn.textContent = originalText;
                            btn.disabled = false;
                        }, 1200);
                    },
                    function (err) {
                        btn.textContent = 'ERROR — TRY AGAIN';
                        btn.disabled = false;
                        errorEl.textContent = (err && err.message) ? err.message : 'Unknown error';
                        errorEl.style.display = 'block';
                    }
                );
            });
            card.appendChild(btn);
            card.appendChild(errorEl);

            grid.appendChild(card);
        });
    }

    var backdropEl = document.getElementById('merchBackdrop');
    if (backdropEl) backdropEl.addEventListener('click', collapseAllCards);

    fetch(API_BASE + '/collections/all/products?storefront_token=' + STOREFRONT_TOKEN)
        .then(function (res) { return res.json(); })
        .then(function (data) { renderProducts(data.results || []); })
        .catch(function (err) {
            console.error('Could not load Fourthwall products', err);
            var grid = document.getElementById('madeToOrderGrid');
            if (grid) grid.innerHTML = '<div class="sectionsub">Store temporarily unavailable — please check back soon.</div>';
        });
})();
