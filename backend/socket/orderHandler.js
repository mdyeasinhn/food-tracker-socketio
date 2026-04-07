import { calculateTotals, createOrderDocument, generateOrderId, isValidStatusTransition, validateOrderData } from "../utils/helper.js";
import { getCollection } from "../config/database.js";

export const orderHandler = (io, socket) => {
  // Listen for new orders from clients
  console.log("a order connectd", socket.id);

  // place order
  socket.on("placeOrder", async (data, callback) => {
    try {
      // Your order placement logic here
      console.log(`Place order from ${socket.id}`);
      const validation = validateOrderData(data);
      if (!validation.valid) {
        return callback({ success: false, message: validation.message });
      }
      const total = calculateTotals(data.items);
      const orderId = generateOrderId();
      const order = createOrderDocument(data, orderId, total);

      const ordersCollection = getCollection('orders');
      await ordersCollection.insertOne(order);

      socket.join(`order-${orderId}`);
      socket.join('customers');

      io.to('admin').emit('newOrder', { order });
      callback({ success: true, order });
      console.log(`✅ Order created: ${orderId}`);

    } catch (error) {
      console.log(error)
      callback({ success: false, message: "Failed to create order" });
    }
  });

  // track order 
  socket.on("trackOrder", async (data, callback) => {
    try {
      const ordersCollection = getCollection('orders');
      const order = await ordersCollection.findOne({ orderId: data.orderId });

      if (!order) {
        return callback({ success: false, message: "Order not found" });
      }
      socket.join(`order-${data.orderId}`);
      callback({ success: true, order });
    } catch (error) {
      console.error("Order tracking error:", error);
      callback({ success: false, message: "Failed to track order" });

    }
  });


  // Cancel Order
  socket.on('cancelOrder', async (data, callback) => {
    try {
      const ordersCollection = getCollection('orders');
      const order = await ordersCollection.findOne({ orderId: data.orderId });

      if (!order) {
        return callback({ success: false, message: 'Order not found' });
      }

      if (!['pending', 'confirmed'].includes(order.status)) {
        return callback({ success: false, message: 'Cannot cancel this order' });
      }

      await ordersCollection.updateOne(
        { orderId: data.orderId },
        {
          $set: { status: 'cancelled', updatedAt: new Date() },
          $push: {
            statusHistory: {
              status: 'cancelled',
              timestamp: new Date(),
              by: socket.id,
              note: data.reason || 'Cancelled by customer'
            }
          }
        }
      );

      io.to(`order_${data.orderId}`).emit('orderCancelled', { orderId: data.orderId });
      io.to('admins').emit('orderCancelled', { orderId: data.orderId, customerName: order.customerName });

      callback({ success: true });

    } catch (error) {
      console.error('❌ Cancel order error:', error);
      callback({ success: false, message: 'Failed to cancel order' });
    }
  });

  // Get My Orders
  socket.on('getMyOrders', async (data, callback) => {
    try {
      const ordersCollection = getCollection('orders');
      const orders = await ordersCollection
        .find({ customerPhone: data.customerPhone })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      callback({ success: true, orders });

    } catch (error) {
      console.error('❌ Get orders error:', error);
      callback({ success: false, message: 'Failed to load orders' });
    }
  });

  //admin login
  socket.on('adminLogin', (data, callback) => {
    try {
      if (data.password === process.env.ADMIN_PASSWORD) {
        socket.isAdmin = true;
        socket.join('admins');
        console.log(`admin logged in: ${socket.id}`);
        callback({ success: true, message: 'Admin login successful' });
      } else {
        callback({ success: false, message: 'Invalid password' });
      }

    } catch (error) {
      callback({ success: false, message: 'Login failed' });
    }
  });

  //get all orders for admin
  socket.on('getAllOrders', async (data, callback) => {
    try {
      if (!socket.isAdmin) {
        return callback({ success: false, message: 'Unauthorized' });
      }
      const orderCollection = getCollection('orders');
      const filter = data.status ? { status: data.status } : {};
      const orders = await orderCollection.find(filter).sort({ createdAt: -1 }).limit(20).toArray();
      callback({ success: true, orders });
    } catch (error) {
      callback({ success: false, message: 'Failed to fetch orders' });
    }
  });

  // update order status by admin
  socket.on('updateOrderStatus', async (data, callback) => {
    try {
      const orderCollection = getCollection('orders');
      const order = await orderCollection.findOne({ orderId: data.orderId });
      if (!order) {
        callback({ success: false, message: 'Order not found' });
      }
      if (!isValidStatusTransition(order.status, data.newStatus)) {
        return callback({ success: false, message: 'Invalid status transition' });
      }
      const result = await orderCollection.updateOne(
        { orderId: data.orderId },
        {
          $set: { status: data.newStatus, updatedAt: new Date() },
        },
        {
          $push: {
            statusHistory: {
              status: data.newStatus,
              timestamp: new Date(),
              by: socket.id,
              note: "Status updated by admin"
            }
          }
        },
        { returnDocument: 'after' }
      )
      io.to(`order-${data.orderId}`).emit('statusUpdated', { orderId: data.orderId, status: data.newStatus, order: result });
      socket.to("admin").emit("orderStatusUpdated", { orderId: data.orderId, newStatus: data.newStatus });
      callback({ success: true, order: result });
    } catch (error) {
      callback({ success: false, message: 'Failed to update order status' });
    }
  });

  socket.on("orderAccept", async (data, callback) => {
    try {
      if(!socket.isAdmin) {
        return callback({ success: false, message: 'Unauthorized' });

      }
        const orderCollection = getCollection('orders');
        const order = await orderCollection.findOne({ orderId: data.orderId });
        if (!order || order.status !== 'pending') {
          return callback({ success: false, message: 'Can not accept this order' });
        }
        const estimatedTime = data.estimatedTime || 30; // default to 30 mins if not provided
        const result = await orderCollection.findOneAndUpdate(
          { orderId: data.orderId },
          { 
            $set: { status: 'confirmed', estimatedTime, updatedAt: new Date() },
          },
          {
            $push: {
              statusHistory: {
                status: 'confirmed',
                timestamp: new Date(),
                by: socket.id,
                note: `Order confirmed. Estimated time: ${estimatedTime} minutes`
              }
            },
          },
          { returnDocument: 'after' }
        );
        io.to(`order-${data.order}`).emit("orderAccepted", {orderId :data.orderId, estimatedTime });
        socket.to("admins").emit('orderAcceptByAdmin', {orderId : data.orderId});
        callback({ success: true, order: result })
        
    } catch (error) {
      callback({ success: false, message: error.message | 'Failed to accept order' });
    }
  });

    // Reject Order
    socket.on('rejectOrder', async (data, callback) => {
        try {
            if (!socket.isAdmin) {
                return callback({ success: false, message: 'Unauthorized' });
            }

            const ordersCollection = getCollection('orders');
            const order = await ordersCollection.findOne({ orderId: data.orderId });

            if (!order || order.status !== 'pending') {
                return callback({ success: false, message: 'Cannot reject this order' });
            }

            await ordersCollection.updateOne(
                { orderId: data.orderId },
                {
                    $set: { status: 'cancelled', updatedAt: new Date() },
                    $push: {
                        statusHistory: {
                            status: 'cancelled',
                            timestamp: new Date(),
                            by: socket.id,
                            note: `Rejected: ${data.reason}`
                        }
                    }
                }
            );

            io.to(`order_${data.orderId}`).emit('orderRejected', { orderId: data.orderId, reason: data.reason });

            callback({ success: true });

        } catch (error) {
            console.error('❌ Reject order error:', error);
            callback({ success: false, message: 'Failed to reject order' });
        }
    });

}