/**
 * @file FoodOrderEngine.jsx
 * @description Dual-mode food ordering component used inside booking detail panels.
 * - Guest mode (isHost=false): shows the host's kitchen menu, lets the guest
 *   build a cart and place an order, and tracks real-time order status.
 * - Host mode (isHost=true): shows incoming orders with status controls
 *   (Start Preparing / Mark Delivered) and listens for new order notifications.
 *
 * Real-time updates are received via Socket.io events:
 *   food:status_update — status change on an existing order
 *   food:new_order     — new order arrived (host mode only)
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Utensils,
  Plus,
  Minus,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Timer,
  ChefHat,
  Bike,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useNotifications } from '../components/SocketContext';

/* -------------------------------------------------------------------------- */
/*                                  CONSTANTS                                 */
/* -------------------------------------------------------------------------- */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * Maps an order status string to display metadata (label, icon component, colours).
 */
const statusMap = {
  pending: { label: 'Pending', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  preparing: { label: 'Preparing', icon: ChefHat, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  delivered: { label: 'Delivered', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
};

/* -------------------------------------------------------------------------- */
/*                               MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */

/**
 * @component FoodOrderEngine
 * @description Main component for food ordering and management.
 * @param {Object} props - Component props.
 * @param {string} props.bookingId - ID of the current booking.
 * @param {string} props.propertyId - ID of the property.
 * @param {boolean} props.isHost - Switches between guest and host view.
 * @returns {JSX.Element} The FoodOrderEngine component.
 */
const FoodOrderEngine = ({ bookingId, propertyId, isHost = false }) => {
  /* -------------------------------------------------------------------------- */
  /*                                    HOOKS                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @description Access real-time notifications via socket.
   */
  const { socket } = useNotifications();

  /* -------------------------------------------------------------------------- */
  /*                                    STATE                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * @description Array of food menu items fetched for this property.
   */
  const [menu, setMenu] = useState([]);

  /**
   * @description Filtered list of food orders associated with this booking.
   */
  const [orders, setOrders] = useState([]);

  /**
   * @description Guest's in-progress order items before placing.
   */
  const [cart, setCart] = useState([]);

  /**
   * @description True while the initial menu + orders are being fetched.
   */
  const [loading, setLoading] = useState(true);

  /**
   * @description True while the place-order API call is in flight.
   */
  const [ordering, setOrdering] = useState(false);

  /* -------------------------------------------------------------------------- */
  /*                                   CALLBACKS                                */
  /* -------------------------------------------------------------------------- */

  /**
   * @function fetchMenu
   * @description Fetch the food menu for the property.
   */
  const fetchMenu = useCallback(
    async () => {
      try {
        const res = await axios.get(`${BASE}/foodmenu/property/${propertyId}`);
        if (res.data.success) {
          setMenu(res.data.menu || []);
        }
      } catch {
        // Silent fail — menu unavailability is non-critical
      }
    },
    // Dependencies
    [propertyId]
  );

  /**
   * @function fetchOrders
   * @description Fetch orders scoped to this specific booking.
   */
  const fetchOrders = useCallback(
    async () => {
      try {
        const endpoint = isHost ? '/foodmenu/orders/host' : '/foodmenu/orders/guest';
        const res = await axios.get(`${BASE}${endpoint}`, { withCredentials: true });

        if (res.data.success) {
          // Filter the returned orders to only those belonging to this booking
          const filtered = res.data.orders.filter((o) => {
            return o.bookingId === bookingId;
          });
          setOrders(filtered);
        }
      } catch {
        // Silent fail — order list unavailability is non-critical
      }
    },
    // Dependencies
    [isHost, bookingId]
  );

  /* -------------------------------------------------------------------------- */
  /*                                    EFFECTS                                 */
  /* -------------------------------------------------------------------------- */

  /**
   * @hook useEffect
   * @description Trigger initial data load when the component mounts or propertyId changes.
   */
  useEffect(
    () => {
      if (!propertyId) {
        return;
      }

      setLoading(true);
      Promise.all([fetchMenu(), fetchOrders()]).finally(() => {
        setLoading(false);
      });

      // Cleanup function
      return () => {
        // No cleanup necessary
      };
    },
    // Dependencies
    [propertyId, fetchMenu, fetchOrders]
  );

  /**
   * @hook useEffect
   * @description Subscribe to real-time food order events via Socket.io.
   */
  useEffect(
    () => {
      if (!socket) {
        return;
      }

      /**
       * Handle order status updates from the server.
       */
      const handleStatusUpdate = (data) => {
        // Update only the affected order in state — avoids a full re-fetch
        setOrders((prev) => {
          return prev.map((o) => {
            if (o._id === data.orderId) {
              return { ...o, status: data.status };
            }
            return o;
          });
        });

        if (!isHost) {
          // status change received
        }
      };

      /**
       * Handle new order notifications for hosts.
       */
      const handleNewOrder = () => {
        // Host: refresh the full order list so the new order appears
        if (isHost) {
          fetchOrders();
        }
      };

      socket.on('food:status_update', handleStatusUpdate);
      socket.on('food:new_order', handleNewOrder);

      // Cleanup
      return () => {
        socket.off('food:status_update', handleStatusUpdate);
        socket.off('food:new_order', handleNewOrder);
      };
    },
    // Dependencies
    [socket, isHost, fetchOrders]
  );

  /* -------------------------------------------------------------------------- */
  /*                                   HANDLERS                                 */
  /* -------------------------------------------------------------------------- */

  /**
   * @description Add one unit of a menu item to the cart.
   * @param {Object} item - The menu item to add.
   */
  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => {
        return i.menuItemId === item._id;
      });

      if (existing) {
        // Item already in cart — increment quantity
        return prev.map((i) => {
          if (i.menuItemId === item._id) {
            return { ...i, quantity: i.quantity + 1 };
          }
          return i;
        });
      }

      // New item — append to cart
      return [
        ...prev,
        {
          menuItemId: item._id,
          name: item.foodname,
          price: item.foodprice,
          servingAt: item.servingAt,
          quantity: 1,
        },
      ];
    });
  };

  /**
   * @description Decrement a cart item's quantity by one.
   * @param {string} itemId - The ID of the menu item to remove.
   */
  const removeFromCart = (itemId) => {
    setCart((prev) => {
      const existing = prev.find((i) => {
        return i.menuItemId === itemId;
      });

      if (existing.quantity === 1) {
        // Last unit — remove from cart
        return prev.filter((i) => {
          return i.menuItemId !== itemId;
        });
      }

      // Decrement quantity
      return prev.map((i) => {
        if (i.menuItemId === itemId) {
          return { ...i, quantity: i.quantity - 1 };
        }
        return i;
      });
    });
  };

  /**
   * @description Submit the cart as a food order to the backend.
   */
  const placeOrder = async () => {
    if (cart.length === 0) {
      return;
    }

    setOrdering(true);

    try {
      const res = await axios.post(
        `${BASE}/foodmenu/orders`,
        {
          bookingId,
          items: cart,
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        setCart([]);
        fetchOrders();
      }
    } catch {
      // error silently handled
    } finally {
      setOrdering(false);
    }
  };

  /**
   * @description Host action: update the status of an existing order.
   * @param {string} orderId - The ID of the order to update.
   * @param {string} status - The new status.
   */
  const updateStatus = async (orderId, status) => {
    try {
      const res = await axios.put(`${BASE}/foodmenu/orders/${orderId}/status`, { status }, { withCredentials: true });

      if (res.data.success) {
        // Optimistic update — patch the order in local state
        setOrders((prev) => {
          return prev.map((o) => {
            if (o._id === orderId) {
              return { ...o, status };
            }
            return o;
          });
        });
      }
    } catch {
      // error silently handled
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  // Show skeleton while data is loading
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="bv-skeleton h-24 rounded-2xl" />
        <div className="bv-skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Orders Status Tracking — shown for both host and guest */}
      {orders.length > 0 && (
        <div className="bv-card-static p-5">
          <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4 flex items-center gap-2">
            <Timer size={16} /> Order Status
          </h3>
          <div className="space-y-4">
            {orders.map((order) => {
              const s = statusMap[order.status] || statusMap.pending;
              const Icon = s.icon;

              return (
                <div
                  key={order._id}
                  className="p-4 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  {/* Status icon + label + item summary */}
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${s.bg} ${s.color}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--bv-text)]">{s.label}</p>
                      <p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold">
                        {order.items
                          .map((i) => {
                            return `${i.quantity}x ${i.name}`;
                          })
                          .join(', ')}
                      </p>
                    </div>
                  </div>

                  {/* Host action buttons — advance order through the workflow */}
                  {isHost && order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <button
                          onClick={() => {
                            updateStatus(order._id, 'preparing');
                          }}
                          className="bv-btn-gold text-[10px] px-3 py-1.5 flex items-center gap-1"
                        >
                          <ChefHat size={12} /> Start Preparing
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          onClick={() => {
                            updateStatus(order._id, 'delivered');
                          }}
                          className="bv-btn-outline text-[10px] px-3 py-1.5 flex items-center gap-1 !border-emerald-500/30 !text-emerald-500"
                        >
                          <Bike size={12} /> Mark Delivered
                        </button>
                      )}
                    </div>
                  )}

                  {/* Guest delivery confirmation */}
                  {!isHost && order.status === 'delivered' && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-bold">
                      <CheckCircle2 size={14} /> Enjoy your meal!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Menu Selection — only visible to guests when the property has a menu */}
      {!isHost && menu.length > 0 && (
        <div className="bv-card-static p-5">
          <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4 flex items-center gap-2">
            <Utensils size={16} /> Host Kitchen Menu
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {menu.map((item) => {
              return (
                <div
                  key={item._id}
                  className="p-4 rounded-xl bg-[var(--bv-bg)] border border-[var(--bv-border)] hover:border-[var(--bv-gold-border)] transition flex items-center justify-between gap-3"
                >
                  {/* Item details */}
                  <div>
                    <p className="text-sm font-bold text-[var(--bv-text)]">{item.foodname}</p>
                    <p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold">{item.servingAt}</p>
                    <p className="text-xs font-bold text-[var(--bv-gold)] mt-1">PKR {item.foodprice}</p>
                  </div>

                  {/* Cart quantity control or add button */}
                  {cart.find((i) => {
                    return i.menuItemId === item._id;
                  }) ? (
                    <div className="flex items-center gap-3 bg-[var(--bv-surface)] rounded-lg p-1 border border-[var(--bv-gold-border)]">
                      <button
                        onClick={() => {
                          removeFromCart(item._id);
                        }}
                        className="p-1 hover:text-[var(--bv-gold)]"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-xs font-bold text-[var(--bv-text)]">
                        {
                          cart.find((i) => {
                            return i.menuItemId === item._id;
                          }).quantity
                        }
                      </span>
                      <button
                        onClick={() => {
                          addToCart(item);
                        }}
                        className="p-1 hover:text-[var(--bv-gold)]"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        addToCart(item);
                      }}
                      className="p-2 rounded-lg bg-[var(--bv-gold-glow)] text-[var(--bv-gold)] hover:bg-[var(--bv-gold)] hover:text-white transition"
                    >
                      <Plus size={18} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cart summary + place order — only visible when cart has items */}
          {cart.length > 0 && (
            <div className="mt-6 pt-5 border-t border-[var(--bv-divider)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-[var(--bv-text)]">Order Summary</span>
                <span className="text-sm font-black text-[var(--bv-gold)]">
                  PKR{' '}
                  {cart.reduce((sum, i) => {
                    return sum + i.price * i.quantity;
                  }, 0)}
                </span>
              </div>

              <button
                onClick={() => {
                  placeOrder();
                }}
                disabled={ordering}
                className="w-full bv-btn-gold py-3 text-sm flex items-center justify-center gap-2"
              >
                {ordering ? <Loader2 size={16} className="animate-spin" /> : <ShoppingBag size={16} />}
                Confirm Order
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FoodOrderEngine;
