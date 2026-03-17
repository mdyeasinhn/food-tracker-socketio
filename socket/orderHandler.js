import { calculateTotals, createOrderDocument, generateOrderId } from "../utils/helper.js";
import { getCollection } from "../config/database.js";

export const orderHandler = (io, socket) => {
  // Listen for new orders from clients
  console.log("a order connectd", socket.id);

  // place order
  socket.on("placeOrder", async (data, callback) => {
    try {
      // Your order placement logic here
      console.log(`Place order from ${socket.id}`);
      const validation = validateOrder(data)
      if (validation.valid) {
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
      const order = await ordersCollection.findone({ orderId: data.orderId });
    
    if(!order) {
      return callback({ success: false, message: "Order not found" });
    }
      socket.join(`order-${data.orderId}`);
      callback({ success: true, order });
    } catch (error) {
      console.error("Order tracking error:", error);
      callback({ success: false, message: "Failed to track order" });

    }
  })

}