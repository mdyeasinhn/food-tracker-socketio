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
    } catch (error) {
      console.log(error)
      //   callback({ success: false, message: error.message });
    }
  });
}