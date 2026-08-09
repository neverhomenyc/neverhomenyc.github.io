// Shared cart icon + dropdown + Fourthwall cart logic, loaded on every page
// so the cart icon (top-right), its item count, and a mini-cart dropdown
// (view/adjust/remove items, then checkout) follow the visitor around the
// whole site, not just the merch page. merch.html additionally loads
// merch_scripts.js, which calls window.NHCart.addItem(...) to add products.
(function () {
    var STOREFRONT_TOKEN = 'ptkn_9299072d-3cd9-4bf6-9b81-08c3fa1d5ce9';
    var CHECKOUT_DOMAIN = 'neverhome-shop.fourthwall.com';
    var API_BASE = 'https://storefront-api.fourthwall.com/v1';

    var cartId = localStorage.getItem('nh_cart_id');
    var cartCount = 0;
    var isOpen = false;

    function money(value) {
        return '$' + Number(value).toFixed(2);
    }

    function variantLabel(variant) {
        var attrs = variant.attributes || {};
        var parts = [];
        if (attrs.color && attrs.color.name) parts.push(attrs.color.name);
        if (attrs.size && attrs.size.name) parts.push(attrs.size.name);
        return parts.join(' / ') || variant.name || '';
    }

    function updateBadge() {
        var badge = document.getElementById('cartBadge');
        if (!badge) return;
        if (cartCount > 0) {
            badge.textContent = cartCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    function setCartFromResponse(cart) {
        cartId = cart.id;
        localStorage.setItem('nh_cart_id', cart.id);
        cartCount = (cart.items || []).reduce(function (sum, i) { return sum + i.quantity; }, 0);
        updateBadge();
        return cart;
    }

    function bounceIcon() {
        var icon = document.getElementById('cartIcon');
        if (!icon) return;
        icon.style.transition = 'none';
        icon.style.transform = 'scale(1.15)';
        setTimeout(function () {
            icon.style.transition = '0.2s ease-out';
            icon.style.transform = 'scale(1)';
        }, 120);
    }

    function apiRequest(path, body) {
        return fetch(API_BASE + path + (path.indexOf('?') === -1 ? '?' : '&') + 'storefront_token=' + STOREFRONT_TOKEN, {
            method: body ? 'POST' : 'GET',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
        }).then(function (res) {
            if (!res.ok) {
                return res.json().catch(function () { return {}; }).then(function (errBody) {
                    throw new Error('Fourthwall cart error ' + res.status + ': ' + (errBody.code || 'unknown'));
                });
            }
            return res.json();
        });
    }

    function fetchCart() {
        if (!cartId) return Promise.resolve(null);
        return apiRequest('/carts/' + cartId).catch(function () { return null; });
    }

    function refreshBadgeFromServer() {
        fetchCart().then(function (cart) {
            if (cart) setCartFromResponse(cart);
        });
    }

    // Adds a variant to the cart, creating a cart first if one doesn't
    // exist yet. Matches Fourthwall's actual Storefront API contract:
    // POST /v1/carts            { items: [{variantId, quantity}] }  (new cart)
    // POST /v1/carts/{id}/add   { items: [{variantId, quantity}] }  (existing cart)
    function addItem(variantId, quantity, onDone, onError) {
        var payload = { items: [{ variantId: variantId, quantity: quantity || 1 }] };

        function createFreshCart() {
            return apiRequest('/carts?currency=USD', payload);
        }

        var request;
        if (cartId) {
            request = apiRequest('/carts/' + cartId + '/add?currency=USD', payload)
                .catch(function (err) {
                    // Stale/expired cart id — fall back to creating a new cart.
                    if (('' + err.message).indexOf('404') !== -1) {
                        cartId = null;
                        localStorage.removeItem('nh_cart_id');
                        return createFreshCart();
                    }
                    throw err;
                });
        } else {
            request = createFreshCart();
        }

        request
            .then(function (cart) {
                setCartFromResponse(cart);
                if (onDone) onDone(cart);
            })
            .catch(function (err) {
                console.error('NHCart addItem failed', err);
                if (onError) onError(err);
            });
    }

    // Sets a variant's quantity to an absolute value (0 removes it).
    function changeQuantity(variantId, quantity) {
        if (!cartId) return Promise.resolve(null);
        return apiRequest('/carts/' + cartId + '/change?currency=USD', {
            items: [{ variantId: variantId, quantity: quantity }]
        }).then(function (cart) {
            setCartFromResponse(cart);
            return cart;
        });
    }

    function checkout() {
        if (!cartId || cartCount === 0) {
            bounceIcon();
            return;
        }
        var params = new URLSearchParams({ cartCurrency: 'USD', cartId: cartId });
        window.location.href = 'https://' + CHECKOUT_DOMAIN + '/checkout/?' + params.toString();
    }

    function renderDropdown(cart) {
        var listEl = document.getElementById('cartItemsList');
        var emptyEl = document.getElementById('cartEmpty');
        var subtotalEl = document.getElementById('cartSubtotal');
        var checkoutBtn = document.getElementById('cartCheckoutBtn');
        if (!listEl || !emptyEl || !subtotalEl || !checkoutBtn) return;

        var items = (cart && cart.items) || [];
        listEl.innerHTML = '';

        if (!items.length) {
            emptyEl.style.display = 'block';
            subtotalEl.style.display = 'none';
            checkoutBtn.style.display = 'none';
            return;
        }

        emptyEl.style.display = 'none';
        subtotalEl.style.display = 'block';
        checkoutBtn.style.display = 'block';

        var subtotal = 0;
        var currency = 'USD';

        items.forEach(function (item) {
            var variant = item.variant;
            var lineTotal = variant.unitPrice.value * item.quantity;
            subtotal += lineTotal;
            currency = variant.unitPrice.currency || currency;

            var row = document.createElement('div');
            row.className = 'cartline';

            var img = document.createElement('img');
            img.className = 'cartline-img';
            img.src = (variant.images && variant.images[0]) ? variant.images[0].url : '';
            img.alt = variant.name || '';
            row.appendChild(img);

            var info = document.createElement('div');
            info.className = 'cartline-info';

            var nameEl = document.createElement('div');
            nameEl.className = 'cartline-name';
            nameEl.textContent = (variant.product && variant.product.name) || variant.name;
            info.appendChild(nameEl);

            var variantEl = document.createElement('div');
            variantEl.className = 'cartline-variant';
            variantEl.textContent = variantLabel(variant);
            info.appendChild(variantEl);

            var priceEl = document.createElement('div');
            priceEl.className = 'cartline-price';
            priceEl.textContent = money(lineTotal);
            info.appendChild(priceEl);

            row.appendChild(info);

            var qtyBox = document.createElement('div');
            qtyBox.className = 'cartline-qty';

            var minusBtn = document.createElement('button');
            minusBtn.textContent = '−';
            minusBtn.addEventListener('click', function () {
                changeQuantity(variant.id, item.quantity - 1).then(renderDropdown);
            });
            qtyBox.appendChild(minusBtn);

            var qtyVal = document.createElement('span');
            qtyVal.className = 'qty-value';
            qtyVal.textContent = item.quantity;
            qtyBox.appendChild(qtyVal);

            var plusBtn = document.createElement('button');
            plusBtn.textContent = '+';
            plusBtn.addEventListener('click', function () {
                changeQuantity(variant.id, item.quantity + 1).then(renderDropdown);
            });
            qtyBox.appendChild(plusBtn);

            row.appendChild(qtyBox);

            var removeBtn = document.createElement('button');
            removeBtn.className = 'cartline-remove';
            removeBtn.title = 'Remove';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', function () {
                changeQuantity(variant.id, 0).then(renderDropdown);
            });
            row.appendChild(removeBtn);

            listEl.appendChild(row);
        });

        subtotalEl.textContent = 'Subtotal: ' + money(subtotal) + ' ' + currency;
    }

    function openDropdown() {
        var dropdown = document.getElementById('cartDropdown');
        if (!dropdown) return;
        isOpen = true;
        dropdown.classList.add('open');
        if (!cartId) {
            renderDropdown(null);
            return;
        }
        fetchCart().then(function (cart) {
            if (cart) setCartFromResponse(cart);
            renderDropdown(cart);
        });
    }

    function closeDropdown() {
        var dropdown = document.getElementById('cartDropdown');
        if (!dropdown) return;
        isOpen = false;
        dropdown.classList.remove('open');
    }

    function toggleDropdown() {
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    }

    window.NHCart = {
        addItem: addItem,
        checkout: checkout,
        getCount: function () { return cartCount; }
    };

    document.addEventListener('DOMContentLoaded', function () {
        var icon = document.getElementById('cartIcon');
        var dropdown = document.getElementById('cartDropdown');
        var checkoutBtn = document.getElementById('cartCheckoutBtn');

        if (icon) {
            icon.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleDropdown();
            });
        }
        if (dropdown) {
            dropdown.addEventListener('click', function (e) { e.stopPropagation(); });
        }
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', checkout);
        }
        document.addEventListener('click', function () {
            if (isOpen) closeDropdown();
        });

        refreshBadgeFromServer();
    });
})();
