
async function test() {
  try {
    // 1. Get an order
    const ordersRes = await fetch('http://localhost:3001/api/dashboard');
    const dbData = await ordersRes.json();
    const order = dbData.activeOrders[0];
    
    if (!order) {
      console.log('No active order found.');
      return;
    }
    console.log('Found order:', order.id);

    // 2. Create customer
    const custRes = await fetch('http://localhost:3001/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Fiado' })
    });
    const cust = await custRes.json();
    console.log('Created customer:', cust);

    // 3. Pay order
    const payRes = await fetch(`http://localhost:3001/api/orders/${order.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payments: [{ amount: 50, method: 'CREDIT_TAB' }],
        closeOrder: false,
        customerId: cust.id
      })
    });
    const payData = await payRes.json();
    console.log('Pay result:', payData);

  } catch (err) {
    console.error(err);
  }
}
test();
