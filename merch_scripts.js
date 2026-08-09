// Fourthwall Storefront API integration for the "MADE TO ORDER" merch grid.
// Products/prices/images are all managed on fourthwall.com — this file just
// fetches them and renders them in the site's own style, with a simple cart
// that stays on neverhomenyc.com until the final checkout step.
(function () {
    var STOREFRONT_TOKEN = 'ptkn_9299072d-3cd9-4bf6-9b81-08c3fa1d5ce9';
    var CHECKOUT_DOMAIN = 'neverhome-shop.fourthwall.com';
    var API_BASE = 'https://storefront-api.fourthwall.com/v1';

    var cartId = localStorage.getItem('nh_cart_id');
    var cartCount = 0;

    function money(value) {
        return '$' + Number(value).toFixed(2);
    }

    function updateCartBar() {
        var badge = document.getElementById('cartBadge');
        if (!badge) return;
        if (cartCount > 0) {
            badge.textContent = cartCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    function createCart() {
        return fetch(API_BASE + '/carts?storefront_token=' + STOREFRONT_TOKEN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currency: 'USD' })
        })
            .then(function (res) { return res.json(); })
            .then(function (cart) {
                cartId = cart.id;
                localStorage.setItem('nh_cart_id', cartId);
                return cartId;
            });
    }

    function ensureCart() {
        if (!cartId) return createCart();
        return fetch(API_BASE + '/carts/' + cartId + '?storefront_token=' + STOREFRONT_TOKEN)
            .then(function (res) { return res.ok ? cartId : createCart(); })
            .catch(createCart);
    }

    function addToCart(variantId, btn) {
        var originalText = btn.textContent;
        btn.textContent = 'ADDING...';
        btn.disabled = true;
        ensureCart()
            .then(function (id) {
                return fetch(API_BASE + '/carts/' + id + '/items?storefront_token=' + STOREFRONT_TOKEN, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ variantId: variantId, quantity: 1 })
                });
            })
            .then(function (res) { return res.json(); })
            .then(function (cart) {
                cartCount = (cart.items || []).reduce(function (sum, i) { return sum + i.quantity; }, 0);
                updateCartBar();
                btn.textContent = 'ADDED!';
                setTimeout(function () {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }, 1200);
            })
            .catch(function (err) {
                console.error('Add to cart failed', err);
                btn.textContent = 'ERROR — TRY AGAIN';
                btn.disabled = false;
            });
    }

    function checkout() {
        if (!cartId || cartCount === 0) {
            var icon = document.getElementById('cartIcon');
            if (icon) {
                icon.style.transition = 'none';
                icon.style.transform = 'scale(1.15)';
                setTimeout(function () {
                    icon.style.transition = '0.2s ease-out';
                    icon.style.transform = 'scale(1)';
                }, 120);
            }
            return;
        }
        var params = new URLSearchParams({ cartCurrency: 'USD', cartId: cartId });
        window.location.href = 'https://' + CHECKOUT_DOMAIN + '/checkout/?' + params.toString();
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

            var img = document.createElement('img');
            var firstImage = (product.images && product.images[0]) || (variants[0].images && variants[0].images[0]);
            img.src = firstImage ? firstImage.url : '';
            img.alt = product.name;
            card.appendChild(img);

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
            btn.addEventListener('click', function () {
                var variantId = select ? select.value : variants[0].id;
                addToCart(variantId, btn);
            });
            card.appendChild(btn);

            grid.appendChild(card);
        });
    }

    fetch(API_BASE + '/collections/all/products?storefront_token=' + STOREFRONT_TOKEN)
        .then(function (res) { return res.json(); })
        .then(function (data) { renderProducts(data.results || []); })
        .catch(function (err) {
            console.error('Could not load Fourthwall products', err);
            var grid = document.getElementById('madeToOrderGrid');
            if (grid) grid.innerHTML = '<div class="sectionsub">Store temporarily unavailable — please check back soon.</div>';
        });

    document.addEventListener('DOMContentLoaded', function () {
        var cartIcon = document.getElementById('cartIcon');
        if (cartIcon) cartIcon.addEventListener('click', checkout);

        if (cartId) {
            fetch(API_BASE + '/carts/' + cartId + '?storefront_token=' + STOREFRONT_TOKEN)
                .then(function (res) { return res.ok ? res.json() : null; })
                .then(function (cart) {
                    if (cart && cart.items) {
                        cartCount = cart.items.reduce(function (sum, i) { return sum + i.quantity; }, 0);
                        updateCartBar();
                    }
                })
                .catch(function () {});
        }
    });
})();
