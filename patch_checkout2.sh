sed -i '' -e 's/const isClosing = closeOrderImmediately || amt >= remainingBalance - 0.05;/let finalCustomerId = customerId;\
      if (paymentMethod === '"'CREDIT_TAB'"') {\
        if (!finalCustomerId \&\& customerNameInput.trim()) {\
          const newCust = await api.createCustomer({ name: customerNameInput.trim() });\
          finalCustomerId = newCust.id;\
        }\
      }\
      const isClosing = closeOrderImmediately || amt >= remainingBalance - 0.05;/g' client/src/components/CheckoutModal.tsx

sed -i '' -e 's/closeOrder: isClosing/closeOrder: isClosing,\
        customerId: finalCustomerId || undefined/g' client/src/components/CheckoutModal.tsx

