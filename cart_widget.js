// Shared cart icon + Fourthwall cart logic, loaded on every page so the
// cart icon (top-right) and its item count follow the visitor around the
// site, not just on the merch page. merch.html additionally loads
// merch_scripts.js, which calls window.NHCart.addItem(...) to add products.
(function () {
    var STOREFRONT_TOKEN = 'ptkn_9299072d-3cd9-4bf6-9b81-08c3fa1d5ce9';
    var CHECKOUT_DOMAIN = 'neverhome-shop.fourthwall.com';
    var API_BASE = 'https://storefront-api.fourthwall.com/v1';

    var cartId = localStorage.getItem('nh_cart_id');
    var cartCount = 0;

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

    function setCart(id, items) {
        cartId = id;
        localStorage.setItem('nh_cart_id', id);
        cartCount = (items || []).reduce(function (sum, i) { return sum + i.quantity; }, 0);
        updateBadge();
    }

    function refreshFromServer() {
        if (!cartId) return;
        fetch(API_BASE + '/carts/' + cartId + '?storefront_token=' + STOREFRONT_TOKEN)
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (cart) {
                if (cart) {
                    cartCount = (cart.items || []).reduce(function (sum, i) { return sum + i.quantity; }, 0);
                    updateBadge();
                }
            })
            .catch(function () {});
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

    function checkout() {
        if (!cartId || cartCount === 0) {
            bounceIcon();
            return;
        }
        var params = new URLSearchParams({ cartCurrency: 'USD', cartId: cartId });
        window.location.href = 'https://' + CHECKOUT_DOMAIN + '/checkout/?' + params.toString();
    }

    // Adds a variant to the cart, creating a cart first if one doesn't
    // exist yet. Follows the actual Fourthwall Storefront API contract:
    // POST /v1/carts            { items: [{variantId, quantity}] }  (new cart)
    // POST /v1/carts/{id}/add   { items: [{variantId, quantity}] }  (existing cart)
    function addItem(variantId, quantity, onDone, onError) {
        var payload = { items: [{ variantId: variantId, quantity: quantity || 1 }] };

        function createFreshCart() {
            return fetch(API_BASE + '/carts?storefront_token=' + STOREFRONT_TOKEN + '&currency=USD', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        var request;
        if (cartId) {
            request = fetch(API_BASE + '/carts/' + cartId + '/add?storefront_token=' + STOREFRONT_TOKEN + '&currency=USD', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(function (res) {
                // Stale/expired cart id — fall back to creating a new cart.
                if (res.status === 404) {
                    cartId = null;
                    localStorage.removeItem('nh_cart_id');
                    return createFreshCart();
                }
                return res;
            });
        } else {
            request = createFreshCart();
        }

        request
            .then(function (res) {
                if (!res.ok) {
                    return res.json().catch(function () { return {}; }).then(function (body) {
                        throw new Error('Fourthwall cart error ' + res.status + ': ' + (body.code || 'unknown'));
                    });
                }
                return res.json();
            })
            .then(function (cart) {
                setCart(cart.id, cart.items);
                if (onDone) onDone(cart);
            })
            .catch(function (err) {
                console.error('NHCart addItem failed', err);
                if (onError) onError(err);
            });
    }

    window.NHCart = {
        addItem: addItem,
        checkout: checkout,
        getCount: function () { return cartCount; }
    };

    document.addEventListener('DOMContentLoaded', function () {
        var icon = document.getElementById('cartIcon');
        if (icon) icon.addEventListener('click', checkout);
        refreshFromServer();
    });
})();
